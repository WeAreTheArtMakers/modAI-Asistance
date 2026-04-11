import { getJson, postJson } from '../utils/http.mjs'

export function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, '')
}

export function resolveApiKey(providerConfig) {
  const stored = typeof providerConfig.apiKey === 'string' ? providerConfig.apiKey.trim() : ''
  if (stored) {
    return stored
  }

  if (!providerConfig.apiKeyEnv) {
    return null
  }

  return process.env[providerConfig.apiKeyEnv] ?? null
}

export async function openAICompatibleListModels(baseUrl, headers) {
  const response = await getJson(`${normalizeBaseUrl(baseUrl)}/models`, { headers })
  return Array.isArray(response.data) ? response.data.map(item => item.id).filter(Boolean) : []
}

export { getJson, postJson }
