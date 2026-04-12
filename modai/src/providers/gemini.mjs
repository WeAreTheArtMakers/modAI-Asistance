import { normalizeBaseUrl, postJson, resolveApiKey } from './shared.mjs'
import { ensurePromptText, normalizeMessagesWithAttachments } from './messageContent.mjs'

function extractGeminiText(response) {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  return parts.map(part => part.text ?? '').join('\n').trim()
}

export function createGeminiProvider(alias, providerConfig) {
  const baseUrl = normalizeBaseUrl(providerConfig.baseUrl)

  return {
    alias,
    capabilities: {
      chat: true,
      imageGeneration: false,
      vision: true,
    },
    async chat({ model, system, messages }) {
      const apiKey = resolveApiKey(providerConfig)
      if (!apiKey) {
        throw new Error(`Set ${providerConfig.apiKeyEnv} to use ${alias}`)
      }

      const normalizedMessages = await normalizeMessagesWithAttachments(messages)

      const response = await postJson(
        `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          systemInstruction: {
            parts: [{ text: system }],
          },
          contents: normalizedMessages.map(message => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [
              ...(ensurePromptText(message.text, message.attachments)
                ? [{ text: ensurePromptText(message.text, message.attachments) }]
                : []),
              ...message.attachments.map(attachment => ({
                inlineData: {
                  mimeType: attachment.mediaType,
                  data: attachment.base64,
                },
              })),
            ],
          })),
        },
        { timeoutMs: 120_000 },
      )

      return {
        text: extractGeminiText(response),
        raw: response,
      }
    },
    async listModels() {
      return []
    },
    async healthcheck() {
      const apiKey = resolveApiKey(providerConfig)
      return {
        ok: Boolean(apiKey),
        message: apiKey ? 'API key detected' : `missing ${providerConfig.apiKeyEnv}`,
      }
    },
  }
}
