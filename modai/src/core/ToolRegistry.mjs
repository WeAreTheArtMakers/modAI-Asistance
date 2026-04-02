import { assertToolAccess } from './toolAccess.mjs'

export class ToolRegistry {
  constructor(tools = []) {
    this.tools = new Map()

    for (const tool of tools) {
      this.register(tool)
    }
  }

  register(tool) {
    this.tools.set(tool.name, tool)
  }

  list() {
    return [...this.tools.values()]
  }

  get(name) {
    return this.tools.get(name)
  }

  async run(name, input, context) {
    const tool = this.get(name)

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`)
    }

    assertToolAccess(tool, context, input)
    return tool.run(input, context)
  }
}
