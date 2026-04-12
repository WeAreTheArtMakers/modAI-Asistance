import { mkdtemp, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'

export function createSandboxTools() {
  return [
    {
      name: 'code_run',
      description: 'Run code in a temporary macOS sandbox with network disabled and workspace writes blocked',
      inputHint: '{"language":"javascript","code":"console.log(42)"}',
      permissionKey: 'code_run',
      requiredMode: 'pro',
      async run(input, context) {
        const request = normalizeSandboxRequest(input)
        const result = await runSandboxedExecution(request, context)
        return JSON.stringify(result, null, 2)
      },
    },
  ]
}

export async function runSandboxedExecution(request, context) {
  const sandboxDir = await realpath(await mkdtemp(join(tmpdir(), 'modai-sandbox-')))
  try {
    const files = request.files.length
      ? request.files
      : [createInlineProgram(request)]

    await Promise.all(files.map(file => writeSandboxFile(sandboxDir, file)))

    const profile = buildSandboxProfile(sandboxDir)
    const profilePath = join(sandboxDir, 'sandbox.sb')
    await writeFile(profilePath, profile, 'utf8')

    const outcome = await executeWithProfile({
      sandboxDir,
      profilePath,
      command: request.command,
      timeoutMs: request.timeoutMs,
    })

    const generatedFiles = await listGeneratedFiles(sandboxDir)
    return {
      sandboxed: true,
      command: request.command,
      language: request.language,
      timeoutMs: request.timeoutMs,
      ...outcome,
      files: generatedFiles,
      workspace: context?.workspaceDir ?? process.cwd(),
    }
  } finally {
    await rm(sandboxDir, { recursive: true, force: true }).catch(() => {})
  }
}

function normalizeSandboxRequest(input) {
  const payload = input && typeof input === 'object' ? input : { code: String(input ?? '') }
  const language = String(payload.language ?? 'javascript').trim().toLowerCase()
  const timeoutMs = clampTimeout(payload.timeoutMs)
  const files = Array.isArray(payload.files)
    ? payload.files
      .map(file => ({
        path: String(file?.path ?? '').trim(),
        content: String(file?.content ?? ''),
      }))
      .filter(file => file.path)
    : []

  const command = String(payload.command ?? '').trim() || defaultCommandFor(language, files[0]?.path)
  if (!command) {
    throw new Error('Sandbox execution requires either a command or a supported language.')
  }

  return {
    language,
    code: String(payload.code ?? ''),
    files,
    command,
    timeoutMs,
  }
}

function createInlineProgram(request) {
  const path = defaultFileNameFor(request.language)
  return {
    path,
    content: request.code,
  }
}

async function writeSandboxFile(sandboxDir, file) {
  const target = resolve(sandboxDir, file.path)
  if (!target.startsWith(`${sandboxDir}/`) && target !== sandboxDir) {
    throw new Error(`Sandbox file path escapes the sandbox: ${file.path}`)
  }

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, file.content ?? '', 'utf8')
}

function buildSandboxProfile(sandboxDir) {
  const metadataRules = buildMetadataRules(sandboxDir)
  return `
(version 1)
(deny default)
(import "system.sb")
(allow process*)
(allow file-read* (subpath "${sandboxDir}"))
(allow file-read-metadata (subpath "${sandboxDir}"))
(allow file-read-metadata ${metadataRules})
(allow file-write* (subpath "${sandboxDir}"))
(allow file-read-data (literal "/dev/null"))
(allow file-read-data (literal "/dev/urandom"))
(deny network*)
`.trim()
}

async function executeWithProfile({ sandboxDir, profilePath, command, timeoutMs }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('/usr/bin/sandbox-exec', ['-f', profilePath, '/bin/zsh', '-lc', command], {
      cwd: sandboxDir,
      env: {
        HOME: sandboxDir,
        PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
        TMPDIR: sandboxDir,
        LANG: 'en_US.UTF-8',
      },
      stdio: 'pipe',
    })

    const stdout = []
    const stderr = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      child.kill('SIGKILL')
      rejectPromise(new Error(`Sandbox command timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))
    child.on('error', error => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      rejectPromise(error)
    })
    child.on('close', code => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      resolvePromise({
        ok: code === 0,
        exitCode: code ?? 0,
        stdout: Buffer.concat(stdout).toString('utf8').trim(),
        stderr: Buffer.concat(stderr).toString('utf8').trim(),
      })
    })
  })
}

async function listGeneratedFiles(sandboxDir) {
  const files = []
  await walkDir(sandboxDir, sandboxDir, files)
  return files
    .filter(path => !path.endsWith('sandbox.sb'))
    .sort((left, right) => left.localeCompare(right))
}

async function walkDir(rootDir, currentDir, files) {
  const entries = await readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const target = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await walkDir(rootDir, target, files)
      continue
    }
    const relativePath = relative(rootDir, target)
    if (!relativePath) {
      continue
    }
    if ((await readFile(target)).length > 128_000) {
      files.push(`${relativePath} (large file)`)
      continue
    }
    files.push(relativePath)
  }
}

function defaultCommandFor(language, filePath = defaultFileNameFor(language)) {
  if (language === 'javascript' || language === 'js') {
    return `${JSON.stringify(process.execPath)} ${filePath}`
  }
  if (language === 'typescript' || language === 'ts') {
    return `${JSON.stringify(process.execPath)} ${filePath}`
  }
  if (language === 'python' || language === 'py') {
    return `python3 ${filePath}`
  }
  if (language === 'bash' || language === 'sh' || language === 'shell') {
    return `bash ${filePath}`
  }
  return ''
}

function defaultFileNameFor(language) {
  if (language === 'python' || language === 'py') {
    return 'main.py'
  }
  if (language === 'bash' || language === 'sh' || language === 'shell') {
    return 'main.sh'
  }
  if (language === 'typescript' || language === 'ts') {
    return 'main.ts'
  }
  return 'main.js'
}

function clampTimeout(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 15_000
  }
  return Math.max(1_000, Math.min(30_000, Math.round(parsed)))
}

function buildMetadataRules(targetPath) {
  const rules = []
  let current = resolve(targetPath)
  while (current && current !== '/') {
    rules.push(`(literal "${current}")`)
    current = dirname(current)
  }
  rules.push('(literal "/")')
  return rules.join(' ')
}
