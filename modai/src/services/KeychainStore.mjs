import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function isMissingKeychainItem(error) {
  const stderr = String(error?.stderr ?? '')
  return error?.code === 44 || /could not be found in the keychain/i.test(stderr)
}

function formatSecurityError(action, alias, error) {
  const stderr = String(error?.stderr ?? '').trim()
  const detail = stderr || error?.message || String(error)
  return new Error(`Keychain ${action} failed for ${alias}: ${detail}`)
}

export class KeychainStore {
  constructor(options = {}) {
    this.enabled = options.enabled ?? process.platform === 'darwin'
    this.securityPath = options.securityPath ?? '/usr/bin/security'
    this.serviceName = options.serviceName ?? 'modAI.provider'
  }

  isAvailable() {
    return this.enabled
  }

  getAccountName(alias) {
    return `modAI:${alias}`
  }

  async getProviderApiKey(alias) {
    if (!this.isAvailable()) {
      return null
    }

    try {
      const { stdout } = await execFileAsync(this.securityPath, [
        'find-generic-password',
        '-a',
        this.getAccountName(alias),
        '-s',
        this.serviceName,
        '-w',
      ], { encoding: 'utf8' })
      return stdout.trim() || null
    } catch (error) {
      if (isMissingKeychainItem(error)) {
        return null
      }
      return null
    }
  }

  async setProviderApiKey(alias, apiKey) {
    if (!this.isAvailable()) {
      return false
    }

    try {
      await execFileAsync(this.securityPath, [
        'add-generic-password',
        '-a',
        this.getAccountName(alias),
        '-s',
        this.serviceName,
        '-w',
        apiKey,
        '-U',
      ], { encoding: 'utf8' })
      return true
    } catch (error) {
      throw formatSecurityError('write', alias, error)
    }
  }

  async deleteProviderApiKey(alias) {
    if (!this.isAvailable()) {
      return false
    }

    try {
      await execFileAsync(this.securityPath, [
        'delete-generic-password',
        '-a',
        this.getAccountName(alias),
        '-s',
        this.serviceName,
      ], { encoding: 'utf8' })
      return true
    } catch (error) {
      if (isMissingKeychainItem(error)) {
        return false
      }
      throw formatSecurityError('delete', alias, error)
    }
  }
}
