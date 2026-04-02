const META_BLOCK_PATTERN = /\s*<modai_meta>[\s\S]*<\/modai_meta>\s*$/i
const SEARCH_VERB_PATTERN = /\b(?:ara|search)\b/i

export function createDesktopShortcut(content) {
  const text = stripMetaContent(content)
  if (!text) {
    return null
  }

  const chromeRequested = /\b(?:chrome|chorme|google chrome)\b/i.test(text)
  const youtubeQuery = extractSearchQuery(text, 'youtube')
  if (youtubeQuery) {
    return {
      toolName: 'open',
      input: {
        target: `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeQuery)}`,
        ...(chromeRequested ? { application: 'Google Chrome' } : {}),
      },
      successMessage: `YouTube aramasi acildi: ${youtubeQuery}`,
    }
  }

  const googleQuery = extractSearchQuery(text, 'google')
  if (googleQuery) {
    return {
      toolName: 'open',
      input: {
        target: `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`,
        ...(chromeRequested ? { application: 'Google Chrome' } : {}),
      },
      successMessage: `Tarayici aramasi acildi: ${googleQuery}`,
    }
  }

  const urlMatch = text.match(/https?:\/\/\S+/i)
  if (urlMatch) {
    return {
      toolName: 'open',
      input: {
        target: urlMatch[0],
        ...(chromeRequested ? { application: 'Google Chrome' } : {}),
      },
      successMessage: `Baglanti acildi: ${urlMatch[0]}`,
    }
  }

  if (chromeRequested && /\b(?:ac|aç|open)\b/i.test(text)) {
    return {
      toolName: 'open',
      input: {
        application: 'Google Chrome',
      },
      successMessage: 'Google Chrome acildi.',
    }
  }

  return null
}

export function extractSearchQuery(text, providerName) {
  const provider = String(providerName ?? '').trim().toLowerCase()
  const raw = normalizeSpaces(stripMetaContent(text))
  if (!provider || !raw) {
    return ''
  }

  if (!new RegExp(`\\b${provider}\\b`, 'i').test(raw) || !SEARCH_VERB_PATTERN.test(raw)) {
    return ''
  }

  const providerScoped = raw.slice(raw.search(new RegExp(`\\b${provider}\\b`, 'i')))
  const patterns = [
    new RegExp(`${provider}(?:\\s*['’]?\\s*(?:da|de)?)?\\s+(.+?)\\s+\\b(?:ara|search)\\b`, 'i'),
    new RegExp(`\\b(?:ara|search)\\b\\s+(.+?)\\s+(?:${provider})(?:\\s*['’]?\\s*(?:da|de)?)?`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = providerScoped.match(pattern) ?? raw.match(pattern)
    const query = cleanQuery(match?.[1] ?? '')
    if (query) {
      return query
    }
  }

  const providerSegments = providerScoped
    .replace(new RegExp(`^${provider}(?:\\s*['’]?\\s*(?:da|de)?)?`, 'i'), '')
    .split(/\b(?:ara|search)\b/i)
    .map(segment => cleanQuery(segment))
    .filter(Boolean)

  return providerSegments[0] ?? ''
}

function stripMetaContent(content) {
  return String(content ?? '').replace(META_BLOCK_PATTERN, '').trim()
}

function normalizeSpaces(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function cleanQuery(value) {
  return normalizeSpaces(
    String(value ?? '')
      .replace(/\b(?:ve|then|sonra)\b$/i, '')
      .replace(/^[,:-]+/, '')
      .replace(/[,:-]+$/, ''),
  )
}
