import { createHash, randomBytes } from 'node:crypto'

const pendingFlows = new Map()
const FLOW_TTL_MS = 10 * 60 * 1000

export async function startMcpOAuthFlow({ server, port, configStore } = {}) {
  const normalized = normalizeOAuthServer(server)
  if (!normalized.url) {
    throw new Error('MCP OAuth requires a remote MCP URL')
  }

  const metadata = await resolveOAuthMetadata(normalized)
  const redirectUri = `http://127.0.0.1:${Number(port) || 8787}/api/mcp/oauth/callback`
  const client = await resolveOAuthClient(normalized, metadata, redirectUri)
  const codeVerifier = base64Url(randomBytes(32))
  const state = base64Url(randomBytes(24))
  const resource = canonicalResourceUri(normalized.url)
  const scopes = normalized.oauthScopes || metadata.scope || ''
  const authorizationUrl = new URL(metadata.authorizationEndpoint)

  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('client_id', client.clientId)
  authorizationUrl.searchParams.set('redirect_uri', redirectUri)
  authorizationUrl.searchParams.set('code_challenge', buildCodeChallenge(codeVerifier))
  authorizationUrl.searchParams.set('code_challenge_method', 'S256')
  authorizationUrl.searchParams.set('state', state)
  authorizationUrl.searchParams.set('resource', resource)
  if (scopes) {
    authorizationUrl.searchParams.set('scope', scopes)
  }

  const flow = {
    state,
    codeVerifier,
    redirectUri,
    resource,
    tokenEndpoint: metadata.tokenEndpoint,
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    server: {
      ...normalized,
      authType: 'oauth',
      oauthAuthorizationUrl: metadata.authorizationEndpoint,
      oauthTokenUrl: metadata.tokenEndpoint,
      oauthClientId: client.clientId,
      oauthClientSecretEnv: normalized.oauthClientSecretEnv,
      oauthScopes: scopes,
      enabled: true,
    },
    createdAt: Date.now(),
  }

  pendingFlows.set(state, flow)
  setTimeout(() => {
    const pending = pendingFlows.get(state)
    if (pending?.createdAt === flow.createdAt) {
      pendingFlows.delete(state)
    }
  }, FLOW_TTL_MS).unref?.()

  return {
    ok: true,
    authorizationUrl: authorizationUrl.toString(),
    redirectUri,
    state,
    resource,
    scope: scopes,
    serverId: normalized.id,
  }
}

export async function completeMcpOAuthCallback({ state, code, error, configStore, keychainStore } = {}) {
  const key = String(state ?? '').trim()
  const flow = pendingFlows.get(key)
  pendingFlows.delete(key)

  if (error) {
    throw new Error(`OAuth authorization failed: ${String(error)}`)
  }
  if (!flow) {
    throw new Error('OAuth flow expired or was not started from this modAI session')
  }
  if (!code) {
    throw new Error('OAuth callback did not include an authorization code')
  }

  const form = new URLSearchParams()
  form.set('grant_type', 'authorization_code')
  form.set('code', String(code))
  form.set('redirect_uri', flow.redirectUri)
  form.set('client_id', flow.clientId)
  form.set('code_verifier', flow.codeVerifier)
  form.set('resource', flow.resource)
  if (flow.clientSecret) {
    form.set('client_secret', flow.clientSecret)
  }

  const tokenResponse = await fetch(flow.tokenEndpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(15_000),
  })

  const tokenBody = await readJsonResponse(tokenResponse)
  if (!tokenResponse.ok) {
    const description = tokenBody.error_description || tokenBody.error || tokenResponse.statusText
    throw new Error(`OAuth token exchange failed: ${description}`)
  }

  const accessToken = String(tokenBody.access_token ?? '').trim()
  if (!accessToken) {
    throw new Error('OAuth token response did not include access_token')
  }

  let tokenSource = 'config'
  let tokenForConfig = accessToken
  if (keychainStore?.isAvailable?.()) {
    try {
      await keychainStore.setMcpAuthToken(flow.server.id, accessToken)
      tokenSource = 'keychain'
      tokenForConfig = ''
    } catch {
      tokenSource = 'config'
      tokenForConfig = accessToken
    }
  }

  const savedConfig = await configStore.update(current => {
    const servers = Array.isArray(current.mcp?.servers) ? [...current.mcp.servers] : []
    const nextServer = {
      ...flow.server,
      authType: 'oauth',
      authToken: tokenForConfig,
      authTokenSource: tokenSource,
      clearAuthToken: false,
      enabled: true,
    }
    const index = servers.findIndex(item => item.id === nextServer.id)
    if (index >= 0) {
      servers[index] = {
        ...servers[index],
        ...nextServer,
      }
    } else {
      servers.push(nextServer)
    }
    current.mcp = {
      ...(current.mcp ?? {}),
      servers,
    }
    return current
  })

  return {
    ok: true,
    serverId: flow.server.id,
    serverName: flow.server.name,
    tokenSource,
    tokenType: tokenBody.token_type || 'Bearer',
    expiresIn: tokenBody.expires_in ?? null,
    scope: tokenBody.scope || flow.server.oauthScopes || '',
    config: savedConfig,
  }
}

function normalizeOAuthServer(server = {}) {
  const transport = ['http', 'sse'].includes(server.transport) ? server.transport : 'http'
  return {
    id: String(server.id ?? '').trim() || `mcp-${Date.now().toString(36)}`,
    presetId: String(server.presetId ?? '').trim(),
    name: String(server.name ?? '').trim() || 'Custom MCP',
    transport,
    url: String(server.url ?? '').trim(),
    command: String(server.command ?? '').trim(),
    argsText: String(server.argsText ?? '').trim(),
    headersText: String(server.headersText ?? '').trim(),
    authType: 'oauth',
    authTokenEnv: String(server.authTokenEnv ?? '').trim(),
    authToken: '',
    authTokenSource: '',
    oauthAuthorizationUrl: String(server.oauthAuthorizationUrl ?? '').trim(),
    oauthTokenUrl: String(server.oauthTokenUrl ?? '').trim(),
    oauthClientId: String(server.oauthClientId ?? '').trim(),
    oauthClientSecretEnv: String(server.oauthClientSecretEnv ?? '').trim(),
    oauthScopes: String(server.oauthScopes ?? '').trim(),
    enabled: server.enabled !== false,
  }
}

async function resolveOAuthMetadata(server) {
  const manualAuthorizationEndpoint = server.oauthAuthorizationUrl
  const manualTokenEndpoint = server.oauthTokenUrl
  if (manualAuthorizationEndpoint && manualTokenEndpoint) {
    return {
      authorizationEndpoint: manualAuthorizationEndpoint,
      tokenEndpoint: manualTokenEndpoint,
      scope: server.oauthScopes,
      raw: {},
    }
  }

  const resourceMetadata = await discoverProtectedResourceMetadata(server.url)
  const authorizationServer = firstString(resourceMetadata?.authorization_servers)
  const issuerUrl = authorizationServer || originForUrl(server.url)
  const authorizationMetadata = await discoverAuthorizationServerMetadata(issuerUrl)

  const authorizationEndpoint = manualAuthorizationEndpoint || authorizationMetadata?.authorization_endpoint
  const tokenEndpoint = manualTokenEndpoint || authorizationMetadata?.token_endpoint
  if (!authorizationEndpoint || !tokenEndpoint) {
    throw new Error('OAuth metadata could not be discovered. Add authorization URL, token URL, and client ID manually.')
  }

  return {
    authorizationEndpoint,
    tokenEndpoint,
    registrationEndpoint: authorizationMetadata?.registration_endpoint || '',
    scope: server.oauthScopes || normalizeScopes(resourceMetadata?.scopes_supported),
    raw: authorizationMetadata ?? {},
  }
}

async function resolveOAuthClient(server, metadata, redirectUri) {
  const clientSecret = resolveClientSecret(server)
  if (server.oauthClientId) {
    return {
      clientId: server.oauthClientId,
      clientSecret,
    }
  }

  if (!metadata.registrationEndpoint) {
    throw new Error('OAuth client ID is required. This provider does not advertise dynamic client registration.')
  }

  const registrationResponse = await fetch(metadata.registrationEndpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_name: 'modAI',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: server.oauthScopes || undefined,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const registration = await readJsonResponse(registrationResponse)
  if (!registrationResponse.ok) {
    const description = registration.error_description || registration.error || registrationResponse.statusText
    throw new Error(`OAuth dynamic client registration failed: ${description}`)
  }

  const clientId = String(registration.client_id ?? '').trim()
  if (!clientId) {
    throw new Error('OAuth dynamic client registration did not return client_id')
  }

  return {
    clientId,
    clientSecret: String(registration.client_secret ?? '').trim(),
  }
}

async function discoverProtectedResourceMetadata(resourceUrl) {
  const candidates = buildProtectedResourceMetadataUrls(resourceUrl)
  const advertised = await readAdvertisedProtectedResourceMetadata(resourceUrl)
  if (advertised) {
    candidates.unshift(advertised)
  }
  return fetchFirstJson(candidates)
}

async function readAdvertisedProtectedResourceMetadata(resourceUrl) {
  try {
    const response = await fetch(resourceUrl, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    })
    const metadataUrl = parseResourceMetadataFromAuthenticateHeader(response.headers.get('www-authenticate') || '')
    await response.body?.cancel?.()
    return metadataUrl
  } catch {
    return ''
  }
}

function parseResourceMetadataFromAuthenticateHeader(header) {
  const match = String(header ?? '').match(/resource_metadata="([^"]+)"/i)
  return match?.[1] || ''
}

async function discoverAuthorizationServerMetadata(issuerUrl) {
  return fetchFirstJson(buildAuthorizationServerMetadataUrls(issuerUrl))
}

async function fetchFirstJson(candidates) {
  for (const candidate of uniqueStrings(candidates)) {
    try {
      const response = await fetch(candidate, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(7_000),
      })
      if (!response.ok) {
        continue
      }
      return await response.json()
    } catch {
      // Keep trying the next well-known location.
    }
  }
  return null
}

function buildProtectedResourceMetadataUrls(resourceUrl) {
  const parsed = new URL(resourceUrl)
  const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : ''
  return [
    new URL(`/.well-known/oauth-protected-resource${pathname}`, parsed.origin).toString(),
    new URL('/.well-known/oauth-protected-resource', parsed.origin).toString(),
  ]
}

function buildAuthorizationServerMetadataUrls(issuerUrl) {
  const parsed = new URL(issuerUrl)
  const pathname = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : ''
  return [
    new URL(`/.well-known/oauth-authorization-server${pathname}`, parsed.origin).toString(),
    new URL(`/.well-known/openid-configuration${pathname}`, parsed.origin).toString(),
    new URL('/.well-known/oauth-authorization-server', parsed.origin).toString(),
    new URL('/.well-known/openid-configuration', parsed.origin).toString(),
  ]
}

function resolveClientSecret(server) {
  if (!server.oauthClientSecretEnv) {
    return ''
  }
  return String(process.env[server.oauthClientSecretEnv] ?? '').trim()
}

function canonicalResourceUri(value) {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  return url.toString()
}

function originForUrl(value) {
  return new URL(value).origin
}

function normalizeScopes(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(' ') : ''
}

function firstString(value) {
  if (!Array.isArray(value)) {
    return ''
  }
  return String(value.find(item => typeof item === 'string' && item.trim()) ?? '').trim()
}

function uniqueStrings(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()))]
}

function buildCodeChallenge(verifier) {
  return base64Url(createHash('sha256').update(verifier).digest())
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '')
}

async function readJsonResponse(response) {
  const text = await response.text()
  if (!text) {
    return {}
  }
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}
