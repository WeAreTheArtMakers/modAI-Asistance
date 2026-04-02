import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConfigStore } from '../src/services/ConfigStore.mjs'
import { SessionStore } from '../src/services/SessionStore.mjs'

test('SessionStore persists sessions, message search, and notes in SQLite', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-session-store-'))
  const configStore = new ConfigStore({
    baseDir,
    fallbackBaseDir: baseDir,
  })
  const sessionStore = new SessionStore(configStore)
  const sessionId = sessionStore.createSessionId()

  await sessionStore.save({
    sessionId,
    modelId: 'ollama:llama3.2',
    agentEnabled: true,
    agentMaxSteps: 6,
    startedAt: '2026-04-01T00:00:00.000Z',
    messages: [
      { role: 'user', content: 'Cyberpunk UI layout', createdAt: '2026-04-01T00:00:01.000Z' },
      { role: 'assistant', content: 'Composer tabana sabitlendi.', createdAt: '2026-04-01T00:00:02.000Z' },
    ],
  })

  const loaded = await sessionStore.loadSession(sessionId)
  assert.equal(loaded.sessionId, sessionId)
  assert.equal(loaded.messages.length, 2)
  assert.equal(loaded.messages[1].content, 'Composer tabana sabitlendi.')

  const searchResults = await sessionStore.search('Cyberpunk', 5)
  assert.equal(searchResults.length, 1)
  assert.equal(searchResults[0].sessionId, sessionId)

  const note = await sessionStore.addNote({
    sessionId,
    category: 'improvement',
    title: 'Dock contrast',
    content: 'Increase contrast for tool cards in dark mode.',
    source: 'agent',
  })
  assert.equal(note.sessionId, sessionId)

  const notes = await sessionStore.listNotes(5)
  assert.equal(notes.length, 1)
  assert.equal(notes[0].title, 'Dock contrast')

  const recent = await sessionStore.listRecent(5)
  assert.equal(recent.length, 1)
  assert.match(recent[0].preview, /Composer/)
})
