export function createDefaultConfig() {
  return {
    version: 9,
    defaultModel: 'ollama:llama3.2',
    language: {
      active: 'en',
    },
    assistant: {
      profile: 'business-copilot',
    },
    mode: {
      active: 'pro',
    },
    theme: {
      active: 'auto',
    },
    reminders: {
      daemonEnabled: true,
      sound: 'Glass',
    },
    agent: {
      enabled: true,
      maxSteps: 6,
    },
    composerTemplates: createDefaultComposerTemplates(),
    permissions: {
      tools: createDefaultToolPermissions(),
    },
    skills: {
      userEnabled: true,
      projectEnabled: true,
      active: [],
    },
    plugins: {
      userEnabled: true,
      projectEnabled: true,
      active: [],
    },
    providers: {
      ollama: {
        type: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
      },
      openaiLocal: {
        type: 'openai-compatible',
        baseUrl: 'http://127.0.0.1:1234/v1',
        apiKeyEnv: 'OPENAI_API_KEY',
      },
      anthropic: {
        type: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
      },
      gemini: {
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKeyEnv: 'GEMINI_API_KEY',
      },
    },
    models: {
      'ollama:llama3.2': {
        provider: 'ollama',
        model: 'llama3.2',
        label: 'local general default',
        capabilities: {
          vision: false,
          imageGeneration: false,
          business: true,
          code: false,
          desktop: false,
        },
      },
      'ollama:qwen2.5-coder:7b': {
        provider: 'ollama',
        model: 'qwen2.5-coder:7b',
        label: 'local coding default',
        capabilities: {
          vision: false,
          imageGeneration: false,
          business: false,
          code: true,
          desktop: false,
        },
      },
      'openaiLocal:local-model': {
        provider: 'openaiLocal',
        model: 'local-model',
        label: 'LM Studio or OpenAI-compatible server',
        capabilities: {
          vision: false,
          imageGeneration: false,
          business: true,
          code: true,
          desktop: false,
        },
      },
      'openaiLocal:image-model': {
        provider: 'openaiLocal',
        model: 'gpt-image-1',
        label: 'image generation optional',
        capabilities: {
          vision: false,
          imageGeneration: true,
          business: false,
          code: false,
          desktop: false,
        },
      },
      'anthropic:claude-3-5-sonnet-latest': {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        label: 'cloud optional',
        capabilities: {
          vision: true,
          imageGeneration: false,
          business: true,
          code: true,
          desktop: true,
        },
      },
      'gemini:gemini-2.5-pro': {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        label: 'cloud optional',
        capabilities: {
          vision: true,
          imageGeneration: false,
          business: true,
          code: true,
          desktop: false,
        },
      },
    },
  }
}

export function mergeConfigWithDefaults(config = {}) {
  const defaults = createDefaultConfig()
  const merged = {
    ...defaults,
    ...config,
    assistant: {
      ...defaults.assistant,
      ...(config.assistant ?? {}),
    },
    language: {
      ...defaults.language,
      ...(config.language ?? {}),
    },
    mode: {
      ...defaults.mode,
      ...(config.mode ?? {}),
    },
    agent: {
      ...defaults.agent,
      ...(config.agent ?? {}),
    },
    composerTemplates: {
      ...defaults.composerTemplates,
      ...(config.composerTemplates ?? {}),
    },
    theme: {
      ...defaults.theme,
      ...(config.theme ?? {}),
    },
    reminders: {
      ...defaults.reminders,
      ...(config.reminders ?? {}),
    },
    permissions: {
      ...defaults.permissions,
      ...(config.permissions ?? {}),
      tools: {
        ...defaults.permissions.tools,
        ...(config.permissions?.tools ?? {}),
      },
    },
    skills: {
      ...defaults.skills,
      ...(config.skills ?? {}),
      active: Array.isArray(config.skills?.active) ? [...config.skills.active] : defaults.skills.active,
    },
    plugins: {
      ...defaults.plugins,
      ...(config.plugins ?? {}),
      active: Array.isArray(config.plugins?.active) ? [...config.plugins.active] : defaults.plugins.active,
    },
    providers: {
      ...defaults.providers,
      ...(config.providers ?? {}),
    },
    models: {
      ...defaults.models,
      ...mergeModelDefinitions(defaults.models, config.models ?? {}),
    },
  }

  applyLegacyUpgrades(config, merged)
  merged.version = defaults.version
  return merged
}

export function createDefaultToolPermissions() {
  return {
    ls: 'allow',
    read: 'allow',
    fetch: 'allow',
    memory_recent: 'allow',
    memory_search: 'allow',
    memory_note: 'allow',
    write: 'ask',
    shell: 'ask',
    open: 'allow',
    clipboard_read: 'allow',
    clipboard_write: 'ask',
    screenshot: 'ask',
    code_run: 'ask',
    screen_analyze: 'ask',
    click_text: 'ask',
    mouse_click: 'ask',
    mouse_drag: 'ask',
    scroll: 'ask',
    window_focus: 'ask',
    type_text: 'ask',
    press_key: 'ask',
    applescript: 'deny',
    image_generate: 'ask',
    memory_semantic: 'allow',
  }
}

export function createDefaultComposerTemplates() {
  return {
    enabled: true,
    autoTaskTemplate: true,
    autoDesktopTemplate: true,
    taskTemplate: [
      'Task: [what should happen]',
      'Goal: [desired outcome]',
      'Constraints: [limits, time, tools]',
      'Due: [date or output format]',
    ].join('\n'),
    desktopTemplate: [
      'Task: [computer action]',
      'Goal: [desired outcome]',
      'Constraints: [app, limits, watch-outs]',
      'Completion Criteria: [what counts as done]',
    ].join('\n'),
  }
}

function mergeModelDefinitions(defaultModels, incomingModels) {
  const merged = {}

  for (const [modelId, definition] of Object.entries(defaultModels)) {
    merged[modelId] = {
      ...definition,
      ...(incomingModels[modelId] ?? {}),
      capabilities: {
        ...(definition.capabilities ?? {}),
        ...(incomingModels[modelId]?.capabilities ?? {}),
      },
    }
  }

  for (const [modelId, definition] of Object.entries(incomingModels)) {
    if (merged[modelId]) {
      continue
    }

    merged[modelId] = {
      ...definition,
      capabilities: {
        ...(definition.capabilities ?? {}),
      },
    }
  }

  return merged
}

function applyLegacyUpgrades(rawConfig, mergedConfig) {
  const previousVersion = Number(rawConfig?.version ?? 0)

  if (previousVersion < 6 && mergedConfig.permissions?.tools?.open === 'ask') {
    mergedConfig.permissions.tools.open = 'allow'
  }

  if (previousVersion < 7 && !rawConfig?.assistant?.profile) {
    mergedConfig.assistant.profile = 'business-copilot'
  }

  if (previousVersion < 8) {
    if (rawConfig?.language?.active !== 'tr') {
      mergedConfig.language.active = 'en'
    }

    const currentTemplates = rawConfig?.composerTemplates ?? {}

    if (
      typeof currentTemplates.taskTemplate !== 'string'
      || currentTemplates.taskTemplate.startsWith('Gorev:')
      || currentTemplates.taskTemplate.startsWith('Görev:')
    ) {
      mergedConfig.composerTemplates.taskTemplate = createDefaultComposerTemplates().taskTemplate
    }

    if (
      typeof currentTemplates.desktopTemplate !== 'string'
      || currentTemplates.desktopTemplate.startsWith('Gorev:')
      || currentTemplates.desktopTemplate.startsWith('Görev:')
    ) {
      mergedConfig.composerTemplates.desktopTemplate = createDefaultComposerTemplates().desktopTemplate
    }
  }
}
