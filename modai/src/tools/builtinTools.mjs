import { exec, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createComputerUseTools } from './computerUse.mjs'
import { createMemoryTools } from './memoryTools.mjs'
import { createSandboxTools } from './sandboxTools.mjs'

const execAsync = promisify(exec)

export function createBuiltinTools() {
  return [
    {
      name: 'ls',
      description: 'List files in a directory',
      inputHint: '{"path":"."}',
      permissionKey: 'ls',
      async run(input, context) {
        const target = resolveWorkspacePath(readPathInput(input) || '.', context)
        const entries = await readdir(target, { withFileTypes: true })
        return entries
          .map(entry => `${entry.isDirectory() ? '[dir]' : '[file]'} ${entry.name}`)
          .join('\n')
      },
    },
    {
      name: 'read',
      description: 'Read a UTF-8 file from disk',
      inputHint: '{"path":"README.md"}',
      permissionKey: 'read',
      async run(input, context) {
        const targetPath = readPathInput(input)
        if (!targetPath) {
          throw new Error('Usage: read {"path":"<file>"}')
        }
        const target = resolveWorkspacePath(targetPath, context)
        return readFile(target, 'utf8')
      },
    },
    {
      name: 'write',
      description: 'Write plain text to a UTF-8 file',
      inputHint: '{"path":"notes.txt","content":"hello"}',
      permissionKey: 'write',
      async run(input, context) {
        const { targetPath, content } = readWriteInput(input)
        if (!targetPath) {
          throw new Error('Usage: write {"path":"<file>","content":"..."}')
        }
        const target = resolveWorkspacePath(targetPath, context)
        await writeFile(target, content ?? '', 'utf8')
        return `Wrote ${target}`
      },
    },
    {
      name: 'shell',
      description: 'Run a local shell command',
      inputHint: '{"command":"pwd"}',
      permissionKey: 'shell',
      async run(input, context) {
        const command = readCommandInput(input)
        if (!command) {
          throw new Error('Usage: shell {"command":"<command>"}')
        }
        const { stdout, stderr } = await execAsync(command, {
          shell: '/bin/zsh',
          cwd: resolveWorkspaceDir(context),
          timeout: 20_000,
          maxBuffer: 4 * 1024 * 1024,
        })
        return [stdout, stderr].filter(Boolean).join('\n').trim() || 'command completed with no output'
      },
    },
    {
      name: 'fetch',
      description: 'Fetch a web URL and return the response body',
      inputHint: '{"url":"https://example.com"}',
      permissionKey: 'fetch',
      async run(input) {
        const url = readUrlInput(input)
        if (!url) {
          throw new Error('Usage: fetch {"url":"https://example.com"}')
        }
        const response = await fetch(url)
        return response.text()
      },
    },
    ...createMemoryTools(),
    {
      name: 'open',
      description: 'Open a file, app, or URL on macOS',
      inputHint: '{"target":"https://example.com"}',
      permissionKey: 'open',
      requiredMode: 'pro',
      async run(input, context) {
        const { target, application } = readOpenInput(input)
        if (!target && !application) {
          throw new Error('Usage: open {"target":"<path|url>","application":"Optional App"}')
        }

        if (application && !target) {
          await runProcess('open', ['-a', application])
          return `Opened ${application}`
        }

        const resolvedTarget = isLikelyUrl(target) ? target : resolveWorkspacePath(target, context)
        const args = application ? ['-a', application, resolvedTarget] : [resolvedTarget]
        await runProcess('open', args)
        return `Opened ${resolvedTarget}${application ? ` with ${application}` : ''}`
      },
    },
    {
      name: 'clipboard_read',
      description: 'Read the current clipboard text',
      inputHint: '{}',
      permissionKey: 'clipboard_read',
      requiredMode: 'pro',
      async run() {
        const result = await runProcess('pbpaste', [])
        return result || '(clipboard empty)'
      },
    },
    {
      name: 'clipboard_write',
      description: 'Write text to the current clipboard',
      inputHint: '{"text":"hello from modAI"}',
      permissionKey: 'clipboard_write',
      requiredMode: 'pro',
      async run(input) {
        const text = readTextInput(input)
        await runProcess('pbcopy', [], { input: text })
        return 'Clipboard updated'
      },
    },
    {
      name: 'screenshot',
      description: 'Capture a macOS screenshot and return the saved file path',
      inputHint: '{"path":"optional/custom.png"}',
      permissionKey: 'screenshot',
      requiredMode: 'pro',
      async run(input, context) {
        const requestedPath = readPathInput(input)
        const target = requestedPath
          ? resolveWorkspacePath(requestedPath, context)
          : await createArtifactPath(context, 'screenshots', `shot-${randomUUID()}.png`)
        await runProcess('screencapture', ['-x', target])
        return `Saved screenshot to ${target}`
      },
    },
    ...createComputerUseTools(),
    ...createSandboxTools(),
    {
      name: 'applescript',
      description: 'Run AppleScript for advanced computer control',
      inputHint: '{"script":"tell application \\"Finder\\" to activate"}',
      permissionKey: 'applescript',
      requiredMode: 'pro',
      async run(input) {
        const script = readScriptInput(input)
        if (!script) {
          throw new Error('Usage: applescript {"script":"tell application \\"Finder\\" to activate"}')
        }
        const output = await runProcess('osascript', ['-e', script])
        return output || 'AppleScript completed with no output'
      },
    },
    {
      name: 'image_generate',
      description: 'Generate an image if the current provider supports it',
      inputHint: '{"prompt":"A brutalist poster","size":"1024x1024"}',
      permissionKey: 'image_generate',
      requiredMode: 'pro',
      async run(input, context) {
        const prompt = readImagePrompt(input)
        if (!prompt.prompt) {
          throw new Error('Usage: image_generate {"prompt":"...","size":"1024x1024"}')
        }

        if (typeof context?.provider?.generateImage !== 'function') {
          throw new Error('Current model/provider does not support image generation')
        }

        const result = await context.provider.generateImage({
          model: context.modelRef?.model,
          prompt: prompt.prompt,
          size: prompt.size,
        })

        return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      },
    },
  ]
}

function readPathInput(input) {
  if (typeof input === 'string') {
    return input
  }

  if (input && typeof input === 'object') {
    return input.path ?? input.targetPath ?? input.file ?? ''
  }

  return ''
}

function readWriteInput(input) {
  if (typeof input === 'string') {
    const [targetPath, ...contentParts] = input.trim().split(/\s+/)
    return {
      targetPath,
      content: contentParts.join(' '),
    }
  }

  if (input && typeof input === 'object') {
    return {
      targetPath: input.targetPath ?? input.path ?? '',
      content: input.content ?? '',
    }
  }

  return {
    targetPath: '',
    content: '',
  }
}

function readCommandInput(input) {
  if (typeof input === 'string') {
    return input
  }

  if (input && typeof input === 'object') {
    return input.command ?? input.cmd ?? ''
  }

  return ''
}

function readUrlInput(input) {
  if (typeof input === 'string') {
    return input
  }

  if (input && typeof input === 'object') {
    return input.url ?? ''
  }

  return ''
}

function readOpenInput(input) {
  if (typeof input === 'string') {
    return { target: input, application: '' }
  }

  if (input && typeof input === 'object') {
    return {
      target: input.target ?? input.path ?? input.url ?? '',
      application: input.application ?? input.app ?? '',
    }
  }

  return { target: '', application: '' }
}

function readTextInput(input) {
  if (typeof input === 'string') {
    return input
  }

  if (input && typeof input === 'object') {
    return input.text ?? input.content ?? ''
  }

  return ''
}

function readScriptInput(input) {
  if (typeof input === 'string') {
    return input
  }

  if (input && typeof input === 'object') {
    return input.script ?? ''
  }

  return ''
}

function readImagePrompt(input) {
  if (typeof input === 'string') {
    return {
      prompt: input,
      size: '1024x1024',
    }
  }

  if (input && typeof input === 'object') {
    return {
      prompt: input.prompt ?? input.text ?? '',
      size: input.size ?? '1024x1024',
    }
  }

  return {
    prompt: '',
    size: '1024x1024',
  }
}

async function createArtifactPath(context, folderName, fileName) {
  const baseDir = context?.configStore?.getBaseDir?.() ?? join(process.cwd(), '.modai')
  const targetDir = join(baseDir, folderName)
  await mkdir(targetDir, { recursive: true })
  return join(targetDir, fileName)
}

function resolveWorkspacePath(targetPath, context) {
  return resolve(resolveWorkspaceDir(context), targetPath)
}

function resolveWorkspaceDir(context) {
  return context?.workspaceDir
    ?? process.env.MODAI_WORKSPACE_DIR
    ?? process.env.HOME
    ?? process.cwd()
}

function isLikelyUrl(value) {
  return /^[a-z]+:\/\//i.test(String(value ?? ''))
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: options.cwd,
    })

    const stdout = []
    const stderr = []

    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))
    child.on('error', rejectPromise)
    child.on('close', code => {
      const stdoutText = Buffer.concat(stdout).toString('utf8').trim()
      const stderrText = Buffer.concat(stderr).toString('utf8').trim()
      if (code !== 0) {
        rejectPromise(new Error(stderrText || `${command} exited with code ${code}`))
        return
      }
      resolvePromise(stdoutText || stderrText)
    })

    if (options.input) {
      child.stdin.write(options.input)
    }
    child.stdin.end()
  })
}
