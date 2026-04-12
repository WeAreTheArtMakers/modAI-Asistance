import test from 'node:test'
import assert from 'node:assert/strict'

import { detectAgentRoute, resolveAgentModelRoute } from '../src/core/agentRouting.mjs'
import { createDefaultConfig } from '../src/services/defaultConfig.mjs'

test('detectAgentRoute distinguishes code, visual, desktop, and business asks', () => {
  assert.equal(
    detectAgentRoute({
      messages: [{ role: 'user', content: 'Refactor the failing React component and fix the build error' }],
      interactionMode: 'chat',
      assistantProfile: 'general',
    }),
    'code',
  )

  assert.equal(
    detectAgentRoute({
      messages: [{ role: 'user', content: 'Analyze this mockup\n\n<modai_meta>{"attachments":[{"name":"screen.png"}]}</modai_meta>' }],
      interactionMode: 'chat',
      assistantProfile: 'general',
    }),
    'visual',
  )

  assert.equal(
    detectAgentRoute({
      messages: [{ role: 'user', content: 'Open Finder and organize the files' }],
      interactionMode: 'desktop',
      assistantProfile: 'general',
    }),
    'desktop',
  )

  assert.equal(
    detectAgentRoute({
      messages: [{ role: 'user', content: 'Help me improve pricing and conversion for this SaaS' }],
      interactionMode: 'chat',
      assistantProfile: 'business-copilot',
    }),
    'business',
  )
})

test('resolveAgentModelRoute prefers route-capable available models', () => {
  const config = createDefaultConfig()
  const providerInsights = new Map([
    ['ollama', { health: { ok: true, message: 'ok' }, models: ['llama3.2', 'qwen2.5-coder:7b'] }],
    ['anthropic', { health: { ok: true, message: 'ok' }, models: ['claude-3-5-sonnet-latest'] }],
    ['gemini', { health: { ok: true, message: 'ok' }, models: ['gemini-2.5-pro'] }],
    ['openaiLocal', { health: { ok: false, message: 'offline' }, models: [] }],
  ])

  const codeRoute = resolveAgentModelRoute({
    config,
    providerInsights,
    requestedModel: 'ollama:llama3.2',
    messages: [{ role: 'user', content: 'Fix the TypeScript build error and add tests' }],
    interactionMode: 'chat',
    assistantProfile: 'general',
    agentRequested: true,
  })
  assert.equal(codeRoute.route, 'code')
  assert.equal(codeRoute.modelId, 'ollama:qwen2.5-coder:7b')
  assert.equal(codeRoute.autoSelected, true)

  const visualRoute = resolveAgentModelRoute({
    config,
    providerInsights,
    requestedModel: 'ollama:qwen2.5-coder:7b',
    messages: [{ role: 'user', content: 'Review this screenshot\n\n<modai_meta>{"attachments":[{"name":"screen.png"}]}</modai_meta>' }],
    interactionMode: 'chat',
    assistantProfile: 'general',
    agentRequested: true,
  })
  assert.equal(visualRoute.route, 'visual')
  assert.equal(visualRoute.modelId, 'anthropic:claude-3-5-sonnet-latest')
})
