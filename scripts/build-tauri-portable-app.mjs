import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = join(rootDir, 'dist')
const platform = process.platform
const arch = process.arch

if (!['linux', 'win32'].includes(platform)) {
  throw new Error(`Portable Tauri packaging is only supported for linux and win32. Current platform: ${platform}`)
}

const platformLabel = platform === 'win32' ? 'windows' : 'linux'
const binaryName = platform === 'win32' ? 'modai-tauri.exe' : 'modai-tauri'
const targetBinaryName = platform === 'win32' ? 'modAI.exe' : 'modAI'
const artifactName = `modAI-tauri-${platformLabel}-${arch}`
const bundleDir = join(distDir, artifactName)
const runtimeDir = join(bundleDir, 'runtime')
const readmePath = join(bundleDir, 'README.txt')
const binarySource = join(rootDir, 'src-tauri', 'target', 'release', binaryName)
const binaryTarget = join(bundleDir, targetBinaryName)
const iconSource = join(rootDir, 'src-tauri', 'icons', 'icon.png')
const iconTarget = join(bundleDir, 'modAI.png')
const archivePath = platform === 'win32'
  ? join(distDir, `${artifactName}.zip`)
  : join(distDir, `${artifactName}.tar.gz`)
const cargoHomeDir = process.env.CARGO_HOME || join(process.env.HOME ?? rootDir, '.cargo')
const cargoExecutable = resolveCargoExecutable(cargoHomeDir)

const readme = `modAI Tauri portable build for ${platformLabel} ${arch}

What is included
- Native Tauri window shell
- Bundled modAI runtime files in ./runtime
- Local-first web UI served from a background Node process

Requirements
- Node.js 22+ on PATH
- Optional: Ollama for local model usage

Run
1. Start ${targetBinaryName}
2. modAI launches the local server automatically
3. The native window opens on the local app URL

Notes
- Runtime logs are written into the user's modAI state directory
- This portable package keeps the runtime next to the executable in ./runtime
`

execFileSync(cargoExecutable, ['build', '--release', '--manifest-path', join(rootDir, 'src-tauri', 'Cargo.toml')], {
  cwd: rootDir,
  stdio: 'inherit',
  env: buildCargoEnv(cargoHomeDir),
})

await rm(bundleDir, { recursive: true, force: true })
await rm(archivePath, { force: true })
await mkdir(runtimeDir, { recursive: true })
await cp(binarySource, binaryTarget)
await cp(join(rootDir, 'modai'), join(runtimeDir, 'modai'), { recursive: true })
await cp(join(rootDir, 'bin'), join(runtimeDir, 'bin'), { recursive: true })
await copyOptional(join(rootDir, '.modai', 'skills'), join(runtimeDir, '.modai', 'skills'))
await copyOptional(join(rootDir, '.modai', 'plugins'), join(runtimeDir, '.modai', 'plugins'))
await copyOptional(iconSource, iconTarget)
await writeFile(readmePath, readme, 'utf8')

if (platform !== 'win32') {
  await chmod(binaryTarget, 0o755)
}

createArchive(bundleDir, archivePath)

console.log(`Created ${bundleDir}`)
console.log(`Created ${archivePath}`)

function buildCargoEnv(cargoHome) {
  const envVars = {
    ...process.env,
    CARGO_HOME: cargoHome,
  }
  const cargoBinDir = join(cargoHome, 'bin')
  if (existsSync(cargoBinDir)) {
    envVars.PATH = `${cargoBinDir}:${process.env.PATH ?? ''}`
  }

  if (process.env.MODAI_CARGO_NET_OFFLINE !== 'false') {
    envVars.CARGO_NET_OFFLINE = 'true'
  }

  return envVars
}

function resolveCargoExecutable(cargoHome) {
  const cargoBin = join(cargoHome, 'bin', platform === 'win32' ? 'cargo.exe' : 'cargo')
  return existsSync(cargoBin) ? cargoBin : 'cargo'
}

function createArchive(sourceDir, outputPath) {
  if (platform === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path "${join(sourceDir, '*')}" -DestinationPath "${outputPath}" -Force`,
      ],
      { cwd: rootDir, stdio: 'inherit' },
    )
    return
  }

  const parentDir = dirname(sourceDir)
  const sourceName = basename(sourceDir)
  execFileSync('tar', ['-czf', outputPath, '-C', parentDir, sourceName], {
    cwd: rootDir,
    stdio: 'inherit',
  })
}

async function copyOptional(source, target) {
  try {
    await cp(source, target, { recursive: true })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return
    }
    throw error
  }
}
