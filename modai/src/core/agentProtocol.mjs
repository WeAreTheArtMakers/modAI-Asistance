import { safeJson } from '../utils/json.mjs'

const TOOL_CALL_PATTERN = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/i
const FINAL_PATTERN = /<final>\s*([\s\S]*?)\s*<\/final>/i
const FENCED_JSON_PATTERN = /```(?:json)?\s*([\s\S]*?)\s*```/i

export function createAgentProtocolPrompt({ tools, maxSteps }) {
  const toolList = tools.map(tool => {
    const usage = tool.inputHint ? ` | input: ${tool.inputHint}` : ''
    return `- ${tool.name}: ${tool.description}${usage}`
  }).join('\n')

  return [
    'Agent mode is enabled.',
    `You may take up to ${maxSteps} tool step(s) before you must return a final answer.`,
    'If you need a tool, respond with exactly one tool block:',
    '<tool_call>{"name":"read","input":{"path":"README.md"}}</tool_call>',
    'If you are done, respond with exactly one final block:',
    '<final>Your answer here.</final>',
    'Rules:',
    '- Return only one <tool_call> block or one <final> block in each response.',
    '- Prefer ls, read, and fetch before shell.',
    '- Prefer code_run over shell when you need to execute or verify code safely.',
    '- Prefer memory_semantic or memory_search when prior sessions may contain relevant context.',
    '- For desktop control, prefer screen_analyze before click_text or mouse_click.',
    '- Prefer click_text when visible text is enough; use mouse_click only with explicit coordinates.',
    '- Use type_text and press_key for keyboard control before falling back to applescript.',
    '- Use write only when the user clearly asked for file creation or modification.',
    '- Use shell only when a dedicated tool cannot solve the task.',
    '- Keep tool input valid JSON.',
    '- If a tool fails, inspect the error and recover or return a final answer.',
    'Available tools:',
    toolList,
  ].join('\n')
}

export function parseAgentResponse(text) {
  const source = String(text ?? '').trim()

  if (!source) {
    return { type: 'final', message: '' }
  }

  const toolMatch = source.match(TOOL_CALL_PATTERN)
  if (toolMatch) {
    try {
      const payload = JSON.parse(toolMatch[1].trim())
      return {
        type: 'tool',
        tool: normalizeToolPayload(payload),
        raw: source,
      }
    } catch (error) {
      return {
        type: 'tool-parse-error',
        message: error instanceof Error ? error.message : String(error),
        raw: source,
      }
    }
  }

  const finalMatch = source.match(FINAL_PATTERN)
  if (finalMatch) {
    return {
      type: 'final',
      message: finalMatch[1].trim(),
      raw: source,
    }
  }

  const jsonPayload = tryParseLooseJson(source)
  if (jsonPayload) {
    if (jsonPayload.mode === 'final' || jsonPayload.type === 'final') {
      return {
        type: 'final',
        message: String(jsonPayload.message ?? jsonPayload.content ?? '').trim(),
        raw: source,
      }
    }

    if (
      jsonPayload.mode === 'tool' ||
      jsonPayload.type === 'tool' ||
      jsonPayload.type === 'tool_call' ||
      jsonPayload.name ||
      jsonPayload.tool
    ) {
      try {
        return {
          type: 'tool',
          tool: normalizeToolPayload(jsonPayload),
          raw: source,
        }
      } catch (error) {
        return {
          type: 'tool-parse-error',
          message: error instanceof Error ? error.message : String(error),
          raw: source,
        }
      }
    }
  }

  return {
    type: 'final',
    message: source,
    raw: source,
  }
}

export function formatToolResultForModel({ toolName, input, output, status }) {
  return [
    'A tool finished. Continue with another <tool_call> or return <final>.',
    '<tool_result>',
    safeJson({
      tool: toolName,
      status,
      input,
      output: truncateForModel(output),
    }),
    '</tool_result>',
  ].join('\n')
}

export function formatProtocolErrorForModel(message) {
  return [
    'Your previous response could not be parsed as a valid tool call.',
    'Return either one <tool_call> JSON block or one <final> block.',
    `<protocol_error>${message}</protocol_error>`,
  ].join('\n')
}

export function summarizeToolEvent(event) {
  if (event.type === 'protocol-error') {
    return `[agent ${event.step}] protocol error: ${event.message}`
  }

  if (event.type === 'tool-call') {
    return `[agent ${event.step}] ${event.toolName} ${formatInlineJson(event.input)}`
  }

  const prefix = event.status === 'ok' ? 'ok' : 'error'
  return `[agent ${event.step}] ${event.toolName} ${prefix}: ${truncateForDisplay(event.output)}`
}

export function truncateForDisplay(value, limit = 220) {
  const text = typeof value === 'string' ? value : safeJson(value)
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, limit)}…`
}

function normalizeToolPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Tool payload must be a JSON object')
  }

  const name = payload.name ?? payload.tool ?? payload.tool_name
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Tool payload is missing "name"')
  }

  let input = payload.input ?? payload.arguments ?? payload.args
  if (input === undefined) {
    const {
      name: _name,
      tool: _tool,
      tool_name: _toolName,
      mode: _mode,
      type: _type,
      reason: _reason,
      content: _content,
      message: _message,
      ...rest
    } = payload

    input = Object.keys(rest).length > 0 ? rest : ''
  }

  return {
    name: name.trim(),
    input,
  }
}

function tryParseLooseJson(source) {
  const direct = tryParseJson(source)
  if (direct) {
    return direct
  }

  const fenced = source.match(FENCED_JSON_PATTERN)
  if (fenced) {
    return tryParseJson(fenced[1].trim())
  }

  return null
}

function tryParseJson(source) {
  try {
    const parsed = JSON.parse(source)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function truncateForModel(value, limit = 12_000) {
  const text = typeof value === 'string' ? value : safeJson(value)
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, limit)}\n...[truncated ${text.length - limit} chars]`
}

function formatInlineJson(value) {
  if (value === '' || value === undefined) {
    return '(no input)'
  }

  const text = typeof value === 'string' ? value : safeJson(value)
  return text.length <= 120 ? text : `${text.slice(0, 120)}…`
}
