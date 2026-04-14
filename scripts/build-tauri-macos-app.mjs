import { chmod, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = join(rootDir, 'dist')
const appDir = join(distDir, 'modAI.app')
const contentsDir = join(appDir, 'Contents')
const macOsDir = join(contentsDir, 'MacOS')
const resourcesDir = join(contentsDir, 'Resources')
const runtimeDir = join(resourcesDir, 'runtime')
const cargoHomeDir = process.env.CARGO_HOME || join(process.env.HOME ?? rootDir, '.cargo')
const cargoExecutable = resolveCargoExecutable(cargoHomeDir)
const requestedTarget = readRequestedTarget()
const artifactArch = mapMacArtifactArch(requestedTarget || process.arch)
const cargoTargetDir = requestedTarget
  ? join(rootDir, 'src-tauri', 'target', requestedTarget, 'release')
  : join(rootDir, 'src-tauri', 'target', 'release')
const binarySource = join(cargoTargetDir, 'modai-tauri')
const binaryTarget = join(macOsDir, 'modAI')
const zipPath = join(distDir, `modAI-tauri-macos-${artifactArch}.zip`)
const infoPlistPath = join(contentsDir, 'Info.plist')
const readmePath = join(resourcesDir, 'README.txt')
const iconIcnsSource = join(rootDir, 'src-tauri', 'icons', 'modAI.icns')
const iconIcnsTarget = join(resourcesDir, 'modAI.icns')
const iconPngSource = join(rootDir, 'src-tauri', 'icons', 'icon.png')
const iconPngTarget = join(resourcesDir, 'modAI.png')
const packageVersion = await readPackageVersion()

const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>modAI</string>
  <key>CFBundleExecutable</key>
  <string>modAI</string>
  <key>CFBundleIconFile</key>
  <string>modAI</string>
  <key>CFBundleIdentifier</key>
  <string>com.modai.tauri</string>
  <key>CFBundleName</key>
  <string>modAI</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${packageVersion}</string>
  <key>CFBundleVersion</key>
  <string>${packageVersion}</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
</dict>
</plist>
`

const readme = `modAI Tauri build for macOS ${artifactArch}

What is bundled
- Native Tauri window shell
- Embedded modAI runtime files
- Local-first web UI served from a background Node process

Requirements
- macOS 13+
- Node.js 22+ on PATH
- Optional: Ollama for local model usage

Run
1. Open modAI.app
2. The Tauri shell starts modAI's local server on http://127.0.0.1:8787
3. The native window opens automatically

If the window cannot start
- Check ~/.modai/tauri-web.log
- Make sure Node.js is installed
- Make sure port 8787 is not blocked
`

execFileSync('node', [join(rootDir, 'scripts', 'generate-brand-assets.mjs')], {
  cwd: rootDir,
  stdio: 'inherit',
})

const cargoArgs = ['build', '--release', '--manifest-path', join(rootDir, 'src-tauri', 'Cargo.toml')]
if (requestedTarget) {
  cargoArgs.push('--target', requestedTarget)
}

execFileSync(cargoExecutable, cargoArgs, {
  cwd: rootDir,
  stdio: 'inherit',
  env: buildCargoEnv(cargoHomeDir),
})

await rm(appDir, { recursive: true, force: true })
await rm(zipPath, { force: true })
await mkdir(macOsDir, { recursive: true })
await mkdir(runtimeDir, { recursive: true })
await cp(binarySource, binaryTarget)
await cp(join(rootDir, 'modai'), join(runtimeDir, 'modai'), { recursive: true })
await cp(join(rootDir, 'bin'), join(runtimeDir, 'bin'), { recursive: true })
await copyOptional(join(rootDir, '.modai', 'skills'), join(runtimeDir, '.modai', 'skills'))
await copyOptional(join(rootDir, '.modai', 'plugins'), join(runtimeDir, '.modai', 'plugins'))
await copyOptional(iconIcnsSource, iconIcnsTarget)
await copyOptional(iconPngSource, iconPngTarget)
await writeFile(infoPlistPath, infoPlist, 'utf8')
await writeFile(readmePath, readme, 'utf8')
await chmod(binaryTarget, 0o755)

try {
  execFileSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appDir], {
    stdio: 'ignore',
  })
} catch {
  console.warn('Ad-hoc codesign skipped')
}

execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appDir, zipPath], {
  stdio: 'ignore',
})

console.log(`Created ${appDir}`)
console.log(`Created ${zipPath}`)

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
  const cargoBin = join(cargoHome, 'bin', 'cargo')
  return existsSync(cargoBin) ? cargoBin : 'cargo'
}

function readRequestedTarget() {
  const targetFlagIndex = process.argv.indexOf('--target')
  if (targetFlagIndex >= 0) {
    return String(process.argv[targetFlagIndex + 1] ?? '').trim()
  }
  return String(process.env.MODAI_CARGO_TARGET ?? '').trim()
}

function mapMacArtifactArch(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'aarch64-apple-darwin' || normalized === 'arm64') {
    return 'arm64'
  }
  if (normalized === 'x86_64-apple-darwin' || normalized === 'x64') {
    return 'x64'
  }
  return process.arch
}

async function readPackageVersion() {
  const manifest = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf8'))
  return String(manifest.version ?? '0.1.0')
}
