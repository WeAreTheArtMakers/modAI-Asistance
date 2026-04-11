import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRuntimeContext } from '../core/runtimeContext.mjs'
import { summarizeToolEvent } from '../core/agentProtocol.mjs'
import { createDesktopShortcut } from '../core/desktopShortcuts.mjs'
import { detectInteractionMode, shouldEnableAgentForMode } from '../core/requestMode.mjs'
import { PermissionRequiredError } from '../core/toolAccess.mjs'
import { ConfigStore } from '../services/ConfigStore.mjs'
import { PluginStore } from '../services/PluginStore.mjs'
import { SessionStore } from '../services/SessionStore.mjs'
import { SkillStore } from '../services/SkillStore.mjs'
import { createDefaultProviderRegistry } from '../core/ProviderRegistry.mjs'
import { inferVisionSupport } from '../providers/messageContent.mjs'
import { safeJson } from '../utils/json.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const staticDir = join(__dirname, 'static')
const configStore = new ConfigStore()
const sessionStore = new SessionStore(configStore)
const providerRegistry = createDefaultProviderRegistry()

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index]
  if (token.startsWith('--')) {
    const [key, value] = token.slice(2).split('=')
    args.set(key, value ?? process.argv[index + 1] ?? '')
  }
}

const port = Number(args.get('port') || process.env.PORT || process.env.MODAI_WEB_PORT || 8787)
const host = process.env.MODAI_WEB_HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1')
const parentPid = Number(process.env.MODAI_PARENT_PID || 0)
const workspaceDir = process.env.MODAI_WORKSPACE_DIR || process.cwd()
const runtimeProjectDir = process.env.MODAI_RUNTIME_DIR || process.cwd()
const skillStore = new SkillStore(configStore, { cwd: runtimeProjectDir })
const pluginStore = new PluginStore(configStore, { cwd: runtimeProjectDir })

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${host}:${port}`)

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { ok: true })
    }

    if (request.method === 'GET' && (url.pathname === '/api/config' || url.pathname === '/api/settings')) {
      const config = await configStore.load()
      return sendJson(response, 200, await buildClientState(config))
    }

    if (request.method === 'GET' && url.pathname === '/api/sessions') {
      const [sessions, notes, tasks] = await Promise.all([
        sessionStore.listRecent(10),
        sessionStore.listNotes(12),
        sessionStore.listScheduledTasks(12),
      ])
      return sendJson(response, 200, { sessions, notes, tasks })
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/sessions/')) {
      const sessionId = decodeURIComponent(url.pathname.slice('/api/sessions/'.length))
      const session = await sessionStore.loadSession(sessionId)
      if (!session) {
        return sendJson(response, 404, { error: 'Session not found' })
      }
      return sendJson(response, 200, session)
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/sessions/')) {
      const sessionId = decodeURIComponent(url.pathname.slice('/api/sessions/'.length))
      const deleted = await sessionStore.deleteSession(sessionId)
      if (!deleted) {
        return sendJson(response, 404, { error: 'Session not found' })
      }
      return sendJson(response, 200, { ok: true, sessionId })
    }

    if (request.method === 'POST' && url.pathname === '/api/settings') {
      const body = await readJson(request)
      const config = await configStore.update(current => {
        applySettingsPatch(current, body)
        return current
      })
      return sendJson(response, 200, await buildClientState(config))
    }

    if (request.method === 'POST' && url.pathname === '/api/uploads') {
      const body = await readJson(request)
      const uploaded = await saveUpload(body)
      return sendJson(response, 200, uploaded)
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/uploads/')) {
      const uploadId = basename(decodeURIComponent(url.pathname.slice('/api/uploads/'.length)))
      const target = join(configStore.getBaseDir(), 'uploads', uploadId)
      return sendFile(response, target, detectUploadContentType(uploadId))
    }

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const config = await configStore.load()
      const body = await readJson(request)
      const sessionId = readSessionId(body.sessionId) ?? sessionStore.createSessionId()
      const existingSession = await sessionStore.loadSession(sessionId)
      const startedAt = readIsoDate(body.startedAt) ?? existingSession?.startedAt ?? new Date().toISOString()
      const inputMessages = Array.isArray(body.messages) && body.messages.length
        ? body.messages
        : [{ role: 'user', content: body.prompt ?? '', createdAt: new Date().toISOString() }]
      const requestedModel = body.model || config.defaultModel
      const modelRef = resolveModel(config, requestedModel)
      const runtimeContext = await createRuntimeContext({
        config,
        configStore,
        skillStore,
        pluginStore,
        modelRef,
        platform: process.platform,
      })
      const provider = providerRegistry.create(modelRef.provider, config.providers[modelRef.provider])
      const providerInsights = await getProviderInsights(config)
      const modelStatus = describeModelAvailability(modelRef.id, config.models[modelRef.id] ?? modelRef, providerInsights)
      if (!modelStatus.available) {
        throw new Error(modelStatus.availabilityMessage)
      }

      const agentRequested = body.agent?.enabled ?? config.agent?.enabled !== false
      const interactionMode = detectInteractionMode(inputMessages)
      const taskDraft = normalizeTaskDraft(body.taskDraft, interactionMode)
      const agent = {
        enabled: shouldEnableAgentForMode(agentRequested, interactionMode),
        maxSteps: body.agent?.maxSteps ?? config.agent?.maxSteps ?? 6,
      }
      const requestContext = {
        config,
        configStore,
        sessionStore,
        sessionId,
        workspaceDir,
        provider,
        modelRef,
        requestMode: interactionMode,
        runtime: {
          ...runtimeContext.runtime,
          permissions: {
            ...runtimeContext.runtime.permissions,
            ...normalizeApprovalPermissions(body.approvals),
          },
        },
        requestId: request.headers['x-request-id'] || '',
      }

      if (taskDraft) {
        await sessionStore.addScheduledTask({
          sessionId,
          mode: interactionMode,
          ...taskDraft,
        })
      }

      const directDesktopAction = interactionMode === 'desktop'
        ? createDesktopShortcut(inputMessages.at(-1)?.content ?? '')
        : null

      if (directDesktopAction) {
        try {
          const output = await runtimeContext.toolRegistry.run(
            directDesktopAction.toolName,
            directDesktopAction.input,
            requestContext,
          )

          const directEvents = [
            {
              type: 'tool-call',
              step: 1,
              toolName: directDesktopAction.toolName,
              input: directDesktopAction.input,
            },
            {
              type: 'tool-result',
              step: 1,
              toolName: directDesktopAction.toolName,
              input: directDesktopAction.input,
              status: 'ok',
              output,
            },
          ]

          const text = directDesktopAction.successMessage
          const persistedMessages = [
            ...inputMessages,
            {
              role: 'assistant',
              content: text,
              createdAt: new Date().toISOString(),
            },
          ]

          await sessionStore.save({
            sessionId,
            modelId: modelRef.id,
            agentEnabled: true,
            agentMaxSteps: 1,
            startedAt,
            messages: persistedMessages,
          })

          return sendJson(response, 200, {
            text,
            model: modelRef.id,
            sessionId,
            startedAt,
            steps: 1,
            stopReason: 'shortcut',
            events: directEvents,
            permissionRequest: null,
          })
        } catch (error) {
          if (error instanceof PermissionRequiredError) {
            return sendJson(response, 200, {
              text: error.message,
              model: modelRef.id,
              sessionId,
              startedAt,
              steps: 1,
              stopReason: 'permission-required',
              events: [{
                type: 'permission-required',
                step: 1,
                toolName: directDesktopAction.toolName,
                permissionKey: error.permissionKey,
                input: directDesktopAction.input,
                message: error.message,
              }],
              permissionRequest: {
                toolName: directDesktopAction.toolName,
                permissionKey: error.permissionKey,
                input: directDesktopAction.input,
                message: error.message,
              },
            })
          }
          throw error
        }
      }

      const result = await runtimeContext.agentRunner.run({
        provider,
        model: modelRef.model,
        systemPrompt: runtimeContext.systemPrompt,
        messages: inputMessages,
        agent,
        context: requestContext,
        onEvent: event => {
          console.log(summarizeToolEvent(event))
        },
      })

      const persistedMessages = result.stopReason === 'permission-required'
        ? inputMessages
        : [
            ...inputMessages,
            {
              role: 'assistant',
              content: result.text,
              createdAt: new Date().toISOString(),
            },
          ]

      await sessionStore.save({
        sessionId,
        modelId: modelRef.id,
        agentEnabled: agent.enabled,
        agentMaxSteps: agent.maxSteps,
        startedAt,
        messages: persistedMessages,
      })

      return sendJson(response, 200, {
        text: result.text,
        model: modelRef.id,
        sessionId,
        startedAt,
        steps: result.steps,
        stopReason: result.stopReason,
        events: result.events,
        permissionRequest: result.permissionRequest ?? null,
      })
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return sendFile(response, join(staticDir, 'index.html'), 'text/html; charset=utf-8')
    }

    if (request.method === 'GET' && url.pathname === '/app.js') {
      return sendFile(response, join(staticDir, 'app.js'), 'text/javascript; charset=utf-8')
    }

    if (request.method === 'GET' && url.pathname === '/styles.css') {
      return sendFile(response, join(staticDir, 'styles.css'), 'text/css; charset=utf-8')
    }

    if (request.method === 'GET' && url.pathname === '/brand-mark.svg') {
      return sendFile(response, join(staticDir, 'brand-mark.svg'), 'image/svg+xml; charset=utf-8')
    }

    sendJson(response, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendJson(response, 500, { error: message })
  }
})

server.listen(port, host, async () => {
  const runtimeDir = configStore.getBaseDir()
  await mkdir(runtimeDir, { recursive: true })
  await writeFile(join(runtimeDir, 'web-runtime.json'), safeJson({
    host,
    port,
    startedAt: new Date().toISOString(),
    pid: process.pid,
  }), 'utf8')
  console.log(`modAI web listening on http://${host}:${port}`)
})

server.on('error', error => {
  console.error('modAI web server error', error)
})

installParentWatch()
installShutdownHooks()

async function buildClientState(config) {
  const providerInsights = await getProviderInsights(config)
  const models = Object.entries(config.models).map(([id, value]) => ({
    id,
    label: value.label ?? id,
    target: `${value.provider}:${value.model}`,
    capabilities: value.capabilities ?? {},
    ...describeModelAvailability(id, value, providerInsights),
  }))
  models.push(...buildDiscoveredModels(config, providerInsights, models))
  const preferredDefaultModel = models.find(model => model.id === config.defaultModel && model.available)?.id
    ?? models.find(model => model.available)?.id
    ?? config.defaultModel
  const selectedModel = resolveModel(config, preferredDefaultModel)
  const runtimeContext = await createRuntimeContext({
    config,
    configStore,
    skillStore,
    pluginStore,
    modelRef: selectedModel,
    platform: process.platform,
  })
  const [sessions, notes, tasks] = await Promise.all([
    sessionStore.listRecent(8),
    sessionStore.listNotes(10),
    sessionStore.listScheduledTasks(10),
  ])
  return {
    defaultModel: preferredDefaultModel,
    assistant: {
      profile: config.assistant?.profile ?? 'business-copilot',
    },
    mode: config.mode,
    theme: config.theme,
    agent: {
      enabled: config.agent?.enabled !== false,
      maxSteps: config.agent?.maxSteps ?? 6,
    },
    composerTemplates: config.composerTemplates,
    permissions: config.permissions,
    providers: Object.entries(config.providers).map(([alias, providerConfig]) => (
      buildProviderState(alias, providerConfig, providerInsights)
    )),
    skills: runtimeContext.skills.map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      source: skill.source,
      active: runtimeContext.activeSkills.some(item => item.id === skill.id),
    })),
    plugins: runtimeContext.plugins.map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      source: plugin.source,
      active: runtimeContext.activePlugins.some(item => item.id === plugin.id),
      tools: Array.isArray(plugin.tools) ? plugin.tools.map(tool => ({
        name: tool.name,
        type: tool.type,
        description: tool.description ?? '',
      })) : [],
    })),
    tools: runtimeContext.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputHint: tool.inputHint ?? '',
      requiredMode: tool.requiredMode ?? 'ultra',
      permissionKey: tool.permissionKey ?? tool.name,
    })),
    models,
    sessions,
    notes,
    tasks,
    workspaceDir,
  }
}

function buildProviderState(alias, providerConfig, providerInsights) {
  const providerInsight = providerInsights.get(alias)
  const available = providerInsight?.health?.ok ?? false
  const availabilityMessage = providerInsight?.health?.message ?? 'provider unavailable'

  return {
    id: alias,
    type: providerConfig.type,
    baseUrl: providerConfig.baseUrl,
    apiKeyEnv: providerConfig.apiKeyEnv ?? '',
    available,
    availabilityMessage,
    setupHint: buildProviderSetupHint(alias, providerConfig, availabilityMessage),
    discoveredModels: providerInsight?.models ?? [],
  }
}

async function getProviderInsights(config) {
  const statuses = await Promise.all(
    Object.entries(config.providers).map(async ([alias, providerConfig]) => {
      const provider = providerRegistry.create(alias, providerConfig)
      const health = await safeHealthcheck(provider)
      const models = health.ok && typeof provider.listModels === 'function'
        ? await safeListModels(provider)
        : []
      return [alias, { health, models }]
    }),
  )

  return new Map(statuses)
}

async function safeListModels(provider) {
  try {
    const models = await provider.listModels()
    return Array.isArray(models) ? models : []
  } catch {
    return []
  }
}

function describeModelAvailability(modelId, modelDefinition, providerInsights) {
  const providerInsight = providerInsights.get(modelDefinition.provider)
  if (!providerInsight) {
    return {
      available: false,
      availabilityMessage: 'provider unavailable',
    }
  }

  if (!providerInsight.health.ok) {
    return {
      available: false,
      availabilityMessage: providerInsight.health.message,
    }
  }

  if (providerInsight.models.length > 0 && !providerInsight.models.includes(modelDefinition.model)) {
    return {
      available: false,
      availabilityMessage: `model '${modelDefinition.model}' not installed or not exposed by ${modelDefinition.provider}`,
    }
  }

  return {
    available: true,
    availabilityMessage: providerInsight.health.message,
  }
}

function buildDiscoveredModels(config, providerInsights, existingModels) {
  const existingIds = new Set(existingModels.map(model => model.id))
  const discovered = []

  for (const [alias, insight] of providerInsights.entries()) {
    if (!insight.health.ok || insight.models.length === 0) {
      continue
    }

    for (const modelName of insight.models) {
      const id = `${alias}:${modelName}`
      if (existingIds.has(id)) {
        continue
      }
      existingIds.add(id)
      discovered.push({
        id,
        label: `${modelName} (discovered)`,
        target: id,
        capabilities: {
          imageGeneration: false,
          vision: alias === 'ollama' ? inferVisionSupport(modelName) : false,
        },
        available: true,
        availabilityMessage: insight.health.message,
      })
    }
  }

  return discovered
}

function buildProviderSetupHint(alias, providerConfig, availabilityMessage) {
  if (providerConfig.apiKeyEnv && availabilityMessage.includes(providerConfig.apiKeyEnv)) {
    return `Launch modAI after exporting ${providerConfig.apiKeyEnv} for the app process.`
  }

  if (providerConfig.type === 'ollama') {
    return 'Start `ollama serve` and install a local model with `ollama pull <model>`.'
  }

  if (providerConfig.type === 'openai-compatible') {
    return 'Run an OpenAI-compatible local server such as LM Studio on the configured base URL.'
  }

  if (providerConfig.type === 'anthropic' || providerConfig.type === 'gemini') {
    return `Set the required API key and relaunch modAI to enable ${alias}.`
  }

  return 'Verify the provider endpoint and credentials, then relaunch modAI.'
}

async function safeHealthcheck(provider) {
  try {
    return await provider.healthcheck()
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function applySettingsPatch(config, patch = {}) {
  if (typeof patch.defaultModel === 'string') {
    try {
      resolveModel(config, patch.defaultModel)
      config.defaultModel = patch.defaultModel
    } catch {
      // Ignore invalid ad-hoc model references
    }
  }

  if (patch.mode?.active && ['ultra', 'pro'].includes(patch.mode.active)) {
    config.mode.active = patch.mode.active
  }

  if (patch.assistant?.profile && ['general', 'business-copilot'].includes(patch.assistant.profile)) {
    config.assistant.profile = patch.assistant.profile
  }

  if (patch.theme?.active && ['auto', 'light', 'dark'].includes(patch.theme.active)) {
    config.theme.active = patch.theme.active
  }

  if (patch.agent && typeof patch.agent === 'object') {
    if (typeof patch.agent.enabled === 'boolean') {
      config.agent.enabled = patch.agent.enabled
    }
    if (Number.isFinite(Number(patch.agent.maxSteps))) {
      config.agent.maxSteps = Math.max(1, Math.min(12, Math.round(Number(patch.agent.maxSteps))))
    }
  }

  if (patch.composerTemplates && typeof patch.composerTemplates === 'object') {
    if (typeof patch.composerTemplates.enabled === 'boolean') {
      config.composerTemplates.enabled = patch.composerTemplates.enabled
    }
    if (typeof patch.composerTemplates.autoTaskTemplate === 'boolean') {
      config.composerTemplates.autoTaskTemplate = patch.composerTemplates.autoTaskTemplate
    }
    if (typeof patch.composerTemplates.autoDesktopTemplate === 'boolean') {
      config.composerTemplates.autoDesktopTemplate = patch.composerTemplates.autoDesktopTemplate
    }
    if (typeof patch.composerTemplates.taskTemplate === 'string') {
      config.composerTemplates.taskTemplate = patch.composerTemplates.taskTemplate
    }
    if (typeof patch.composerTemplates.desktopTemplate === 'string') {
      config.composerTemplates.desktopTemplate = patch.composerTemplates.desktopTemplate
    }
  }

  if (patch.permissions?.tools && typeof patch.permissions.tools === 'object') {
    for (const [toolName, permission] of Object.entries(patch.permissions.tools)) {
      if (['allow', 'ask', 'deny'].includes(permission)) {
        config.permissions.tools[toolName] = permission
      }
    }
  }

  if (patch.skills && typeof patch.skills === 'object') {
    if (typeof patch.skills.userEnabled === 'boolean') {
      config.skills.userEnabled = patch.skills.userEnabled
    }
    if (typeof patch.skills.projectEnabled === 'boolean') {
      config.skills.projectEnabled = patch.skills.projectEnabled
    }
    if (Array.isArray(patch.skills.active)) {
      config.skills.active = patch.skills.active.filter(item => typeof item === 'string')
    }
  }

  if (patch.plugins && typeof patch.plugins === 'object') {
    if (typeof patch.plugins.userEnabled === 'boolean') {
      config.plugins.userEnabled = patch.plugins.userEnabled
    }
    if (typeof patch.plugins.projectEnabled === 'boolean') {
      config.plugins.projectEnabled = patch.plugins.projectEnabled
    }
    if (Array.isArray(patch.plugins.active)) {
      config.plugins.active = patch.plugins.active.filter(item => typeof item === 'string')
    }
  }
}

function normalizeApprovalPermissions(approvals) {
  if (!approvals || typeof approvals !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(approvals).filter(([, value]) => value === 'allow'),
  )
}

function resolveModel(config, reference) {
  if (config.models[reference]) {
    const definition = config.models[reference]
    return {
      id: reference,
      provider: definition.provider,
      model: definition.model,
      capabilities: definition.capabilities ?? {},
    }
  }

  const separatorIndex = reference.indexOf(':')
  if (separatorIndex === -1) {
    throw new Error(`Unknown model reference: ${reference}`)
  }

  const provider = reference.slice(0, separatorIndex)
  const model = reference.slice(separatorIndex + 1)
  if (!config.providers[provider]) {
    throw new Error(`Unknown provider alias: ${provider}`)
  }

  return { id: reference, provider, model, capabilities: {} }
}

function normalizeTaskDraft(taskDraft, interactionMode) {
  if (interactionMode !== 'task' || !taskDraft || typeof taskDraft !== 'object') {
    return null
  }

  const title = String(taskDraft.title ?? '').trim()
  const goal = String(taskDraft.goal ?? '').trim()
  const constraints = String(taskDraft.constraints ?? '').trim()
  const delivery = String(taskDraft.delivery ?? '').trim()
  const body = String(taskDraft.body ?? '').trim()
  if (!title && !goal && !delivery) {
    return null
  }

  return {
    title: title || goal || 'Planlanmis gorev',
    goal,
    constraints,
    delivery,
    completion: String(taskDraft.completion ?? '').trim(),
    body,
    status: delivery ? 'scheduled' : 'draft',
    source: 'user',
  }
}

async function saveUpload(body = {}) {
  const upload = parseUploadPayload(body)
  await configStore.ensureLayout()
  const uploadsDir = join(configStore.getBaseDir(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })

  const stem = sanitizeFileStem(upload.name)
  const extension = extname(upload.name) || guessFileExtension(upload.type)
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${stem}${extension}`
  const targetPath = join(uploadsDir, filename)
  await writeFile(targetPath, upload.buffer)

  return {
    id: filename,
    name: basename(upload.name),
    path: targetPath,
    url: `/api/uploads/${encodeURIComponent(filename)}`,
    type: upload.type,
    size: upload.buffer.length,
  }
}

function parseUploadPayload(body = {}) {
  const name = String(body.name ?? 'attachment').trim() || 'attachment'
  const requestedType = String(body.type ?? '').trim()
  const dataUrl = String(body.dataUrl ?? '').trim()
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error('Invalid upload payload')
  }

  return {
    name,
    type: requestedType || match[1] || 'application/octet-stream',
    buffer: Buffer.from(match[2], 'base64'),
  }
}

function sanitizeFileStem(name) {
  const stem = basename(name, extname(name))
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return stem || 'attachment'
}

function guessFileExtension(type) {
  if (type === 'image/png') {
    return '.png'
  }
  if (type === 'image/jpeg') {
    return '.jpg'
  }
  if (type === 'image/webp') {
    return '.webp'
  }
  if (type === 'image/gif') {
    return '.gif'
  }
  return '.bin'
}

function detectUploadContentType(fileName) {
  const extension = extname(fileName).toLowerCase()
  if (extension === '.png') {
    return 'image/png'
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg'
  }
  if (extension === '.webp') {
    return 'image/webp'
  }
  if (extension === '.gif') {
    return 'image/gif'
  }
  return 'application/octet-stream'
}

function readSessionId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readIsoDate(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

async function sendFile(response, filePath, contentType) {
  const content = await readFile(filePath)
  response.writeHead(200, { 'content-type': contentType })
  response.end(content)
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  response.end(safeJson(payload))
}

function installParentWatch() {
  if (!Number.isInteger(parentPid) || parentPid <= 1) {
    return
  }

  const interval = setInterval(() => {
    try {
      process.kill(parentPid, 0)
    } catch {
      void shutdown('parent-exited')
    }
  }, 2000)

  interval.unref?.()
}

function installShutdownHooks() {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP']
  for (const signal of signals) {
    process.on(signal, () => {
      void shutdown(signal)
    })
  }
}

let shuttingDown = false

async function shutdown(reason) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.log(`modAI web shutting down: ${reason}`)
  await new Promise(resolvePromise => {
    server.close(() => resolvePromise())
  })
  process.exit(0)
}
