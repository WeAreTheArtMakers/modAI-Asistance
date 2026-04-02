export class PermissionRequiredError extends Error {
  constructor({ toolName, permissionKey, input }) {
    super(`Permission required for "${toolName}". Allow it from the permissions panel.`)
    this.name = 'PermissionRequiredError'
    this.code = 'PERMISSION_REQUIRED'
    this.toolName = toolName
    this.permissionKey = permissionKey
    this.input = input
  }
}

export function assertToolAccess(tool, context = {}, input) {
  const mode = getRuntimeMode(context)
  if (tool.requiredMode === 'pro' && mode !== 'pro') {
    throw new Error(`Tool "${tool.name}" requires Pro mode`)
  }

  const permission = getToolPermission(tool.permissionKey ?? tool.name, context)
  if (permission === 'allow') {
    return
  }

  if (permission === 'deny') {
    throw new Error(`Permission denied for "${tool.name}"`)
  }

  throw new PermissionRequiredError({
    toolName: tool.name,
    permissionKey: tool.permissionKey ?? tool.name,
    input,
  })
}

export function getRuntimeMode(context = {}) {
  return context.runtime?.mode ?? context.config?.mode?.active ?? 'pro'
}

export function getToolPermission(toolName, context = {}) {
  return context.runtime?.permissions?.[toolName]
    ?? context.config?.permissions?.tools?.[toolName]
    ?? 'ask'
}
