function readInlineProviderApiKey(providerConfig) {
  return typeof providerConfig?.apiKey === 'string' ? providerConfig.apiKey.trim() : ''
}

export function stripInlineProviderSecrets(config) {
  let changed = false
  for (const providerConfig of Object.values(config.providers ?? {})) {
    if (typeof providerConfig !== 'object' || !providerConfig) {
      continue
    }
    if (typeof providerConfig.apiKeySource === 'string') {
      delete providerConfig.apiKeySource
      changed = true
    }
    if (typeof providerConfig.apiKey === 'string') {
      delete providerConfig.apiKey
      changed = true
    }
  }
  return changed
}

export function sanitizeConfigForDisk(config) {
  const next = structuredClone(config)
  for (const providerConfig of Object.values(next.providers ?? {})) {
    if (typeof providerConfig !== 'object' || !providerConfig) {
      continue
    }
    delete providerConfig.apiKeySource
  }
  return next
}

export async function applyProviderSecretUpdates(config, providerUpdates, { keychainStore } = {}) {
  if (!providerUpdates || typeof providerUpdates !== 'object') {
    return false
  }

  let changed = false
  const useKeychain = Boolean(keychainStore?.isAvailable?.())

  for (const [alias, update] of Object.entries(providerUpdates)) {
    if (!config.providers?.[alias] || !update || typeof update !== 'object') {
      continue
    }

    const apiKey = typeof update.apiKey === 'string' ? update.apiKey.trim() : ''

    if (update.clearApiKey === true) {
      if (useKeychain) {
        await keychainStore.deleteProviderApiKey(alias)
      }
      if (typeof config.providers[alias].apiKey === 'string') {
        delete config.providers[alias].apiKey
      }
      changed = true
    }

    if (!apiKey) {
      continue
    }

    if (useKeychain) {
      await keychainStore.setProviderApiKey(alias, apiKey)
      if (typeof config.providers[alias].apiKey === 'string') {
        delete config.providers[alias].apiKey
      }
    } else {
      config.providers[alias].apiKey = apiKey
    }
    changed = true
  }

  return changed
}

export async function prepareRuntimeConfig(config, { configStore, keychainStore } = {}) {
  const useKeychain = Boolean(keychainStore?.isAvailable?.())
  let migrated = false

  if (useKeychain) {
    for (const [alias, providerConfig] of Object.entries(config.providers ?? {})) {
      const inlineApiKey = readInlineProviderApiKey(providerConfig)
      if (!inlineApiKey) {
        continue
      }

      const stored = await keychainStore.getProviderApiKey(alias)
      if (!stored) {
        await keychainStore.setProviderApiKey(alias, inlineApiKey)
      }
      delete config.providers[alias].apiKey
      migrated = true
    }
  }

  if (migrated && configStore) {
    await configStore.save(config)
  }

  const runtimeConfig = structuredClone(config)
  for (const [alias, providerConfig] of Object.entries(runtimeConfig.providers ?? {})) {
    const inlineApiKey = readInlineProviderApiKey(providerConfig)
    if (inlineApiKey) {
      providerConfig.apiKeySource = 'config'
      continue
    }

    if (!useKeychain) {
      continue
    }

    const stored = await keychainStore.getProviderApiKey(alias)
    if (!stored) {
      continue
    }

    providerConfig.apiKey = stored
    providerConfig.apiKeySource = 'keychain'
  }

  return runtimeConfig
}
