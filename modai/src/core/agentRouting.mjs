import { parseMessageContent } from '../providers/messageContent.mjs'

const CODE_HINTS = [
  'bug', 'error', 'stack', 'trace', 'refactor', 'component', 'typescript', 'javascript', 'python',
  'node', 'api', 'repo', 'commit', 'patch', 'test', 'lint', 'build', 'crash', 'function', 'class',
  'kod', 'hata', 'derle', 'derleme', 'test', 'bileşen', 'bilesen', 'repo', 'commit',
]

const BUSINESS_HINTS = [
  'pricing', 'revenue', 'sales', 'market', 'growth', 'funnel', 'positioning', 'launch', 'gtm',
  'customer', 'conversion', 'business', 'yatirim', 'yatırım', 'gelir', 'satis', 'satış',
  'pazar', 'büyüme', 'buyume', 'müşteri', 'musteri',
]

const VISUAL_HINTS = [
  'image', 'screenshot', 'vision', 'visual', 'ui', 'ux', 'design', 'figma', 'photo', 'mockup',
  'gorsel', 'görsel', 'ekran', 'tasarim', 'tasarım', 'mockup',
]

export function detectAgentRoute({ messages, interactionMode = 'chat', assistantProfile = 'general' }) {
  if (interactionMode === 'desktop') {
    return 'desktop'
  }

  const latestUser = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user')
  const parsed = parseMessageContent(latestUser?.content ?? '')
  const text = String(parsed.text ?? '').toLocaleLowerCase('tr-TR')
  const hasAttachments = Array.isArray(parsed.meta?.attachments) && parsed.meta.attachments.length > 0

  if (hasAttachments || includesAny(text, VISUAL_HINTS)) {
    return 'visual'
  }
  if (assistantProfile === 'business-copilot' || includesAny(text, BUSINESS_HINTS)) {
    return 'business'
  }
  if (includesAny(text, CODE_HINTS)) {
    return 'code'
  }
  return 'general'
}

export function resolveAgentModelRoute({
  config,
  providerInsights,
  requestedModel,
  messages,
  interactionMode,
  assistantProfile,
  agentRequested,
}) {
  const route = detectAgentRoute({ messages, interactionMode, assistantProfile })
  const requestedId = typeof requestedModel === 'string' && requestedModel.trim()
    ? requestedModel.trim()
    : config.defaultModel

  if (!agentRequested || route === 'general') {
    return {
      route,
      modelId: requestedId,
      autoSelected: false,
    }
  }

  const candidates = Object.entries(config.models)
    .map(([id, definition]) => ({
      id,
      definition,
      available: isModelAvailable(definition, providerInsights),
    }))
    .filter(candidate => candidate.available)

  const ranked = candidates
    .map(candidate => ({
      ...candidate,
      score: scoreModelRoute(candidate, route, requestedId),
    }))
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score)

  if (!ranked.length) {
    return {
      route,
      modelId: requestedId,
      autoSelected: false,
    }
  }

  return {
    route,
    modelId: ranked[0].id,
    autoSelected: ranked[0].id !== requestedId,
  }
}

function scoreModelRoute(candidate, route, requestedId) {
  const id = candidate.id.toLocaleLowerCase('en-US')
  const label = String(candidate.definition.label ?? '').toLocaleLowerCase('en-US')
  const capabilities = candidate.definition.capabilities ?? {}
  let score = candidate.id === requestedId ? 25 : 0

  if (route === 'visual') {
    if (capabilities.vision) {
      score += 260
    }
    if (label.includes('vision') || label.includes('visual') || id.includes('vision') || id.includes('vl')) {
      score += 60
    }
  }

  if (route === 'desktop') {
    if (capabilities.desktop) {
      score += 260
    }
    if (capabilities.vision) {
      score += 80
    }
    if (label.includes('sonnet') || id.includes('claude')) {
      score += 50
    }
  }

  if (route === 'code') {
    if (capabilities.code) {
      score += 260
    }
    if (label.includes('coder') || id.includes('coder') || id.includes('code')) {
      score += 80
    }
  }

  if (route === 'business') {
    if (capabilities.business) {
      score += 260
    }
    if (label.includes('business') || label.includes('general default') || id.includes('llama3.2')) {
      score += 60
    }
  }

  if (capabilities.imageGeneration && route !== 'visual') {
    score -= 120
  }

  return score
}

function isModelAvailable(definition, providerInsights) {
  const providerInsight = providerInsights.get(definition.provider)
  if (!providerInsight?.health?.ok) {
    return false
  }
  return providerInsight.models.length === 0 || providerInsight.models.includes(definition.model)
}

function includesAny(text, hints) {
  const words = new Set(text.match(/[\p{L}\p{N}_-]+/gu) ?? [])
  return hints.some(token => token.includes(' ') ? text.includes(token) : words.has(token))
}
