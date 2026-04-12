import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const PLIST_ID = 'com.modai.reminders'

export async function syncReminderDaemon({ enabled, sound = 'Glass', configStore, runtimeDir, nodePath = process.execPath }) {
  if (!configStore) {
    return { installed: false, message: 'Reminder daemon config is unavailable.' }
  }

  if (!enabled) {
    await uninstallReminderDaemon()
    return {
      installed: false,
      launchAgentPath: getLaunchAgentPath(),
      message: 'Background reminder daemon is disabled.',
    }
  }

  const launchAgentPath = getLaunchAgentPath()
  await mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true })
  const scriptPath = join(runtimeDir, 'modai', 'src', 'services', 'reminderDaemonRunner.mjs')
  const plist = buildLaunchAgentPlist({
    nodePath,
    scriptPath,
    modaiHome: configStore.getBaseDir(),
    sound,
  })

  await writeFile(launchAgentPath, plist, 'utf8')
  await safelyRun(['launchctl', 'unload', launchAgentPath])
  await safelyRun(['launchctl', 'load', launchAgentPath])

  return {
    installed: true,
    launchAgentPath,
    message: 'Background reminder daemon is active.',
  }
}

export async function getReminderDaemonStatus() {
  const launchAgentPath = getLaunchAgentPath()
  try {
    await readFile(launchAgentPath, 'utf8')
    return {
      installed: true,
      launchAgentPath,
      message: 'Background reminder daemon is installed.',
    }
  } catch {
    return {
      installed: false,
      launchAgentPath,
      message: 'Background reminder daemon is not installed.',
    }
  }
}

export async function uninstallReminderDaemon() {
  const launchAgentPath = getLaunchAgentPath()
  await safelyRun(['launchctl', 'unload', launchAgentPath])
  await rm(launchAgentPath, { force: true })
}

export function getLaunchAgentPath() {
  return join(homedir(), 'Library', 'LaunchAgents', `${PLIST_ID}.plist`)
}

function buildLaunchAgentPlist({ nodePath, scriptPath, modaiHome, sound }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${PLIST_ID}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${escapeXml(nodePath)}</string>
      <string>${escapeXml(scriptPath)}</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
      <key>MODAI_HOME</key>
      <string>${escapeXml(modaiHome)}</string>
      <key>MODAI_REMINDER_SOUND</key>
      <string>${escapeXml(sound)}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>30</integer>
    <key>StandardOutPath</key>
    <string>${escapeXml(join(modaiHome, 'reminder-daemon.log'))}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(join(modaiHome, 'reminder-daemon.log'))}</string>
  </dict>
</plist>
`
}

async function safelyRun(args) {
  try {
    await execFileAsync(args[0], args.slice(1))
  } catch {
    // Ignore launchctl transitions that fail during replace/remove.
  }
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
