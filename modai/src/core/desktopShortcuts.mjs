const META_BLOCK_PATTERN = /\s*<modai_meta>[\s\S]*<\/modai_meta>\s*$/i
const SEARCH_VERB_PATTERN = /\b(?:ara|search)\b/i

export function createDesktopShortcut(content) {
  const text = stripMetaContent(content)
  if (!text) {
    return null
  }

  const fields = parseStructuredFields(text)
  const structuredIntent = [
    text,
    fields.gorev,
    fields.amac,
    fields.kisitlar,
    fields.tamamlanmaKriteri,
    fields.teslim,
  ].filter(Boolean).join('\n')

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
    ? extractSearchQuery(structuredIntent, 'youtube') || deriveYoutubeQueryFromFields(fields)
    : ''
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

  if (/\byoutube\b/i.test(structuredIntent)) {
    return {
      toolName: 'open',
      input: {
        target: 'https://www.youtube.com',
        ...(chromeRequested ? { application: 'Google Chrome' } : {}),
      },
      successMessage: 'YouTube acildi.',
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
      successMessage: `Tarayici aramasi acildi: ${googleQuery}`,
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
      successMessage: `Baglanti acildi: ${urlMatch[0]}`,
    }
  }

  if (chromeRequested && /\b(?:ac|aç|open)\b/i.test(structuredIntent)) {
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

    const match = line.match(/^(Gorev|Görev|Amac|Amaç|Kisitlar|Kısıtlar|Teslim|Tamamlanma Kriteri)\s*:\s*(.*)$/i)
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
  if (normalized.startsWith('gorev') || normalized.startsWith('görev')) {
    return 'gorev'
  }
  if (normalized.startsWith('amac') || normalized.startsWith('amaç')) {
    return 'amac'
  }
  if (normalized.startsWith('kisit') || normalized.startsWith('kısıt')) {
    return 'kisitlar'
  }
  if (normalized.startsWith('teslim')) {
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
        .replace(/\b(?:goster|göster|gelsin|gorunuyor|görünüyor|ac|aç|ziyaret et|izle|ara|arama|search|bul|bulmak|bulun)\b/gi, '')
        .replace(/\b(?:olsun|gibi|icin|için)\b/gi, ''),
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
      ? 'Finder Downloads klasorunu acti.'
      : 'Finder acildi.',
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
    successMessage: `Ekran goruntusu kaydedildi: ${targetPath}`,
  }
}
