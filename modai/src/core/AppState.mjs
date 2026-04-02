export class AppState {
  constructor({ modelId, sessionId, agentEnabled = true, agentMaxSteps = 6 }) {
    this.modelId = modelId
    this.sessionId = sessionId
    this.agentEnabled = agentEnabled
    this.agentMaxSteps = agentMaxSteps
    this.messages = []
    this.startedAt = new Date().toISOString()
  }

  setModel(modelId) {
    this.modelId = modelId
  }

  clearMessages() {
    this.messages = []
  }

  resetSession(sessionId = this.sessionId) {
    this.sessionId = sessionId
    this.messages = []
    this.startedAt = new Date().toISOString()
  }

  setAgentEnabled(value) {
    this.agentEnabled = Boolean(value)
  }

  setAgentMaxSteps(value) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      throw new Error('Agent max steps must be numeric')
    }
    this.agentMaxSteps = Math.max(1, Math.min(12, Math.round(parsed)))
  }

  addMessage(role, content) {
    const message = {
      role,
      content,
      createdAt: new Date().toISOString(),
    }

    this.messages.push(message)
    return message
  }

  toConversationWindow(limit = 20) {
    return this.messages.slice(-limit).map(({ role, content }) => ({ role, content }))
  }
}
