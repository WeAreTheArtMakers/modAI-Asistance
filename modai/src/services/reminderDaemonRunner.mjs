import { execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { ConfigStore } from './ConfigStore.mjs'
import { SessionStore } from './SessionStore.mjs'

const execFileAsync = promisify(execFile)
const configStore = new ConfigStore()
const sessionStore = new SessionStore(configStore)
const statePath = join(configStore.getBaseDir(), 'reminder-daemon-state.json')

await runReminderCycle()

async function runReminderCycle() {
  const config = await configStore.load()
  if (config.reminders?.daemonEnabled === false) {
    return
  }

  const tasks = await sessionStore.listScheduledTasks(200)
  const state = readState()
  const now = Date.now()

  for (const task of tasks) {
    if (!task.delivery) {
      continue
    }

    const dueAt = parseDeliveryDate(task.delivery)
    if (!dueAt || dueAt.getTime() > now) {
      continue
    }

    const signature = `${task.taskId}:${task.updatedAt}:${task.delivery}`
    if (state.notified[task.taskId] === signature) {
      continue
    }

    try {
      await sendNotification(task.title, task.goal || task.title, config.reminders?.sound || process.env.MODAI_REMINDER_SOUND || 'Glass')
      state.notified[task.taskId] = signature
    } catch {
      // Keep the task eligible for the next cycle if notification delivery fails.
    }
  }

  writeState(state)
}

async function sendNotification(title, body, sound) {
  const trimmedTitle = String(title ?? 'modAI Reminder').slice(0, 120)
  const trimmedBody = String(body ?? '').slice(0, 220)
  await execFileAsync('osascript', [
    '-e',
    `display notification "${escapeAppleScript(trimmedBody)}" with title "${escapeAppleScript(trimmedTitle)}"`,
  ])

  const soundPath = `/System/Library/Sounds/${sound}.aiff`
  await execFileAsync('afplay', [soundPath]).catch(() => {})
}

function readState() {
  if (!existsSync(statePath)) {
    return { notified: {} }
  }

  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return { notified: {} }
  }
}

function writeState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8')
}

function parseDeliveryDate(value) {
  const normalized = String(value ?? '').trim().replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function escapeAppleScript(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
