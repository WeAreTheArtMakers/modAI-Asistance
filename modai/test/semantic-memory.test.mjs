import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConfigStore } from '../src/services/ConfigStore.mjs'
import { SessionStore } from '../src/services/SessionStore.mjs'

test('SessionStore semanticSearch ranks similar past work even without exact keywords', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-semantic-memory-'))
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
      { role: 'user', content: 'Improve contrast and readability for the dark mode settings drawer', createdAt: '2026-04-01T00:00:01.000Z' },
      { role: 'assistant', content: 'Raised surface contrast, widened the drawer, and fixed the activity panel spacing.', createdAt: '2026-04-01T00:00:02.000Z' },
    ],
  })

  await sessionStore.addNote({
    sessionId,
    category: 'improvement',
    title: 'Drawer polish',
    content: 'Make the settings panel wider and improve tab legibility on small screens.',
    source: 'agent',
  })

  const results = await sessionStore.semanticSearch('settings panel readability and wider tabs', 5)

  assert.equal(results.sessions.length > 0, true)
  assert.equal(results.notes.length > 0, true)
  assert.match(results.sessions[0].content, /drawer/i)
  assert.match(results.notes[0].title, /Drawer polish/i)
})
