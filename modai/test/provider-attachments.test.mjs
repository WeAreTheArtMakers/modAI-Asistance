import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { normalizeMessagesWithAttachments, parseMessageContent } from '../src/providers/messageContent.mjs'
import { createOllamaProvider } from '../src/providers/ollama.mjs'

test('parseMessageContent strips hidden modAI metadata', () => {
  const parsed = parseMessageContent('Grafiği yorumla\n\n<modai_meta>{"mode":"chat"}</modai_meta>')
  assert.equal(parsed.text, 'Grafiği yorumla')
  assert.deepEqual(parsed.meta, { mode: 'chat' })
})

test('normalizeMessagesWithAttachments loads uploaded image payloads', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-attachments-'))
  const imagePath = join(baseDir, 'chart.png')
  await writeFile(imagePath, Buffer.from('89504e470d0a1a0a', 'hex'))

  const [message] = await normalizeMessagesWithAttachments([
    {
      role: 'user',
      content: `Grafiği analiz et\n\n<modai_meta>${JSON.stringify({
        attachments: [{ name: 'chart.png', path: imagePath, type: 'image/png' }],
      })}</modai_meta>`,
    },
  ])

  assert.equal(message.text, 'Grafiği analiz et')
  assert.equal(message.attachments.length, 1)
  assert.equal(message.attachments[0].mediaType, 'image/png')
  assert.equal(typeof message.attachments[0].base64, 'string')
})

test('Ollama provider forwards image attachments as chat images', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-ollama-provider-'))
  const imagePath = join(baseDir, 'chart.jpg')
  await writeFile(imagePath, Buffer.from('ffd8ffe000104a46494600', 'hex'))

  const requests = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    requests.push({
      url,
      init,
      body: JSON.parse(String(init.body)),
    })

    return new Response(JSON.stringify({
      message: {
        content: 'Grafik yuklendi ve analiz edildi.',
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const provider = createOllamaProvider('ollama', {
      type: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
    })

    const result = await provider.chat({
      model: 'modAI:latest',
      system: 'You are modAI',
      messages: [{
        role: 'user',
        content: `Grafiği analiz et\n\n<modai_meta>${JSON.stringify({
          attachments: [{ name: 'chart.jpg', path: imagePath, type: 'image/jpeg' }],
        })}</modai_meta>`,
      }],
    })

    assert.equal(result.text, 'Grafik yuklendi ve analiz edildi.')
    assert.equal(requests.length, 1)
    assert.equal(requests[0].body.messages[1].content, 'Grafiği analiz et')
    assert.equal(Array.isArray(requests[0].body.messages[1].images), true)
    assert.equal(requests[0].body.messages[1].images.length, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
