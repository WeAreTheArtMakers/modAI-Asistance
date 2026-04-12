const TASK_FIELD_PATTERN = /^(Gorev|Görev|Task|Amac|Amaç|Goal|Kisitlar|Kısıtlar|Constraints|Teslim|Due|Tamamlanma Kriteri|Completion Criteria)\s*:\s*(.*)$/i

export function serializeMessageContent(text, meta = {}) {
  const normalizedText = String(text ?? '').trim()
  const normalizedMeta = normalizeMessageMeta(meta)
  if (!Object.keys(normalizedMeta).length) {
    return normalizedText
  }
  return `${normalizedText}\n\n<modai_meta>${JSON.stringify(normalizedMeta)}</modai_meta>`
}

export function parseMessageContent(content) {
  const source = String(content ?? '')
  const match = source.match(/\s*<modai_meta>([\s\S]*?)<\/modai_meta>\s*$/)
  if (!match) {
    return {
      text: source.trim(),
      meta: null,
    }
  }

  let meta = null
  try {
    meta = JSON.parse(match[1])
  } catch {
    meta = null
  }

  return {
    text: source.slice(0, match.index).trim(),
    meta,
  }
}

export function normalizeMessageMeta(meta) {
  const next = {}
  if (Array.isArray(meta.attachments) && meta.attachments.length) {
    next.attachments = meta.attachments.map(attachment => ({
      name: attachment.name,
      path: attachment.path,
      type: attachment.type,
      size: attachment.size,
    }))
  }
  if (meta.mode && meta.mode !== 'chat') {
    next.mode = meta.mode
  }
  return next
}

export function parseTaskDraft(prompt) {
  const lines = String(prompt ?? '').split('\n')
  const fields = {
    title: '',
    goal: '',
    constraints: '',
    delivery: '',
    completion: '',
  }
  let currentKey = ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const match = line.match(TASK_FIELD_PATTERN)
    if (match) {
      currentKey = normalizeTaskFieldName(match[1])
      fields[currentKey] = sanitizeTaskFieldValue(match[2])
      continue
    }

    if (currentKey) {
      const value = sanitizeTaskFieldValue(line)
      fields[currentKey] = [fields[currentKey], value].filter(Boolean).join('\n')
    }
  }

  const body = String(prompt ?? '').trim()
  if (!fields.title && !fields.goal && !fields.delivery) {
    return null
  }

  return {
    ...fields,
    body,
  }
}

export function renderInline(value) {
  if (value === '' || value === undefined || value === null) {
    return '(empty)'
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length <= 120 ? text : `${text.slice(0, 120)}…`
}

export function summarizeTitle(value, fallback = 'New chat') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) {
    return fallback
  }
  return text.length <= 42 ? text : `${text.slice(0, 42)}…`
}

export function normalizeSteps(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(12, Math.round(parsed))) : 6
}

export function isValidProviderTab(value) {
  return ['local', 'cloud', 'advanced'].includes(value)
}

export function getDefaultProviderTab(settings) {
  const providers = settings?.providers ?? []
  if (providers.some(provider => provider.group === 'cloud' && provider.apiKeyEnv && !provider.hasCredential)) {
    return 'cloud'
  }
  if (providers.some(provider => provider.group === 'local' && !provider.available)) {
    return 'local'
  }
  return 'local'
}

export function formatDateTimeOffset(days, hour, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, minute, 0, 0)
  return formatDateTimeForTask(date)
}

export function formatNextWeekdayDateTime(weekday, hour, minute = 0) {
  const date = new Date()
  const currentDay = date.getDay()
  const offset = (weekday - currentDay + 7) % 7 || 7
  date.setDate(date.getDate() + offset)
  date.setHours(hour, minute, 0, 0)
  return formatDateTimeForTask(date)
}

export function formatDateTimeForTask(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

export function parseDeliveryDate(value) {
  const normalized = String(value ?? '').trim().replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function findLastUserMessage(items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role === 'user') {
      return items[index]
    }
  }
  return null
}

export function formatTimestamp(value, locale = 'en-US') {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString(locale, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatClock(value, locale = 'en-US') {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getTaskTimingState(task) {
  if (!task?.delivery) {
    return 'draft'
  }

  const parsed = parseDeliveryDate(task.delivery)
  if (!parsed) {
    return String(task.status || 'scheduled').toLowerCase()
  }

  const delta = parsed.getTime() - Date.now()
  if (delta < 0) {
    return 'overdue'
  }
  if (delta <= 60 * 60 * 1000) {
    return 'due-soon'
  }
  return 'scheduled'
}

export function getTaskStatusLabel(task, translate) {
  const stateValue = getTaskTimingState(task)
  if (stateValue === 'draft') {
    return translate('draft')
  }
  if (stateValue === 'overdue') {
    return translate('overdue')
  }
  if (stateValue === 'due-soon') {
    return translate('dueSoon')
  }
  return translate('scheduled')
}

export function readFileAsDataUrl(file) {
  return new Promise((resolvePromise, rejectPromise) => {
    const reader = new FileReader()
    reader.onerror = () => rejectPromise(reader.error || new Error('File could not be read'))
    reader.onload = () => resolvePromise(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function cssEscape(value) {
  return String(value).replaceAll('"', '\\"')
}

function sanitizeTaskFieldValue(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }

  if (/^\[[^\]]+\]$/.test(text) || /^<[^>]+>$/.test(text)) {
    return ''
  }

  return text
}

function normalizeTaskFieldName(label) {
  const normalized = String(label ?? '').toLowerCase()
  if (normalized.startsWith('gorev') || normalized.startsWith('görev') || normalized.startsWith('task')) {
    return 'title'
  }
  if (normalized.startsWith('amac') || normalized.startsWith('amaç') || normalized.startsWith('goal')) {
    return 'goal'
  }
  if (normalized.startsWith('kisit') || normalized.startsWith('kısıt') || normalized.startsWith('constraints')) {
    return 'constraints'
  }
  if (normalized.startsWith('teslim') || normalized.startsWith('due')) {
    return 'delivery'
  }
  return 'completion'
}
