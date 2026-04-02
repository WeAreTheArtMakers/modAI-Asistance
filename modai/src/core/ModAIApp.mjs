import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { AppState } from './AppState.mjs'
import { createRuntimeContext } from './runtimeContext.mjs'
import { ConfigStore } from '../services/ConfigStore.mjs'
import { SessionStore } from '../services/SessionStore.mjs'
import { SkillStore } from '../services/SkillStore.mjs'
import { PluginStore } from '../services/PluginStore.mjs'
import { createDefaultProviderRegistry } from './ProviderRegistry.mjs'
import { summarizeToolEvent } from './agentProtocol.mjs'
import { formatStatus, header, printKeyValueTable, renderBanner } from '../utils/terminal.mjs'
import { commandExists, parseFlags, readFlag } from '../utils/cli.mjs'
import { safeJson } from '../utils/json.mjs'

export class ModAIApp {
  constructor(options = {}) {
    this.configStore = options.configStore ?? new ConfigStore()
    this.sessionStore = options.sessionStore ?? new SessionStore(this.configStore)
    this.skillStore = options.skillStore ?? new SkillStore(this.configStore)
    this.pluginStore = options.pluginStore ?? new PluginStore(this.configStore)
    this.providerRegistry = options.providerRegistry ?? createDefaultProviderRegistry()
    this.workspaceDir = options.workspaceDir ?? process.env.MODAI_WORKSPACE_DIR ?? process.cwd()
  }

  async run(argv) {
    const [command = 'chat', ...rest] = argv

    switch (command) {
      case 'chat':
        return this.runChat(rest)
      case 'prompt':
        return this.runPrompt(rest)
      case 'doctor':
        return this.runDoctor()
      case 'models':
        return this.runModels(rest)
      case 'config':
        return this.runConfig(rest)
      case 'help':
      case '--help':
      case '-h':
        return this.printHelp()
      default:
        throw new Error(`Unknown command: ${command}`)
    }
  }

  async runChat(argv) {
    const config = await this.configStore.load()
    const flags = parseFlags(argv)
    const requestedModel = readFlag(flags, 'm', 'model')
    const agentDefaults = this.resolveAgentSettings({
      config,
      enabledOverride: flags.booleans.has('no-agent') ? false : undefined,
      maxStepsOverride: readFlag(flags, null, 'agent-steps'),
    })
    let modelRef = await this.resolvePreferredModel(config, requestedModel)
    const state = new AppState({
      modelId: modelRef.id,
      sessionId: this.sessionStore.createSessionId(),
      agentEnabled: agentDefaults.enabled,
      agentMaxSteps: agentDefaults.maxSteps,
    })
    let runtimeContext = await this.createRuntime(config, modelRef)
    let provider = this.providerRegistry.create(modelRef.provider, config.providers[modelRef.provider])
    const rl = createInterface({ input, output, terminal: true })

    console.log(renderBanner(modelRef.id))
    console.log(
      `Mode: ${config.mode?.active ?? 'pro'} · skills ${runtimeContext.activeSkills.length} · plugins ${runtimeContext.activePlugins.length}`,
    )
    console.log(`Agent mode: ${state.agentEnabled ? `on · max ${state.agentMaxSteps} step(s)` : 'off'}`)
    console.log(
      'Slash commands: /help, /mode, /permissions, /permit, /skills, /plugins, /agent, /use <model>, /models, /tools, /ls, /read, /write, /shell, /fetch, /open, /clipboard_read, /clipboard_write, /screenshot, /screen_analyze, /click_text, /mouse_click, /mouse_drag, /scroll, /window_focus, /type_text, /press_key, /memory_recent, /memory_search, /memory_note, /applescript, /image_generate, /clear, /exit',
    )

    try {
      while (true) {
        const line = (await rl.question(`modAI:${state.modelId}> `)).trim()

        if (!line) {
          continue
        }

        if (line.startsWith('/')) {
          const handled = await this.handleSlashCommand(line, {
            config,
            state,
            provider,
            runtimeContext,
          })
          if (handled === 'exit') {
            break
          }
          if (handled === 'provider-changed' || handled === 'refresh-runtime') {
            modelRef = this.resolveModel(config, state.modelId)
            runtimeContext = await this.createRuntime(config, modelRef)
            provider = this.providerRegistry.create(modelRef.provider, config.providers[modelRef.provider])
          }
          continue
        }

        state.addMessage('user', line)
        runtimeContext = await this.createRuntime(config, modelRef)
        const result = await this.runAssistantTurn({
          agentRunner: runtimeContext.agentRunner,
          provider,
          modelRef,
          systemPrompt: runtimeContext.systemPrompt,
          messages: state.toConversationWindow(),
          agent: {
            enabled: state.agentEnabled,
            maxSteps: state.agentMaxSteps,
          },
          context: {
            config,
            state,
            provider,
            configStore: this.configStore,
            sessionStore: this.sessionStore,
            sessionId: state.sessionId,
            workspaceDir: this.workspaceDir,
            modelRef,
            runtime: runtimeContext.runtime,
            systemPrompt: runtimeContext.systemPrompt,
          },
          onEvent: event => {
            console.log(`\n${summarizeToolEvent(event)}\n`)
          },
        })
        state.addMessage('assistant', result.text)
        console.log(`\n${result.text}\n`)
        await this.sessionStore.save(state)
      }
    } finally {
      rl.close()
      await this.sessionStore.save(state)
    }
  }

  async runPrompt(argv) {
    const config = await this.configStore.load()
    const flags = parseFlags(argv)
    const requestedModel = readFlag(flags, 'm', 'model')
    const prompt = flags.positionals.join(' ').trim()

    if (!prompt) {
      throw new Error('No prompt text provided')
    }

    const modelRef = await this.resolvePreferredModel(config, requestedModel)
    const runtimeContext = await this.createRuntime(config, modelRef)
    const provider = this.providerRegistry.create(modelRef.provider, config.providers[modelRef.provider])
    const agent = this.resolveAgentSettings({
      config,
      enabledOverride: flags.booleans.has('no-agent') ? false : undefined,
      maxStepsOverride: readFlag(flags, null, 'agent-steps'),
    })
    const sessionState = new AppState({
      modelId: modelRef.id,
      sessionId: this.sessionStore.createSessionId(),
      agentEnabled: agent.enabled,
      agentMaxSteps: agent.maxSteps,
    })
    sessionState.addMessage('user', prompt)
    const result = await this.runAssistantTurn({
      agentRunner: runtimeContext.agentRunner,
      provider,
      modelRef,
      systemPrompt: runtimeContext.systemPrompt,
      messages: sessionState.toConversationWindow(),
      agent,
      context: {
        config,
        state: sessionState,
        provider,
        configStore: this.configStore,
        sessionStore: this.sessionStore,
        sessionId: sessionState.sessionId,
        workspaceDir: this.workspaceDir,
        modelRef,
        runtime: runtimeContext.runtime,
      },
    })

    sessionState.addMessage('assistant', result.text)
    await this.sessionStore.save(sessionState)
    console.log(result.text)
  }

  async runDoctor() {
    const config = await this.configStore.load()
    const configPath = this.configStore.getConfigPath()
    const defaultModel = await this.resolvePreferredModel(config)
    const runtimeContext = await this.createRuntime(config, defaultModel)
    const providerConfig = config.providers[defaultModel.provider]
    const provider = this.providerRegistry.create(defaultModel.provider, providerConfig)
    const hasOllama = await commandExists('ollama')
    const checks = [
      ['platform', formatStatus(process.platform === 'darwin', process.platform)],
      ['arch', formatStatus(process.arch === 'arm64', process.arch)],
      ['node', formatStatus(Number(process.versions.node.split('.')[0]) >= 20, process.version)],
      ['ollama-bin', formatStatus(hasOllama, hasOllama ? 'available' : 'missing')],
      ['config', formatStatus(true, configPath)],
      ['default-model', formatStatus(true, `${defaultModel.id} via ${providerConfig.type}`)],
      ['agent', formatStatus(config.agent?.enabled !== false, `max ${config.agent?.maxSteps ?? 6} step(s)`)],
      ['mode', formatStatus(config.mode?.active === 'pro', config.mode?.active ?? 'pro')],
      ['skills', formatStatus(true, `${runtimeContext.activeSkills.length} active`)],
      ['plugins', formatStatus(true, `${runtimeContext.activePlugins.length} active`)],
    ]

    let healthLine = ['provider-health', 'not checked']
    try {
      const health = await provider.healthcheck()
      healthLine = ['provider-health', formatStatus(health.ok, health.message)]
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      healthLine = ['provider-health', formatStatus(false, message)]
    }

    console.log(header('modAI Doctor'))
    printKeyValueTable([...checks, healthLine])
  }

  async runModels(argv) {
    const config = await this.configStore.load()
    const flags = parseFlags(argv)
    const discover = flags.booleans.has('discover')
    const rows = []

    for (const [modelId, definition] of Object.entries(config.models)) {
      rows.push([
        modelId,
        `${definition.provider}:${definition.model}`,
        definition.label ?? 'configured',
      ])
    }

    console.log(header('Configured Models'))
    printKeyValueTable(rows, ['model-id', 'target', 'note'])

    if (!discover) {
      return
    }

    console.log(`\n${header('Discovered Models')}`)

    for (const [alias, providerConfig] of Object.entries(config.providers)) {
      const provider = this.providerRegistry.create(alias, providerConfig)
      try {
        const models = await provider.listModels()
        const summary = models.length ? models.join(', ') : 'no models returned'
        console.log(`${alias}: ${summary}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.log(`${alias}: unavailable (${message})`)
      }
    }
  }

  async runConfig(argv) {
    const [subcommand = 'show'] = argv

    switch (subcommand) {
      case 'init': {
        const config = await this.configStore.init()
        console.log(`Initialized config at ${this.configStore.getConfigPath()}`)
        console.log(safeJson(config))
        return
      }
      case 'show': {
        const config = await this.configStore.load()
        console.log(safeJson(config))
        return
      }
      case 'path': {
        console.log(this.configStore.getConfigPath())
        return
      }
      default:
        throw new Error(`Unknown config subcommand: ${subcommand}`)
    }
  }

  async handleSlashCommand(line, context) {
    const [command, ...rest] = line.slice(1).trim().split(/\s+/)

    switch (command) {
      case 'exit':
      case 'quit':
        return 'exit'
      case 'help':
        this.printSlashHelp()
        return 'handled'
      case 'models':
        await this.runModels([])
        return 'handled'
      case 'mode': {
        const nextMode = rest[0]
        if (!nextMode) {
          console.log(`Current mode: ${context.config.mode?.active ?? 'pro'}`)
          return 'handled'
        }
        if (!['ultra', 'pro'].includes(nextMode)) {
          throw new Error('Usage: /mode <ultra|pro>')
        }
        context.config.mode.active = nextMode
        await this.configStore.save(context.config)
        console.log(`Mode changed to ${nextMode}`)
        return 'refresh-runtime'
      }
      case 'permissions': {
        const rows = Object.entries(context.config.permissions?.tools ?? {})
          .map(([tool, permission]) => `${tool}: ${permission}`)
          .join('\n')
        console.log(rows)
        return 'handled'
      }
      case 'permit': {
        const [toolName, permission] = rest
        if (!toolName || !permission || !['allow', 'ask', 'deny'].includes(permission)) {
          throw new Error('Usage: /permit <tool> <allow|ask|deny>')
        }
        context.config.permissions.tools[toolName] = permission
        await this.configStore.save(context.config)
        console.log(`Permission for ${toolName}: ${permission}`)
        return 'refresh-runtime'
      }
      case 'skills': {
        const lines = context.runtimeContext.skills.map(skill => `${skill.id}: ${skill.description || skill.source}`)
        console.log(lines.length ? lines.join('\n') : 'No skills loaded')
        return 'handled'
      }
      case 'plugins': {
        const lines = context.runtimeContext.plugins.map(plugin => `${plugin.id}: ${plugin.description || plugin.source}`)
        console.log(lines.length ? lines.join('\n') : 'No plugins loaded')
        return 'handled'
      }
      case 'agent': {
        if (rest[0] === 'on') {
          context.state.setAgentEnabled(true)
          if (rest[1]) {
            context.state.setAgentMaxSteps(rest[1])
          }
          context.config.agent.enabled = true
          context.config.agent.maxSteps = context.state.agentMaxSteps
          await this.configStore.save(context.config)
          console.log(`Agent mode on · max ${context.state.agentMaxSteps} step(s)`)
          return 'handled'
        }

        if (rest[0] === 'off') {
          context.state.setAgentEnabled(false)
          context.config.agent.enabled = false
          context.config.agent.maxSteps = context.state.agentMaxSteps
          await this.configStore.save(context.config)
          console.log('Agent mode off')
          return 'handled'
        }

        if (rest[0] === 'max') {
          context.state.setAgentMaxSteps(rest[1])
          context.config.agent.enabled = context.state.agentEnabled
          context.config.agent.maxSteps = context.state.agentMaxSteps
          await this.configStore.save(context.config)
          console.log(`Agent max steps set to ${context.state.agentMaxSteps}`)
          return 'handled'
        }

        console.log(`Agent mode ${context.state.agentEnabled ? 'on' : 'off'} · max ${context.state.agentMaxSteps} step(s)`)
        return 'handled'
      }
      case 'tools':
        console.log(
          context.runtimeContext.tools
            .map(tool => `${tool.name}: ${tool.description}${tool.inputHint ? ` | ${tool.inputHint}` : ''}`)
            .join('\n'),
        )
        return 'handled'
      case 'use': {
        const nextModelId = rest.join(' ').trim()
        if (!nextModelId) {
          throw new Error('Usage: /use <provider:model>')
        }
        const modelRef = this.resolveModel(context.config, nextModelId)
        context.config.defaultModel = modelRef.id
        await this.configStore.save(context.config)
        context.state.setModel(modelRef.id)
        console.log(`Active model changed to ${modelRef.id}`)
        return 'provider-changed'
      }
      case 'clear':
        context.state.resetSession(this.sessionStore.createSessionId())
        console.log('Conversation window cleared')
        return 'handled'
      case 'read':
      case 'ls':
      case 'fetch':
      case 'open':
      case 'clipboard_read':
      case 'screenshot':
      case 'screen_analyze':
      case 'click_text':
      case 'window_focus':
      case 'type_text':
      case 'press_key':
      case 'memory_recent':
      case 'memory_search':
      case 'applescript':
      case 'shell':
      case 'image_generate':
        console.log(await this.runToolFromSlash(command, rest.join(' '), context))
        return 'handled'
      case 'mouse_click': {
        const [x, y, button, clickCount] = rest
        console.log(await this.runToolFromSlash(command, { x, y, button, clickCount }, context))
        return 'handled'
      }
      case 'mouse_drag': {
        const [fromX, fromY, toX, toY, button, durationMs] = rest
        console.log(await this.runToolFromSlash(command, {
          fromX,
          fromY,
          toX,
          toY,
          button,
          durationMs,
        }, context))
        return 'handled'
      }
      case 'scroll': {
        const [deltaY, deltaX, units] = rest
        console.log(await this.runToolFromSlash(command, { deltaY, deltaX, units }, context))
        return 'handled'
      }
      case 'write': {
        const [targetPath, ...contentParts] = rest
        const content = contentParts.join(' ')
        console.log(await this.runToolFromSlash(command, { targetPath, content }, context))
        return 'handled'
      }
      case 'clipboard_write': {
        console.log(await this.runToolFromSlash(command, { text: rest.join(' ') }, context))
        return 'handled'
      }
      case 'memory_note': {
        console.log(await this.runToolFromSlash(command, parseMemoryNoteSlash(rest.join(' ')), context))
        return 'handled'
      }
      default:
        throw new Error(`Unknown slash command: /${command}`)
    }
  }

  resolveModel(config, reference) {
    if (config.models[reference]) {
      const definition = config.models[reference]
      return {
        id: reference,
        provider: definition.provider,
        model: definition.model,
        label: definition.label ?? reference,
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

    return {
      id: reference,
      provider,
      model,
      label: reference,
      capabilities: {},
    }
  }

  resolveAgentSettings({ config, enabledOverride, maxStepsOverride }) {
    const defaultAgent = config.agent ?? {}
    const maxSteps = Number(maxStepsOverride ?? defaultAgent.maxSteps ?? 6)

    return {
      enabled: enabledOverride ?? defaultAgent.enabled !== false,
      maxSteps: Number.isFinite(maxSteps) ? Math.max(1, Math.min(12, Math.round(maxSteps))) : 6,
    }
  }

  async resolvePreferredModel(config, requestedReference) {
    if (requestedReference) {
      return this.resolveModel(config, requestedReference)
    }

    const configuredModel = this.resolveModel(config, config.defaultModel)
    const providerInsights = await this.getProviderInsights(config)
    const configuredStatus = this.describeModelAvailability(configuredModel, providerInsights)
    if (configuredStatus.available) {
      return configuredModel
    }

    const fallbackId = this.buildDiscoveredModels(config, providerInsights)[0]?.id
    return fallbackId ? this.resolveModel(config, fallbackId) : configuredModel
  }

  async getProviderInsights(config) {
    const entries = await Promise.all(
      Object.entries(config.providers).map(async ([alias, providerConfig]) => {
        const provider = this.providerRegistry.create(alias, providerConfig)
        const health = await this.safeHealthcheck(provider)
        const models = health.ok && typeof provider.listModels === 'function'
          ? await this.safeListModels(provider)
          : []
        return [alias, { health, models }]
      }),
    )

    return new Map(entries)
  }

  async safeHealthcheck(provider) {
    try {
      return await provider.healthcheck()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        ok: false,
        message,
      }
    }
  }

  async safeListModels(provider) {
    try {
      const models = await provider.listModels()
      return Array.isArray(models) ? models : []
    } catch {
      return []
    }
  }

  describeModelAvailability(modelRef, providerInsights) {
    const providerInsight = providerInsights.get(modelRef.provider)
    if (!providerInsight) {
      return {
        available: false,
      }
    }

    if (!providerInsight.health.ok) {
      return {
        available: false,
      }
    }

    if (providerInsight.models.length > 0 && !providerInsight.models.includes(modelRef.model)) {
      return {
        available: false,
      }
    }

    return {
      available: true,
    }
  }

  buildDiscoveredModels(config, providerInsights) {
    const existingIds = new Set(Object.keys(config.models))
    const discovered = []

    for (const [alias, providerInsight] of providerInsights.entries()) {
      for (const model of providerInsight.models ?? []) {
        const id = `${alias}:${model}`
        if (existingIds.has(id)) {
          continue
        }
        existingIds.add(id)
        discovered.push({ id, provider: alias, model })
      }
    }

    return discovered
  }

  async runAssistantTurn({ agentRunner, provider, modelRef, systemPrompt, messages, agent, context, onEvent }) {
    return agentRunner.run({
      provider,
      model: modelRef.model,
      systemPrompt,
      messages,
      agent,
      context,
      onEvent,
    })
  }

  async createRuntime(config, modelRef) {
    return createRuntimeContext({
      config,
      configStore: this.configStore,
      skillStore: this.skillStore,
      pluginStore: this.pluginStore,
      modelRef,
      platform: process.platform,
    })
  }

  async runToolFromSlash(name, inputValue, context) {
    const modelRef = this.resolveModel(context.config, context.state.modelId)
    const nextContext = {
      ...context,
      configStore: this.configStore,
      sessionStore: this.sessionStore,
      sessionId: context.state.sessionId,
      workspaceDir: this.workspaceDir,
      modelRef,
      runtime: context.runtimeContext.runtime,
      provider: context.provider,
    }
    return context.runtimeContext.toolRegistry.run(name, inputValue, nextContext)
  }

  printHelp() {
    console.log(renderBanner('help'))
    console.log('Commands:')
    console.log('  chat               Start interactive chat')
    console.log('  prompt             Run a single prompt')
    console.log('  doctor             Run local environment checks')
    console.log('  models [--discover]  Show configured models')
    console.log('  config init|show|path')
    console.log('Flags:')
    console.log('  --agent-steps <n>  Agent step limit (1-12)')
    console.log('  --no-agent         Disable agent loop for the current run')
    console.log('Modes:')
    console.log('  ultra              Minimal local workflow')
    console.log('  pro                Permissions, plugins, skills, computer tools')
  }

  printSlashHelp() {
    console.log('Slash commands:')
    console.log('  /help')
    console.log('  /mode <ultra|pro>')
    console.log('  /permissions')
    console.log('  /permit <tool> <allow|ask|deny>')
    console.log('  /skills')
    console.log('  /plugins')
    console.log('  /agent [on|off|max <n>]')
    console.log('  /models')
    console.log('  /tools')
    console.log('  /use <provider:model>')
    console.log('  /ls [path]')
    console.log('  /read <path>')
    console.log('  /write <path> <content>')
    console.log('  /shell <command>')
    console.log('  /fetch <url>')
    console.log('  /open <path|url>')
    console.log('  /clipboard_read')
    console.log('  /clipboard_write <text>')
    console.log('  /screenshot [path]')
    console.log('  /screen_analyze [query]')
    console.log('  /click_text <query>')
    console.log('  /mouse_click <x> <y> [left|right|center] [count]')
    console.log('  /mouse_drag <fromX> <fromY> <toX> <toY> [left|right|center] [durationMs]')
    console.log('  /scroll <deltaY> [deltaX] [line|pixel]')
    console.log('  /window_focus <app name or window title>')
    console.log('  /type_text <text>')
    console.log('  /press_key <return|tab|cmd+k>')
    console.log('  /memory_recent [limit]')
    console.log('  /memory_search <query>')
    console.log('  /memory_note title | content | category')
    console.log('  /applescript <script>')
    console.log('  /image_generate <prompt>')
    console.log('  /clear')
    console.log('  /exit')
  }
}

function parseMemoryNoteSlash(raw) {
  const text = String(raw ?? '').trim()
  if (!text) {
    return {}
  }

  if (text.startsWith('{')) {
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }

  const [title = '', content = '', category = 'general'] = text.split('|').map(part => part.trim())
  return { title, content, category }
}
