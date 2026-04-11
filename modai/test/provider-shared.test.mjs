import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveApiKey } from '../src/providers/shared.mjs'

test('resolveApiKey prefers the stored provider key over environment lookup', () => {
  process.env.GEMINI_API_KEY = 'env-key'

  const resolved = resolveApiKey({
    apiKey: 'stored-key',
    apiKeyEnv: 'GEMINI_API_KEY',
  })

  assert.equal(resolved, 'stored-key')
})
