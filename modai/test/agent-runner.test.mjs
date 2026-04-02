import test from 'node:test'
import assert from 'node:assert/strict'

import { AgentRunner } from '../src/core/AgentRunner.mjs'
import { parseAgentResponse } from '../src/core/agentProtocol.mjs'
import { PermissionRequiredError } from '../src/core/toolAccess.mjs'

test('parseAgentResponse reads tool calls and finals', () => {
  const toolAction = parseAgentResponse('<tool_call>{"name":"read","input":{"path":"README.md"}}</tool_call>')
  assert.equal(toolAction.type, 'tool')
  assert.equal(toolAction.tool.name, 'read')
  assert.deepEqual(toolAction.tool.input, { path: 'README.md' })

  const finalAction = parseAgentResponse('<final>done</final>')
  assert.equal(finalAction.type, 'final')
  assert.equal(finalAction.message, 'done')
})

test('AgentRunner executes tool steps before returning a final answer', async () => {
  const replies = [
    '<tool_call>{"name":"read","input":{"path":"README.md"}}</tool_call>',
    '<final>README incelendi ve ajan tamamlandi.</final>',
  ]

  const provider = {
    async chat() {
      return { text: replies.shift() }
    },
  }

  const seenCalls = []
  const runner = new AgentRunner({
    toolRegistry: {
      list() {
        return [{ name: 'read', description: 'Read a file', inputHint: '{"path":"README.md"}' }]
      },
      async run(name, input) {
        seenCalls.push({ name, input })
        return '# README'
      },
    },
  })

  const result = await runner.run({
    provider,
    model: 'fake-model',
    systemPrompt: 'You are modAI',
    messages: [{ role: 'user', content: 'README dosyasina bak' }],
    agent: { enabled: true, maxSteps: 4 },
    context: {},
  })

  assert.equal(result.text, 'README incelendi ve ajan tamamlandi.')
  assert.equal(result.events[0].type, 'tool-call')
  assert.equal(result.events[1].type, 'tool-result')
  assert.deepEqual(seenCalls, [{ name: 'read', input: { path: 'README.md' } }])
})

test('AgentRunner stops and returns a permission request when a tool requires approval', async () => {
  const provider = {
    async chat() {
      return { text: '<tool_call>{"name":"mouse_click","input":{"x":12,"y":34}}</tool_call>' }
    },
  }

  const runner = new AgentRunner({
    toolRegistry: {
      list() {
        return [{ name: 'mouse_click', description: 'Click', inputHint: '{"x":12,"y":34}' }]
      },
      async run() {
        throw new PermissionRequiredError({
          toolName: 'mouse_click',
          permissionKey: 'mouse_click',
          input: { x: 12, y: 34 },
        })
      },
    },
  })

  const result = await runner.run({
    provider,
    model: 'fake-model',
    systemPrompt: 'You are modAI',
    messages: [{ role: 'user', content: 'Tikla' }],
    agent: { enabled: true, maxSteps: 2 },
    context: {},
  })

  assert.equal(result.stopReason, 'permission-required')
  assert.equal(result.permissionRequest.toolName, 'mouse_click')
  assert.equal(result.events[1].type, 'permission-required')
})

test('AgentRunner retries once in desktop mode when the model narrates instead of using a tool', async () => {
  const replies = [
    'I will open Google Chrome for you now.',
    '<tool_call>{"name":"open","input":{"target":"https://youtube.com","application":"Google Chrome"}}</tool_call>',
    '<final>Tarayici acildi.</final>',
  ]

  const calls = []
  const runner = new AgentRunner({
    toolRegistry: {
      list() {
        return [{ name: 'open', description: 'Open a URL or app', inputHint: '{"target":"https://example.com"}' }]
      },
      async run(name, input) {
        calls.push({ name, input })
        return 'Opened'
      },
    },
  })

  const result = await runner.run({
    provider: {
      async chat() {
        return { text: replies.shift() }
      },
    },
    model: 'fake-model',
    systemPrompt: 'You are modAI',
    messages: [{ role: 'user', content: 'Chrome ac ve YouTube ara' }],
    agent: { enabled: true, maxSteps: 4 },
    context: { requestMode: 'desktop' },
  })

  assert.equal(result.text, 'Tarayici acildi.')
  assert.equal(calls.length, 1)
  assert.equal(result.events[0].type, 'protocol-error')
  assert.equal(result.events[1].type, 'tool-call')
})
