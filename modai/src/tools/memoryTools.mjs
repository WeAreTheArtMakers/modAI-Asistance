export function createMemoryTools() {
  return [
    {
      name: 'memory_recent',
      description: 'List recent sessions and saved internal notes',
      inputHint: '{"limit":6}',
      permissionKey: 'memory_recent',
      requiredMode: 'pro',
      async run(input, context) {
        const limit = normalizeLimit(input?.limit ?? input)
        const sessions = await context?.sessionStore?.listRecent?.(limit) ?? []
        const notes = await context?.sessionStore?.listNotes?.(limit) ?? []
        return JSON.stringify({ sessions, notes }, null, 2)
      },
    },
    {
      name: 'memory_search',
      description: 'Search previous session messages and notes with keyword plus semantic ranking',
      inputHint: '{"query":"UI redesign","limit":6}',
      permissionKey: 'memory_search',
      requiredMode: 'pro',
      async run(input, context) {
        const query = readQuery(input)
        if (!query) {
          throw new Error('Usage: memory_search {"query":"...","limit":6}')
        }
        const limit = normalizeLimit(input?.limit)
        const exactSessions = await context?.sessionStore?.search?.(query, limit) ?? []
        const semantic = await context?.sessionStore?.semanticSearch?.(query, limit) ?? { sessions: [], notes: [] }
        const notes = (await context?.sessionStore?.listNotes?.(limit * 2) ?? [])
          .filter(note => JSON.stringify(note).toLowerCase().includes(query.toLowerCase()))
          .slice(0, limit)
        return JSON.stringify({
          query,
          exactSessions,
          exactNotes: notes,
          semanticSessions: semantic.sessions ?? [],
          semanticNotes: semantic.notes ?? [],
        }, null, 2)
      },
    },
    {
      name: 'memory_semantic',
      description: 'Search memory by semantic similarity across messages and notes',
      inputHint: '{"query":"dark mode contrast issue","limit":6}',
      permissionKey: 'memory_search',
      requiredMode: 'pro',
      async run(input, context) {
        const query = readQuery(input)
        if (!query) {
          throw new Error('Usage: memory_semantic {"query":"...","limit":6}')
        }
        const limit = normalizeLimit(input?.limit)
        const semantic = await context?.sessionStore?.semanticSearch?.(query, limit) ?? { sessions: [], notes: [] }
        return JSON.stringify({ query, ...semantic }, null, 2)
      },
    },
    {
      name: 'memory_note',
      description: 'Persist an internal note or improvement idea into SQLite memory',
      inputHint: '{"title":"Improve control dock","content":"Turn permissions into grouped presets","category":"improvement"}',
      permissionKey: 'memory_note',
      requiredMode: 'pro',
      async run(input, context) {
        const payload = readNoteInput(input)
        if (!payload.title || !payload.content) {
          throw new Error('Usage: memory_note {"title":"...","content":"...","category":"improvement"}')
        }
        const note = await context?.sessionStore?.addNote?.({
          ...payload,
          sessionId: context?.state?.sessionId ?? context?.sessionId ?? '',
          source: 'agent',
        })
        return JSON.stringify(note, null, 2)
      },
    },
  ]
}

function readQuery(input) {
  if (typeof input === 'string') {
    return input.trim()
  }

  if (input && typeof input === 'object') {
    return String(input.query ?? input.text ?? '').trim()
  }

  return ''
}

function readNoteInput(input) {
  if (typeof input === 'string') {
    const [title, ...contentParts] = input.split(/\s+/)
    return {
      title: title ?? '',
      content: contentParts.join(' ').trim(),
      category: 'general',
    }
  }

  if (input && typeof input === 'object') {
    return {
      title: String(input.title ?? '').trim(),
      content: String(input.content ?? input.text ?? '').trim(),
      category: String(input.category ?? 'general').trim(),
    }
  }

  return {
    title: '',
    content: '',
    category: 'general',
  }
}

function normalizeLimit(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(20, Math.round(parsed))) : 6
}
