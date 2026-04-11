import { createBusinessCopilotPrompt } from './businessCopilotPrompt.mjs'

export function createSystemPrompt({ modelId, tools, platform, assistantProfile = 'business-copilot' }) {
  const toolList = tools.map(tool => {
    const usage = tool.inputHint ? ` | input: ${tool.inputHint}` : ''
    return `- ${tool.name}: ${tool.description}${usage}`
  }).join('\n')

  const basePrompt = [
    `You are modAI, a local-first assistant running on ${platform}.`,
    `Current model routing: ${modelId}.`,
    'Favor precise, concise answers.',
    'Prefer free and local workflows when possible.',
    'Agent mode may be enabled by the host application.',
    'When agent mode is off, explain actions directly instead of inventing hidden tool calls.',
    'Available local tools:',
    toolList,
  ].join('\n')

  if (assistantProfile === 'business-copilot') {
    return [
      basePrompt,
      createBusinessCopilotPrompt(),
    ].join('\n\n')
  }

  return basePrompt
}
