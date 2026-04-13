import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

const MCP_PROTOCOL_VERSION = '2025-11-05'
const MCP_CLIENT_INFO = {
  name: 'modAI',
  version: '0.1.0',
}

export async function createMcpRuntime(options = {}) {
  const servers = Array.isArray(options.servers) ? options.servers : []
  const diagnostics = []
  const tools = []

  for (const server of servers) {
    const diagnostic = await inspectMcpServer(server, options)
    diagnostics.push(diagnostic)

    if (!diagnostic.ok) {
      continue
    }

    for (const definition of diagnostic.tools) {
      const qualifiedName = buildQualifiedToolName(server, definition.name)
      tools.push({
        name: qualifiedName,
        description: definition.description || `${server.name} MCP tool`,
        inputHint: formatInputHint(definition.inputSchema),
        requiredMode: 'pro',
        permissionKey: buildPermissionKey(server, definition.name),
        mcp: {
          serverId: server.id,
          toolName: definition.name,
        },
        async run(input) {
          const result = await callMcpTool(server, definition.name, input, options)
          return formatToolCallOutput(result)
        },
      })
    }
  }

  return {
    tools,
    diagnostics,
  }
}

export async function inspectMcpServer(server, options = {}) {
  const descriptor = normalizeServerDescriptor(server)
  const auth = resolveAuthState(server)

  if (!descriptor.enabled) {
    return buildDiagnostic(server, {
      ok: false,
      status: 'disabled',
      configured: descriptor.configured,
      auth,
      error: '',
      tools: [],
    })
  }

  if (!descriptor.configured) {
    return buildDiagnostic(server, {
      ok: false,
      status: 'needs-setup',
      configured: false,
      auth,
      error: descriptor.error || 'Connector setup is incomplete',
      tools: [],
    })
  }

  let client
  try {
    client = createClient(server, options)
    const init = await client.initialize()
    const listed = await client.listTools()
    const tools = Array.isArray(listed.tools) ? listed.tools.map(tool => ({
      name: String(tool.name ?? '').trim(),
      description: String(tool.description ?? '').trim(),
      inputSchema: tool.inputSchema ?? tool.input_schema ?? {},
    })).filter(tool => tool.name) : []

    return buildDiagnostic(server, {
      ok: true,
      status: 'connected',
      configured: true,
      auth,
      tools,
      toolCount: tools.length,
      protocolVersion: init.protocolVersion || '',
      serverInfo: init.serverInfo ?? null,
    })
  } catch (error) {
    return buildDiagnostic(server, {
      ok: false,
      status: 'error',
      configured: true,
      auth,
      error: error instanceof Error ? error.message : String(error),
      tools: [],
    })
  } finally {
    await client?.close?.()
  }
}

export async function callMcpTool(server, toolName, input, options = {}) {
  const descriptor = normalizeServerDescriptor(server)
  if (!descriptor.enabled) {
    throw new Error(`MCP server "${server.name}" is disabled`)
  }
  if (!descriptor.configured) {
    throw new Error(descriptor.error || `MCP server "${server.name}" is not configured`)
  }
  const client = createClient(server, options)
  try {
    await client.initialize()
    return await client.callTool(toolName, normalizeToolArguments(input))
  } finally {
    await client.close()
  }
}

function createClient(server, options) {
  if (server.transport === 'http') {
    return new HttpMcpClient(server, options)
  }
  if (server.transport === 'sse') {
    return new LegacySseMcpClient(server, options)
  }
  if (server.transport === 'stdio') {
    return new StdioMcpClient(server, options)
  }
  throw new Error(`Unsupported MCP transport: ${server.transport}`)
}

class HttpMcpClient {
  constructor(server, options = {}) {
    this.server = server
    this.timeoutMs = options.timeoutMs ?? 12_000
    this.sessionId = ''
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) {
      return this.initializeResult
    }

    const response = await this.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: MCP_CLIENT_INFO,
    })
    this.initializeResult = response
    this.initialized = true
    await this.notify('notifications/initialized', {})
    return response
  }

  async listTools() {
    await this.initialize()
    const tools = []
    let cursor

    do {
      const response = await this.request('tools/list', cursor ? { cursor } : {})
      tools.push(...(response.tools ?? []))
      cursor = response.nextCursor ?? ''
    } while (cursor)

    return { tools }
  }

  async callTool(name, args) {
    await this.initialize()
    return this.request('tools/call', {
      name,
      arguments: args,
    })
  }

  async notify(method, params = {}) {
    await this.send({
      jsonrpc: '2.0',
      method,
      params,
    }, { expectResponse: false })
  }

  async request(method, params = {}) {
    const id = randomUUID()
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }
    const response = await this.send(payload, { requestId: id })
    return unwrapJsonRpcResponse(response)
  }

  async send(payload, options = {}) {
    const controller = AbortSignal.timeout(this.timeoutMs)
    const headers = buildHttpHeaders(this.server, this.sessionId)
    headers.set('accept', 'application/json, text/event-stream')
    headers.set('content-type', 'application/json')

    const response = await fetch(this.server.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller,
    })

    const nextSessionId = response.headers.get('mcp-session-id') || ''
    if (nextSessionId) {
      this.sessionId = nextSessionId
    }

    if (response.status === 202 && options.expectResponse === false) {
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (!response.ok) {
      const bodyText = await response.text()
      throw new Error(`${response.status} ${response.statusText}: ${bodyText.slice(0, 400)}`)
    }

    if (contentType.includes('text/event-stream')) {
      return readEventStreamJsonRpcResponse(response, options.requestId)
    }

    return response.json()
  }

  async close() {
    if (!this.sessionId) {
      return
    }

    try {
      const headers = buildHttpHeaders(this.server, this.sessionId)
      await fetch(this.server.url, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(5_000),
      })
    } catch {
      // Ignore cleanup failures.
    } finally {
      this.sessionId = ''
    }
  }
}

class LegacySseMcpClient {
  constructor(server, options = {}) {
    this.server = server
    this.timeoutMs = options.timeoutMs ?? 12_000
    this.pending = new Map()
    this.postUrl = ''
    this.connected = false
    this.closing = false
  }

  async initialize() {
    if (this.initialized) {
      return this.initializeResult
    }

    const response = await this.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: MCP_CLIENT_INFO,
    })
    this.initializeResult = response
    this.initialized = true
    await this.notify('notifications/initialized', {})
    return response
  }

  async listTools() {
    await this.initialize()
    const tools = []
    let cursor

    do {
      const response = await this.request('tools/list', cursor ? { cursor } : {})
      tools.push(...(response.tools ?? []))
      cursor = response.nextCursor ?? ''
    } while (cursor)

    return { tools }
  }

  async callTool(name, args) {
    await this.initialize()
    return this.request('tools/call', {
      name,
      arguments: args,
    })
  }

  async notify(method, params = {}) {
    await this.connect()
    await this.postMessage({
      jsonrpc: '2.0',
      method,
      params,
    })
  }

  async request(method, params = {}) {
    await this.connect()
    const id = randomUUID()
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    const responsePromise = this.waitForResponse(id)
    try {
      const immediateResponse = await this.postMessage(payload, { requestId: id })
      if (immediateResponse) {
        this.clearPending(id)
        return unwrapJsonRpcResponse(immediateResponse)
      }
      const response = await responsePromise
      return unwrapJsonRpcResponse(response)
    } catch (error) {
      this.clearPending(id)
      throw error
    }
  }

  async connect() {
    if (this.postUrl) {
      return this.postUrl
    }
    if (this.endpointPromise) {
      return this.endpointPromise
    }

    this.connected = true
    this.abortController = new AbortController()
    this.endpointPromise = new Promise((resolve, reject) => {
      this.resolveEndpoint = resolve
      this.rejectEndpoint = reject
      this.endpointTimer = setTimeout(() => {
        reject(new Error(`Timed out waiting for legacy SSE endpoint from ${this.server.name}`))
      }, this.timeoutMs)
    })

    const headers = buildHttpHeaders(this.server)
    headers.set('accept', 'text/event-stream')
    const response = await fetch(this.server.url, {
      method: 'GET',
      headers,
      signal: this.abortController.signal,
    })

    if (!response.ok) {
      const bodyText = await response.text()
      throw new Error(`${response.status} ${response.statusText}: ${bodyText.slice(0, 400)}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/event-stream')) {
      throw new Error(`Legacy SSE MCP endpoint must return text/event-stream, received ${contentType || 'unknown content type'}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Legacy SSE MCP endpoint opened without a readable body')
    }

    this.streamPromise = this.readStream(reader).catch(error => {
      if (this.closing) {
        return
      }
      this.rejectEndpoint?.(error)
      this.rejectAll(error)
    })

    return this.endpointPromise
  }

  async readStream(reader) {
    const decoder = new TextDecoder()
    let buffer = ''

    while (!this.closing) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const events = splitSseEvents(buffer)
      buffer = events.remaining

      for (const rawEvent of events.items) {
        this.handleSseEvent(rawEvent)
      }
    }

    if (!this.closing) {
      this.rejectAll(new Error('Legacy SSE MCP stream closed'))
    }
  }

  handleSseEvent(rawEvent) {
    const event = parseSseEvent(rawEvent)
    if (!event?.data) {
      return
    }

    if (event.event === 'endpoint') {
      this.postUrl = new URL(event.data.trim(), this.server.url).toString()
      clearTimeout(this.endpointTimer)
      this.resolveEndpoint?.(this.postUrl)
      return
    }

    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      return
    }

    if (!message || typeof message !== 'object' || !Object.hasOwn(message, 'id')) {
      return
    }

    const requestId = String(message.id)
    const entry = this.pending.get(requestId)
    if (!entry) {
      return
    }

    clearTimeout(entry.timer)
    this.pending.delete(requestId)
    entry.resolve(message)
  }

  waitForResponse(id) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for MCP response from ${this.server.name}`))
      }, this.timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
    })
  }

  async postMessage(payload) {
    const endpoint = await this.connect()
    const headers = buildHttpHeaders(this.server)
    headers.set('accept', 'application/json, text/event-stream')
    headers.set('content-type', 'application/json')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      const bodyText = await response.text()
      throw new Error(`${response.status} ${response.statusText}: ${bodyText.slice(0, 400)}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return response.json()
    }

    return null
  }

  clearPending(id) {
    const entry = this.pending.get(String(id))
    if (!entry) {
      return
    }
    clearTimeout(entry.timer)
    this.pending.delete(String(id))
  }

  rejectAll(error) {
    for (const [requestId, entry] of this.pending.entries()) {
      clearTimeout(entry.timer)
      entry.reject(error)
      this.pending.delete(requestId)
    }
  }

  async close() {
    this.closing = true
    clearTimeout(this.endpointTimer)
    this.rejectAll(new Error('Legacy SSE MCP client closed'))
    this.abortController?.abort()
  }
}

class StdioMcpClient {
  constructor(server, options = {}) {
    this.server = server
    this.timeoutMs = options.timeoutMs ?? 12_000
    this.workspaceDir = options.workspaceDir ?? process.cwd()
    this.pending = new Map()
    this.buffer = ''
    this.spawned = false
  }

  async initialize() {
    if (this.initialized) {
      return this.initializeResult
    }

    this.ensureProcess()
    const response = await this.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: MCP_CLIENT_INFO,
    })
    this.initializeResult = response
    this.initialized = true
    await this.notify('notifications/initialized', {})
    return response
  }

  async listTools() {
    await this.initialize()
    const tools = []
    let cursor

    do {
      const response = await this.request('tools/list', cursor ? { cursor } : {})
      tools.push(...(response.tools ?? []))
      cursor = response.nextCursor ?? ''
    } while (cursor)

    return { tools }
  }

  async callTool(name, args) {
    await this.initialize()
    return this.request('tools/call', {
      name,
      arguments: args,
    })
  }

  async notify(method, params = {}) {
    this.ensureProcess()
    this.child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    })}\n`)
  }

  async request(method, params = {}) {
    this.ensureProcess()
    const id = randomUUID()
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    }

    const responsePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Timed out waiting for MCP response from ${this.server.name}`))
      }, this.timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
    })

    this.child.stdin.write(`${JSON.stringify(payload)}\n`)
    const response = await responsePromise
    return unwrapJsonRpcResponse(response)
  }

  ensureProcess() {
    if (this.spawned) {
      return
    }

    const args = parseCommandArgsText(this.server.argsText)
    this.child = spawn(this.server.command, args, {
      cwd: this.workspaceDir,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.spawned = true

    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk
      this.flushStdoutBuffer()
    })
    this.child.stderr.setEncoding('utf8')
    this.child.on('error', error => {
      this.rejectAll(error)
    })
    this.child.on('exit', code => {
      if (this.pending.size === 0) {
        return
      }
      this.rejectAll(new Error(`MCP process exited with code ${code ?? 'unknown'}`))
    })
  }

  flushStdoutBuffer() {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) {
        continue
      }

      let message
      try {
        message = JSON.parse(line)
      } catch {
        continue
      }

      if (!Object.hasOwn(message, 'id')) {
        continue
      }

      const requestId = String(message.id)
      const entry = this.pending.get(requestId)
      if (!entry) {
        continue
      }

      clearTimeout(entry.timer)
      this.pending.delete(requestId)
      entry.resolve(message)
    }
  }

  rejectAll(error) {
    for (const [requestId, entry] of this.pending.entries()) {
      clearTimeout(entry.timer)
      entry.reject(error)
      this.pending.delete(requestId)
    }
  }

  async close() {
    this.rejectAll(new Error('MCP process closed'))
    if (!this.child || this.child.killed) {
      return
    }
    this.child.kill('SIGTERM')
  }
}

function normalizeServerDescriptor(server = {}) {
  const transport = ['http', 'stdio', 'sse'].includes(server.transport) ? server.transport : 'stdio'
  if (transport === 'stdio') {
    return {
      transport,
      enabled: server.enabled !== false,
      configured: Boolean(String(server.command ?? '').trim()),
      error: '',
    }
  }

  return {
    transport,
    enabled: server.enabled !== false,
    configured: Boolean(String(server.url ?? '').trim()),
    error: '',
  }
}

function resolveAuthState(server = {}) {
  const authType = ['none', 'bearer', 'oauth'].includes(server.authType) ? server.authType : 'none'
  const envToken = server.authTokenEnv ? String(process.env[server.authTokenEnv] ?? '').trim() : ''
  const inlineToken = typeof server.authToken === 'string' ? server.authToken.trim() : ''
  const source = inlineToken
    ? (server.authTokenSource || 'config')
    : envToken
      ? 'env'
      : ''

  return {
    type: authType,
    env: String(server.authTokenEnv ?? '').trim(),
    hasSecret: Boolean(inlineToken || envToken),
    source,
    ready: authType === 'none' || Boolean(inlineToken || envToken),
  }
}

function buildHttpHeaders(server, sessionId = '') {
  const headers = new Headers()
  const customHeaders = parseHeadersText(server.headersText)
  for (const [key, value] of Object.entries(customHeaders)) {
    headers.set(key, value)
  }

  const authType = ['none', 'bearer', 'oauth'].includes(server.authType) ? server.authType : 'none'
  const authToken = typeof server.authToken === 'string' && server.authToken.trim()
    ? server.authToken.trim()
    : String(server.authTokenEnv ? process.env[server.authTokenEnv] ?? '' : '').trim()

  if ((authType === 'bearer' || authType === 'oauth') && authToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${authToken}`)
  }

  if (sessionId) {
    headers.set('mcp-session-id', sessionId)
  }
  return headers
}

function parseHeadersText(headersText) {
  const source = String(headersText ?? '').trim()
  if (!source) {
    return {}
  }

  let parsed
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    throw new Error(`Invalid MCP headers JSON: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('MCP headers must be a JSON object')
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, String(value)]),
  )
}

async function readEventStreamJsonRpcResponse(response, requestId) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('MCP server opened an event stream without a readable body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = splitSseEvents(buffer)
    buffer = events.remaining

    for (const event of events.items) {
      const message = parseSseJson(event)
      if (!message || !Object.hasOwn(message, 'id')) {
        continue
      }
      if (String(message.id) === String(requestId)) {
        return message
      }
    }
  }

  throw new Error('MCP event stream closed before returning a JSON-RPC response')
}

function splitSseEvents(buffer) {
  const normalized = String(buffer ?? '').replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  return {
    items: parts.slice(0, -1),
    remaining: parts.at(-1) ?? '',
  }
}

function parseSseEvent(rawEvent) {
  const event = {
    event: 'message',
    data: '',
    id: '',
  }
  const data = []

  for (const line of String(rawEvent ?? '').replace(/\r\n/g, '\n').split('\n')) {
    if (!line || line.startsWith(':')) {
      continue
    }

    const separatorIndex = line.indexOf(':')
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : ''
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue

    if (field === 'event') {
      event.event = value || 'message'
    } else if (field === 'data') {
      data.push(value)
    } else if (field === 'id') {
      event.id = value
    }
  }

  event.data = data.join('\n').trim()
  return event
}

function parseSseJson(rawEvent) {
  const payload = parseSseEvent(rawEvent)?.data ?? ''

  if (!payload) {
    return null
  }

  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function unwrapJsonRpcResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid MCP response')
  }

  if (response.error) {
    const message = response.error.message || 'MCP request failed'
    throw new Error(message)
  }

  return response.result ?? {}
}

function formatInputHint(inputSchema) {
  const schema = inputSchema && typeof inputSchema === 'object' ? inputSchema : {}
  const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
  const keys = Object.keys(properties)
  if (!keys.length) {
    return '{}'
  }

  const preview = Object.fromEntries(keys.slice(0, 3).map(key => [key, inferSchemaPlaceholder(properties[key])]))
  return JSON.stringify(preview)
}

function inferSchemaPlaceholder(schema) {
  const type = schema?.type
  if (type === 'number' || type === 'integer') {
    return 0
  }
  if (type === 'boolean') {
    return true
  }
  if (type === 'array') {
    return []
  }
  if (type === 'object') {
    return {}
  }
  return 'value'
}

function normalizeToolArguments(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input
  }
  if (typeof input === 'string') {
    return { input }
  }
  return { value: input }
}

function formatToolCallOutput(result) {
  if (result?.isError) {
    const message = Array.isArray(result.content)
      ? result.content.map(content => content.text || JSON.stringify(content)).join('\n')
      : 'MCP tool returned an error'
    throw new Error(message)
  }

  if (Array.isArray(result?.content) && result.content.length) {
    return result.content.map(content => {
      if (content.type === 'text' && typeof content.text === 'string') {
        return content.text
      }
      if (content.type === 'image' && content.data) {
        return `[image:${content.mimeType || 'application/octet-stream'}]`
      }
      if (content.type === 'resource' && content.resource?.uri) {
        return content.resource.uri
      }
      return JSON.stringify(content, null, 2)
    }).join('\n\n')
  }

  return JSON.stringify(result ?? {}, null, 2)
}

function buildDiagnostic(server, values = {}) {
  const tools = Array.isArray(values.tools) ? values.tools : []
  return {
    serverId: server.id,
    name: server.name,
    transport: server.transport,
    enabled: server.enabled !== false,
    configured: values.configured !== false,
    ok: values.ok === true,
    status: values.status || (values.ok ? 'connected' : 'error'),
    endpoint: server.transport === 'stdio'
      ? [server.command, server.argsText].filter(Boolean).join(' ').trim()
      : server.url,
    checkedAt: new Date().toISOString(),
    error: values.error || '',
    auth: values.auth ?? resolveAuthState(server),
    toolCount: values.toolCount ?? tools.length,
    toolNames: tools.map(tool => tool.name),
    tools,
    protocolVersion: values.protocolVersion || '',
    serverInfo: values.serverInfo ?? null,
  }
}

function buildQualifiedToolName(server, toolName) {
  return `mcp.${slugValue(server.id || server.name)}.${slugValue(toolName)}`
}

function buildPermissionKey(server, toolName) {
  return `mcp:${server.id}:${toolName}`
}

function slugValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'mcp'
}

function parseCommandArgsText(argsText) {
  const source = String(argsText ?? '').trim()
  if (!source) {
    return []
  }

  if (source.startsWith('[')) {
    const parsed = JSON.parse(source)
    if (!Array.isArray(parsed)) {
      throw new Error('MCP command arguments must be a JSON array')
    }
    return parsed.map(value => String(value))
  }

  const args = []
  const pattern = /"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s]+)/g
  let match
  while ((match = pattern.exec(source))) {
    args.push(match[1] ?? match[2] ?? match[3] ?? match[4] ?? '')
  }
  return args
}
