import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { createRuntimeContext } from '../core/runtimeContext.mjs'
import { summarizeToolEvent } from '../core/agentProtocol.mjs'
import { createDesktopShortcut } from '../core/desktopShortcuts.mjs'
import { resolveAgentModelRoute } from '../core/agentRouting.mjs'
import { detectInteractionMode, shouldEnableAgentForMode } from '../core/requestMode.mjs'
import { PermissionRequiredError } from '../core/toolAccess.mjs'
import { ConfigStore } from '../services/ConfigStore.mjs'
import { BillingStore, buildBillingClientState } from '../services/BillingStore.mjs'
import { KeychainStore } from '../services/KeychainStore.mjs'
import { completeMcpOAuthCallback, startMcpOAuthFlow } from '../services/mcpOAuth.mjs'
import { inspectMcpServer } from '../services/mcpRuntime.mjs'
import { PluginStore } from '../services/PluginStore.mjs'
import { getReminderDaemonStatus, syncReminderDaemon } from '../services/reminderDaemon.mjs'
import { SessionStore } from '../services/SessionStore.mjs'
import { SkillStore } from '../services/SkillStore.mjs'
import {
  activateLemonLicense,
  createDirectCryptoInvoice,
  extractLemonWebhookRecord,
  extractNowPaymentsWebhookRecord,
  getBillingCatalog,
  getBillingEnvironment,
  getCardCheckoutUrl,
  isSuccessfulCryptoStatus,
  resolveBillingPlan,
  verifyDirectCryptoTransfer,
  verifyLemonWebhookSignature,
  verifyNowPaymentsWebhookSignature,
} from '../services/billingGateway.mjs'
import { applyMcpSecretUpdates, applyProviderSecretUpdates, prepareRuntimeConfig } from '../services/providerSecrets.mjs'
import { createDefaultProviderRegistry } from '../core/ProviderRegistry.mjs'
import { inferVisionSupport } from '../providers/messageContent.mjs'
import { safeJson } from '../utils/json.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const staticDir = join(__dirname, 'static')
const configStore = new ConfigStore()
const keychainStore = new KeychainStore()
const sessionStore = new SessionStore(configStore)
const billingStore = new BillingStore(configStore)
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
const workspaceDirOverride = process.env.MODAI_WORKSPACE_DIR || ''
let workspaceDir = resolve(workspaceDirOverride || process.env.HOME || homedir() || process.cwd())
const runtimeProjectDir = process.env.MODAI_RUNTIME_DIR || process.cwd()
const skillStore = new SkillStore(configStore, { cwd: runtimeProjectDir })
const pluginStore = new PluginStore(configStore, { cwd: runtimeProjectDir })
const execFile = promisify(execFileCallback)

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

    if (request.method === 'GET' && url.pathname === '/api/billing') {
      return sendJson(response, 200, await billingStore.getClientState({
        catalog: getBillingCatalog(),
        environment: getBillingEnvironment(),
      }))
    }

    if (request.method === 'GET' && url.pathname === '/api/workspace/outline') {
      return sendJson(response, 200, await buildWorkspaceOutlineResponse(workspaceDir))
    }

    if (request.method === 'POST' && url.pathname === '/api/workspace/root') {
      const body = await readJson(request)
      try {
        const nextRoot = await validateWorkspaceRoot(body.path)
        const config = await configStore.update(current => {
          current.workspace = {
            ...(current.workspace ?? {}),
            rootDir: nextRoot,
          }
          return current
        })
        workspaceDir = resolveConfiguredWorkspaceDir(config)
        return sendJson(response, 200, {
          ok: true,
          workspaceDir,
          outline: await buildWorkspaceOutlineResponse(workspaceDir),
        })
      } catch (rootError) {
        const message = rootError instanceof Error ? rootError.message : String(rootError)
        return sendJson(response, 400, { error: message })
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/workspace/file') {
      const relativePath = url.searchParams.get('path') ?? ''
      try {
        return sendJson(response, 200, await readWorkspaceFile(relativePath))
      } catch (fileError) {
        const message = fileError instanceof Error ? fileError.message : String(fileError)
        return sendJson(response, 400, { error: message })
      }
    }

    if (request.method === 'PUT' && url.pathname === '/api/workspace/file') {
      const body = await readJson(request)
      try {
        return sendJson(response, 200, await writeWorkspaceFile(body))
      } catch (fileError) {
        const message = fileError instanceof Error ? fileError.message : String(fileError)
        return sendJson(response, 400, { error: message })
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/mcp/test') {
      const body = await readJson(request)
      const config = await loadRuntimeConfig()
      const serverPatch = normalizeMcpServerPatch(body.server ?? {})
      if (!serverPatch) {
        return sendJson(response, 400, { error: 'Invalid MCP server payload' })
      }

      const savedServer = (config.mcp?.servers ?? []).find(server => server.id === serverPatch.id)
      const effectiveServer = savedServer
        ? {
            ...savedServer,
            ...serverPatch,
            authToken: serverPatch.authToken || savedServer.authToken || '',
            authTokenSource: serverPatch.authToken ? 'config' : (savedServer.authTokenSource ?? serverPatch.authTokenSource ?? ''),
          }
        : serverPatch

      const diagnostic = await inspectMcpServer(effectiveServer, {
        workspaceDir,
      })
      const savedServers = config.mcp?.servers ?? []
      const nextServers = savedServers.some(server => server.id === serverPatch.id)
        ? savedServers.map(server => (server.id === serverPatch.id ? {
            ...server,
            ...serverPatch,
            authToken: serverPatch.authToken || server.authToken || '',
            authTokenSource: serverPatch.authToken ? 'config' : server.authTokenSource || '',
          } : server))
        : [...savedServers, serverPatch]

      return sendJson(response, 200, {
        ok: diagnostic.ok,
        diagnostic,
        mcp: {
          diagnostics: mergeMcpDiagnostics(config.mcp?.diagnostics ?? [], diagnostic),
          servers: nextServers.map(server => serializeMcpServerForClient(server)),
        },
      })
    }

    if (request.method === 'POST' && url.pathname === '/api/mcp/oauth/start') {
      const body = await readJson(request)
      const config = await loadRuntimeConfig()
      const serverPatch = normalizeMcpServerPatch(body.server ?? {})
      if (!serverPatch) {
        return sendJson(response, 400, { error: 'Invalid MCP server payload' })
      }

      const savedServer = (config.mcp?.servers ?? []).find(server => server.id === serverPatch.id)
      const effectiveServer = savedServer
        ? {
            ...savedServer,
            ...serverPatch,
            authType: 'oauth',
          }
        : {
            ...serverPatch,
            authType: 'oauth',
          }
      const flow = await startMcpOAuthFlow({
        server: effectiveServer,
        port,
        configStore,
      })
      return sendJson(response, 200, flow)
    }

    if (request.method === 'GET' && url.pathname === '/api/mcp/oauth/callback') {
      try {
        const result = await completeMcpOAuthCallback({
          state: url.searchParams.get('state') ?? '',
          code: url.searchParams.get('code') ?? '',
          error: url.searchParams.get('error') ?? '',
          configStore,
          keychainStore,
        })
        return sendHtml(response, 200, buildMcpOAuthResultPage(result))
      } catch (oauthError) {
        const message = oauthError instanceof Error ? oauthError.message : String(oauthError)
        return sendHtml(response, 400, buildMcpOAuthResultPage({ ok: false, error: message }))
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/billing/trial/start') {
      const body = await readJson(request)
      const nextState = await billingStore.startTrial({
        trialDays: getBillingCatalog().trialDays,
        deviceName: String(body.deviceName ?? '').trim(),
      })
      return sendJson(response, 200, buildBillingResponse(nextState))
    }

    if (request.method === 'POST' && url.pathname === '/api/billing/activate') {
      const body = await readJson(request)
      const licenseKey = String(body.licenseKey ?? '').trim()
      const email = String(body.email ?? '').trim()
      const deviceName = String(body.deviceName ?? '').trim()

      let nextState
      try {
        nextState = await billingStore.activateStoredLicense({
          licenseKey,
          email,
          deviceName,
        })
      } catch (localError) {
        try {
          const result = await activateLemonLicense({
            licenseKey,
            deviceName,
          })
          nextState = await billingStore.saveRemoteActivation({
            source: result.source,
            provider: 'lemon-squeezy',
            licenseKey: result.licenseKey,
            email: result.email,
            planLabel: result.planLabel || result.productName,
            activationLimit: result.activationLimit,
            instanceId: result.instanceId,
            expiresAt: result.expiresAt,
            deviceName: result.instanceName || deviceName,
            orderId: result.orderId,
            metadata: result.raw,
          })
        } catch (remoteError) {
          throw remoteError instanceof Error ? remoteError : localError
        }
      }

      return sendJson(response, 200, buildBillingResponse(nextState))
    }

    if (request.method === 'POST' && url.pathname === '/api/billing/checkout/card') {
      const body = await readJson(request)
      const planId = String(body.planId ?? '').trim()
      const checkoutUrl = getCardCheckoutUrl(planId)
      if (!checkoutUrl) {
        return sendJson(response, 400, { error: 'Card checkout is not configured for this plan' })
      }
      return sendJson(response, 200, {
        ok: true,
        planId,
        url: checkoutUrl,
      })
    }

    if (request.method === 'POST' && url.pathname === '/api/billing/checkout/crypto') {
      const body = await readJson(request)
      const plan = resolveBillingPlan(String(body.planId ?? '').trim())
      const payment = await createDirectCryptoInvoice({
        plan,
        networkId: String(body.networkId ?? '').trim(),
        assetId: String(body.assetId ?? '').trim(),
        email: String(body.email ?? '').trim(),
        deviceName: String(body.deviceName ?? '').trim(),
        payerAddress: String(body.payerAddress ?? '').trim(),
      })

      const nextState = await billingStore.createPayment({
        ...payment,
        planId: plan.id,
        planLabel: plan.label,
      })

      return sendJson(response, 200, buildBillingResponse(nextState))
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/billing/payments/') && url.pathname.endsWith('/refresh')) {
      const providerPaymentId = decodeURIComponent(url.pathname.slice('/api/billing/payments/'.length, -'/refresh'.length))
      const currentState = await billingStore.load()
      const payment = currentState.payments.find(item => item.providerPaymentId === providerPaymentId)
      if (!payment) {
        return sendJson(response, 404, { error: 'Payment not found' })
      }

      return sendJson(response, 200, buildBillingResponse(currentState))
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/billing/payments/') && url.pathname.endsWith('/verify-transfer')) {
      const providerPaymentId = decodeURIComponent(url.pathname.slice('/api/billing/payments/'.length, -'/verify-transfer'.length))
      const currentState = await billingStore.load()
      const payment = currentState.payments.find(item => item.providerPaymentId === providerPaymentId)
      if (!payment) {
        return sendJson(response, 404, { error: 'Payment not found' })
      }

      const body = await readJson(request)
      const verification = await verifyDirectCryptoTransfer(payment, {
        txHash: String(body.txHash ?? '').trim(),
        payerAddress: String(body.payerAddress ?? '').trim(),
      })
      const plan = resolveBillingPlan(payment.planId)
      const nextState = await billingStore.updatePaymentStatus(providerPaymentId, verification, {
        issueLicense: isSuccessfulCryptoStatus(verification.paymentStatus),
        source: 'crypto',
        activationLimit: plan.activationLimit,
      })
      return sendJson(response, 200, buildBillingResponse(nextState))
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/billing/payments/') && url.pathname.endsWith('/simulate-finish')) {
      const providerPaymentId = decodeURIComponent(url.pathname.slice('/api/billing/payments/'.length, -'/simulate-finish'.length))
      const currentState = await billingStore.load()
      const payment = currentState.payments.find(item => item.providerPaymentId === providerPaymentId)
      if (!payment) {
        return sendJson(response, 404, { error: 'Payment not found' })
      }
      const plan = resolveBillingPlan(payment.planId)
      const nextState = await billingStore.updatePaymentStatus(providerPaymentId, {
        paymentStatus: 'finished',
        actuallyPaid: payment.payAmount,
        outcomeAmount: payment.payAmount,
        outcomeCurrency: payment.payCurrency,
      }, {
        issueLicense: true,
        source: 'crypto',
        activationLimit: plan.activationLimit,
      })
      return sendJson(response, 200, buildBillingResponse(nextState))
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/billing/payments/') && url.pathname.endsWith('/claim')) {
      const providerPaymentId = decodeURIComponent(url.pathname.slice('/api/billing/payments/'.length, -'/claim'.length))
      const body = await readJson(request)
      const nextState = await billingStore.claimPaymentLicense({
        providerPaymentId,
        email: String(body.email ?? '').trim(),
        deviceName: String(body.deviceName ?? '').trim(),
      })
      return sendJson(response, 200, buildBillingResponse(nextState))
    }

    if (request.method === 'POST' && url.pathname === '/api/webhooks/lemonsqueezy') {
      const rawBody = await readRequestBody(request)
      const secret = String(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET ?? '').trim()
      const signature = String(request.headers['x-signature'] ?? '')
      if (secret && !verifyLemonWebhookSignature(rawBody, signature, secret)) {
        return sendJson(response, 401, { error: 'Invalid Lemon Squeezy signature' })
      }

      const payload = rawBody ? JSON.parse(rawBody) : {}
      const record = extractLemonWebhookRecord(payload)
      let nextState = await billingStore.recordWebhookEvent({
        provider: record.provider,
        eventName: record.eventName,
        providerObjectId: record.providerObjectId,
        status: record.status,
        payload,
      })

      if (record.licenseKey) {
        nextState = await billingStore.issueLicense({
          source: 'lemon-squeezy',
          provider: 'lemon-squeezy',
          planLabel: [record.productName, record.variantName].filter(Boolean).join(' · '),
          email: record.email,
          activationLimit: record.activationLimit || 1,
          expiresAt: record.expiresAt,
          orderId: record.orderId || record.providerObjectId,
          metadata: payload,
          providedLicenseKey: record.licenseKey,
        })
      }

      return sendJson(response, 200, {
        ok: true,
        billing: buildBillingSnapshot(nextState),
      })
    }

    if (request.method === 'POST' && url.pathname === '/api/webhooks/crypto') {
      const rawBody = await readRequestBody(request)
      const secret = String(process.env.NOWPAYMENTS_IPN_SECRET ?? '').trim()
      const signature = String(request.headers['x-nowpayments-sig'] ?? request.headers['x-signature'] ?? '')
      if (secret && !verifyNowPaymentsWebhookSignature(rawBody, signature, secret)) {
        return sendJson(response, 401, { error: 'Invalid NOWPayments signature' })
      }

      const payload = rawBody ? JSON.parse(rawBody) : {}
      const record = extractNowPaymentsWebhookRecord(payload)
      let nextState = await billingStore.recordWebhookEvent({
        provider: record.provider,
        eventName: 'payment_status',
        providerObjectId: record.providerPaymentId,
        status: record.paymentStatus,
        payload,
      })

      if (record.providerPaymentId) {
        const stateSnapshot = await billingStore.load()
        const payment = stateSnapshot.payments.find(item => item.providerPaymentId === record.providerPaymentId)
        if (payment) {
          const plan = resolveBillingPlan(payment.planId)
          nextState = await billingStore.updatePaymentStatus(record.providerPaymentId, record, {
            issueLicense: isSuccessfulCryptoStatus(record.paymentStatus),
            source: 'crypto',
            activationLimit: plan.activationLimit,
          })
        }
      }

      return sendJson(response, 200, {
        ok: true,
        billing: buildBillingSnapshot(nextState),
      })
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

    if (request.method === 'PATCH' && url.pathname.startsWith('/api/tasks/')) {
      const taskId = decodeURIComponent(url.pathname.slice('/api/tasks/'.length))
      const currentTask = await sessionStore.getScheduledTask(taskId)
      if (!currentTask) {
        return sendJson(response, 404, { error: 'Task not found' })
      }

      const body = await readJson(request)
      const title = String(body.title ?? '').trim()
      const goal = String(body.goal ?? '').trim()
      const constraints = String(body.constraints ?? '').trim()
      const delivery = normalizeDeliveryInput(body.delivery)
      const completion = String(body.completion ?? '').trim()
      const nextTask = {
        ...currentTask,
        title: title || goal || currentTask.title || 'Planned task',
        goal,
        constraints,
        delivery,
        completion,
      }
      nextTask.status = nextTask.delivery ? 'scheduled' : 'draft'
      nextTask.body = buildTaskBody(nextTask)

      const updatedTask = await sessionStore.updateScheduledTask(taskId, nextTask)
      return sendJson(response, 200, { ok: true, task: updatedTask })
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

    if (request.method === 'POST' && url.pathname === '/api/open-link') {
      const body = await readJson(request)
      const externalUrl = String(body.url ?? '').trim()
      if (!/^https?:\/\//i.test(externalUrl)) {
        return sendJson(response, 400, { error: 'Only http and https URLs are allowed' })
      }
      await execFile('open', [externalUrl])
      return sendJson(response, 200, { ok: true, url: externalUrl })
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
        workspaceDir,
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

    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/' || url.pathname === '/index.html')) {
      return sendFile(response, join(staticDir, 'index.html'), 'text/html; charset=utf-8', request.method)
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      const assetPath = resolveStaticAsset(url.pathname)
      if (assetPath) {
        return sendFile(response, assetPath, getStaticContentType(assetPath), request.method)
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
  workspaceDir = resolveConfiguredWorkspaceDir(config)
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
    workspaceDir,
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
    mcp: {
      servers: (config.mcp?.servers ?? []).map(server => serializeMcpServerForClient(server)),
      diagnostics: runtimeContext.mcpDiagnostics ?? [],
    },
    models,
    sessions,
    notes,
    tasks,
    billing: await billingStore.getClientState({
      catalog: getBillingCatalog(),
      environment: getBillingEnvironment(),
    }),
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

  if (patch.mcp && typeof patch.mcp === 'object' && Array.isArray(patch.mcp.servers)) {
    const nextServers = patch.mcp.servers
      .map(server => normalizeMcpServerPatch(server))
      .filter(Boolean)
    await applyMcpSecretUpdates(config, nextServers, { keychainStore })
    config.mcp.servers = nextServers.map(({ clearAuthToken, ...server }) => server)
  }
}

function normalizeMcpServerPatch(server) {
  if (!server || typeof server !== 'object') {
    return null
  }

  const transport = ['stdio', 'http', 'sse'].includes(server.transport) ? server.transport : 'stdio'
  const authType = ['none', 'bearer', 'oauth'].includes(server.authType) ? server.authType : 'none'
  return {
    id: String(server.id ?? '').trim() || `mcp-${Date.now().toString(36)}`,
    presetId: String(server.presetId ?? '').trim(),
    name: String(server.name ?? '').trim() || 'Custom MCP',
    transport,
    url: String(server.url ?? '').trim(),
    command: String(server.command ?? '').trim(),
    argsText: String(server.argsText ?? '').trim(),
    headersText: String(server.headersText ?? '').trim(),
    authType,
    authTokenEnv: String(server.authTokenEnv ?? '').trim(),
    authToken: typeof server.authToken === 'string' ? server.authToken.trim() : '',
    authTokenSource: String(server.authTokenSource ?? '').trim(),
    oauthAuthorizationUrl: String(server.oauthAuthorizationUrl ?? '').trim(),
    oauthTokenUrl: String(server.oauthTokenUrl ?? '').trim(),
    oauthClientId: String(server.oauthClientId ?? '').trim(),
    oauthClientSecretEnv: String(server.oauthClientSecretEnv ?? '').trim(),
    oauthScopes: String(server.oauthScopes ?? '').trim(),
    clearAuthToken: server.clearAuthToken === true,
    enabled: server.enabled !== false,
  }
}

function serializeMcpServerForClient(server) {
  const authToken = typeof server.authToken === 'string' ? server.authToken.trim() : ''
  const envToken = server.authTokenEnv ? String(process.env[server.authTokenEnv] ?? '').trim() : ''
  return {
    id: server.id,
    presetId: server.presetId ?? '',
    name: server.name,
    transport: server.transport,
    url: server.url ?? '',
    command: server.command ?? '',
    argsText: server.argsText ?? '',
    headersText: server.headersText ?? '',
    authType: server.authType ?? 'none',
    authTokenEnv: server.authTokenEnv ?? '',
    authTokenSource: server.authTokenSource ?? (authToken ? 'config' : envToken ? 'env' : ''),
    hasAuthToken: Boolean(authToken || envToken),
    oauthAuthorizationUrl: server.oauthAuthorizationUrl ?? '',
    oauthTokenUrl: server.oauthTokenUrl ?? '',
    oauthClientId: server.oauthClientId ?? '',
    oauthClientSecretEnv: server.oauthClientSecretEnv ?? '',
    oauthScopes: server.oauthScopes ?? '',
    enabled: server.enabled !== false,
  }
}

function mergeMcpDiagnostics(existing, nextDiagnostic) {
  const items = Array.isArray(existing) ? [...existing] : []
  const index = items.findIndex(item => item.serverId === nextDiagnostic.serverId)
  if (index >= 0) {
    items[index] = nextDiagnostic
  } else {
    items.push(nextDiagnostic)
  }
  return items
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

function buildTaskBody(task) {
  const lines = [
    `Task: ${task.title}`,
  ]

  if (task.goal) {
    lines.push(`Goal: ${task.goal}`)
  }
  if (task.constraints) {
    lines.push(`Constraints: ${task.constraints}`)
  }
  if (task.delivery) {
    lines.push(`Due: ${task.delivery}`)
  }
  if (task.completion) {
    lines.push(`Completion Criteria: ${task.completion}`)
  }

  return lines.join('\n')
}

function normalizeDeliveryInput(value) {
  const text = String(value ?? '').trim().replace('T', ' ')
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

async function buildWorkspaceOutlineResponse(rootDir) {
  return {
    root: rootDir,
    generatedAt: new Date().toISOString(),
    nodes: await listWorkspaceNodes(rootDir, { depth: 2, maxEntries: 10, maxNodes: 180 }),
  }
}

async function readWorkspaceFile(relativePath) {
  const targetPath = resolveWorkspaceTarget(relativePath)
  const fileStat = await stat(targetPath)
  if (!fileStat.isFile()) {
    throw new Error('Workspace target is not a file')
  }
  if (fileStat.size > 1_000_000) {
    throw new Error('Workspace file is larger than the 1 MB editor limit')
  }

  const buffer = await readFile(targetPath)
  if (buffer.includes(0)) {
    throw new Error('Binary files are not supported in the workspace editor')
  }

  return {
    ok: true,
    path: relativeToWorkspace(targetPath),
    absolutePath: targetPath,
    content: buffer.toString('utf8'),
    size: fileStat.size,
    modifiedAt: fileStat.mtime.toISOString(),
  }
}

async function writeWorkspaceFile(body = {}) {
  const relativePath = String(body.path ?? '').trim()
  const content = typeof body.content === 'string' ? body.content : ''
  const targetPath = resolveWorkspaceTarget(relativePath)
  const fileStat = await stat(targetPath)
  if (!fileStat.isFile()) {
    throw new Error('Workspace target is not a file')
  }
  await writeFile(targetPath, content, 'utf8')
  const nextStat = await stat(targetPath)
  return {
    ok: true,
    path: relativeToWorkspace(targetPath),
    absolutePath: targetPath,
    size: nextStat.size,
    modifiedAt: nextStat.mtime.toISOString(),
  }
}

function resolveWorkspaceTarget(relativePath) {
  const source = String(relativePath ?? '').trim()
  if (!source || source === '.') {
    throw new Error('Workspace file path is required')
  }

  const root = resolve(workspaceDir)
  const targetPath = resolve(root, source)
  const rootPrefix = root.endsWith('/') ? root : `${root}/`
  if (targetPath !== root && !targetPath.startsWith(rootPrefix)) {
    throw new Error('Workspace path is outside the configured workspace')
  }
  return targetPath
}

async function validateWorkspaceRoot(value) {
  const source = String(value ?? '').trim()
  if (!source) {
    throw new Error('Workspace folder path is required')
  }
  const targetPath = resolve(source.replace(/^~(?=\/|$)/, process.env.HOME || homedir() || '~'))
  const rootStat = await stat(targetPath)
  if (!rootStat.isDirectory()) {
    throw new Error('Workspace root must be a folder')
  }
  return targetPath
}

function resolveConfiguredWorkspaceDir(config = {}) {
  const configured = String(config.workspace?.rootDir ?? '').trim()
  return resolve(workspaceDirOverride || configured || process.env.HOME || homedir() || process.cwd())
}

async function listWorkspaceNodes(currentDir, options = {}, state = { remaining: options.maxNodes ?? 180 }) {
  if (state.remaining <= 0) {
    return []
  }

  let entries = []
  try {
    entries = await readdir(currentDir, { withFileTypes: true })
  } catch {
    return []
  }

  const depth = options.depth ?? 2
  const maxEntries = options.maxEntries ?? 10
  const visibleEntries = entries
    .filter(entry => !shouldHideWorkspaceEntry(entry.name))
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })
    .slice(0, maxEntries)

  const nodes = []
  for (const entry of visibleEntries) {
    if (state.remaining <= 0) {
      break
    }
    state.remaining -= 1
    const targetPath = join(currentDir, entry.name)
    const node = {
      name: entry.name,
      path: targetPath,
      relativePath: relativeToWorkspace(targetPath),
      type: entry.isDirectory() ? 'dir' : 'file',
    }
    if (entry.isDirectory() && depth > 0) {
      node.children = await listWorkspaceNodes(targetPath, {
        ...options,
        depth: depth - 1,
      }, state)
    }
    nodes.push(node)
  }

  return nodes
}

function shouldHideWorkspaceEntry(name) {
  if (String(name).startsWith('.') && !['.github', '.gitignore', '.env.example'].includes(name)) {
    return true
  }

  return [
    '.git',
    '.DS_Store',
    'node_modules',
    'dist',
    'target',
    '.next',
    '.turbo',
    '.idea',
  ].includes(name)
}

function relativeToWorkspace(targetPath) {
  if (!targetPath.startsWith(workspaceDir)) {
    return targetPath
  }
  return targetPath.slice(workspaceDir.length).replace(/^\/+/, '') || '.'
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
  if (!['.html', '.js', '.css', '.svg', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.webmanifest'].includes(extension)) {
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
  if (extension === '.webmanifest') {
    return 'application/manifest+json; charset=utf-8'
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
  const raw = await readRequestBody(request)
  return raw ? JSON.parse(raw) : {}
}

async function readRequestBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function sendFile(response, filePath, contentType, method = 'GET') {
  const content = await readFile(filePath)
  response.writeHead(200, {
    'content-type': contentType,
    'content-length': String(content.byteLength),
  })
  response.end(method === 'HEAD' ? undefined : content)
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  response.end(safeJson(payload))
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, { 'content-type': 'text/html; charset=utf-8' })
  response.end(html)
}

function buildMcpOAuthResultPage(result = {}) {
  const title = result.ok ? 'MCP OAuth connected' : 'MCP OAuth failed'
  const detail = result.ok
    ? `${result.serverName || 'MCP connector'} is connected. You can close this window and return to modAI.`
    : (result.error || 'The OAuth callback could not be completed.')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtmlText(title)}</title>
    <style>
      :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #090b10; color: #f5f7fb; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: radial-gradient(circle at 20% 10%, rgba(124, 156, 255, 0.18), transparent 34%), #090b10; }
      main { width: min(520px, calc(100vw - 32px)); border: 1px solid rgba(255,255,255,.12); border-radius: 24px; padding: 28px; background: rgba(15,18,25,.92); box-shadow: 0 30px 80px rgba(0,0,0,.38); }
      .eyebrow { color: #93a4c7; font-size: 12px; letter-spacing: .16em; text-transform: uppercase; font-weight: 760; }
      h1 { margin: 10px 0; font-size: 28px; }
      p { color: #b7c2d8; line-height: 1.6; }
      .status { display: inline-flex; margin-top: 14px; padding: 8px 12px; border-radius: 999px; border: 1px solid ${result.ok ? 'rgba(116,211,159,.35)' : 'rgba(255,123,123,.35)'}; color: ${result.ok ? '#74d39f' : '#ff8c8c'}; }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">modAI connector auth</div>
      <h1>${escapeHtmlText(title)}</h1>
      <p>${escapeHtmlText(detail)}</p>
      <div class="status">${escapeHtmlText(result.ok ? 'Ready' : 'Needs attention')}</div>
    </main>
  </body>
</html>`
}

function escapeHtmlText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildBillingResponse(state) {
  return {
    ok: true,
    billing: buildBillingSnapshot(state),
  }
}

function buildBillingSnapshot(state) {
  return buildBillingClientState(state, {
    catalog: getBillingCatalog(),
    environment: getBillingEnvironment(),
    now: new Date(),
  })
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
