import { getJson, normalizeBaseUrl, postJson, resolveApiKey } from './shared.mjs'
import { ensurePromptText, normalizeMessagesWithAttachments } from './messageContent.mjs'

function extractAnthropicText(response) {
  const content = Array.isArray(response.content) ? response.content : []
  return content.map(part => part.text ?? '').join('\n').trim()
}

export function createAnthropicProvider(alias, providerConfig) {
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

      const response = await postJson(`${baseUrl}/v1/messages`, {
        model,
        system,
        max_tokens: 2048,
        messages: normalizedMessages.map(message => ({
          role: message.role,
          content: [
            ...(message.role !== 'assistant'
              ? message.attachments.map(attachment => ({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: attachment.mediaType,
                    data: attachment.base64,
                  },
                }))
              : []),
            ...(ensurePromptText(message.text, message.attachments)
              ? [{
                  type: 'text',
                  text: ensurePromptText(message.text, message.attachments),
                }]
              : []),
          ],
        })),
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeoutMs: 120_000,
      })

      return {
        text: extractAnthropicText(response),
        raw: response,
      }
    },
    async listModels() {
      const apiKey = resolveApiKey(providerConfig)
      if (!apiKey) {
        return []
      }

      const response = await getJson(`${baseUrl}/v1/models`, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      })

      return Array.isArray(response.data) ? response.data.map(item => item.id).filter(Boolean) : []
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
