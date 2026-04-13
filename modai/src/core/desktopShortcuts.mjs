const META_BLOCK_PATTERN = /\s*<modai_meta>[\s\S]*<\/modai_meta>\s*$/i
const SEARCH_VERB_PATTERN = /\b(?:ara|search)\b/i

export function createDesktopShortcut(content) {
  const text = stripMetaContent(content)
  if (!text) {
    return null
  }

  const fields = parseStructuredFields(text)
  const hasStructuredFields = Object.values(fields).some(Boolean)
  const structuredIntent = [
    fields.gorev,
    fields.amac,
    fields.kisitlar,
    fields.tamamlanmaKriteri,
    fields.teslim,
  ].filter(Boolean).join('\n') || text

  const chromeRequested = /\b(?:chrome|chorme|google chrome)\b/i.test(text)
  const finderShortcut = createFinderShortcut(structuredIntent)
  if (finderShortcut) {
    return finderShortcut
  }

  const screenshotShortcut = createScreenshotShortcut(structuredIntent)
  if (screenshotShortcut) {
    return screenshotShortcut
  }

  const youtubeIntent = /\byoutube\b/i.test(structuredIntent)
  const youtubeQuery = youtubeIntent
    ? (hasStructuredFields ? deriveYoutubeQueryFromFields(fields) : '') || extractSearchQuery(structuredIntent, 'youtube')
    : ''
  if (youtubeQuery) {
    return {
      toolName: 'open',
      input: {
        target: `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeQuery)}`,
        ...(chromeRequested ? { application: 'Google Chrome' } : {}),
      },
      successMessage: `Opened YouTube search: ${youtubeQuery}`,
    }
  }

  if (/\byoutube\b/i.test(structuredIntent)) {
    return {
      toolName: 'open',
      input: {
        target: 'https://www.youtube.com',
        ...(chromeRequested ? { application: 'Google Chrome' } : {}),
      },
      successMessage: 'Opened YouTube.',
    }
  }

  const googleQuery = extractSearchQuery(structuredIntent, 'google')
  if (googleQuery) {
    return {
      toolName: 'open',
      input: {
        target: `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`,
        ...(chromeRequested ? { application: 'Google Chrome' } : {}),
      },
      successMessage: `Opened browser search: ${googleQuery}`,
    }
  }

  const urlMatch = structuredIntent.match(/https?:\/\/\S+/i)
  if (urlMatch) {
    return {
      toolName: 'open',
      input: {
        target: urlMatch[0],
        ...(chromeRequested ? { application: 'Google Chrome' } : {}),
      },
      successMessage: `Opened link: ${urlMatch[0]}`,
    }
  }

  if (chromeRequested && /\b(?:ac|aç|open)\b/i.test(structuredIntent)) {
    return {
      toolName: 'open',
      input: {
        application: 'Google Chrome',
      },
      successMessage: 'Opened Google Chrome.',
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

function parseStructuredFields(text) {
  const fields = {
    gorev: '',
    amac: '',
    kisitlar: '',
    teslim: '',
    tamamlanmaKriteri: '',
  }

  for (const rawLine of String(text ?? '').split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const match = line.match(/^(Gorev|Görev|Task|Amac|Amaç|Goal|Kisitlar|Kısıtlar|Constraints|Teslim|Due|Tamamlanma Kriteri|Completion Criteria)\s*:\s*(.*)$/i)
    if (!match) {
      continue
    }

    const key = normalizeFieldKey(match[1])
    fields[key] = cleanQuery(match[2])
  }

  return fields
}

function normalizeFieldKey(value) {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized.startsWith('gorev') || normalized.startsWith('görev') || normalized.startsWith('task')) {
    return 'gorev'
  }
  if (normalized.startsWith('amac') || normalized.startsWith('amaç') || normalized.startsWith('goal')) {
    return 'amac'
  }
  if (normalized.startsWith('kisit') || normalized.startsWith('kısıt') || normalized.startsWith('constraints')) {
    return 'kisitlar'
  }
  if (normalized.startsWith('teslim') || normalized.startsWith('due')) {
    return 'teslim'
  }
  return 'tamamlanmaKriteri'
}

function deriveYoutubeQueryFromFields(fields) {
  const candidates = [
    fields.amac,
    fields.gorev,
    fields.tamamlanmaKriteri,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const cleaned = cleanQuery(
      candidate
        .replace(/\byoutube\b/gi, '')
        .replace(/\b(?:video(?:lari|ları|lari)?|videolarini|sonuclari|sonuçlari)\b/gi, '')
        .replace(/\b(?:goster|göster|gelsin|gorunuyor|görünüyor|ac|aç|ziyaret et|izle|ara|arama|search|bul|bulmak|bulun|find|show|open|visit|results|visible)\b/gi, '')
        .replace(/\b(?:olsun|gibi|icin|için|on)\b/gi, ''),
    )

    if (cleaned && !/^\b(?:yok|none|bos|boş)\b$/i.test(cleaned)) {
      return cleaned
    }
  }

  return ''
}

function createFinderShortcut(text) {
  if (!/\bfinder\b/i.test(text) && !/\bdownloads?\b/i.test(text)) {
    return null
  }

  if (!/\b(?:ac|aç|open|goster|göster|ziyaret et)\b/i.test(text)) {
    return null
  }

  const home = process.env.HOME || ''
  const target = /\bdownloads?\b/i.test(text) && home
    ? `${home}/Downloads`
    : home || '.'

  return {
    toolName: 'open',
    input: {
      target,
      application: 'Finder',
    },
    successMessage: target.endsWith('/Downloads')
      ? 'Opened Finder to Downloads.'
      : 'Opened Finder.',
  }
}

function createScreenshotShortcut(text) {
  if (!/\b(?:screenshot|screen\s*capture|ekran goruntusu|ekran görüntüsü|ekrani yakala|ekranı yakala)\b/i.test(text)) {
    return null
  }

  const home = process.env.HOME || ''
  const fileName = `modAI-screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
  const targetPath = home ? `${home}/Desktop/${fileName}` : fileName

  return {
    toolName: 'screenshot',
    input: {
      path: targetPath,
    },
    successMessage: `Saved screenshot: ${targetPath}`,
  }
}
