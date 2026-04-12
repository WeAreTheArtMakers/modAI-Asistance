const modeSelect = document.getElementById('modeSelect')
const assistantProfileSelect = document.getElementById('assistantProfileSelect')
const themeSelect = document.getElementById('themeSelect')
const modelSelect = document.getElementById('modelSelect')
const modelStatus = document.getElementById('modelStatus')
const modeStatusBadge = document.getElementById('modeStatusBadge')
const assistantProfileBadge = document.getElementById('assistantProfileBadge')
const runtimeSummary = document.getElementById('runtimeSummary')
const providersPanel = document.getElementById('providersPanel')
const providerTabList = document.getElementById('providerTabList')
const providersSection = document.getElementById('providersSection')
const agentToggle = document.getElementById('agentToggle')
const agentSteps = document.getElementById('agentSteps')
const templateToggle = document.getElementById('templateToggle')
const taskTemplateToggle = document.getElementById('taskTemplateToggle')
const desktopTemplateToggle = document.getElementById('desktopTemplateToggle')
const taskTemplateInput = document.getElementById('taskTemplateInput')
const desktopTemplateInput = document.getElementById('desktopTemplateInput')
const permissionsPanel = document.getElementById('permissionsPanel')
const skillsPanel = document.getElementById('skillsPanel')
const pluginsPanel = document.getElementById('pluginsPanel')
const toolsPanel = document.getElementById('toolsPanel')
const memorySessionsPanel = document.getElementById('memorySessionsPanel')
const drawerSessionsPanel = document.getElementById('drawerSessionsPanel')
const memoryNotesPanel = document.getElementById('memoryNotesPanel')
const scheduledTasksPanel = document.getElementById('scheduledTasksPanel')
const saveSettingsButton = document.getElementById('saveSettingsButton')
const messages = document.getElementById('messages')
const composer = document.getElementById('composer')
const promptInput = document.getElementById('promptInput')
const statusBox = document.getElementById('statusBox')
const sendButton = document.getElementById('sendButton')
const clearButton = document.getElementById('clearButton')
const approvalOverlay = document.getElementById('approvalOverlay')
const approvalTitle = document.getElementById('approvalTitle')
const approvalMessage = document.getElementById('approvalMessage')
const approvalInput = document.getElementById('approvalInput')
const approvalDenyButton = document.getElementById('approvalDenyButton')
const approvalAllowOnceButton = document.getElementById('approvalAllowOnceButton')
const approvalAllowAlwaysButton = document.getElementById('approvalAllowAlwaysButton')
const activeSessionMeta = document.getElementById('activeSessionMeta')
const memorySessionBadge = document.getElementById('memorySessionBadge')
const connectionSummary = document.getElementById('connectionSummary')
const workspaceSummary = document.getElementById('workspaceSummary')
const chatTitle = document.getElementById('chatTitle')
const toggleSettingsButton = document.getElementById('toggleSettingsButton')
const closeSettingsButton = document.getElementById('closeSettingsButton')
const drawerNewChatButton = document.getElementById('drawerNewChatButton')
const settingsDrawer = document.getElementById('settingsDrawer')
const drawerScrim = document.getElementById('drawerScrim')
const activityShell = document.getElementById('activityShell')
const activityPanel = document.getElementById('activityPanel')
const activitySummary = document.getElementById('activitySummary')
const toggleActivityButton = document.getElementById('toggleActivityButton')
const activityHeaderButton = document.getElementById('activityHeaderButton')
const attachImageButton = document.getElementById('attachImageButton')
const imageInput = document.getElementById('imageInput')
const taskModeButton = document.getElementById('taskModeButton')
const desktopModeButton = document.getElementById('desktopModeButton')
const attachmentStrip = document.getElementById('attachmentStrip')
const composerExamples = document.getElementById('composerExamples')

const state = {
  settings: null,
  history: [],
  activity: [],
  pendingChatRequest: null,
  pendingPermissionRequest: null,
  sessionId: null,
  startedAt: new Date().toISOString(),
  composerMode: 'chat',
  pendingAttachments: [],
  thinkingNode: null,
  providerTab: 'local',
  providerDrafts: {},
}

const MODE_LABELS = {
  chat: 'Standart sohbet',
  task: 'Görev modu',
  desktop: 'Bilgisayar kontrolü',
}

const MODE_EXAMPLES = {
  desktop: [
    {
      title: 'Chrome ve YouTube',
      hint: 'Chrome acip YouTube arama sonucunu gosterir.',
      prompt: [
        'Gorev: Google Chrome ac ve YouTube ziyaret et',
        'Amac: Baran Gulesen videolarini bulmak',
        'Kisitlar: Yalnizca Google Chrome kullan, yeni bir sekmede ac',
        'Tamamlanma Kriteri: Baran Gulesen YouTube arama sonuclari gorunuyor',
      ].join('\n'),
    },
    {
      title: 'Finder ve Downloads',
      hint: 'Finder acip Downloads klasorune gider.',
      prompt: [
        'Gorev: Finder ac ve Downloads klasorunu goster',
        'Amac: indirilen dosyalari kontrol etmek',
        'Kisitlar: Sadece Finder kullan',
        'Tamamlanma Kriteri: Downloads klasoru ekranda acik',
      ].join('\n'),
    },
    {
      title: 'Ekran goruntusu al',
      hint: 'Ekran yakalar ve kaydeder.',
      prompt: [
        'Gorev: mevcut ekrandan ekran goruntusu al',
        'Amac: acik pencerenin bir kopyasini kaydetmek',
        'Kisitlar: dosyayi masaustune kaydet',
        'Tamamlanma Kriteri: ekran goruntusu dosyasi olustu',
      ].join('\n'),
    },
  ],
  task: [
    {
      title: 'Sabah hatirlaticisi',
      hint: 'Yarin sabah icin kisa bir hatirlatici kaydi olusturur.',
      prompt: [
        'Gorev: Sabah toplantisini hatirlat',
        'Amac: yarin 09:00 toplantisini kacirmamak',
        'Kisitlar: kisa ve net olsun',
        'Teslim: 2026-04-03 09:00',
      ].join('\n'),
    },
    {
      title: 'Haftalik rapor gorevi',
      hint: 'Bir rapor hazirlik gorevini planlar.',
      prompt: [
        'Gorev: Haftalik satis raporunu hazirla',
        'Amac: cuma gunu paylasilacak ozeti hazir tutmak',
        'Kisitlar: mevcut verilerle sinirli kal',
        'Teslim: 2026-04-04 18:00',
      ].join('\n'),
    },
    {
      title: 'Fatura hatirlaticisi',
      hint: 'Duzensiz unutulan odemeler icin kullan.',
      prompt: [
        'Gorev: Elektrik faturasini hatirlat',
        'Amac: son odeme tarihini kacirmamak',
        'Kisitlar: odeme tutari bilinmiyorsa bos birak',
        'Teslim: 2026-04-05 17:00',
      ].join('\n'),
    },
  ],
}

boot().catch(showError)

async function boot() {
  bindEvents()
  await refreshSettings()
  renderConversation()
  renderActivity()
  renderComposerContext()
  setBusy(false, 'Hazır')
}

function bindEvents() {
  composer.addEventListener('submit', onSubmit)
  saveSettingsButton.addEventListener('click', onSaveSettings)
  clearButton.addEventListener('click', onClear)
  modelSelect.addEventListener('change', updateModelStatus)
  modeSelect.addEventListener('change', updateModelStatus)
  assistantProfileSelect.addEventListener('change', renderAssistantProfileBadges)
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value))
  agentToggle.addEventListener('change', updateModelStatus)
  agentSteps.addEventListener('input', updateModelStatus)
  templateToggle.addEventListener('change', syncTemplateControls)
  taskTemplateToggle.addEventListener('change', syncTemplateControls)
  desktopTemplateToggle.addEventListener('change', syncTemplateControls)
  approvalDenyButton.addEventListener('click', onApprovalDeny)
  approvalAllowOnceButton.addEventListener('click', () => handlePermissionApproval('once'))
  approvalAllowAlwaysButton.addEventListener('click', () => handlePermissionApproval('always'))
  memorySessionsPanel.addEventListener('click', onSessionCardClick)
  drawerSessionsPanel.addEventListener('click', onSessionCardClick)
  providersPanel.addEventListener('click', onProviderPanelClick)
  providersPanel.addEventListener('input', onProviderPanelInput)
  providerTabList.addEventListener('click', onProviderTabClick)
  toggleSettingsButton.addEventListener('click', openSettingsDrawer)
  closeSettingsButton.addEventListener('click', closeSettingsDrawer)
  drawerNewChatButton.addEventListener('click', onClear)
  drawerScrim.addEventListener('click', closeSettingsDrawer)
  toggleActivityButton.addEventListener('click', openActivityDrawer)
  activityHeaderButton.addEventListener('click', openActivityDrawer)
  attachImageButton.addEventListener('click', () => imageInput.click())
  imageInput.addEventListener('change', onImageInputChange)
  taskModeButton.addEventListener('click', () => toggleComposerMode('task'))
  desktopModeButton.addEventListener('click', () => toggleComposerMode('desktop'))
  attachmentStrip.addEventListener('click', onAttachmentStripClick)
  composerExamples.addEventListener('click', onComposerExamplesClick)
  messages.addEventListener('click', onMessageAreaClick)
  promptInput.addEventListener('input', resizeComposerInput)
  promptInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      composer.requestSubmit()
    }
  })
}

async function refreshSettings() {
  const settings = await fetchJson('/api/settings')
  state.settings = settings
  renderSettings(settings)
}

function renderSettings(settings) {
  if (!state.providerTab || !isValidProviderTab(state.providerTab)) {
    state.providerTab = getDefaultProviderTab(settings)
  }
  state.providerDrafts = createProviderDrafts(settings.providers ?? [])
  modeSelect.value = settings.mode?.active ?? 'pro'
  assistantProfileSelect.value = settings.assistant?.profile ?? 'business-copilot'
  const theme = settings.theme?.active ?? 'auto'
  themeSelect.value = theme
  applyTheme(theme)
  renderModels(settings)
  renderProviders(settings)
  renderAgent(settings)
  renderComposerTemplateSettings(settings)
  renderPermissions(settings)
  renderSkills(settings)
  renderPlugins(settings)
  renderTools(settings)
  renderMemory(settings)
  renderAssistantProfileBadges()
  updateModelStatus()
  updateSessionIndicators()
  renderComposerContext()
  resizeComposerInput()
}

function renderModels(settings) {
  modelSelect.innerHTML = ''
  for (const model of settings.models ?? []) {
    const option = document.createElement('option')
    option.value = model.id
    option.textContent = model.available
      ? `${model.id}`
      : `${model.id} · unavailable`
    option.disabled = !model.available
    if (model.id === settings.defaultModel) {
      option.selected = true
    }
    modelSelect.append(option)
  }
}

function renderProviders(settings) {
  renderProviderTabs()

  const providers = settings.providers ?? []
  if (state.providerTab === 'advanced') {
    providersPanel.innerHTML = renderAdvancedProviderPanel(providers)
    return
  }

  const visibleProviders = providers.filter(provider => provider.group === state.providerTab)
  providersPanel.innerHTML = visibleProviders.length
    ? visibleProviders.map(renderProviderCardMarkup).join('')
    : '<div class="empty-card">Bu sekmede goruntulenecek provider yok.</div>'
}

function renderProviderTabs() {
  for (const button of providerTabList.querySelectorAll('[data-provider-tab]')) {
    button.classList.toggle('is-active', button.dataset.providerTab === state.providerTab)
  }
}

function renderProviderCardMarkup(provider) {
  const discoveredModels = (provider.discoveredModels ?? []).slice(0, 4).join(', ')
  const supportsApiKey = Boolean(provider.apiKeyEnv)
  const draft = state.providerDrafts[provider.id] ?? {
    baseUrl: provider.baseUrl || '',
    apiKey: '',
    clearApiKey: false,
  }
  const storageLabel = provider.secretStorage === 'keychain'
    ? 'macOS Keychain'
    : provider.secretStorage === 'env'
      ? 'ortam degiskeni'
    : provider.hasStoredApiKey
      ? 'uygulama config'
      : 'ortam degiskeni veya bos'

  return `
    <article class="provider-card ${provider.available ? 'ok' : 'warn'}">
      <div class="provider-head">
        <strong>${escapeHtml(provider.id)}</strong>
        <span class="provider-pill">${provider.available ? 'ready' : 'setup'}</span>
      </div>
      <div class="provider-meta">${escapeHtml(provider.type)}${provider.baseUrl ? ` · ${escapeHtml(provider.baseUrl)}` : ''}</div>
      <div class="provider-status">${escapeHtml(provider.availabilityMessage)}</div>
      <div class="provider-hint">${escapeHtml(provider.setupHint || '')}</div>
      <div class="provider-config">
        <label class="field compact-field">
          <span>Base URL</span>
          <input
            type="text"
            data-provider-base-url="${escapeHtml(provider.id)}"
            value="${escapeHtml(draft.baseUrl)}"
            placeholder="https://..."
          />
        </label>
        ${supportsApiKey ? `
          <label class="field compact-field">
            <span>API key ${provider.hasCredential ? `· ${escapeHtml(storageLabel)}` : ''}</span>
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
          >${draft.clearApiKey ? "Key temizlenecek" : "Kayitli key'i temizle"}</button>
          <span class="provider-inline-note">Bos birakirsan mevcut key korunur.</span>
        </div>
      ` : ''}
      ${discoveredModels ? `<div class="provider-models">${escapeHtml(discoveredModels)}</div>` : ''}
    </article>
  `
}

function renderAdvancedProviderPanel(providers) {
  const localCount = providers.filter(provider => provider.group === 'local').length
  const cloudCount = providers.filter(provider => provider.group === 'cloud').length
  const missingKeys = providers.filter(provider => provider.apiKeyEnv && !provider.hasCredential).length
  const keychainCount = providers.filter(provider => provider.secretStorage === 'keychain').length

  return `
    <article class="provider-card">
      <div class="provider-head">
        <strong>Secret storage</strong>
        <span class="provider-pill">${keychainCount ? 'keychain' : 'env/config'}</span>
      </div>
      <div class="provider-status">Cloud provider key'leri macOS Keychain icinde saklanabilir. Ortam degiskenleri fallback olarak calismaya devam eder.</div>
      <div class="provider-models">${escapeHtml(`${keychainCount} keychain, ${missingKeys} setup bekliyor`)}</div>
    </article>
    <article class="provider-card">
      <div class="provider-head">
        <strong>Gruplar</strong>
        <span class="provider-pill">overview</span>
      </div>
      <div class="provider-status">${escapeHtml(`${localCount} local provider, ${cloudCount} cloud provider tanimli.`)}</div>
      <div class="provider-models">${escapeHtml(providers.map(provider => `${provider.id}: ${provider.baseUrl || 'default endpoint'}`).join(' · '))}</div>
    </article>
    <article class="provider-card">
      <div class="provider-head">
        <strong>Advanced note</strong>
        <span class="provider-pill">custom endpoints</span>
      </div>
      <div class="provider-status">Base URL alanlari Local ve Cloud sekmelerinde duzenlenir. Bu panel, saklama ve baglanti stratejisini ozetler.</div>
      <div class="provider-hint">Cloud key'lerini uygulama icinden kaydet, yerel modellere gecmeden once Ollama veya LM Studio endpoint'lerini dogrula.</div>
    </article>
  `
}

function renderAgent(settings) {
  agentToggle.checked = settings.agent?.enabled !== false
  agentSteps.value = String(settings.agent?.maxSteps ?? 6)
}

function renderComposerTemplateSettings(settings) {
  const templates = settings.composerTemplates ?? {}
  templateToggle.checked = templates.enabled !== false
  taskTemplateToggle.checked = templates.autoTaskTemplate !== false
  desktopTemplateToggle.checked = templates.autoDesktopTemplate !== false
  taskTemplateInput.value = templates.taskTemplate ?? ''
  desktopTemplateInput.value = templates.desktopTemplate ?? ''
  syncTemplateControls()
}

function syncTemplateControls() {
  const templatesEnabled = templateToggle.checked
  taskTemplateToggle.disabled = !templatesEnabled
  desktopTemplateToggle.disabled = !templatesEnabled
  taskTemplateInput.disabled = !templatesEnabled || !taskTemplateToggle.checked
  desktopTemplateInput.disabled = !templatesEnabled || !desktopTemplateToggle.checked
}

function renderPermissions(settings) {
  permissionsPanel.innerHTML = ''
  for (const tool of settings.tools ?? []) {
    const row = document.createElement('label')
    row.className = 'list-row'
    const current = settings.permissions?.tools?.[tool.permissionKey] ?? 'ask'
    row.innerHTML = `
      <span class="row-title">${escapeHtml(tool.name)}</span>
      <select data-permission-key="${escapeHtml(tool.permissionKey)}">
        <option value="allow">allow</option>
        <option value="ask">ask</option>
        <option value="deny">deny</option>
      </select>
    `
    row.querySelector('select').value = current
    permissionsPanel.append(row)
  }
}

function renderSkills(settings) {
  skillsPanel.innerHTML = ''
  if (!(settings.skills ?? []).length) {
    skillsPanel.innerHTML = '<div class="empty-card">Skill bulunamadı.</div>'
    return
  }

  for (const skill of settings.skills) {
    const row = document.createElement('label')
    row.className = 'check-row'
    row.innerHTML = `
      <input type="checkbox" data-skill-id="${escapeHtml(skill.id)}" ${skill.active ? 'checked' : ''} />
      <span>
        <strong>${escapeHtml(skill.name)}</strong>
        <small>${escapeHtml(skill.description || skill.source)}</small>
      </span>
    `
    skillsPanel.append(row)
  }
}

function renderPlugins(settings) {
  pluginsPanel.innerHTML = ''
  if (!(settings.plugins ?? []).length) {
    pluginsPanel.innerHTML = '<div class="empty-card">Plugin bulunamadı.</div>'
    return
  }

  for (const plugin of settings.plugins) {
    const row = document.createElement('label')
    row.className = 'check-row'
    row.innerHTML = `
      <input type="checkbox" data-plugin-id="${escapeHtml(plugin.id)}" ${plugin.active ? 'checked' : ''} />
      <span>
        <strong>${escapeHtml(plugin.name)}</strong>
        <small>${escapeHtml(plugin.description || plugin.source)}</small>
      </span>
    `
    pluginsPanel.append(row)
  }
}

function renderTools(settings) {
  toolsPanel.innerHTML = (settings.tools ?? []).map(tool => `
    <article class="tool-card">
      <div class="tool-name">${escapeHtml(tool.name)}</div>
      <div class="tool-meta">${escapeHtml(tool.requiredMode)} · ${escapeHtml(tool.permissionKey)}</div>
      <div class="tool-description">${escapeHtml(tool.description)}</div>
    </article>
  `).join('')
}

function renderMemory(settings) {
  const sessions = settings.sessions ?? []
  const notes = settings.notes ?? []
  const tasks = settings.tasks ?? []

  const sessionMarkup = sessions.length
    ? sessions.map(renderSessionCardMarkup).join('')
    : '<div class="empty-card">Henüz kayıtlı sohbet yok.</div>'

  memorySessionsPanel.innerHTML = sessionMarkup
  drawerSessionsPanel.innerHTML = sessionMarkup

  memoryNotesPanel.innerHTML = notes.length
    ? notes.map(note => `
        <article class="note-card">
          <div class="note-head">
            <strong>${escapeHtml(note.title)}</strong>
            <span>${escapeHtml(note.category)}</span>
          </div>
          <div class="note-body">${escapeHtml(note.content)}</div>
          <div class="note-time">${escapeHtml(formatTimestamp(note.createdAt))}</div>
        </article>
      `).join('')
    : '<div class="empty-card">Henüz note yok.</div>'

  scheduledTasksPanel.innerHTML = tasks.length
    ? tasks.map(task => `
        <article class="note-card task-card">
          <div class="note-head">
            <strong>${escapeHtml(task.title)}</strong>
            <span>${escapeHtml(task.status || 'draft')}</span>
          </div>
          ${task.goal ? `<div class="note-body">${escapeHtml(task.goal)}</div>` : ''}
          ${task.delivery ? `<div class="note-time">Teslim: ${escapeHtml(task.delivery)}</div>` : ''}
        </article>
      `).join('')
    : '<div class="empty-card">Planlanmis gorev yok.</div>'
}

function renderSessionCardMarkup(session) {
  return `
    <button
      type="button"
      class="session-card ${session.sessionId === state.sessionId ? 'active' : ''}"
      data-session-id="${escapeHtml(session.sessionId)}"
    >
      <div class="session-card-head">
        <div class="session-title">${escapeHtml(session.preview || 'Yeni sohbet')}</div>
        <span
          class="session-delete"
          role="button"
          tabindex="0"
          aria-label="Sohbeti sil"
          data-delete-session-id="${escapeHtml(session.sessionId)}"
        >Sil</span>
      </div>
      <div class="session-meta">${escapeHtml(formatTimestamp(session.updatedAt))}</div>
    </button>
  `
}

function updateModelStatus() {
  const current = state.settings?.models?.find(model => model.id === modelSelect.value)
  if (!current) {
    modelStatus.textContent = 'Model seçilmedi'
    runtimeSummary.textContent = 'Runtime beklemede'
    connectionSummary.textContent = 'Aktif model yok'
    sendButton.disabled = true
    return
  }

  const readiness = current.available ? 'hazır' : 'kullanılamıyor'
  modelStatus.textContent = `${current.id} ${readiness}`
  runtimeSummary.textContent = current.available
    ? `${formatAssistantProfileLabel(assistantProfileSelect.value)} · ${modeSelect.value.toUpperCase()} · ${agentToggle.checked ? `agent ${normalizeSteps(agentSteps.value)} step` : 'agent kapalı'}`
    : current.availabilityMessage
  connectionSummary.textContent = `${current.id} · ${current.available ? 'online' : 'setup gerekli'}`
  sendButton.disabled = !current.available
}

function updateSessionIndicators() {
  const lastUserMessage = findLastUserMessage(state.history)
  const lastParsed = lastUserMessage ? parseMessageContent(lastUserMessage.content) : null
  const titleSource = lastParsed?.text ?? state.history.at(-1)?.content ?? 'Yeni sohbet'
  chatTitle.textContent = summarizeTitle(titleSource)
  activeSessionMeta.textContent = state.sessionId
    ? `${state.history.length} mesaj · ${state.sessionId.slice(0, 8)}…`
    : 'Henüz mesaj yok'
  memorySessionBadge.textContent = state.sessionId
    ? `Session aktif · ${state.sessionId.slice(0, 8)}…`
    : 'Yeni session'
  workspaceSummary.textContent = state.settings?.workspaceDir
    ? `Workspace · ${state.settings.workspaceDir}`
    : 'Workspace hazır'
}

function renderAssistantProfileBadges() {
  assistantProfileBadge.textContent = formatAssistantProfileLabel(assistantProfileSelect.value)
}

function renderConversation() {
  messages.innerHTML = ''

  if (!state.history.length) {
    const onboarding = renderProviderOnboarding(state.settings)
    messages.innerHTML = `
      <section class="empty-state">
        <div class="eyebrow">modAI</div>
        <h3>${assistantProfileSelect.value === 'business-copilot' ? 'Business Development Copilot hazir.' : 'Profesyonel ve sade sohbet görünümü hazır.'}</h3>
        <p>${assistantProfileSelect.value === 'business-copilot'
          ? 'Gelir artisi, maliyet azaltma, operasyon ve buyume odakli analiz icin bir is turu veya hedef yaz. Copilot sektor ve olgunluk seviyesini infer ederek calisir.'
          : 'Eski sohbetler solda kalir. Chat altinda gorsel ekleme, gorev verme ve bilgisayar kontrolu icin hizli aksiyonlar bulunur. Tool aktivitesi ayri panelde tutulur.'}</p>
        ${onboarding}
      </section>
    `
    return
  }

  for (const message of state.history) {
    appendMessage(message.role, message.content, message, true)
  }
  scrollMessagesToBottom()
}

function appendMessage(role, rawContent, meta = {}, skipScroll = false) {
  const emptyState = messages.querySelector('.empty-state')
  if (emptyState) {
    emptyState.remove()
  }

  const parsed = parseMessageContent(rawContent)
  const node = document.createElement('article')
  node.className = `message ${role}${meta.error ? ' error' : ''}`
  const timeLabel = meta.createdAt ? formatClock(meta.createdAt) : ''
  node.innerHTML = `
    <div class="message-head">
      <div class="message-role">${escapeHtml(role === 'assistant' ? 'modAI' : 'You')}</div>
      <div class="message-time">${escapeHtml(timeLabel)}</div>
    </div>
    ${renderMessageMeta(parsed.meta)}
    <div class="message-content"></div>
  `
  const contentNode = node.querySelector('.message-content')
  const visibleText = parsed.text || fallbackMessageText(parsed.meta)
  messages.append(node)
  if (skipScroll) {
    contentNode.textContent = visibleText
  } else {
    animateMessageText(contentNode, visibleText, role)
  }
  if (!skipScroll) {
    scrollMessagesToBottom()
  }
}

function showThinkingMessage(label = 'modAI dusunuyor') {
  clearThinkingMessage()

  const emptyState = messages.querySelector('.empty-state')
  if (emptyState) {
    emptyState.remove()
  }

  const node = document.createElement('article')
  node.className = 'message assistant pending'
  node.innerHTML = `
    <div class="message-head">
      <div class="message-role">modAI</div>
      <div class="message-time">${escapeHtml(formatClock(new Date().toISOString()))}</div>
    </div>
    <div class="thinking-row">
      <span class="thinking-label">${escapeHtml(label)}</span>
      <span class="thinking-dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </span>
    </div>
  `
  messages.append(node)
  state.thinkingNode = node
  scrollMessagesToBottom()
}

function renderProviderOnboarding(settings) {
  const providers = settings?.providers ?? []
  if (!providers.length) {
    return ''
  }

  const localReady = providers.filter(provider => provider.group === 'local' && provider.available).length
  const localTotal = providers.filter(provider => provider.group === 'local').length
  const cloudReady = providers.filter(provider => provider.group === 'cloud' && provider.available).length
  const cloudTotal = providers.filter(provider => provider.group === 'cloud').length
  const missingCloudKeys = providers.filter(
    provider => provider.group === 'cloud' && provider.apiKeyEnv && !provider.hasCredential,
  ).length

  return `
    <section class="setup-onboarding">
      <article class="setup-card">
        <div class="provider-head">
          <strong>Provider Setup</strong>
          <span class="provider-pill">${escapeHtml(`${localReady + cloudReady}/${localTotal + cloudTotal} hazir`)}</span>
        </div>
        <div class="provider-status">Bos sohbette en hizli akış: local modeli dogrula, sonra gerekirse cloud provider key'lerini ekle.</div>
        <div class="setup-grid">
          <div class="setup-stat">
            <span>Local</span>
            <strong>${escapeHtml(`${localReady}/${localTotal}`)}</strong>
            <small>Ollama veya local OpenAI-compatible sunucu</small>
          </div>
          <div class="setup-stat">
            <span>Cloud</span>
            <strong>${escapeHtml(`${cloudReady}/${cloudTotal}`)}</strong>
            <small>${escapeHtml(missingCloudKeys ? `${missingCloudKeys} API key bekliyor` : 'Cloud tarafi hazir')}</small>
          </div>
        </div>
        <div class="onboarding-actions">
          <button type="button" class="secondary" data-open-provider-tab="local">Local Setup</button>
          <button type="button" class="secondary" data-open-provider-tab="cloud">Cloud Setup</button>
          <button type="button" class="secondary" data-open-provider-tab="advanced">Advanced</button>
        </div>
      </article>
    </section>
  `
}

function clearThinkingMessage() {
  state.thinkingNode?.remove()
  state.thinkingNode = null
}

function renderMessageMeta(meta) {
  if (!meta) {
    return ''
  }

  const items = []
  if (meta.mode && meta.mode !== 'chat') {
    items.push(`<span class="message-chip">${escapeHtml(MODE_LABELS[meta.mode] ?? meta.mode)}</span>`)
  }
  for (const attachment of meta.attachments ?? []) {
    items.push(`<span class="message-chip attachment">${escapeHtml(attachment.name)}</span>`)
  }

  if (!items.length) {
    return ''
  }

  return `<div class="message-meta-row">${items.join('')}</div>`
}

function fallbackMessageText(meta) {
  if (meta?.attachments?.length) {
    return 'Ekli görsel gönderildi.'
  }
  return ''
}

function scrollMessagesToBottom() {
  messages.scrollTop = messages.scrollHeight
}

function animateMessageText(node, text, role) {
  const value = String(text ?? '')
  if (!value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = value
    return
  }

  let index = 0
  node.parentElement?.classList.add('revealing')
  const step = role === 'assistant' ? 3 : 6
  const timer = window.setInterval(() => {
    index = Math.min(value.length, index + step)
    node.textContent = value.slice(0, index)
    scrollMessagesToBottom()
    if (index >= value.length) {
      window.clearInterval(timer)
      node.parentElement?.classList.remove('revealing')
    }
  }, role === 'assistant' ? 18 : 10)
}

function appendActivityEvent(event) {
  const entry = formatActivityEvent(event)
  state.activity.push(entry)
  renderActivity()
}

function formatActivityEvent(event) {
  const createdAt = new Date().toISOString()

  if (event.type === 'tool-call') {
    return {
      level: 'info',
      title: `${event.toolName} çalıştırıldı`,
      body: renderInline(event.input),
      createdAt,
    }
  }

  if (event.type === 'permission-required') {
    return {
      level: 'warn',
      title: `${event.toolName} izin bekliyor`,
      body: 'Devam etmek için kullanıcı onayı gerekli.',
      createdAt,
    }
  }

  if (event.type === 'protocol-error') {
    return {
      level: 'error',
      title: 'Agent protocol error',
      body: event.message,
      createdAt,
    }
  }

  const output = renderInline(event?.output)
  return {
    level: event.status === 'error' ? 'error' : 'info',
    title: `${event.toolName} ${event.status === 'error' ? 'hata verdi' : 'tamamlandı'}`,
    body: output,
    createdAt,
  }
}

function renderActivity() {
  const errors = state.activity.filter(item => item.level === 'error').length
  const warnings = state.activity.filter(item => item.level === 'warn').length
  const total = state.activity.length

  activitySummary.textContent = total
    ? `${total} aksiyon${errors ? ` · ${errors} hata` : ''}${warnings ? ` · ${warnings} izin` : ''}`
    : 'Arka plan aktivitesi yok'
  activityHeaderButton.textContent = total ? `Kayıt ${total}` : 'Aktivite'
  toggleActivityButton.textContent = total ? `Aktivite ${total}` : 'Aktivite'

  activityPanel.innerHTML = total
    ? state.activity.map(item => `
        <article class="activity-item ${item.level}">
          <div class="activity-item-head">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(formatClock(item.createdAt))}</span>
          </div>
          <div class="activity-item-body">${escapeHtml(item.body)}</div>
        </article>
      `).join('')
    : '<div class="empty-card">Henüz activity kaydı yok.</div>'
}

function renderComposerContext() {
  taskModeButton.classList.toggle('active', state.composerMode === 'task')
  desktopModeButton.classList.toggle('active', state.composerMode === 'desktop')
  modeStatusBadge.textContent = MODE_LABELS[state.composerMode]
  updateComposerAffordances()
  renderComposerExamples()
  renderAttachmentStrip()
}

function updateComposerAffordances() {
  if (state.composerMode === 'task') {
    promptInput.placeholder = 'Gorev ayrintilarini yaz. Sablon aktifse alanlar otomatik doldurulur.'
    sendButton.textContent = 'Kaydet'
    return
  }

  if (state.composerMode === 'desktop') {
    promptInput.placeholder = 'Bilgisayarda uygulanacak aksiyonu yaz. Ornek: Chrome ac ve YouTube’da arama yap.'
    sendButton.textContent = 'Uygula'
    return
  }

  promptInput.placeholder = 'Mesajini yaz. Gorsel ekleyebilir, gorev plani baslatabilir veya bilgisayar kontrol moduna gecebilirsin.'
  sendButton.textContent = 'Send'
}

function renderComposerExamples() {
  const examples = MODE_EXAMPLES[state.composerMode] ?? []
  if (!examples.length) {
    composerExamples.innerHTML = ''
    composerExamples.classList.add('hidden')
    return
  }

  composerExamples.classList.remove('hidden')
  const label = state.composerMode === 'desktop' ? 'Hazir bilgisayar akislari' : 'Hazir gorev sablonlari'
  composerExamples.innerHTML = `
    <div class="composer-examples-label">${label}</div>
    <div class="composer-examples-list">
      ${examples.map((example, index) => `
        <button
          type="button"
          class="example-chip"
          data-example-mode="${escapeHtml(state.composerMode)}"
          data-example-index="${index}"
        >
          <strong>${escapeHtml(example.title)}</strong>
          <span>${escapeHtml(example.hint)}</span>
        </button>
      `).join('')}
    </div>
  `
}

function renderAttachmentStrip() {
  if (!state.pendingAttachments.length) {
    attachmentStrip.innerHTML = ''
    return
  }

  attachmentStrip.innerHTML = state.pendingAttachments.map((attachment, index) => `
    <div class="attachment-chip">
      ${attachment.url && String(attachment.type ?? '').startsWith('image/')
        ? `<img class="attachment-thumb" src="${escapeHtml(attachment.url)}" alt="${escapeHtml(attachment.name)}" />`
        : ''}
      <span class="attachment-label">${escapeHtml(attachment.name)}</span>
      <button type="button" class="attachment-remove" data-index="${index}">Kaldır</button>
    </div>
  `).join('')
}

async function onImageInputChange(event) {
  const files = [...(event.target.files ?? [])]
  if (!files.length) {
    return
  }

  setBusy(true, 'Görsel yükleniyor...')
  try {
    for (const file of files) {
      const uploaded = await uploadImage(file)
      state.pendingAttachments.push(uploaded)
    }
    renderComposerContext()
    setBusy(false, `${files.length} görsel eklendi`)
  } catch (error) {
    showError(error)
  } finally {
    imageInput.value = ''
  }
}

async function uploadImage(file) {
  const dataUrl = await readFileAsDataUrl(file)
  return fetchJson('/api/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      type: file.type,
      dataUrl,
    }),
  })
}

function toggleComposerMode(mode) {
  state.composerMode = state.composerMode === mode ? 'chat' : mode
  if (state.composerMode !== 'chat' && !promptInput.value.trim()) {
    promptInput.value = buildModeSeed(state.composerMode)
  }
  renderComposerContext()
  resizeComposerInput()
  promptInput.focus()
}

function buildModeSeed(mode) {
  const templates = state.settings?.composerTemplates ?? {}
  if (templates.enabled === false) {
    return ''
  }

  if (mode === 'task') {
    return templates.autoTaskTemplate === false
      ? ''
      : String(templates.taskTemplate ?? '').trim()
  }

  if (mode === 'desktop') {
    return templates.autoDesktopTemplate === false
      ? ''
      : String(templates.desktopTemplate ?? '').trim()
  }

  return ''
}

function onAttachmentStripClick(event) {
  const button = event.target.closest('[data-index]')
  if (!button) {
    return
  }

  const index = Number(button.dataset.index)
  if (!Number.isFinite(index)) {
    return
  }

  state.pendingAttachments.splice(index, 1)
  renderComposerContext()
}

function onComposerExamplesClick(event) {
  const button = event.target.closest('[data-example-mode][data-example-index]')
  if (!button) {
    return
  }

  const mode = button.dataset.exampleMode
  const index = Number(button.dataset.exampleIndex)
  const example = MODE_EXAMPLES[mode]?.[index]
  if (!example) {
    return
  }

  state.composerMode = mode
  promptInput.value = example.prompt
  renderComposerContext()
  resizeComposerInput()
  promptInput.focus()
}

async function onSaveSettings() {
  setBusy(true, 'Ayarlar kaydediliyor...')
  try {
    const settings = await fetchJson('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(collectSettingsPatch()),
    })
    state.settings = settings
    renderSettings(settings)
    setBusy(false, 'Ayarlar kaydedildi')
    return true
  } catch (error) {
    showError(error)
    return false
  }
}

async function onSubmit(event) {
  event.preventDefault()

  const prompt = promptInput.value.trim() || buildDefaultPrompt()
  if (!prompt) {
    return
  }

  const requestModel = resolveRequestModel()
  if (!requestModel) {
    return
  }

  const saved = await onSaveSettings()
  if (!saved || sendButton.disabled) {
    return
  }

  const userMessage = {
    role: 'user',
    content: serializeMessageContent(prompt, {
      attachments: state.pendingAttachments,
      mode: state.composerMode,
    }),
    createdAt: new Date().toISOString(),
  }

  if (!state.sessionId && state.history.length === 0) {
    state.startedAt = userMessage.createdAt
  }

  state.activity = []
  renderActivity()

  promptInput.value = ''
  appendMessage(userMessage.role, userMessage.content, userMessage)

  state.pendingChatRequest = {
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    model: requestModel.id,
    messages: [...state.history, userMessage],
    taskDraft: state.composerMode === 'task' ? parseTaskDraft(prompt) : null,
    agent: {
      enabled: state.composerMode === 'chat' ? agentToggle.checked : true,
      maxSteps: normalizeSteps(agentSteps.value),
    },
  }
  state.history = [...state.pendingChatRequest.messages]
  resetComposerContext()
  updateSessionIndicators()
  resizeComposerInput()
  await runChatRequest(state.pendingChatRequest)
}

function buildDefaultPrompt() {
  if (state.composerMode === 'desktop') {
    return 'Bu görevi bilgisayar kontrol araçlarıyla adım adım tamamla.'
  }

  if (state.composerMode === 'task') {
    return 'Bu görev için plan oluştur ve uygulamaya başla.'
  }

  if (state.pendingAttachments.length) {
    return 'Ekli görseli kullanarak yardımcı ol.'
  }

  return ''
}

function resolveRequestModel() {
  const current = state.settings?.models?.find(model => model.id === modelSelect.value)
  if (!state.pendingAttachments.length) {
    return current
  }

  if (current?.capabilities?.vision && current.available) {
    return current
  }

  const fallback = (state.settings?.models ?? []).find(model => model.available && model.capabilities?.vision)
  if (!fallback) {
    showError('Ekli gorsel icin vision destekli bir model bulunamadi.')
    return null
  }

  modelSelect.value = fallback.id
  updateModelStatus()
  statusBox.textContent = `Vision modeli secildi · ${fallback.id}`
  return fallback
}

function resetComposerContext() {
  state.pendingAttachments = []
  state.composerMode = 'chat'
  renderComposerContext()
}

function onClear() {
  state.history = []
  state.activity = []
  state.pendingChatRequest = null
  state.pendingPermissionRequest = null
  state.sessionId = null
  state.startedAt = new Date().toISOString()
  clearThinkingMessage()
  closeApprovalModal()
  resetComposerContext()
  renderConversation()
  renderActivity()
  updateSessionIndicators()
  setBusy(false, 'Yeni sohbet hazır')
}

function collectSettingsPatch() {
  const providerUpdates = collectProviderUpdates()

  return {
    defaultModel: modelSelect.value,
    assistant: {
      profile: assistantProfileSelect.value,
    },
    mode: {
      active: modeSelect.value,
    },
    theme: {
      active: themeSelect.value,
    },
    agent: {
      enabled: agentToggle.checked,
      maxSteps: normalizeSteps(agentSteps.value),
    },
    composerTemplates: {
      enabled: templateToggle.checked,
      autoTaskTemplate: taskTemplateToggle.checked,
      autoDesktopTemplate: desktopTemplateToggle.checked,
      taskTemplate: taskTemplateInput.value,
      desktopTemplate: desktopTemplateInput.value,
    },
    permissions: {
      tools: Object.fromEntries(
        [...permissionsPanel.querySelectorAll('select[data-permission-key]')].map(node => [
          node.dataset.permissionKey,
          node.value,
        ]),
      ),
    },
    skills: {
      active: [...skillsPanel.querySelectorAll('input[data-skill-id]:checked')].map(node => node.dataset.skillId),
    },
    plugins: {
      active: [...pluginsPanel.querySelectorAll('input[data-plugin-id]:checked')].map(node => node.dataset.pluginId),
    },
    providers: providerUpdates,
  }
}

function onProviderPanelClick(event) {
  const clearButton = event.target.closest('[data-provider-clear-key]')
  if (!clearButton) {
    return
  }

  const providerId = clearButton.dataset.providerClearKey
  const input = providersPanel.querySelector(`[data-provider-api-key="${cssEscape(providerId)}"]`)
  if (!input) {
    return
  }

  input.value = ''
  input.dataset.clearApiKey = 'true'
  state.providerDrafts[providerId] = {
    ...(state.providerDrafts[providerId] ?? {}),
    apiKey: '',
    clearApiKey: true,
  }
  clearButton.textContent = 'Key temizlenecek'
}

function onProviderPanelInput(event) {
  const apiKeyInput = event.target.closest('[data-provider-api-key]')
  if (apiKeyInput) {
    const providerId = apiKeyInput.dataset.providerApiKey
    const apiKey = apiKeyInput.value.trim()
    state.providerDrafts[providerId] = {
      ...(state.providerDrafts[providerId] ?? {}),
      apiKey,
      clearApiKey: false,
    }
    if (apiKey) {
      apiKeyInput.dataset.clearApiKey = 'false'
      const clearButton = providersPanel.querySelector(`[data-provider-clear-key="${cssEscape(providerId)}"]`)
      if (clearButton) {
        clearButton.textContent = "Kayitli key'i temizle"
      }
    }
    return
  }

  const baseUrlInput = event.target.closest('[data-provider-base-url]')
  if (!baseUrlInput) {
    return
  }

  const providerId = baseUrlInput.dataset.providerBaseUrl
  state.providerDrafts[providerId] = {
    ...(state.providerDrafts[providerId] ?? {}),
    baseUrl: baseUrlInput.value.trim(),
  }
}

function createProviderDrafts(providers) {
  return Object.fromEntries(providers.map(provider => [
    provider.id,
    {
      baseUrl: provider.baseUrl || '',
      apiKey: '',
      clearApiKey: false,
    },
  ]))
}

function syncProviderDraftsFromDom() {
  for (const input of providersPanel.querySelectorAll('[data-provider-base-url]')) {
    const providerId = input.dataset.providerBaseUrl
    if (!providerId) {
      continue
    }

    state.providerDrafts[providerId] = {
      ...(state.providerDrafts[providerId] ?? {}),
      baseUrl: input.value.trim(),
    }
  }

  for (const input of providersPanel.querySelectorAll('[data-provider-api-key]')) {
    const providerId = input.dataset.providerApiKey
    if (!providerId) {
      continue
    }

    state.providerDrafts[providerId] = {
      ...(state.providerDrafts[providerId] ?? {}),
      apiKey: input.value.trim(),
      clearApiKey: input.dataset.clearApiKey === 'true',
    }
  }
}

function collectProviderUpdates() {
  syncProviderDraftsFromDom()
  const updates = {}

  for (const [providerId, draft] of Object.entries(state.providerDrafts)) {
    updates[providerId] = {
      baseUrl: draft.baseUrl ?? '',
    }

    if (draft.clearApiKey) {
      updates[providerId].clearApiKey = true
    }

    if (draft.apiKey) {
      updates[providerId].apiKey = draft.apiKey
    }
  }

  return updates
}

function onProviderTabClick(event) {
  syncProviderDraftsFromDom()
  const button = event.target.closest('[data-provider-tab]')
  if (!button) {
    return
  }

  const nextTab = button.dataset.providerTab
  if (!isValidProviderTab(nextTab)) {
    return
  }

  state.providerTab = nextTab
  renderProviders(state.settings ?? {})
}

function onMessageAreaClick(event) {
  const button = event.target.closest('[data-open-provider-tab]')
  if (!button) {
    return
  }

  openSettingsDrawer({
    providerTab: button.dataset.openProviderTab,
    scrollToProviders: true,
  })
}

function setBusy(isBusy, label) {
  promptInput.disabled = isBusy
  saveSettingsButton.disabled = isBusy
  clearButton.disabled = isBusy
  attachImageButton.disabled = isBusy
  statusBox.textContent = label
  if (isBusy) {
    sendButton.disabled = true
  } else {
    updateModelStatus()
  }
}

function showError(error) {
  const message = error instanceof Error ? error.message : String(error)
  clearThinkingMessage()
  appendMessage('assistant', `Error: ${message}`, {
    createdAt: new Date().toISOString(),
    error: true,
  })
  setBusy(false, 'Hata')
}

async function runChatRequest(request, approvals = {}) {
  setBusy(true, request.agent?.enabled ? 'Agent çalışıyor...' : 'Düşünüyor...')
  showThinkingMessage(request.agent?.enabled ? 'Araçlari ve adimlari planliyor' : 'Yanit hazirlaniyor')

  try {
    const result = await fetchJson('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...request,
        approvals,
      }),
    })

    for (const item of result.events ?? []) {
      try {
        appendActivityEvent(item)
      } catch (activityError) {
    state.activity.push({
      level: 'error',
      title: 'Aktivite kaydı işlenemedi',
      body: activityError instanceof Error ? activityError.message : String(activityError),
      createdAt: new Date().toISOString(),
    })
        renderActivity()
      }
    }

    state.sessionId = result.sessionId ?? state.sessionId
    state.startedAt = result.startedAt ?? state.startedAt

    if (result.stopReason === 'permission-required' && result.permissionRequest) {
      clearThinkingMessage()
      state.pendingPermissionRequest = result.permissionRequest
      openApprovalModal(result.permissionRequest)
      await refreshMemoryData()
      updateSessionIndicators()
      setBusy(false, 'İzin gerekiyor')
      return
    }

    const assistantMessage = {
      role: 'assistant',
      content: result.text || '(empty response)',
      createdAt: new Date().toISOString(),
    }

    clearThinkingMessage()
    state.history = [...request.messages, assistantMessage]
    state.pendingChatRequest = null
    state.pendingPermissionRequest = null
    closeApprovalModal()
    appendMessage('assistant', assistantMessage.content, assistantMessage)
    await refreshMemoryData()
    updateSessionIndicators()
    setBusy(false, `Hazır · ${result.model}`)
  } catch (error) {
    showError(error)
  }
}

async function refreshMemoryData() {
  if (!state.settings) {
    return
  }

  try {
    const memory = await fetchJson('/api/sessions')
    state.settings = {
      ...state.settings,
      sessions: memory.sessions ?? [],
      notes: memory.notes ?? [],
      tasks: memory.tasks ?? [],
    }
    renderMemory(state.settings)
  } catch {
    // Ignore memory refresh failures.
  }
}

function openApprovalModal(request) {
  approvalTitle.textContent = `${request.toolName} için izin gerekiyor`
  approvalMessage.textContent = request.message
  approvalInput.textContent = JSON.stringify(request.input ?? '', null, 2)
  approvalOverlay.classList.remove('hidden')
}

function closeApprovalModal() {
  approvalOverlay.classList.add('hidden')
}

function onApprovalDeny() {
  if (state.pendingPermissionRequest?.toolName) {
    state.activity.push({
      level: 'warn',
      title: `${state.pendingPermissionRequest.toolName} reddedildi`,
      body: 'Kullanıcı izin vermedi.',
      createdAt: new Date().toISOString(),
    })
    renderActivity()
  }
  state.pendingPermissionRequest = null
  state.pendingChatRequest = null
  clearThinkingMessage()
  closeApprovalModal()
  setBusy(false, 'İzin reddedildi')
}

async function handlePermissionApproval(scope) {
  const request = state.pendingChatRequest
  const permissionRequest = state.pendingPermissionRequest
  if (!request || !permissionRequest) {
    closeApprovalModal()
    return
  }

  const permissionKey = permissionRequest.permissionKey
  if (scope === 'always') {
    setPermissionSelectValue(permissionKey, 'allow')
    const saved = await onSaveSettings()
    if (!saved) {
      return
    }
  }

  closeApprovalModal()
  await runChatRequest(request, {
    [permissionKey]: 'allow',
  })
}

function setPermissionSelectValue(permissionKey, value) {
  const field = permissionsPanel.querySelector(`select[data-permission-key="${cssEscape(permissionKey)}"]`)
  if (field) {
    field.value = value
  }
}

async function onSessionCardClick(event) {
  const deleteButton = event.target.closest('[data-delete-session-id]')
  if (deleteButton) {
    const sessionId = deleteButton.dataset.deleteSessionId
    if (!sessionId) {
      return
    }

    const confirmed = window.confirm('Bu sohbet kaydini silmek istiyor musun?')
    if (!confirmed) {
      return
    }

    setBusy(true, 'Sohbet siliniyor...')
    try {
      await fetchJson(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      })

      if (state.sessionId === sessionId) {
        onClear()
      }

      await refreshMemoryData()
      setBusy(false, 'Sohbet silindi')
    } catch (error) {
      showError(error)
    }
    return
  }

  const card = event.target.closest('[data-session-id]')
  if (!card) {
    return
  }

  const sessionId = card.dataset.sessionId
  if (!sessionId) {
    return
  }

  setBusy(true, 'Sohbet yükleniyor...')
  try {
    const session = await fetchJson(`/api/sessions/${encodeURIComponent(sessionId)}`)
    state.sessionId = session.sessionId
    state.startedAt = session.startedAt ?? new Date().toISOString()
    state.history = Array.isArray(session.messages) ? session.messages : []
    state.activity = []
    state.pendingChatRequest = null
    state.pendingPermissionRequest = null
    closeApprovalModal()
    if (session.modelId && [...modelSelect.options].some(option => option.value === session.modelId)) {
      modelSelect.value = session.modelId
    }
    resetComposerContext()
    renderConversation()
    renderActivity()
    updateSessionIndicators()
    await refreshMemoryData()
    setBusy(false, `Sohbet yüklendi · ${session.modelId}`)
  } catch (error) {
    showError(error)
  }
}

function openSettingsDrawer(options = {}) {
  if (isValidProviderTab(options.providerTab)) {
    state.providerTab = options.providerTab
    renderProviders(state.settings ?? {})
  }

  settingsDrawer.classList.remove('hidden')
  drawerScrim.classList.remove('hidden')

  if (options.scrollToProviders) {
    window.requestAnimationFrame(() => {
      providersSection?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }
}

function openActivityDrawer() {
  openSettingsDrawer()
  activityShell.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

function closeSettingsDrawer() {
  settingsDrawer.classList.add('hidden')
  drawerScrim.classList.add('hidden')
}

function applyTheme(theme) {
  if (theme === 'auto') {
    delete document.documentElement.dataset.theme
    return
  }

  document.documentElement.dataset.theme = theme
}

function resizeComposerInput() {
  promptInput.style.height = 'auto'
  promptInput.style.height = `${Math.min(190, Math.max(84, promptInput.scrollHeight))}px`
}

function serializeMessageContent(text, meta = {}) {
  const normalizedText = String(text ?? '').trim()
  const normalizedMeta = normalizeMessageMeta(meta)
  if (!Object.keys(normalizedMeta).length) {
    return normalizedText
  }
  return `${normalizedText}\n\n<modai_meta>${JSON.stringify(normalizedMeta)}</modai_meta>`
}

function parseMessageContent(content) {
  const source = String(content ?? '')
  const match = source.match(/\s*<modai_meta>([\s\S]*?)<\/modai_meta>\s*$/)
  if (!match) {
    return {
      text: source.trim(),
      meta: null,
    }
  }

  let meta = null
  try {
    meta = JSON.parse(match[1])
  } catch {
    meta = null
  }

  return {
    text: source.slice(0, match.index).trim(),
    meta,
  }
}

function normalizeMessageMeta(meta) {
  const next = {}
  if (Array.isArray(meta.attachments) && meta.attachments.length) {
    next.attachments = meta.attachments.map(attachment => ({
      name: attachment.name,
      path: attachment.path,
      type: attachment.type,
      size: attachment.size,
    }))
  }
  if (meta.mode && meta.mode !== 'chat') {
    next.mode = meta.mode
  }
  return next
}

function parseTaskDraft(prompt) {
  const lines = String(prompt ?? '').split('\n')
  const fields = {
    title: '',
    goal: '',
    constraints: '',
    delivery: '',
    completion: '',
  }
  let currentKey = ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const match = line.match(/^(Gorev|Görev|Amac|Amaç|Kisitlar|Kısıtlar|Teslim|Tamamlanma Kriteri)\s*:\s*(.*)$/i)
    if (match) {
      currentKey = normalizeTaskFieldName(match[1])
      fields[currentKey] = sanitizeTaskFieldValue(match[2])
      continue
    }

    if (currentKey) {
      const value = sanitizeTaskFieldValue(line)
      fields[currentKey] = [fields[currentKey], value].filter(Boolean).join('\n')
    }
  }

  const body = String(prompt ?? '').trim()
  if (!fields.title && !fields.goal && !fields.delivery) {
    return null
  }

  return {
    ...fields,
    body,
  }
}

function sanitizeTaskFieldValue(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }

  if (/^\[[^\]]+\]$/.test(text) || /^<[^>]+>$/.test(text)) {
    return ''
  }

  return text
}

function normalizeTaskFieldName(label) {
  const normalized = String(label ?? '').toLowerCase()
  if (normalized.startsWith('gorev') || normalized.startsWith('görev')) {
    return 'title'
  }
  if (normalized.startsWith('amac') || normalized.startsWith('amaç')) {
    return 'goal'
  }
  if (normalized.startsWith('kisit') || normalized.startsWith('kısıt')) {
    return 'constraints'
  }
  if (normalized.startsWith('teslim')) {
    return 'delivery'
  }
  return 'completion'
}

async function fetchJson(url, init) {
  const response = await fetch(url, init)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

function renderInline(value) {
  if (value === '' || value === undefined || value === null) {
    return '(empty)'
  }

  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length <= 120 ? text : `${text.slice(0, 120)}…`
}

function summarizeTitle(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) {
    return 'Yeni sohbet'
  }
  return text.length <= 42 ? text : `${text.slice(0, 42)}…`
}

function formatAssistantProfileLabel(value) {
  return value === 'business-copilot' ? 'Business copilot' : 'General assistant'
}

function normalizeSteps(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(12, Math.round(parsed))) : 6
}

function isValidProviderTab(value) {
  return ['local', 'cloud', 'advanced'].includes(value)
}

function getDefaultProviderTab(settings) {
  const providers = settings?.providers ?? []
  if (providers.some(provider => provider.group === 'cloud' && provider.apiKeyEnv && !provider.hasCredential)) {
    return 'cloud'
  }
  if (providers.some(provider => provider.group === 'local' && !provider.available)) {
    return 'local'
  }
  return 'local'
}

function findLastUserMessage(items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.role === 'user') {
      return items[index]
    }
  }
  return null
}

function formatTimestamp(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('tr-TR', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatClock(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function readFileAsDataUrl(file) {
  return new Promise((resolvePromise, rejectPromise) => {
    const reader = new FileReader()
    reader.onerror = () => rejectPromise(reader.error || new Error('File could not be read'))
    reader.onload = () => resolvePromise(String(reader.result ?? ''))
    reader.readAsDataURL(file)
  })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function cssEscape(value) {
  return String(value).replaceAll('"', '\\"')
}
