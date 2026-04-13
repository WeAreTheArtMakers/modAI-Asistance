function readInlineProviderApiKey(providerConfig) {
  return typeof providerConfig?.apiKey === 'string' ? providerConfig.apiKey.trim() : ''
}

function readInlineMcpAuthToken(serverConfig) {
  return typeof serverConfig?.authToken === 'string' ? serverConfig.authToken.trim() : ''
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
  for (const serverConfig of config.mcp?.servers ?? []) {
    if (typeof serverConfig !== 'object' || !serverConfig) {
      continue
    }
    if (typeof serverConfig.authTokenSource === 'string') {
      delete serverConfig.authTokenSource
      changed = true
    }
    if (typeof serverConfig.authToken === 'string') {
      delete serverConfig.authToken
      changed = true
    }
    if (typeof serverConfig.clearAuthToken === 'boolean') {
      delete serverConfig.clearAuthToken
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
  for (const serverConfig of next.mcp?.servers ?? []) {
    if (typeof serverConfig !== 'object' || !serverConfig) {
      continue
    }
    delete serverConfig.authTokenSource
    delete serverConfig.clearAuthToken
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

export async function applyMcpSecretUpdates(config, nextServers, { keychainStore } = {}) {
  if (!Array.isArray(nextServers)) {
    return false
  }

  let changed = false
  const useKeychain = Boolean(keychainStore?.isAvailable?.())
  const existingIds = new Set((config.mcp?.servers ?? []).map(server => server.id).filter(Boolean))
  const nextIds = new Set()

  for (const server of nextServers) {
    if (!server || typeof server !== 'object') {
      continue
    }

    const serverId = String(server.id ?? '').trim()
    if (!serverId) {
      continue
    }

    nextIds.add(serverId)
    const authToken = typeof server.authToken === 'string' ? server.authToken.trim() : ''

    if (server.clearAuthToken === true) {
      if (useKeychain) {
        await keychainStore.deleteMcpAuthToken(serverId)
      }
      changed = true
    }

    if (!authToken) {
      continue
    }

    if (useKeychain) {
      await keychainStore.setMcpAuthToken(serverId, authToken)
      delete server.authToken
    }
    changed = true
  }

  if (useKeychain) {
    for (const serverId of existingIds) {
      if (nextIds.has(serverId)) {
        continue
      }
      await keychainStore.deleteMcpAuthToken(serverId)
      changed = true
    }
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

    for (const serverConfig of config.mcp?.servers ?? []) {
      if (!serverConfig || typeof serverConfig !== 'object') {
        continue
      }

      const inlineAuthToken = readInlineMcpAuthToken(serverConfig)
      if (!inlineAuthToken || !serverConfig.id) {
        continue
      }

      const stored = await keychainStore.getMcpAuthToken(serverConfig.id)
      if (!stored) {
        await keychainStore.setMcpAuthToken(serverConfig.id, inlineAuthToken)
      }
      delete serverConfig.authToken
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

  for (const serverConfig of runtimeConfig.mcp?.servers ?? []) {
    if (!serverConfig || typeof serverConfig !== 'object') {
      continue
    }

    const inlineAuthToken = readInlineMcpAuthToken(serverConfig)
    if (inlineAuthToken) {
      serverConfig.authTokenSource = 'config'
      continue
    }

    if (!useKeychain || !serverConfig.id) {
      continue
    }

    const stored = await keychainStore.getMcpAuthToken(serverConfig.id)
    if (!stored) {
      continue
    }

    serverConfig.authToken = stored
    serverConfig.authTokenSource = 'keychain'
  }

  return runtimeConfig
}
