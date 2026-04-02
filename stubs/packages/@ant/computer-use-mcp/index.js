export const DEFAULT_GRANT_FLAGS = []
export const API_RESIZE_PARAMS = {}

export function bindSessionContext(_fn) {
  return async (...args) => {
    throw new Error('@ant/computer-use-mcp is unavailable in this workspace build')
  }
}

export function buildComputerUseTools() {
  return []
}

export function createComputerUseMcpServer() {
  return {
    async connect() {},
    setRequestHandler() {},
  }
}

export function targetImageSize(width, height) {
  return [width, height]
}
