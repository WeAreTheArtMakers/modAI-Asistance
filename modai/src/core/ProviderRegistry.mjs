import { createAnthropicProvider } from '../providers/anthropic.mjs'
import { createGeminiProvider } from '../providers/gemini.mjs'
import { createOllamaProvider } from '../providers/ollama.mjs'
import { createOpenAICompatibleProvider } from '../providers/openaiCompatible.mjs'

export class ProviderRegistry {
  constructor() {
    this.factories = new Map()
  }

  register(type, factory) {
    this.factories.set(type, factory)
  }

  create(alias, providerConfig) {
    const factory = this.factories.get(providerConfig.type)

    if (!factory) {
      throw new Error(`Unsupported provider type: ${providerConfig.type}`)
    }

    return factory(alias, providerConfig)
  }
}

export function createDefaultProviderRegistry() {
  const registry = new ProviderRegistry()
  registry.register('ollama', createOllamaProvider)
  registry.register('openai-compatible', createOpenAICompatibleProvider)
  registry.register('anthropic', createAnthropicProvider)
  registry.register('gemini', createGeminiProvider)
  return registry
}
