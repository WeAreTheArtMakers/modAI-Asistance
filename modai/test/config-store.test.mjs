import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConfigStore } from '../src/services/ConfigStore.mjs'

test('ConfigStore creates a default config when missing', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-config-'))
  const store = new ConfigStore({ baseDir })

  const config = await store.load()
  const raw = await readFile(store.getConfigPath(), 'utf8')

  assert.equal(config.defaultModel, 'ollama:llama3.2')
  assert.match(raw, /ollama/)
})
