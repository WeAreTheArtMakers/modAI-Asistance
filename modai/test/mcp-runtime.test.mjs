import test from 'node:test'
import assert from 'node:assert/strict'

import { callMcpTool, createMcpRuntime, inspectMcpServer } from '../src/services/mcpRuntime.mjs'

test('inspectMcpServer discovers tools over streamable HTTP and uses bearer auth', async () => {
  const seenAuthHeaders = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, init = {}) => {
    const headers = new Headers(init.headers)
    seenAuthHeaders.push(headers.get('authorization') || '')

    if (init.method === 'DELETE') {
      return new Response('', { status: 204 })
    }

    const payload = init.body ? JSON.parse(String(init.body)) : {}

    if (payload.method === 'initialize') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          protocolVersion: '2025-11-05',
          capabilities: {},
          serverInfo: { name: 'HTTP Test MCP' },
        },
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'mcp-session-id': 'session-1',
        },
      })
    }

    if (payload.method === 'notifications/initialized') {
      return new Response('', { status: 202 })
    }

    if (payload.method === 'tools/list') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          tools: [{
            name: 'echo',
            description: 'Echo back the message',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (payload.method === 'tools/call') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: payload.id,
        result: {
          content: [{ type: 'text', text: `echo:${payload.params.arguments.message}` }],
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response('unexpected request', { status: 500 })
  }

  try {
    const diagnostic = await inspectMcpServer({
      id: 'github',
      name: 'GitHub MCP',
      transport: 'http',
      url: 'https://example.test/mcp',
      headersText: '',
      authType: 'bearer',
      authToken: 'secret-token',
      enabled: true,
    })

    assert.equal(diagnostic.ok, true)
    assert.equal(diagnostic.toolCount, 1)
    assert.deepEqual(diagnostic.toolNames, ['echo'])
    assert.ok(seenAuthHeaders.every(value => value === 'Bearer secret-token'))

    const runtime = await createMcpRuntime({
      servers: [{
        id: 'github',
        name: 'GitHub MCP',
        transport: 'http',
        url: 'https://example.test/mcp',
        headersText: '',
        authType: 'bearer',
        authToken: 'secret-token',
        enabled: true,
      }],
    })

    assert.equal(runtime.tools.length, 1)
    assert.equal(runtime.tools[0].name, 'mcp.github.echo')

    const output = await runtime.tools[0].run({ message: 'hello' })
    assert.equal(output, 'echo:hello')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('legacy SSE transport discovers and calls MCP tools', async () => {
  const originalFetch = globalThis.fetch
  const encoder = new TextEncoder()
  let activeController = null

  function sendSse(event, data) {
    activeController?.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
  }

  globalThis.fetch = async (url, init = {}) => {
    if (init.method === 'GET') {
      const stream = new ReadableStream({
        start(controller) {
          activeController = controller
          setTimeout(() => sendSse('endpoint', '/messages'), 0)
        },
      })
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    }

    assert.equal(String(url), 'https://example.test/messages')
    const payload = init.body ? JSON.parse(String(init.body)) : {}

    setTimeout(() => {
      if (payload.method === 'initialize') {
        sendSse('message', JSON.stringify({
          jsonrpc: '2.0',
          id: payload.id,
          result: {
            protocolVersion: '2025-11-05',
            capabilities: {},
            serverInfo: { name: 'SSE Test MCP' },
          },
        }))
      } else if (payload.method === 'tools/list') {
        sendSse('message', JSON.stringify({
          jsonrpc: '2.0',
          id: payload.id,
          result: {
            tools: [{
              name: 'search',
              description: 'Search through a legacy SSE connector',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                },
              },
            }],
          },
        }))
        activeController?.close()
      } else if (payload.method === 'tools/call') {
        sendSse('message', JSON.stringify({
          jsonrpc: '2.0',
          id: payload.id,
          result: {
            content: [{ type: 'text', text: `sse:${payload.params.arguments.query}` }],
          },
        }))
        activeController?.close()
      }
    }, 0)

    return new Response('', { status: 202 })
  }

  try {
    const server = {
      id: 'legacy',
      name: 'Legacy SSE MCP',
      transport: 'sse',
      url: 'https://example.test/sse',
      headersText: '',
      authType: 'none',
      enabled: true,
    }

    const diagnostic = await inspectMcpServer(server)
    assert.equal(diagnostic.ok, true)
    assert.equal(diagnostic.toolCount, 1)
    assert.deepEqual(diagnostic.toolNames, ['search'])

    const result = await callMcpTool(server, 'search', { query: 'modAI' })
    assert.deepEqual(result, {
      content: [{ type: 'text', text: 'sse:modAI' }],
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('callMcpTool works over stdio transport', async () => {
  const script = [
    'import readline from "node:readline";',
    'const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });',
    'for await (const line of rl) {',
    '  const message = JSON.parse(line);',
    '  if (message.method === "notifications/initialized") { continue; }',
    '  if (message.method === "initialize") {',
    '    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-11-05", capabilities: {}, serverInfo: { name: "stdio" } } }) + "\\n");',
    '    continue;',
    '  }',
    '  if (message.method === "tools/list") {',
    '    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "sum", description: "adds numbers", inputSchema: { type: "object", properties: { left: { type: "number" }, right: { type: "number" } } } }] } }) + "\\n");',
    '    continue;',
    '  }',
    '  if (message.method === "tools/call") {',
    '    const total = Number(message.params.arguments.left || 0) + Number(message.params.arguments.right || 0);',
    '    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: String(total) }] } }) + "\\n");',
    '  }',
    '}',
  ].join('\n')

  const diagnostic = await inspectMcpServer({
    id: 'stdio-test',
    name: 'stdio test',
    transport: 'stdio',
    command: process.execPath,
    argsText: JSON.stringify(['--input-type=module', '-e', script]),
    enabled: true,
  })

  assert.equal(diagnostic.ok, true)
  assert.equal(diagnostic.toolCount, 1)
  assert.deepEqual(diagnostic.toolNames, ['sum'])

  const result = await callMcpTool({
    id: 'stdio-test',
    name: 'stdio test',
    transport: 'stdio',
    command: process.execPath,
    argsText: JSON.stringify(['--input-type=module', '-e', script]),
    enabled: true,
  }, 'sum', {
    left: 2,
    right: 5,
  })

  assert.deepEqual(result, {
    content: [{ type: 'text', text: '7' }],
  })
})
