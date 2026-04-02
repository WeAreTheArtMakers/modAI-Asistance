import { parseMessageContent } from '../providers/messageContent.mjs'

export function detectInteractionMode(messages) {
  const latestUser = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user')

  if (!latestUser) {
    return 'chat'
  }

  const parsed = parseMessageContent(latestUser.content ?? '')
  return parsed.meta?.mode === 'task' || parsed.meta?.mode === 'desktop'
    ? parsed.meta.mode
    : 'chat'
}

export function shouldEnableAgentForMode(agentRequested, interactionMode) {
  if (!agentRequested) {
    return false
  }

  return interactionMode === 'task' || interactionMode === 'desktop'
}
