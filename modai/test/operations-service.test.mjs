import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConfigStore } from '../src/services/ConfigStore.mjs'
import { checkForAppUpdates, getOperationsSnapshot, recordTelemetryEvent } from '../src/services/operationsService.mjs'

test('operations service records telemetry events locally', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-ops-telemetry-'))
  const configStore = new ConfigStore({ baseDir, fallbackBaseDir: baseDir })

  await recordTelemetryEvent(configStore, {
    source: 'frontend',
    level: 'error',
    message: 'Example failure',
  })

  const snapshot = await getOperationsSnapshot({
    configStore,
    runtimeDir: process.cwd(),
  })

  assert.equal(snapshot.telemetry.eventCount, 1)
  assert.equal(Boolean(snapshot.telemetry.lastEventAt), true)
})

test('operations service checks updates and prefers native Tauri assets', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-ops-update-'))
  const runtimeDir = await mkdtemp(join(tmpdir(), 'modai-runtime-'))
  const configStore = new ConfigStore({ baseDir, fallbackBaseDir: baseDir })
  await writeFile(join(runtimeDir, 'package.json'), JSON.stringify({ version: '0.1.0' }), 'utf8')

  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        tag_name: 'v0.2.0',
        html_url: 'https://example.com/release',
        body: 'Release notes',
        assets: [
          {
            name: 'modAI-tauri-macos-arm64.zip',
            browser_download_url: 'https://example.com/modAI-tauri-macos-arm64.zip',
          },
          {
            name: 'modAI-macos-arm64.zip',
            browser_download_url: 'https://example.com/modAI-macos-arm64.zip',
          },
        ],
      }
    },
  })

  const result = await checkForAppUpdates({
    configStore,
    runtimeDir,
    fetchImpl,
    platform: 'darwin',
    arch: 'arm64',
  })

  assert.equal(result.operations.update.available, true)
  assert.equal(result.operations.update.assetName, 'modAI-tauri-macos-arm64.zip')
})
