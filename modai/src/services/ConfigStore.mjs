import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { createDefaultConfig, mergeConfigWithDefaults } from './defaultConfig.mjs'
import { sanitizeConfigForDisk } from './providerSecrets.mjs'
import { safeJson } from '../utils/json.mjs'

export class ConfigStore {
  constructor(options = {}) {
    this.baseDir = options.baseDir ?? process.env.MODAI_HOME ?? join(homedir(), '.modai')
    this.fallbackBaseDir = options.fallbackBaseDir ?? join(process.cwd(), '.modai')
  }

  getBaseDir() {
    return this.baseDir
  }

  getConfigPath() {
    return join(this.baseDir, 'config.json')
  }

  getSessionsDir() {
    return join(this.baseDir, 'sessions')
  }

  async ensureLayout() {
    try {
      await mkdir(this.baseDir, { recursive: true })
      await mkdir(this.getSessionsDir(), { recursive: true })
    } catch (error) {
      if (!this.shouldUseFallback(error)) {
        throw error
      }

      this.baseDir = this.fallbackBaseDir
      await mkdir(this.baseDir, { recursive: true })
      await mkdir(this.getSessionsDir(), { recursive: true })
    }
  }

  async init() {
    await this.ensureLayout()
    const config = createDefaultConfig()
    await this.save(config)
    return config
  }

  async load() {
    await this.ensureLayout()

    try {
      const raw = await readFile(this.getConfigPath(), 'utf8')
      const parsed = JSON.parse(raw)
      const hydrated = mergeConfigWithDefaults(parsed)
      if (safeJson(parsed) !== safeJson(hydrated)) {
        await this.save(hydrated)
      }
      return hydrated
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return this.init()
      }
      throw error
    }
  }

  async save(config) {
    await this.ensureLayout()
    const sanitized = sanitizeConfigForDisk(config)
    await writeFile(this.getConfigPath(), safeJson(mergeConfigWithDefaults(sanitized)), 'utf8')
  }

  async update(mutator) {
    const current = await this.load()
    const next = await mutator(structuredClone(current))
    const normalized = mergeConfigWithDefaults(next)
    await this.save(normalized)
    return normalized
  }

  shouldUseFallback(error) {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'EPERM' || error.code === 'EACCES') &&
      this.baseDir !== this.fallbackBaseDir,
    )
  }
}
