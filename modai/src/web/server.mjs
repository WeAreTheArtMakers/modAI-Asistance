import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRuntimeContext } from '../core/runtimeContext.mjs'
import { summarizeToolEvent } from '../core/agentProtocol.mjs'
import { createDesktopShortcut } from '../core/desktopShortcuts.mjs'
import { resolveAgentModelRoute } from '../core/agentRouting.mjs'
import { detectInteractionMode, shouldEnableAgentForMode } from '../core/requestMode.mjs'
import { PermissionRequiredError } from '../core/toolAccess.mjs'
import { ConfigStore } from '../services/ConfigStore.mjs'
import { KeychainStore } from '../services/KeychainStore.mjs'
import { PluginStore } from '../services/PluginStore.mjs'
import { getReminderDaemonStatus, syncReminderDaemon } from '../services/reminderDaemon.mjs'
import { SessionStore } from '../services/SessionStore.mjs'
import { SkillStore } from '../services/SkillStore.mjs'
import { applyProviderSecretUpdates, prepareRuntimeConfig } from '../services/providerSecrets.mjs'
import { createDefaultProviderRegistry } from '../core/ProviderRegistry.mjs'
import { inferVisionSupport } from '../providers/messageContent.mjs'
import { safeJson } from '../utils/json.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const staticDir = join(__dirname, 'static')
const configStore = new ConfigStore()
const keychainStore = new KeychainStore()
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
      const config = await loadRuntimeConfig()
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

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/tasks/')) {
      const taskId = decodeURIComponent(url.pathname.slice('/api/tasks/'.length))
      const deleted = await sessionStore.deleteScheduledTask(taskId)
      if (!deleted) {
        return sendJson(response, 404, { error: 'Task not found' })
      }
      return sendJson(response, 200, { ok: true, taskId })
    }

    if (request.method === 'POST' && url.pathname === '/api/skills') {
      const body = await readJson(request)
      const skill = await saveUserSkill(body)
      const config = await loadRuntimeConfig()
      return sendJson(response, 200, { ok: true, skill, state: await buildClientState(config) })
    }

    if (request.method === 'POST' && url.pathname === '/api/settings') {
      const body = await readJson(request)
      const config = await configStore.update(async current => {
        await applySettingsPatch(current, body)
        return current
      })
      await syncReminderDaemon({
        enabled: config.reminders?.daemonEnabled !== false,
        sound: config.reminders?.sound || 'Glass',
        configStore,
        runtimeDir: runtimeProjectDir,
      })
      const runtimeConfig = await prepareRuntimeConfig(config, { configStore, keychainStore })
      return sendJson(response, 200, await buildClientState(runtimeConfig))
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
      const config = await loadRuntimeConfig()
      const body = await readJson(request)
      const sessionId = readSessionId(body.sessionId) ?? sessionStore.createSessionId()
      const existingSession = await sessionStore.loadSession(sessionId)
      const startedAt = readIsoDate(body.startedAt) ?? existingSession?.startedAt ?? new Date().toISOString()
      const inputMessages = Array.isArray(body.messages) && body.messages.length
        ? body.messages
        : [{ role: 'user', content: body.prompt ?? '', createdAt: new Date().toISOString() }]
      const requestedModel = body.model || config.defaultModel
      const interactionMode = detectInteractionMode(inputMessages)
      const providerInsights = await getProviderInsights(config)
      const routedModel = resolveAgentModelRoute({
        config,
        providerInsights,
        requestedModel,
        messages: inputMessages,
        interactionMode,
        assistantProfile: config.assistant?.profile ?? 'general',
        agentRequested: body.agent?.enabled ?? config.agent?.enabled !== false,
      })
      const modelRef = resolveModel(config, routedModel.modelId)
      const runtimeContext = await createRuntimeContext({
        config,
        configStore,
        skillStore,
        pluginStore,
        modelRef,
        platform: process.platform,
      })
      const provider = providerRegistry.create(modelRef.provider, config.providers[modelRef.provider])
      const modelStatus = describeModelAvailability(modelRef.id, config.models[modelRef.id] ?? modelRef, providerInsights)
      if (!modelStatus.available) {
        throw new Error(modelStatus.availabilityMessage)
      }

      const agentRequested = body.agent?.enabled ?? config.agent?.enabled !== false
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

      let savedTask = null
      if (taskDraft) {
        savedTask = await sessionStore.addScheduledTask({
          sessionId,
          mode: interactionMode,
          ...taskDraft,
        })
      }

      if (interactionMode === 'task' && savedTask) {
        const text = buildTaskSavedMessage(savedTask, config.language?.active)
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
          agentEnabled: false,
          agentMaxSteps: 0,
          startedAt,
          messages: persistedMessages,
        })

        return sendJson(response, 200, {
          text,
          model: modelRef.id,
          route: routedModel.route,
          autoSelectedModel: routedModel.autoSelected,
          sessionId,
          startedAt,
          steps: 0,
          stopReason: 'task-saved',
          events: [],
          permissionRequest: null,
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
            route: routedModel.route,
            autoSelectedModel: routedModel.autoSelected,
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
              route: routedModel.route,
              autoSelectedModel: routedModel.autoSelected,
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
        route: routedModel.route,
        autoSelectedModel: routedModel.autoSelected,
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

    if (request.method === 'GET') {
      const assetPath = resolveStaticAsset(url.pathname)
      if (assetPath) {
        return sendFile(response, assetPath, getStaticContentType(assetPath))
      }
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
  const config = await loadRuntimeConfig()
  await syncReminderDaemon({
    enabled: config.reminders?.daemonEnabled !== false,
    sound: config.reminders?.sound || 'Glass',
    configStore,
    runtimeDir: runtimeProjectDir,
  })
  console.log(`modAI web listening on http://${host}:${port}`)
})

server.on('error', error => {
  console.error('modAI web server error', error)
})

installParentWatch()
installShutdownHooks()

async function loadRuntimeConfig() {
  const config = await configStore.load()
  return prepareRuntimeConfig(config, { configStore, keychainStore })
}

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
  const reminderDaemon = await getReminderDaemonStatus()
  return {
    defaultModel: preferredDefaultModel,
    assistant: {
      profile: config.assistant?.profile ?? 'business-copilot',
    },
    mode: config.mode,
    theme: config.theme,
    reminders: {
      daemonEnabled: config.reminders?.daemonEnabled !== false,
      sound: config.reminders?.sound || 'Glass',
      daemon: reminderDaemon,
    },
    language: config.language ?? { active: 'en' },
    now: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  const hasStoredApiKey = typeof providerConfig.apiKey === 'string' && providerConfig.apiKey.trim().length > 0
  const envApiKey = providerConfig.apiKeyEnv ? (process.env[providerConfig.apiKeyEnv] ?? '').trim() : ''
  const hasCredential = hasStoredApiKey || Boolean(envApiKey)

  return {
    id: alias,
    type: providerConfig.type,
    group: classifyProviderGroup(alias, providerConfig),
    baseUrl: providerConfig.baseUrl,
    apiKeyEnv: providerConfig.apiKeyEnv ?? '',
    secretStorage: providerConfig.apiKeySource ?? (envApiKey ? 'env' : ''),
    hasStoredApiKey,
    hasCredential,
    available,
    availabilityMessage,
    setupHint: buildProviderSetupHint(alias, providerConfig, availabilityMessage),
    discoveredModels: providerInsight?.models ?? [],
  }
}

function classifyProviderGroup(alias, providerConfig) {
  if (providerConfig.type === 'ollama' || alias === 'openaiLocal' || providerConfig.baseUrl?.includes('127.0.0.1')) {
    return 'local'
  }
  return 'cloud'
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
  if (providerConfig.apiKeySource === 'keychain') {
    return 'The API key is stored in macOS Keychain. You can update it from Settings.'
  }

  if (typeof providerConfig.apiKey === 'string' && providerConfig.apiKey.trim()) {
    return 'The API key is saved inside the app. You can update it from Settings.'
  }

  if (providerConfig.apiKeyEnv && availabilityMessage.includes(providerConfig.apiKeyEnv)) {
    return `${providerConfig.apiKeyEnv} is missing. Save the API key below or provide it as an environment variable.`
  }

  if (providerConfig.type === 'ollama') {
    return 'Start `ollama serve` and install a local model with `ollama pull <model>`.'
  }

  if (providerConfig.type === 'openai-compatible') {
    return 'Run an OpenAI-compatible local server such as LM Studio on the configured base URL.'
  }

  if (providerConfig.type === 'anthropic' || providerConfig.type === 'gemini') {
    return `Add the required API key in Settings to enable the ${alias} connection.`
  }

  return 'Check the provider endpoint and credentials.'
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

async function applySettingsPatch(config, patch = {}) {
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

  if (patch.language?.active && ['en', 'tr'].includes(patch.language.active)) {
    config.language.active = patch.language.active
  }

  if (patch.reminders && typeof patch.reminders === 'object') {
    if (typeof patch.reminders.daemonEnabled === 'boolean') {
      config.reminders.daemonEnabled = patch.reminders.daemonEnabled
    }
    if (typeof patch.reminders.sound === 'string' && patch.reminders.sound.trim()) {
      config.reminders.sound = patch.reminders.sound.trim()
    }
  }

  if (patch.providers && typeof patch.providers === 'object') {
    for (const [alias, update] of Object.entries(patch.providers)) {
      if (!config.providers[alias] || !update || typeof update !== 'object') {
        continue
      }

      if (typeof update.baseUrl === 'string' && update.baseUrl.trim()) {
        config.providers[alias].baseUrl = update.baseUrl.trim()
      }
    }

    await applyProviderSecretUpdates(config, patch.providers, { keychainStore })
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
  const delivery = normalizeDeliveryInput(taskDraft.delivery)
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

function buildTaskSavedMessage(task, language = 'en') {
  const isTurkish = language === 'tr'
  const lines = [
    isTurkish ? `Görev kaydedildi: ${task.title}` : `Task saved: ${task.title}`,
  ]

  if (task.goal) {
    lines.push(isTurkish ? `Amaç: ${task.goal}` : `Goal: ${task.goal}`)
  }

  if (task.delivery) {
    lines.push(isTurkish ? `Teslim: ${task.delivery}` : `Due: ${task.delivery}`)
    if (isPastDelivery(task.delivery)) {
      lines.push(isTurkish
        ? 'Not: Bu teslim tarihi geçmiş görünüyor. Tarihi güncellemek istersen görevi yeniden oluştur.'
        : 'Note: this due date appears to be in the past. Create the task again if you want to update it.')
    }
  } else {
    lines.push(isTurkish
      ? 'Teslim: tarih belirtilmedi, görev taslak olarak saklandı.'
      : 'Due: no date provided, saved as a draft task.')
  }

  lines.push(isTurkish
    ? 'Kayıt Planlanmış Görevler bölümüne eklendi. modAI açıkken zamanında uygulama içi bildirim ve kısa bir zil sesi tetikler; macOS bildirimi için tarayıcı/Tauri izni gerekebilir.'
    : 'The task was added to Scheduled Tasks. While modAI is open it can trigger an in-app reminder and a short chime at the due time; macOS notifications require notification permission.')
  return lines.join('\n')
}

function normalizeDeliveryInput(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }

  const relativeMatch = text.match(/\b(bugun|bugün|today|yarin|yarın|tomorrow)\b(?:[^\d]*(\d{1,2})(?::|\.)(\d{2}))?/i)
  if (!relativeMatch) {
    return text
  }

  const date = new Date()
  const label = relativeMatch[1].toLowerCase()
  if (label === 'yarin' || label === 'yarın' || label === 'tomorrow') {
    date.setDate(date.getDate() + 1)
  }

  const hour = Number(relativeMatch[2] ?? 9)
  const minute = Number(relativeMatch[3] ?? 0)
  date.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0)
  return formatLocalDateTime(date)
}

async function saveUserSkill(body = {}) {
  const id = sanitizeSkillId(body.id || body.name || 'custom-skill')
  const title = sanitizeSkillTitle(body.name || id)
  const description = String(body.description ?? '').trim()
  const content = String(body.content ?? '').trim()
  if (!content && !description) {
    throw new Error('Skill content is required')
  }

  await configStore.ensureLayout()
  const skillsDir = join(configStore.getBaseDir(), 'skills', id)
  await mkdir(skillsDir, { recursive: true })
  const skillPath = join(skillsDir, 'SKILL.md')
  await writeFile(skillPath, [
    `# ${title}`,
    '',
    description || 'User-installed modAI skill.',
    '',
    content || 'Use this skill when the user explicitly selects it.',
    '',
  ].join('\n'), 'utf8')

  return { id, name: title, path: skillPath }
}

function sanitizeSkillId(value) {
  const normalized = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || `skill-${Date.now()}`
}

function sanitizeSkillTitle(value) {
  return String(value ?? 'Custom Skill').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Custom Skill'
}

function isPastDelivery(value) {
  const parsed = parseDeliveryDate(value)
  return Boolean(parsed && parsed.getTime() < Date.now())
}

function parseDeliveryDate(value) {
  const normalized = String(value ?? '').trim().replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatLocalDateTime(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
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

function resolveStaticAsset(pathname) {
  const requested = decodeURIComponent(pathname || '/')
  const relativePath = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '')
  const target = resolve(staticDir, relativePath)
  if (!target.startsWith(`${staticDir}/`) && target !== resolve(staticDir, 'index.html')) {
    return null
  }

  const extension = extname(target).toLowerCase()
  if (!['.html', '.js', '.css', '.svg', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extension)) {
    return null
  }

  return target
}

function getStaticContentType(filePath) {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.html') {
    return 'text/html; charset=utf-8'
  }
  if (extension === '.js') {
    return 'text/javascript; charset=utf-8'
  }
  if (extension === '.css') {
    return 'text/css; charset=utf-8'
  }
  if (extension === '.svg') {
    return 'image/svg+xml; charset=utf-8'
  }
  if (extension === '.json') {
    return 'application/json; charset=utf-8'
  }
  return detectUploadContentType(filePath)
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
