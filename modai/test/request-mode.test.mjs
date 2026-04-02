import test from 'node:test'
import assert from 'node:assert/strict'

import { detectInteractionMode, shouldEnableAgentForMode } from '../src/core/requestMode.mjs'

test('detectInteractionMode defaults to chat for plain messages and attachments', () => {
  assert.equal(detectInteractionMode([{ role: 'user', content: 'Merhaba' }]), 'chat')
  assert.equal(
    detectInteractionMode([{
      role: 'user',
      content: 'Grafiği analiz et\n\n<modai_meta>{"attachments":[{"name":"chart.jpg","path":"/tmp/chart.jpg","type":"image/jpeg"}]}</modai_meta>',
    }]),
    'chat',
  )
})

test('detectInteractionMode recognizes task and desktop modes from hidden metadata', () => {
  assert.equal(
    detectInteractionMode([{ role: 'user', content: 'Plan çıkar\n\n<modai_meta>{"mode":"task"}</modai_meta>' }]),
    'task',
  )
  assert.equal(
    detectInteractionMode([{ role: 'user', content: 'Bilgisayarı kullan\n\n<modai_meta>{"mode":"desktop"}</modai_meta>' }]),
    'desktop',
  )
})

test('shouldEnableAgentForMode enables tools only for task and desktop flows', () => {
  assert.equal(shouldEnableAgentForMode(true, 'chat'), false)
  assert.equal(shouldEnableAgentForMode(true, 'task'), true)
  assert.equal(shouldEnableAgentForMode(true, 'desktop'), true)
  assert.equal(shouldEnableAgentForMode(false, 'task'), false)
})
