import { randomUUID } from 'node:crypto'
import { join } from 'node:path'

import { rankSemanticMatches } from './semanticMemory.mjs'

let sqliteModulePromise = null

export class SessionStore {
  constructor(configStore) {
    this.configStore = configStore
    this.db = null
  }

  createSessionId() {
    return randomUUID()
  }

  getDatabasePath() {
    return join(this.configStore.getBaseDir(), 'memory.sqlite')
  }

  async save(state) {
    const db = await this.ensureDb()
    const messages = Array.isArray(state.messages) ? state.messages : []
    const preview = buildPreview(messages)
    const startedAt = state.startedAt ?? new Date().toISOString()
    const updatedAt = new Date().toISOString()

    db.exec('BEGIN')
    try {
      db.prepare(`
        INSERT INTO sessions (
          session_id,
          model_id,
          agent_enabled,
          agent_max_steps,
          started_at,
          updated_at,
          message_count,
          preview
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          model_id = excluded.model_id,
          agent_enabled = excluded.agent_enabled,
          agent_max_steps = excluded.agent_max_steps,
          updated_at = excluded.updated_at,
          message_count = excluded.message_count,
          preview = excluded.preview
      `).run(
        state.sessionId,
        state.modelId,
        state.agentEnabled ? 1 : 0,
        state.agentMaxSteps ?? 6,
        startedAt,
        updatedAt,
        messages.length,
        preview,
      )

      db.prepare('DELETE FROM messages WHERE session_id = ?').run(state.sessionId)
      const insertMessage = db.prepare(`
        INSERT INTO messages (
          session_id,
          position,
          role,
          content,
          created_at
        ) VALUES (?, ?, ?, ?, ?)
      `)

      messages.forEach((message, index) => {
        insertMessage.run(
          state.sessionId,
          index,
          message.role ?? 'assistant',
          message.content ?? '',
          message.createdAt ?? updatedAt,
        )
      })

      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  async loadSession(sessionId) {
    const db = await this.ensureDb()
    const session = db.prepare(`
      SELECT
        session_id AS sessionId,
        model_id AS modelId,
        agent_enabled AS agentEnabled,
        agent_max_steps AS agentMaxSteps,
        started_at AS startedAt,
        updated_at AS updatedAt
      FROM sessions
      WHERE session_id = ?
      LIMIT 1
    `).get(sessionId)

    if (!session) {
      return null
    }

    const messages = db.prepare(`
      SELECT
        role,
        content,
        created_at AS createdAt
      FROM messages
      WHERE session_id = ?
      ORDER BY position ASC
    `).all(sessionId)

    return {
      ...session,
      agentEnabled: Boolean(session.agentEnabled),
      messages,
    }
  }

  async listRecent(limit = 10) {
    const db = await this.ensureDb()
    return db.prepare(`
      SELECT
        session_id AS sessionId,
        model_id AS modelId,
        updated_at AS updatedAt,
        started_at AS startedAt,
        message_count AS messageCount,
        preview
      FROM sessions
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit)
  }

  async deleteSession(sessionId) {
    const db = await this.ensureDb()
    db.exec('BEGIN')
    try {
      db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId)
      db.prepare('DELETE FROM notes WHERE session_id = ?').run(sessionId)
      db.prepare('DELETE FROM scheduled_tasks WHERE session_id = ?').run(sessionId)
      const result = db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId)
      db.exec('COMMIT')
      return result.changes > 0
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  async search(query, limit = 8) {
    const db = await this.ensureDb()
    const likePattern = `%${String(query ?? '').trim()}%`
    if (likePattern === '%%') {
      return []
    }

    return db.prepare(`
      SELECT
        m.session_id AS sessionId,
        s.model_id AS modelId,
        m.role,
        m.content,
        m.created_at AS createdAt
      FROM messages m
      JOIN sessions s ON s.session_id = m.session_id
      WHERE m.content LIKE ? COLLATE NOCASE
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(likePattern, limit)
  }

  async semanticSearch(query, limit = 8) {
    const db = await this.ensureDb()
    const textQuery = String(query ?? '').trim()
    if (!textQuery) {
      return { sessions: [], notes: [] }
    }

    const messages = db.prepare(`
      SELECT
        m.session_id AS sessionId,
        s.model_id AS modelId,
        s.preview,
        m.role,
        m.content,
        m.created_at AS createdAt
      FROM messages m
      JOIN sessions s ON s.session_id = m.session_id
      ORDER BY m.created_at DESC
      LIMIT 250
    `).all()

    const notes = db.prepare(`
      SELECT
        note_id AS noteId,
        session_id AS sessionId,
        category,
        title,
        content,
        source,
        created_at AS createdAt
      FROM notes
      ORDER BY created_at DESC
      LIMIT 120
    `).all()

    return {
      sessions: rankSemanticMatches(textQuery, messages.map(message => ({
        ...message,
        semanticText: `${message.preview}\n${message.content}`,
      })), { limit }),
      notes: rankSemanticMatches(textQuery, notes.map(note => ({
        ...note,
        semanticText: `${note.title}\n${note.content}`,
      })), { limit }),
    }
  }

  async addNote({ title, content, category = 'general', sessionId = '', source = 'agent' }) {
    const db = await this.ensureDb()
    const noteId = randomUUID()
    const createdAt = new Date().toISOString()
    db.prepare(`
      INSERT INTO notes (
        note_id,
        session_id,
        category,
        title,
        content,
        source,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      noteId,
      sessionId,
      category,
      title,
      content,
      source,
      createdAt,
    )

    return {
      noteId,
      sessionId,
      category,
      title,
      content,
      source,
      createdAt,
    }
  }

  async listNotes(limit = 12) {
    const db = await this.ensureDb()
    return db.prepare(`
      SELECT
        note_id AS noteId,
        session_id AS sessionId,
        category,
        title,
        content,
        source,
        created_at AS createdAt
      FROM notes
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit)
  }

  async addScheduledTask({
    sessionId = '',
    mode = 'task',
    title,
    goal = '',
    constraints = '',
    delivery = '',
    completion = '',
    body = '',
    status = 'scheduled',
    source = 'user',
  }) {
    const db = await this.ensureDb()
    const taskId = randomUUID()
    const timestamp = new Date().toISOString()
    db.prepare(`
      INSERT INTO scheduled_tasks (
        task_id,
        session_id,
        mode,
        title,
        goal,
        constraints,
        delivery,
        completion,
        body,
        status,
        source,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      sessionId,
      mode,
      title,
      goal,
      constraints,
      delivery,
      completion,
      body,
      status,
      source,
      timestamp,
      timestamp,
    )

    return {
      taskId,
      sessionId,
      mode,
      title,
      goal,
      constraints,
      delivery,
      completion,
      body,
      status,
      source,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  }

  async listScheduledTasks(limit = 12) {
    const db = await this.ensureDb()
    return db.prepare(`
      SELECT
        task_id AS taskId,
        session_id AS sessionId,
        mode,
        title,
        goal,
        constraints,
        delivery,
        completion,
        body,
        status,
        source,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM scheduled_tasks
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit)
  }

  async getScheduledTask(taskId) {
    const db = await this.ensureDb()
    return db.prepare(`
      SELECT
        task_id AS taskId,
        session_id AS sessionId,
        mode,
        title,
        goal,
        constraints,
        delivery,
        completion,
        body,
        status,
        source,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM scheduled_tasks
      WHERE task_id = ?
      LIMIT 1
    `).get(taskId) ?? null
  }

  async updateScheduledTask(taskId, patch) {
    const db = await this.ensureDb()
    const timestamp = new Date().toISOString()
    const result = db.prepare(`
      UPDATE scheduled_tasks
      SET
        title = ?,
        goal = ?,
        constraints = ?,
        delivery = ?,
        completion = ?,
        body = ?,
        status = ?,
        updated_at = ?
      WHERE task_id = ?
    `).run(
      patch.title,
      patch.goal,
      patch.constraints,
      patch.delivery,
      patch.completion,
      patch.body,
      patch.status,
      timestamp,
      taskId,
    )

    if (!result.changes) {
      return null
    }

    return this.getScheduledTask(taskId)
  }

  async deleteScheduledTask(taskId) {
    const db = await this.ensureDb()
    const result = db.prepare('DELETE FROM scheduled_tasks WHERE task_id = ?').run(taskId)
    return result.changes > 0
  }

  async ensureDb() {
    if (this.db) {
      return this.db
    }

    await this.configStore.ensureLayout()
    const { DatabaseSync } = await loadSqliteModule()
    const db = new DatabaseSync(this.getDatabasePath())
    db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        agent_enabled INTEGER NOT NULL,
        agent_max_steps INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        preview TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS messages (
        session_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (session_id, position)
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
      CREATE TABLE IF NOT EXISTS notes (
        note_id TEXT PRIMARY KEY,
        session_id TEXT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        task_id TEXT PRIMARY KEY,
        session_id TEXT,
        mode TEXT NOT NULL,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        constraints TEXT NOT NULL,
        delivery TEXT NOT NULL,
        completion TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_updated_at ON scheduled_tasks(updated_at DESC);
    `)
    this.db = db
    return db
  }
}

async function loadSqliteModule() {
  sqliteModulePromise ??= import('node:sqlite')
  return sqliteModulePromise
}

function buildPreview(messages) {
  const latest = [...messages].reverse().find(message => String(message.content ?? '').trim())
  if (!latest) {
    return 'New session'
  }

  const source = extractPreviewText(String(latest.content ?? ''))
  return source.length <= 180 ? source : `${source.slice(0, 180)}…`
}

function extractPreviewText(content) {
  const metaMatch = content.match(/\s*<modai_meta>([\s\S]*?)<\/modai_meta>\s*$/)
  const visible = (metaMatch ? content.slice(0, metaMatch.index) : content).replace(/\s+/g, ' ').trim()
  if (visible) {
    return visible
  }

  if (!metaMatch) {
    return 'New session'
  }

  try {
    const meta = JSON.parse(metaMatch[1])
    const attachmentNames = Array.isArray(meta.attachments)
      ? meta.attachments.map(attachment => attachment.name).filter(Boolean)
      : []
    if (attachmentNames.length) {
      return `Attachment: ${attachmentNames.join(', ')}`
    }
    if (meta.mode) {
      return `Mode: ${meta.mode}`
    }
  } catch {
    return 'New session'
  }

  return 'New session'
}
