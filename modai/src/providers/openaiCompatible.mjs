import { openAICompatibleListModels, postJson, normalizeBaseUrl, resolveApiKey } from './shared.mjs'
import { ensurePromptText, normalizeMessagesWithAttachments } from './messageContent.mjs'

function extractOpenAIText(response) {
  const content = response.choices?.[0]?.message?.content
  if (Array.isArray(content)) {
    return content.map(part => part.text ?? '').join('\n').trim()
  }
  return typeof content === 'string' ? content : ''
}

export function createOpenAICompatibleProvider(alias, providerConfig) {
  const baseUrl = normalizeBaseUrl(providerConfig.baseUrl)

  return {
    alias,
    capabilities: {
      chat: true,
      imageGeneration: providerConfig.imageGeneration !== false,
      vision: true,
    },
    async chat({ model, system, messages }) {
      const apiKey = resolveApiKey(providerConfig)
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      const normalizedMessages = await normalizeMessagesWithAttachments(messages)
      const response = await postJson(`${baseUrl}/chat/completions`, {
        model,
        messages: [
          { role: 'system', content: system },
          ...normalizedMessages.map(message => ({
            role: message.role,
            content: message.attachments.length
              ? [
                  ...(ensurePromptText(message.text, message.attachments)
                    ? [{ type: 'text', text: ensurePromptText(message.text, message.attachments) }]
                    : []),
                  ...message.attachments.map(attachment => ({
                    type: 'image_url',
                    image_url: {
                      url: attachment.dataUrl,
                    },
                  })),
                ]
              : ensurePromptText(message.text, message.attachments),
          })),
        ],
        temperature: 0.2,
      }, { headers })

      return {
        text: extractOpenAIText(response),
        raw: response,
      }
    },
    async generateImage({ model, prompt, size = '1024x1024' }) {
      const apiKey = resolveApiKey(providerConfig)
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      const response = await postJson(`${baseUrl}/images/generations`, {
        model: providerConfig.imageModel ?? model,
        prompt,
        size,
      }, { headers })

      const image = response.data?.[0]
      if (!image) {
        throw new Error('Image endpoint returned no image payload')
      }

      return image.url ?? image.b64_json ?? JSON.stringify(image)
    },
    async listModels() {
      const apiKey = resolveApiKey(providerConfig)
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      return openAICompatibleListModels(baseUrl, headers)
    },
    async healthcheck() {
      const models = await this.listModels()
      return {
        ok: true,
        message: models.length ? `${models.length} model(s) returned` : 'reachable, no models returned',
      }
    },
  }
}
