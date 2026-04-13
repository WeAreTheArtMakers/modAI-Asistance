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

  const task = await sessionStore.addScheduledTask({
    sessionId,
    mode: 'task',
    title: 'Haftalik rapor',
    goal: 'Raporu sabaha hazir tut',
    constraints: 'Sadece mevcut dosyalar',
    delivery: '2026-04-03 09:00',
    body: 'Gorev: Haftalik rapor',
    status: 'scheduled',
    source: 'user',
  })
  assert.equal(task.title, 'Haftalik rapor')

  const tasks = await sessionStore.listScheduledTasks(5)
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].delivery, '2026-04-03 09:00')

  const updatedTask = await sessionStore.updateScheduledTask(task.taskId, {
    ...task,
    title: 'Haftalik rapor guncel',
    goal: 'Raporu bugun bitir',
    constraints: 'Sadece son veri seti',
    delivery: '2026-04-03 11:30',
    completion: 'PDF hazir',
    body: 'Task: Haftalik rapor guncel',
    status: 'scheduled',
  })
  assert.equal(updatedTask.title, 'Haftalik rapor guncel')
  assert.equal(updatedTask.delivery, '2026-04-03 11:30')
  assert.equal(updatedTask.completion, 'PDF hazir')

  const deleted = await sessionStore.deleteSession(sessionId)
  assert.equal(deleted, true)

  const deletedSession = await sessionStore.loadSession(sessionId)
  assert.equal(deletedSession, null)
})
