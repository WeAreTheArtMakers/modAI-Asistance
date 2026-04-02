import {
  createAgentProtocolPrompt,
  formatProtocolErrorForModel,
  formatToolResultForModel,
  parseAgentResponse,
} from './agentProtocol.mjs'
import { PermissionRequiredError } from './toolAccess.mjs'

export class AgentRunner {
  constructor({ toolRegistry }) {
    this.toolRegistry = toolRegistry
  }

  async run(options) {
    const {
      provider,
      model,
      systemPrompt,
      messages,
      agent,
      context,
      onEvent,
    } = options

    if (!agent?.enabled) {
      const reply = await provider.chat({
        model,
        system: systemPrompt,
        messages,
      })

      return {
        text: reply.text,
        events: [],
        steps: 0,
        stopReason: 'disabled',
      }
    }

    const maxSteps = normalizeMaxSteps(agent.maxSteps)
    const conversation = [...messages]
    const events = []
    const protocolPrompt = createAgentProtocolPrompt({
      tools: this.toolRegistry.list(),
      maxSteps,
    })
    const combinedSystemPrompt = `${systemPrompt}\n\n${protocolPrompt}`
    let finalText = ''

    for (let step = 1; step <= maxSteps; step += 1) {
      const reply = await provider.chat({
        model,
        system: combinedSystemPrompt,
        messages: conversation,
      })
      const action = parseAgentResponse(reply.text)

      if (action.type === 'tool-parse-error') {
        conversation.push({ role: 'assistant', content: reply.text })
        conversation.push({ role: 'user', content: formatProtocolErrorForModel(action.message) })
        events.push({
          type: 'protocol-error',
          step,
          message: action.message,
        })
        onEvent?.({
          type: 'protocol-error',
          step,
          message: action.message,
        })
        continue
      }

      if (action.type === 'tool') {
        const toolCallEvent = {
          type: 'tool-call',
          step,
          toolName: action.tool.name,
          input: action.tool.input,
        }
        events.push(toolCallEvent)
        onEvent?.(toolCallEvent)

        let output = ''
        let status = 'ok'

        try {
          output = await this.toolRegistry.run(action.tool.name, action.tool.input, context)
        } catch (error) {
          if (error instanceof PermissionRequiredError) {
            const permissionEvent = {
              type: 'permission-required',
              step,
              toolName: action.tool.name,
              permissionKey: error.permissionKey,
              input: action.tool.input,
              message: error.message,
            }
            events.push(permissionEvent)
            onEvent?.(permissionEvent)

            return {
              text: error.message,
              events,
              steps: step,
              stopReason: 'permission-required',
              permissionRequest: {
                toolName: action.tool.name,
                permissionKey: error.permissionKey,
                input: action.tool.input,
                message: error.message,
              },
            }
          }

          status = 'error'
          output = error instanceof Error ? error.message : String(error)
        }

        const toolResultEvent = {
          type: 'tool-result',
          step,
          toolName: action.tool.name,
          input: action.tool.input,
          status,
          output,
        }
        events.push(toolResultEvent)
        onEvent?.(toolResultEvent)

        conversation.push({ role: 'assistant', content: reply.text })
        conversation.push({
          role: 'user',
          content: formatToolResultForModel({
            toolName: action.tool.name,
            input: action.tool.input,
            output,
            status,
          }),
        })
        continue
      }

      if (context?.requestMode === 'desktop' && step === 1 && events.length === 0) {
        conversation.push({ role: 'assistant', content: reply.text })
        conversation.push({
          role: 'user',
          content: formatProtocolErrorForModel(
            'Desktop mode requires execution. Do not describe the intended action. Return one <tool_call> now if the task can be performed.',
          ),
        })
        events.push({
          type: 'protocol-error',
          step,
          message: 'Desktop mode returned narration instead of a tool call',
        })
        onEvent?.({
          type: 'protocol-error',
          step,
          message: 'Desktop mode returned narration instead of a tool call',
        })
        continue
      }

      finalText = action.message || reply.text
      return {
        text: finalText,
        events,
        steps: step,
        stopReason: 'final',
      }
    }

    const limitMessage = [
      finalText || 'Agent step limit reached before a final answer was produced.',
      `Step limit: ${maxSteps}. Refine the task or increase the limit.`,
    ].filter(Boolean).join('\n\n')

    return {
      text: limitMessage,
      events,
      steps: maxSteps,
      stopReason: 'max-steps',
    }
  }
}

function normalizeMaxSteps(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 6
  }
  return Math.max(1, Math.min(12, Math.round(parsed)))
}
