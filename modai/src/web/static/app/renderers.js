import { escapeHtml, getTaskStatusLabel, getTaskTimingState } from './utils.js'

export function renderProviderCardMarkup(provider, { draft, t }) {
  const discoveredModels = (provider.discoveredModels ?? []).slice(0, 4).join(', ')
  const supportsApiKey = Boolean(provider.apiKeyEnv)
  const storageLabel = provider.secretStorage === 'keychain'
    ? t('macKeychain')
    : provider.secretStorage === 'env'
      ? t('environmentVariable')
      : provider.hasStoredApiKey
        ? 'app config'
        : t('envOrEmpty')

  return `
    <article class="provider-card ${provider.available ? 'ok' : 'warn'}">
      <div class="provider-head">
        <strong>${escapeHtml(provider.id)}</strong>
        <span class="provider-pill">${provider.available ? escapeHtml(t('providerReady')) : escapeHtml(t('providerSetup'))}</span>
      </div>
      <div class="provider-meta">${escapeHtml(provider.type)}${provider.baseUrl ? ` · ${escapeHtml(provider.baseUrl)}` : ''}</div>
      <div class="provider-status">${escapeHtml(provider.availabilityMessage)}</div>
      <div class="provider-hint">${escapeHtml(provider.setupHint || '')}</div>
      <div class="provider-config">
        <label class="field compact-field">
          <span>${escapeHtml(t('baseUrl'))}</span>
          <input
            type="text"
            data-provider-base-url="${escapeHtml(provider.id)}"
            value="${escapeHtml(draft.baseUrl)}"
            placeholder="https://..."
          />
        </label>
        ${supportsApiKey ? `
          <label class="field compact-field">
            <span>${escapeHtml(t('apiKey'))} ${provider.hasCredential ? `· ${escapeHtml(storageLabel)}` : ''}</span>
            <input
              type="password"
              data-provider-api-key="${escapeHtml(provider.id)}"
              data-clear-api-key="${draft.clearApiKey ? 'true' : 'false'}"
              value="${escapeHtml(draft.apiKey)}"
              placeholder="${escapeHtml(provider.apiKeyEnv || 'API_KEY')}"
              autocomplete="off"
            />
          </label>
        ` : ''}
      </div>
      ${supportsApiKey ? `
        <div class="provider-actions">
          <button
            type="button"
            class="secondary provider-inline-button"
            data-provider-clear-key="${escapeHtml(provider.id)}"
          >${draft.clearApiKey ? escapeHtml(t('keyWillClear')) : escapeHtml(t('clearStoredKey'))}</button>
          <span class="provider-inline-note">${escapeHtml(t('leaveBlank'))}</span>
        </div>
      ` : ''}
      ${discoveredModels ? `<div class="provider-models">${escapeHtml(discoveredModels)}</div>` : ''}
    </article>
  `
}

export function renderAdvancedProviderPanel(providers, { t }) {
  const localCount = providers.filter(provider => provider.group === 'local').length
  const cloudCount = providers.filter(provider => provider.group === 'cloud').length
  const missingKeys = providers.filter(provider => provider.apiKeyEnv && !provider.hasCredential).length
  const keychainCount = providers.filter(provider => provider.secretStorage === 'keychain').length

  return `
    <article class="provider-card">
      <div class="provider-head">
        <strong>${escapeHtml(t('secretStorageTitle'))}</strong>
        <span class="provider-pill">${keychainCount ? 'keychain' : 'env/config'}</span>
      </div>
      <div class="provider-status">${escapeHtml(t('secretStorageCopy'))}</div>
      <div class="provider-models">${escapeHtml(`${keychainCount} keychain, ${missingKeys} ${t('providerSetup')}`)}</div>
    </article>
    <article class="provider-card">
      <div class="provider-head">
        <strong>${escapeHtml(t('groupsTitle'))}</strong>
        <span class="provider-pill">${escapeHtml(t('overview'))}</span>
      </div>
      <div class="provider-status">${escapeHtml(t('groupsCopy', { local: localCount, cloud: cloudCount }))}</div>
      <div class="provider-models">${escapeHtml(providers.map(provider => `${provider.id}: ${provider.baseUrl || 'default endpoint'}`).join(' · '))}</div>
    </article>
    <article class="provider-card">
      <div class="provider-head">
        <strong>${escapeHtml(t('advancedNoteTitle'))}</strong>
        <span class="provider-pill">${escapeHtml(t('customEndpoints'))}</span>
      </div>
      <div class="provider-status">${escapeHtml(t('advancedNoteCopy'))}</div>
      <div class="provider-hint">${escapeHtml(t('advancedNoteHint'))}</div>
    </article>
  `
}

export function renderSessionCardMarkup(session, { activeSessionId, t, formatTimestamp }) {
  return `
    <article class="session-card ${session.sessionId === activeSessionId ? 'active' : ''}">
      <button
        type="button"
        class="session-open"
        data-session-id="${escapeHtml(session.sessionId)}"
      >
      <div class="session-card-head">
        <div class="session-title">${escapeHtml(session.preview || t('newChat'))}</div>
      </div>
      <div class="session-meta">${escapeHtml(formatTimestamp(session.updatedAt))}</div>
      </button>
      <button
        type="button"
        class="session-delete"
        aria-label="${escapeHtml(t('delete'))}"
        data-delete-session-id="${escapeHtml(session.sessionId)}"
      >×</button>
    </article>
  `
}

export function renderNoteCardMarkup(note, { formatTimestamp }) {
  return `
    <article class="note-card">
      <div class="note-head">
        <strong>${escapeHtml(note.title)}</strong>
        <span>${escapeHtml(note.category)}</span>
      </div>
      <div class="note-body">${escapeHtml(note.content)}</div>
      <div class="note-time">${escapeHtml(formatTimestamp(note.createdAt))}</div>
    </article>
  `
}

export function renderTaskCardMarkup(task, { t }) {
  const taskState = getTaskTimingState(task)
  const taskStatus = getTaskStatusLabel(task, t)
  return `
    <article class="note-card task-card ${escapeHtml(taskState)}">
      <div class="note-head task-head">
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          <div class="task-status-pill ${escapeHtml(taskState)}">${escapeHtml(taskStatus)}</div>
        </div>
        <button
          type="button"
          class="secondary task-delete"
          data-delete-task-id="${escapeHtml(task.taskId)}"
          aria-label="${escapeHtml(t('delete'))}"
        >×</button>
      </div>
      ${task.goal ? `<div class="note-body">${escapeHtml(task.goal)}</div>` : ''}
      ${task.delivery ? `<div class="note-time">${escapeHtml(t('due'))}: ${escapeHtml(task.delivery)}</div>` : ''}
    </article>
  `
}
