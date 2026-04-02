import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

const DEFAULT_IMAGE_PROMPT = 'Use the attached image as context.'

const IMAGE_EXTENSIONS = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.heic', 'image/heic'],
])

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

export async function normalizeMessagesWithAttachments(messages) {
  const sourceMessages = Array.isArray(messages) ? messages : []
  return Promise.all(sourceMessages.map(normalizeSingleMessage))
}

export function inferVisionSupport(modelName = '', details = {}) {
  const haystack = [
    modelName,
    details.family,
    ...(Array.isArray(details.families) ? details.families : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return [
    'gemma3',
    'qwen25vl',
    'qwen2.5vl',
    'vision',
    'vl',
    'llava',
    'bakllava',
    'minicpm-v',
    'moondream',
  ].some(token => haystack.includes(token))
}

async function normalizeSingleMessage(message = {}) {
  const parsed = parseMessageContent(message.content ?? '')
  const attachments = await loadImageAttachments(parsed.meta?.attachments)

  return {
    role: message.role ?? 'user',
    text: parsed.text,
    meta: parsed.meta ?? null,
    attachments,
  }
}

async function loadImageAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return []
  }

  const loaded = []
  for (const attachment of attachments) {
    if (!attachment?.path || !isImageAttachment(attachment)) {
      continue
    }

    let buffer
    try {
      buffer = await readFile(attachment.path)
    } catch {
      throw new Error(`Attached image is no longer available: ${attachment.name || attachment.path}`)
    }

    const mediaType = normalizeMediaType(attachment)
    loaded.push({
      name: attachment.name || 'attachment',
      path: attachment.path,
      mediaType,
      base64: buffer.toString('base64'),
      dataUrl: `data:${mediaType};base64,${buffer.toString('base64')}`,
      size: buffer.length,
    })
  }

  return loaded
}

function isImageAttachment(attachment) {
  const explicitType = String(attachment?.type ?? '').trim().toLowerCase()
  if (explicitType.startsWith('image/')) {
    return true
  }

  const extension = extname(String(attachment?.name ?? attachment?.path ?? '')).toLowerCase()
  return IMAGE_EXTENSIONS.has(extension)
}

function normalizeMediaType(attachment) {
  const explicitType = String(attachment?.type ?? '').trim().toLowerCase()
  if (explicitType.startsWith('image/')) {
    return explicitType
  }

  const extension = extname(String(attachment?.name ?? attachment?.path ?? '')).toLowerCase()
  return IMAGE_EXTENSIONS.get(extension) ?? 'image/png'
}

export function ensurePromptText(text, attachments) {
  const normalizedText = String(text ?? '').trim()
  if (normalizedText) {
    return normalizedText
  }

  return attachments.length ? DEFAULT_IMAGE_PROMPT : ''
}
