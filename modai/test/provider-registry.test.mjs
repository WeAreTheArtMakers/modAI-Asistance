import test from 'node:test'
import assert from 'node:assert/strict'

import { createDefaultProviderRegistry } from '../src/core/ProviderRegistry.mjs'

test('ProviderRegistry creates an ollama provider', () => {
  const registry = createDefaultProviderRegistry()
  const provider = registry.create('ollama', {
    type: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
  })

  assert.equal(typeof provider.chat, 'function')
  assert.equal(typeof provider.healthcheck, 'function')
})
