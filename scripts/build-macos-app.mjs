import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = join(rootDir, 'dist')
const appDir = join(rootDir, 'dist', 'modAI.app')
const contentsDir = join(appDir, 'Contents')
const macOsDir = join(contentsDir, 'MacOS')
const resourcesDir = join(contentsDir, 'Resources')
const runtimeDir = join(resourcesDir, 'runtime')
const runtimeCommandPath = join(runtimeDir, 'modAI.command')
const runtimeReadmePath = join(resourcesDir, 'README.txt')
const infoPlistPath = join(contentsDir, 'Info.plist')
const launcherPath = join(macOsDir, 'modai-launcher')
const zipPath = join(distDir, `modAI-macos-${process.arch}.zip`)

const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>modAI</string>
  <key>CFBundleExecutable</key>
  <string>modai-launcher</string>
  <key>CFBundleIdentifier</key>
  <string>com.modai.ultralight</string>
  <key>CFBundleName</key>
  <string>modAI</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>0.1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
</dict>
</plist>
`

const launcher = `#!/bin/zsh
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$APP_ROOT/Resources/runtime"
NODE_BIN="\${MODAI_NODE_BIN:-\$(command -v node || true)}"
PORT="\${MODAI_WEB_PORT:-8787}"
STATE_DIR="\${MODAI_HOME:-$HOME/.modai}"
LOG_FILE="$STATE_DIR/web.log"
PID_FILE="$STATE_DIR/web.pid"
SERVER_ENTRY="$RUNTIME_DIR/modai/src/web/server.mjs"
URL="http://127.0.0.1:$PORT"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\${PATH:-}"

mkdir -p "$STATE_DIR"

if [[ -z "$NODE_BIN" ]]; then
  /usr/bin/osascript -e 'display alert "modAI needs Node.js 20+" message "Install Node.js, then relaunch modAI." as critical'
  exit 1
fi

if ! /usr/bin/curl -fsS "$URL/health" >/dev/null 2>&1; then
  nohup "$NODE_BIN" "$SERVER_ENTRY" --port "$PORT" >"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"

  for _ in {1..20}; do
    if /usr/bin/curl -fsS "$URL/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! /usr/bin/curl -fsS "$URL/health" >/dev/null 2>&1; then
  /usr/bin/osascript -e 'display alert "modAI server failed to start" message "Check ~/.modai/web.log for details." as critical'
  exit 1
fi

exec /usr/bin/open "$URL"
`

const runtimeCommand = `#!/bin/zsh
set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="\${MODAI_NODE_BIN:-\$(command -v node || true)}"

if [[ -z "$NODE_BIN" ]]; then
  echo "modAI requires Node.js 20+ on PATH."
  echo "Install Node.js, then relaunch the app."
  exit 1
fi

if [[ "$#" -eq 0 ]]; then
  set -- chat
fi

exec "$NODE_BIN" "$RUNTIME_DIR/modai/src/cli.mjs" "$@"
`

const readme = `modAI macOS ${process.arch} build

Requirements
- macOS 13+
- Node.js 20+
- Browser UI opens locally on http://127.0.0.1:8787
- Optional: Ollama for fully local model usage

Quick start
1. Install Node.js 20+ if it is not already available on PATH.
2. Install and start Ollama:
   ollama serve
   ollama pull llama3.2
3. Open modAI.app to launch the local web interface.
4. For direct CLI usage, run:
   ./modAI.command

Config
- Config is stored in ~/.modai by default.
- In restricted environments, modAI falls back to a local .modai folder.
`

await rm(appDir, { recursive: true, force: true })
await rm(zipPath, { force: true })
await mkdir(macOsDir, { recursive: true })
await mkdir(runtimeDir, { recursive: true })
await cp(join(rootDir, 'modai'), join(runtimeDir, 'modai'), { recursive: true })
await cp(join(rootDir, 'bin'), join(runtimeDir, 'bin'), { recursive: true })
await writeFile(infoPlistPath, infoPlist, 'utf8')
await writeFile(launcherPath, launcher, 'utf8')
await writeFile(runtimeCommandPath, runtimeCommand, 'utf8')
await writeFile(runtimeReadmePath, readme, 'utf8')
await chmod(launcherPath, 0o755)
await chmod(runtimeCommandPath, 0o755)

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
