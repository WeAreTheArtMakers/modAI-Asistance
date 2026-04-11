import test from 'node:test'
import assert from 'node:assert/strict'

import { createSystemPrompt } from '../src/prompts/systemPrompt.mjs'

test('createSystemPrompt injects business copilot instructions when selected', () => {
  const prompt = createSystemPrompt({
    modelId: 'ollama:gemma3:4b',
    tools: [{ name: 'read', description: 'Read a file', inputHint: '{"path":"README.md"}' }],
    platform: 'darwin',
    assistantProfile: 'business-copilot',
  })

  assert.match(prompt, /advanced AI Business Development Copilot/i)
  assert.match(prompt, /### 📊 Situation Analysis/)
  assert.match(prompt, /### 🚀 Growth Strategy/)
})

test('createSystemPrompt stays compact for the general assistant profile', () => {
  const prompt = createSystemPrompt({
    modelId: 'ollama:gemma3:4b',
    tools: [],
    platform: 'darwin',
    assistantProfile: 'general',
  })

  assert.doesNotMatch(prompt, /Business Development Copilot/i)
  assert.match(prompt, /You are modAI/)
})
