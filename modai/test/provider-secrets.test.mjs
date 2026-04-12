import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyProviderSecretUpdates,
  prepareRuntimeConfig,
  sanitizeConfigForDisk,
  stripInlineProviderSecrets,
} from '../src/services/providerSecrets.mjs'

test('sanitizeConfigForDisk removes runtime-only provider metadata', () => {
  const sanitized = sanitizeConfigForDisk({
    providers: {
      gemini: {
        apiKeySource: 'keychain',
        baseUrl: 'https://example.com',
      },
    },
  })

  assert.deepEqual(sanitized, {
    providers: {
      gemini: {
        baseUrl: 'https://example.com',
      },
    },
  })
})

test('stripInlineProviderSecrets removes inline provider keys', () => {
  const config = {
    providers: {
      gemini: {
        apiKey: 'secret',
        apiKeySource: 'config',
      },
    },
  }

  const changed = stripInlineProviderSecrets(config)

  assert.equal(changed, true)
  assert.deepEqual(config, { providers: { gemini: {} } })
})

test('applyProviderSecretUpdates writes to keychain when available', async () => {
  const writes = []
  const deletes = []
  const config = {
    providers: {
      gemini: {
        baseUrl: 'https://example.com',
      },
    },
  }

  await applyProviderSecretUpdates(config, {
    gemini: {
      apiKey: 'abc123',
      clearApiKey: false,
    },
  }, {
    keychainStore: {
      isAvailable: () => true,
      setProviderApiKey: async (alias, value) => {
        writes.push([alias, value])
      },
      deleteProviderApiKey: async alias => {
        deletes.push(alias)
      },
    },
  })

  assert.deepEqual(writes, [['gemini', 'abc123']])
  assert.deepEqual(deletes, [])
  assert.equal('apiKey' in config.providers.gemini, false)
})

test('prepareRuntimeConfig migrates inline secrets into keychain and hydrates runtime config', async () => {
  const saved = []
  const keychain = new Map()
  const config = {
    providers: {
      gemini: {
        apiKey: 'legacy-secret',
        apiKeyEnv: 'GEMINI_API_KEY',
      },
      ollama: {
        baseUrl: 'http://127.0.0.1:11434',
      },
    },
  }

  const runtimeConfig = await prepareRuntimeConfig(config, {
    configStore: {
      save: async value => {
        saved.push(structuredClone(value))
      },
    },
    keychainStore: {
      isAvailable: () => true,
      getProviderApiKey: async alias => keychain.get(alias) ?? null,
      setProviderApiKey: async (alias, value) => {
        keychain.set(alias, value)
      },
    },
  })

  assert.equal(config.providers.gemini.apiKey, undefined)
  assert.equal(saved.length, 1)
  assert.equal(runtimeConfig.providers.gemini.apiKey, 'legacy-secret')
  assert.equal(runtimeConfig.providers.gemini.apiKeySource, 'keychain')
})
