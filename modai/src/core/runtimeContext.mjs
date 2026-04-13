import { AgentRunner } from './AgentRunner.mjs'
import { ToolRegistry } from './ToolRegistry.mjs'
import { createSystemPrompt } from '../prompts/systemPrompt.mjs'
import { createBuiltinTools } from '../tools/builtinTools.mjs'
import { createMcpRuntime } from '../services/mcpRuntime.mjs'
import { createPluginTools } from '../services/PluginStore.mjs'
import { buildSkillPrompt, filterActiveSkills } from '../services/SkillStore.mjs'

export async function createRuntimeContext({
  config,
  configStore,
  skillStore,
  pluginStore,
  modelRef,
  platform = process.platform,
  workspaceDir,
}) {
  const skills = skillStore ? await skillStore.list(config) : []
  const plugins = pluginStore ? await pluginStore.list(config) : []
  const activeSkills = filterActiveSkills(skills, config.skills?.active)
  const activePlugins = filterActivePlugins(plugins, config.plugins?.active)
  const mcpRuntime = await createMcpRuntime({
    servers: config.mcp?.servers ?? [],
    workspaceDir,
  })
  const tools = [
    ...createBuiltinTools(),
    ...createPluginTools(activePlugins),
    ...mcpRuntime.tools,
  ]
  const toolRegistry = new ToolRegistry(tools)
  const agentRunner = new AgentRunner({ toolRegistry })
  const systemPrompt = composeSystemPrompt({
    modelRef,
    tools,
    platform,
    mode: config.mode?.active ?? 'pro',
    assistantProfile: config.assistant?.profile ?? 'business-copilot',
    activeSkills,
    activePlugins,
  })

  return {
    tools,
    toolRegistry,
    agentRunner,
    skills,
    activeSkills,
    plugins,
    activePlugins,
    mcpDiagnostics: mcpRuntime.diagnostics,
    systemPrompt,
    runtime: {
      mode: config.mode?.active ?? 'pro',
      permissions: config.permissions?.tools ?? {},
      activeSkillIds: activeSkills.map(skill => skill.id),
      activePluginIds: activePlugins.map(plugin => plugin.id),
      activeMcpServerIds: mcpRuntime.diagnostics.filter(item => item.ok).map(item => item.serverId),
    },
    configStore,
  }
}

function composeSystemPrompt({ modelRef, tools, platform, mode, assistantProfile, activeSkills, activePlugins }) {
  const basePrompt = createSystemPrompt({
    modelId: modelRef.id,
    tools,
    platform,
    assistantProfile,
    now: new Date(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  const pluginSection = activePlugins.length
    ? [
        'Loaded plugins:',
        ...activePlugins.map(plugin => `- ${plugin.name}: ${plugin.description || 'plugin loaded'}`),
      ].join('\n')
    : ''
  const skillSection = buildSkillPrompt(activeSkills, activeSkills.map(skill => skill.id))

  return [
    basePrompt,
    `Active assistant profile: ${assistantProfile}.`,
    `Current runtime mode: ${mode}.`,
    pluginSection,
    skillSection,
  ].filter(Boolean).join('\n\n')
}

function filterActivePlugins(plugins, activePluginIds = []) {
  if (!Array.isArray(activePluginIds) || activePluginIds.length === 0) {
    return plugins.filter(plugin => plugin.enabled !== false)
  }

  const activeSet = new Set(activePluginIds)
  return plugins.filter(plugin => activeSet.has(plugin.id) && plugin.enabled !== false)
}
