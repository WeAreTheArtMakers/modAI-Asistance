import { exec } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export class PluginStore {
  constructor(configStore, options = {}) {
    this.configStore = configStore
    this.cwd = options.cwd ?? process.cwd()
  }

  async list(config) {
    const sources = []

    if (config.plugins?.userEnabled !== false) {
      sources.push({
        source: 'user',
        root: join(this.configStore.getBaseDir(), 'plugins'),
      })
    }

    if (config.plugins?.projectEnabled !== false) {
      sources.push({
        source: 'project',
        root: join(this.cwd, '.modai', 'plugins'),
      })
    }

    const loaded = []
    for (const entry of sources) {
      loaded.push(...await loadPluginsFromRoot(entry.root, entry.source))
    }

    return dedupeById(loaded)
  }
}

export function createPluginTools(plugins = []) {
  const tools = []

  for (const plugin of plugins) {
    const pluginTools = Array.isArray(plugin.tools) ? plugin.tools : []
    for (const definition of pluginTools) {
      if (!definition?.name || definition.enabled === false) {
        continue
      }

      const permissionKey = definition.permissionKey ?? `plugin:${plugin.id}:${definition.name}`
      tools.push({
        name: definition.name,
        description: definition.description ?? `${plugin.name} plugin tool`,
        inputHint: definition.inputHint ?? '{"input":"value"}',
        requiredMode: 'pro',
        permissionKey,
        pluginId: plugin.id,
        async run(input, context) {
          if (definition.type === 'http') {
            return runHttpPluginTool(definition, input)
          }

          if (definition.type === 'shell') {
            return runShellPluginTool(definition, input)
          }

          throw new Error(`Unsupported plugin tool type: ${definition.type}`)
        },
      })
    }
  }

  return tools
}

async function loadPluginsFromRoot(root, source) {
  let entries = []

  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (isMissing(error)) {
      return []
    }
    throw error
  }

  const plugins = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue
    }

    const path = join(root, entry.name)
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw)
    plugins.push({
      id: parsed.id ?? basename(entry.name, '.json'),
      name: parsed.name ?? basename(entry.name, '.json'),
      description: parsed.description ?? '',
      source,
      path,
      enabled: parsed.enabled !== false,
      tools: Array.isArray(parsed.tools) ? parsed.tools : [],
    })
  }

  return plugins
}

async function runHttpPluginTool(definition, input) {
  const payload = resolvePluginInput(input)
  const method = String(definition.method ?? 'POST').toUpperCase()
  const headers = {
    'content-type': 'application/json',
    ...(definition.headers ?? {}),
  }
  const body = definition.bodyTemplate ? interpolateTemplate(definition.bodyTemplate, payload) : payload
  const response = await fetch(definition.url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 400)}`)
  }
  return text
}

async function runShellPluginTool(definition, input) {
  const payload = resolvePluginInput(input)
  const command = interpolateTemplate(String(definition.command ?? ''), payload)
  if (!command.trim()) {
    throw new Error('Plugin shell command is empty')
  }

  const { stdout, stderr } = await execAsync(command, {
    shell: '/bin/zsh',
    timeout: 20_000,
    maxBuffer: 4 * 1024 * 1024,
  })

  return [stdout, stderr].filter(Boolean).join('\n').trim() || 'command completed with no output'
}

function resolvePluginInput(input) {
  if (typeof input === 'string') {
    return {
      input,
      text: input,
      json: input,
    }
  }

  return {
    input,
    text: typeof input === 'object' ? JSON.stringify(input) : String(input ?? ''),
    json: typeof input === 'object' ? JSON.stringify(input) : JSON.stringify({ value: input }),
    ...(input && typeof input === 'object' ? input : {}),
  }
}

function interpolateTemplate(template, payload) {
  if (typeof template === 'string') {
    return template
      .replaceAll('{{input}}', payload.text ?? '')
      .replaceAll('{{json}}', payload.json ?? '{}')
  }

  if (Array.isArray(template)) {
    return template.map(item => interpolateTemplate(item, payload))
  }

  if (template && typeof template === 'object') {
    return Object.fromEntries(
      Object.entries(template).map(([key, value]) => [key, interpolateTemplate(value, payload)]),
    )
  }

  return template
}

function dedupeById(plugins) {
  const seen = new Set()
  const result = []

  for (const plugin of plugins) {
    if (seen.has(plugin.id)) {
      continue
    }
    seen.add(plugin.id)
    result.push(plugin)
  }

  return result
}

function isMissing(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}
