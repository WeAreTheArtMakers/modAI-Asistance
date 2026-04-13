import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConfigStore } from '../src/services/ConfigStore.mjs'

test('ConfigStore creates a default config when missing', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-config-'))
  const store = new ConfigStore({ baseDir })

  const config = await store.load()
  const raw = await readFile(store.getConfigPath(), 'utf8')

  assert.equal(config.defaultModel, 'ollama:llama3.2')
  assert.deepEqual(config.mcp.servers, [])
  assert.match(raw, /ollama/)
})

test('ConfigStore upgrades legacy open permission for desktop control', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-config-upgrade-'))
  const store = new ConfigStore({ baseDir, fallbackBaseDir: baseDir })
  await store.ensureLayout()
  await writeFile(store.getConfigPath(), JSON.stringify({
    version: 5,
    permissions: {
      tools: {
        open: 'ask',
      },
    },
  }, null, 2), 'utf8')

  const config = await store.load()

  assert.equal(config.permissions.tools.open, 'allow')
  assert.equal(config.assistant.profile, 'business-copilot')
  assert.equal(config.language.active, 'en')
  assert.deepEqual(config.mcp.servers, [])
  assert.equal(config.version, 10)
})

test('ConfigStore normalizes MCP auth fields', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-config-mcp-'))
  const store = new ConfigStore({ baseDir, fallbackBaseDir: baseDir })
  await store.ensureLayout()
  await writeFile(store.getConfigPath(), JSON.stringify({
    version: 10,
    mcp: {
      servers: [{
        id: 'github',
        name: 'GitHub MCP',
        transport: 'http',
        url: 'https://example.com/mcp',
        authType: 'bearer',
        authTokenEnv: 'GITHUB_TOKEN',
      }],
    },
  }, null, 2), 'utf8')

  const config = await store.load()

  assert.equal(config.mcp.servers[0].authType, 'bearer')
  assert.equal(config.mcp.servers[0].authTokenEnv, 'GITHUB_TOKEN')
  assert.equal(config.mcp.servers[0].authTokenSource, '')
})
