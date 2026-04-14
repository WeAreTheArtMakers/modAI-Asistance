import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const DEFAULT_RELEASE_REPO = 'WeAreTheArtMakers/modAI-Asistance'

let lastUpdateResult = null

export async function getOperationsSnapshot({ configStore, runtimeDir }) {
  const currentVersion = await resolveAppVersion(runtimeDir)
  const telemetry = await readTelemetryStatus(configStore)

  return {
    appVersion: currentVersion,
    update: {
      currentVersion,
      checkedAt: lastUpdateResult?.checkedAt ?? '',
      latestVersion: lastUpdateResult?.latestVersion ?? '',
      available: lastUpdateResult?.available === true,
      downloadUrl: lastUpdateResult?.downloadUrl ?? '',
      releaseUrl: lastUpdateResult?.releaseUrl ?? '',
      assetName: lastUpdateResult?.assetName ?? '',
      notes: lastUpdateResult?.notes ?? '',
      source: lastUpdateResult?.source ?? 'github-releases',
    },
    telemetry,
  }
}

export async function checkForAppUpdates({
  configStore,
  runtimeDir,
  fetchImpl = fetch,
  platform = process.platform,
  arch = process.arch,
} = {}) {
  const currentVersion = await resolveAppVersion(runtimeDir)
  const repo = String(process.env.MODAI_GITHUB_REPO ?? DEFAULT_RELEASE_REPO).trim() || DEFAULT_RELEASE_REPO
  const feedUrl = String(process.env.MODAI_UPDATE_FEED_URL ?? '').trim()
  const requestUrl = feedUrl || `https://api.github.com/repos/${repo}/releases/latest`
  const response = await fetchImpl(requestUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'modAI',
    },
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.message || 'Update check failed')
  }

  const latestVersion = normalizeVersion(payload.tag_name || payload.version || '')
  const releaseUrl = String(payload.html_url ?? payload.url ?? '')
  const assets = Array.isArray(payload.assets) ? payload.assets : []
  const asset = pickReleaseAsset(assets, { platform, arch })
  const checkedAt = new Date().toISOString()

  lastUpdateResult = {
    currentVersion,
    checkedAt,
    latestVersion,
    available: compareVersions(latestVersion, currentVersion) > 0,
    downloadUrl: String(asset?.browser_download_url ?? releaseUrl),
    releaseUrl,
    assetName: String(asset?.name ?? ''),
    notes: String(payload.body ?? ''),
    source: feedUrl ? 'custom-feed' : 'github-releases',
  }

  return {
    ok: true,
    operations: await getOperationsSnapshot({ configStore, runtimeDir }),
  }
}

export async function recordTelemetryEvent(configStore, event = {}, { fetchImpl = fetch } = {}) {
  await configStore.ensureLayout()
  await mkdir(configStore.getBaseDir(), { recursive: true })

  const entry = {
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    source: String(event.source ?? 'app'),
    level: String(event.level ?? 'error'),
    message: String(event.message ?? '').slice(0, 8_000),
    stack: typeof event.stack === 'string' ? event.stack.slice(0, 16_000) : '',
    context: event.context ?? {},
  }

  await appendFile(getTelemetryLogPath(configStore), `${JSON.stringify(entry)}\n`, 'utf8')

  const endpoint = String(process.env.MODAI_TELEMETRY_ENDPOINT ?? '').trim()
  if (endpoint) {
    try {
      const headers = {
        'Content-Type': 'application/json',
      }
      const bearer = String(process.env.MODAI_TELEMETRY_BEARER_TOKEN ?? '').trim()
      if (bearer) {
        headers.Authorization = `Bearer ${bearer}`
      }

      await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(entry),
      })
    } catch {
      // Keep local logging best-effort even if the remote sink is unavailable.
    }
  }

  return {
    ok: true,
    telemetry: await readTelemetryStatus(configStore),
  }
}

export async function readTelemetryStatus(configStore) {
  const logPath = getTelemetryLogPath(configStore)
  const crashLogPath = getCrashLogPath(configStore)
  const [eventLines, crashStats] = await Promise.all([
    readTelemetryLines(logPath),
    safeStat(crashLogPath),
  ])

  const lastEvent = eventLines.length ? parseJsonLine(eventLines[eventLines.length - 1]) : null

  return {
    localLogPath: logPath,
    crashLogPath,
    eventCount: eventLines.length,
    lastEventAt: lastEvent?.occurredAt ?? '',
    remoteSinkConfigured: Boolean(String(process.env.MODAI_TELEMETRY_ENDPOINT ?? '').trim()),
    crashLogPresent: Boolean(crashStats && crashStats.size > 0),
    crashLogSize: Number(crashStats?.size ?? 0),
  }
}

export function getTelemetryLogPath(configStore) {
  return join(configStore.getBaseDir(), 'telemetry-events.jsonl')
}

export function getCrashLogPath(configStore) {
  return join(configStore.getBaseDir(), 'crash.log')
}

async function resolveAppVersion(runtimeDir) {
  const packagePath = join(runtimeDir, 'package.json')
  try {
    const raw = await readFile(packagePath, 'utf8')
    const parsed = JSON.parse(raw)
    return normalizeVersion(parsed.version || '0.1.0')
  } catch {
    return normalizeVersion(process.env.MODAI_APP_VERSION || '0.1.0')
  }
}

function pickReleaseAsset(assets, { platform, arch }) {
  const patterns = getPreferredAssetPatterns(platform, arch)
  for (const pattern of patterns) {
    const match = assets.find(asset => pattern.test(String(asset?.name ?? '')))
    if (match) {
      return match
    }
  }
  return assets[0] ?? null
}

function getPreferredAssetPatterns(platform, arch) {
  if (platform === 'darwin' && arch === 'arm64') {
    return [/tauri-macos-arm64\.zip$/i, /macos-arm64\.zip$/i]
  }
  if (platform === 'darwin') {
    return [/tauri-macos-(x64|intel)\.zip$/i, /macos-(x64|intel)\.zip$/i]
  }
  if (platform === 'win32') {
    return [/windows.*(x64|amd64).*\.(msi|exe)$/i, /tauri-windows.*\.zip$/i]
  }
  return [/linux.*\.(appimage|deb)$/i, /tauri-linux.*\.tar\.gz$/i]
}

function normalizeVersion(value) {
  return String(value ?? '').trim().replace(/^v/i, '') || '0.0.0'
}

function compareVersions(left, right) {
  const leftParts = splitVersion(left)
  const rightParts = splitVersion(right)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0
    const rightValue = rightParts[index] ?? 0
    if (leftValue > rightValue) {
      return 1
    }
    if (leftValue < rightValue) {
      return -1
    }
  }

  return 0
}

function splitVersion(value) {
  return normalizeVersion(value)
    .split(/[.-]/)
    .map(part => Number.parseInt(part, 10))
    .filter(part => Number.isFinite(part))
}

async function readTelemetryLines(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return raw.split('\n').map(line => line.trim()).filter(Boolean)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

async function safeStat(filePath) {
  try {
    return await stat(filePath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}
