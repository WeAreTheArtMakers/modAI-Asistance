import { getJson, postJson, normalizeBaseUrl } from './shared.mjs'
import { ensurePromptText, normalizeMessagesWithAttachments } from './messageContent.mjs'

export function createOllamaProvider(alias, providerConfig) {
  const baseUrl = normalizeBaseUrl(providerConfig.baseUrl)

  return {
    alias,
    capabilities: {
      chat: true,
      imageGeneration: false,
      vision: true,
    },
    async chat({ model, system, messages }) {
      const normalizedMessages = await normalizeMessagesWithAttachments(messages)
      const response = await postJson(`${baseUrl}/api/chat`, {
        model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          ...normalizedMessages.map(message => {
            const attachments = Array.isArray(message.attachments) ? message.attachments : []
            return {
              role: message.role,
              content: ensurePromptText(message.text, attachments),
              ...(attachments.length ? {
                images: attachments.map(attachment => attachment.base64),
              } : {}),
            }
          }),
        ],
      })

      return {
        text: response.message?.content ?? '',
        raw: response,
      }
    },
    async listModels() {
      const response = await getJson(`${baseUrl}/api/tags`)
      return Array.isArray(response.models) ? response.models.map(item => item.name).filter(Boolean) : []
    },
    async healthcheck() {
      try {
        const models = await this.listModels()
        return {
          ok: true,
          message: models.length ? `${models.length} model(s) available` : 'reachable, no local models listed',
        }
      } catch {
        return {
          ok: false,
          message: 'Ollama binary exists but server is unreachable. Run `ollama serve` and `ollama pull llama3.2`.',
        }
      }
    },
  }
}
