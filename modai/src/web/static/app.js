const modeSelect = document.getElementById('modeSelect')
const assistantProfileSelect = document.getElementById('assistantProfileSelect')
const themeSelect = document.getElementById('themeSelect')
const languageSelect = document.getElementById('languageSelect')
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
const drawerTabList = document.getElementById('drawerTabList')
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
const skillNameInput = document.getElementById('skillNameInput')
const skillDescriptionInput = document.getElementById('skillDescriptionInput')
const skillContentInput = document.getElementById('skillContentInput')
const skillFileInput = document.getElementById('skillFileInput')
const loadSkillFileButton = document.getElementById('loadSkillFileButton')
const installSkillButton = document.getElementById('installSkillButton')
const reminderDaemonToggle = document.getElementById('reminderDaemonToggle')
const reminderSoundSelect = document.getElementById('reminderSoundSelect')
const reminderStatus = document.getElementById('reminderStatus')

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
  language: 'en',
  reminderTimer: null,
  remindedTaskIds: new Set(),
  activeDrawerTab: 'general',
  locales: {},
}

const I18N = {
  en: {
    brandEyebrow: 'modAI assistant',
    newChat: 'New Chat',
    chats: 'Chats',
    localFirstChat: 'local-first chat',
    activity: 'Activity',
    settings: 'Settings',
    attachImage: 'Attach Image',
    newTask: 'New Task',
    computerUse: 'Computer Use',
    promptDefault: 'Message modAI. Attach images, create tasks, or run computer actions.',
    controls: 'Controls',
    settingsTitle: 'Settings and Tools',
    settingsSubtitle: 'Manage providers, language, permissions, skills, and runtime behavior.',
    close: 'Close',
    panel: 'Panel',
    mobilePanelCopy: 'On small screens, chats and settings are combined in this panel.',
    providersLabel: 'Providers',
    providersCopy: 'Manage local models, cloud providers, and API key storage.',
    runtimeLabel: 'Runtime',
    language: 'Language',
    modeLabel: 'Mode',
    copilotLabel: 'Copilot',
    themeLabel: 'Theme',
    agentModeLabel: 'Agent mode',
    agentStepsLabel: 'Agent steps',
    taskDrafts: 'Task Drafts',
    taskDraftsCopy: 'Automatic drafts are only used for task planning. Computer Use accepts direct commands.',
    autoTemplates: 'Automatic templates',
    taskTemplate: 'Task template',
    taskTemplateText: 'Task template text',
    permissionsLabel: 'Permissions',
    skillsLabel: 'Skills',
    skillsCopy: 'Enable built-in skills or install external skills for new workflows.',
    skillNameLabel: 'Skill name',
    skillDescriptionLabel: 'Description',
    skillContentLabel: 'Skill instructions',
    skillNamePlaceholder: 'Sales follow-up',
    skillDescriptionPlaceholder: 'Helps draft follow-up messages.',
    skillContentPlaceholder: 'Describe when the skill should be used and what it should do.',
    installSkill: 'Install Skill',
    pluginsLabel: 'Plugins',
    toolsLabel: 'Tools',
    notesLabel: 'Notes',
    scheduledTasks: 'Scheduled Tasks',
    scheduledTasksCopy: 'Due tasks trigger an in-app reminder and a short chime while modAI is open.',
    remindersLabel: 'Reminders',
    remindersCopy: 'Keep reminders active in the background with a launch agent and Notification Center alerts.',
    reminderDaemonLabel: 'Background reminder daemon',
    reminderSoundLabel: 'Reminder sound',
    reminderDaemonOn: 'Launch agent is enabled. Scheduled tasks can notify in the background.',
    reminderDaemonOff: 'Launch agent is disabled. Reminders only work while the app is open.',
    saveSettings: 'Save Settings',
    runtimeReady: 'Runtime ready',
    permissionRequest: 'Permission Request',
    deny: 'Deny',
    allowOnce: 'Allow Once',
    allowAlways: 'Always Allow',
    modelWaiting: 'Waiting for model',
    workspaceReady: 'Workspace ready',
    ready: 'Ready',
    standardChat: 'Standard chat',
    taskMode: 'Task mode',
    computerControl: 'Computer control',
    noProvidersTab: 'No providers to show in this tab.',
    noSkills: 'No skills found.',
    noPlugins: 'No plugins found.',
    noSessions: 'No saved chats yet.',
    noNotes: 'No notes yet.',
    noTasks: 'No scheduled tasks.',
    newSessionBadge: 'New session',
    sessionActive: 'Session active',
    noMessagesYet: 'No messages yet',
    messagesLabel: 'messages',
    workspaceLabel: 'Workspace',
    modelNotSelected: 'No model selected',
    runtimeWaiting: 'Runtime waiting',
    noActiveModel: 'No active model',
    readyShort: 'ready',
    unavailableShort: 'unavailable',
    online: 'online',
    setupRequired: 'setup required',
    businessCopilot: 'Business copilot',
    generalAssistant: 'General assistant',
    emptyBusinessTitle: 'Business Development Copilot ready.',
    emptyBusinessBody: 'Describe your business, offer, revenue problem, or growth target. modAI will infer market context and respond with an operator-grade plan.',
    emptyGeneralTitle: 'Clean local chat is ready.',
    emptyGeneralBody: 'Past chats stay on the left. Image uploads, task planning, and computer control remain one tap away below the composer.',
    providerSetupTitle: 'Provider Setup',
    providerSetupBody: 'Fastest path: verify a local model first, then add cloud API keys if you need stronger models or vision.',
    localSetup: 'Local Setup',
    cloudSetup: 'Cloud Setup',
    advanced: 'Advanced',
    localSetupCopy: 'Ollama or a local OpenAI-compatible server',
    cloudReady: 'Cloud side is ready',
    cloudWaiting: '{count} API keys missing',
    localLabel: 'Local',
    cloudLabel: 'Cloud',
    advancedLabel: 'Advanced',
    you: 'You',
    thinkingAgent: 'Planning tools and steps',
    thinkingAnswer: 'Preparing response',
    attachedImageSent: 'Attached image sent.',
    toolRan: '{tool} ran',
    toolNeedsPermission: '{tool} needs approval',
    protocolError: 'Agent protocol error',
    toolFailed: '{tool} failed',
    toolDone: '{tool} completed',
    noActivity: 'No background activity',
    activityRecords: 'Record {count}',
    activityEmpty: 'No activity yet.',
    actionsSummary: '{count} actions',
    actionsWithErrors: '{count} actions · {errors} errors',
    actionsWithWarnings: '{count} actions · {warnings} approvals',
    actionsWithAll: '{count} actions · {errors} errors · {warnings} approvals',
    taskPlaceholder: 'Write the task details. If templates are enabled, the task draft will be inserted automatically.',
    desktopPlaceholder: 'Write the computer action directly. Example: Open Chrome and search YouTube for Baran Gulesen.',
    readyComputerFlows: 'Ready computer flows',
    readyTaskTemplates: 'Ready task templates',
    remove: 'Remove',
    imageUploading: 'Uploading image...',
    imagesAdded: '{count} image added',
    settingsSaving: 'Saving settings...',
    settingsSaved: 'Settings saved',
    deleteChatConfirm: 'Delete this saved chat?',
    deleteTaskConfirm: 'Delete this scheduled task?',
    deletingChat: 'Deleting chat...',
    deletedChat: 'Chat deleted',
    deletingTask: 'Deleting task...',
    deletedTask: 'Task deleted',
    loadingChat: 'Loading chat...',
    loadedChat: 'Chat loaded · {model}',
    error: 'Error',
    permissionNeeded: 'Approval required',
    permissionDenied: 'Approval denied',
    save: 'Save',
    run: 'Run',
    noVisionModel: 'No vision-capable model is available for this image.',
    visionSelected: 'Vision model selected · {model}',
    newChatReady: 'New chat ready',
    delete: 'Delete',
    due: 'Due',
    draft: 'Draft',
    scheduled: 'Scheduled',
    dueSoon: 'Due soon',
    overdue: 'Overdue',
    reminderTriggered: 'Reminder triggered · {title}',
    reminderTitle: 'Task due',
    reminderBody: '{title} is due now.',
    providerReady: 'ready',
    providerSetup: 'setup',
    baseUrl: 'Base URL',
    apiKey: 'API key',
    macKeychain: 'macOS Keychain',
    environmentVariable: 'environment variable',
    envOrEmpty: 'environment variable or empty',
    clearStoredKey: 'Clear stored key',
    keyWillClear: 'Stored key will be cleared',
    leaveBlank: 'Leave blank to keep the current key.',
    secretStorageTitle: 'Secret storage',
    secretStorageCopy: 'Cloud provider keys can be stored in macOS Keychain. Environment variables remain a fallback.',
    groupsTitle: 'Groups',
    groupsCopy: '{local} local providers, {cloud} cloud providers defined.',
    advancedNoteTitle: 'Advanced note',
    advancedNoteCopy: 'Edit Base URL values in Local and Cloud. This panel summarizes storage and connection behavior.',
    advancedNoteHint: 'Save cloud keys inside the app, then verify local endpoints before switching models.',
    overview: 'overview',
    customEndpoints: 'custom endpoints',
    installSkillBusy: 'Installing skill...',
    installSkillDone: 'Skill installed',
    loadSkillFile: 'Load .md File',
    skillFileLoaded: 'Skill file loaded',
    generalTab: 'General',
    automationTab: 'Automation',
    extensionsTab: 'Extensions',
    skillContentRequired: 'Skill content is required.',
    noteCategory: 'general',
  },
  tr: {
    brandEyebrow: 'modAI asistanı',
    newChat: 'Yeni Sohbet',
    chats: 'Sohbetler',
    localFirstChat: 'yerel öncelikli sohbet',
    activity: 'Aktivite',
    settings: 'Ayarlar',
    attachImage: 'Görsel Ekle',
    newTask: 'Görev Ver',
    computerUse: 'Bilgisayarı Kullan',
    promptDefault: 'modAI\'ye yaz. Görsel ekleyebilir, görev oluşturabilir veya bilgisayar aksiyonları çalıştırabilirsin.',
    controls: 'Kontroller',
    settingsTitle: 'Ayarlar ve Araçlar',
    settingsSubtitle: 'Provider, dil, izin, skill ve çalışma ayarlarını buradan yönet.',
    close: 'Kapat',
    panel: 'Panel',
    mobilePanelCopy: 'Küçük ekranlarda sohbetler ve ayarlar bu panelde birleşir.',
    providersLabel: 'Providerlar',
    providersCopy: 'Yerel modelleri, cloud providerları ve API anahtarlarını yönet.',
    runtimeLabel: 'Çalışma Modu',
    language: 'Dil',
    modeLabel: 'Mod',
    copilotLabel: 'Kopilot',
    themeLabel: 'Tema',
    agentModeLabel: 'Ajan modu',
    agentStepsLabel: 'Ajan adımı',
    taskDrafts: 'Görev Taslakları',
    taskDraftsCopy: 'Otomatik taslaklar yalnız görev planlama için kullanılır. Bilgisayarı Kullan doğrudan komut kabul eder.',
    autoTemplates: 'Otomatik şablonlar',
    taskTemplate: 'Görev şablonu',
    taskTemplateText: 'Görev şablon metni',
    permissionsLabel: 'İzinler',
    skillsLabel: 'Skilller',
    skillsCopy: 'Yerleşik skillleri etkinleştir veya yeni akışlar için dış skill yükle.',
    skillNameLabel: 'Skill adı',
    skillDescriptionLabel: 'Açıklama',
    skillContentLabel: 'Skill talimatları',
    skillNamePlaceholder: 'Satış takibi',
    skillDescriptionPlaceholder: 'Takip mesajları yazmaya yardım eder.',
    skillContentPlaceholder: 'Skillin ne zaman kullanılacağını ve ne yapacağını yaz.',
    installSkill: 'Skill Yükle',
    pluginsLabel: 'Pluginler',
    toolsLabel: 'Araçlar',
    notesLabel: 'Notlar',
    scheduledTasks: 'Planlanmış Görevler',
    scheduledTasksCopy: 'modAI açıkken zamanı gelen görevler uygulama içi bildirim ve kısa bir zil sesi üretir.',
    remindersLabel: 'Hatırlatıcılar',
    remindersCopy: 'Hatırlatıcıları arka planda launch agent ve Bildirim Merkezi uyarıları ile aktif tut.',
    reminderDaemonLabel: 'Arka plan hatırlatıcı servisi',
    reminderSoundLabel: 'Hatırlatıcı sesi',
    reminderDaemonOn: 'Launch agent açık. Planlanmış görevler arka planda bildirim üretebilir.',
    reminderDaemonOff: 'Launch agent kapalı. Hatırlatıcılar yalnız uygulama açıkken çalışır.',
    saveSettings: 'Ayarları Kaydet',
    runtimeReady: 'Çalışma ortamı hazır',
    permissionRequest: 'İzin İsteği',
    deny: 'Reddet',
    allowOnce: 'Bir Kez İzin Ver',
    allowAlways: 'Her Zaman İzin Ver',
    modelWaiting: 'Model bekleniyor',
    workspaceReady: 'Workspace hazır',
    ready: 'Hazır',
    standardChat: 'Standart sohbet',
    taskMode: 'Görev modu',
    computerControl: 'Bilgisayar kontrolü',
    noProvidersTab: 'Bu sekmede gösterilecek provider yok.',
    noSkills: 'Skill bulunamadı.',
    noPlugins: 'Plugin bulunamadı.',
    noSessions: 'Henüz kayıtlı sohbet yok.',
    noNotes: 'Henüz not yok.',
    noTasks: 'Planlanmış görev yok.',
    newSessionBadge: 'Yeni session',
    sessionActive: 'Session aktif',
    noMessagesYet: 'Henüz mesaj yok',
    messagesLabel: 'mesaj',
    workspaceLabel: 'Workspace',
    modelNotSelected: 'Model seçilmedi',
    runtimeWaiting: 'Çalışma ortamı beklemede',
    noActiveModel: 'Aktif model yok',
    readyShort: 'hazır',
    unavailableShort: 'kullanılamıyor',
    online: 'çevrimiçi',
    setupRequired: 'kurulum gerekli',
    businessCopilot: 'İş kopilotu',
    generalAssistant: 'Genel asistan',
    emptyBusinessTitle: 'İş geliştirme kopilotu hazır.',
    emptyBusinessBody: 'İşini, teklifini, gelir problemini veya büyüme hedefini yaz. modAI pazar bağlamını çıkarıp operasyon odaklı bir plan sunar.',
    emptyGeneralTitle: 'Temiz yerel sohbet hazır.',
    emptyGeneralBody: 'Eski sohbetler solda kalır. Görsel, görev ve bilgisayar akışları yazma alanının altında durur.',
    providerSetupTitle: 'Provider Kurulumu',
    providerSetupBody: 'En hızlı akış: önce yerel modeli doğrula, sonra gerekirse cloud API anahtarlarını ekle.',
    localSetup: 'Yerel Kurulum',
    cloudSetup: 'Cloud Kurulumu',
    advanced: 'Gelişmiş',
    localSetupCopy: 'Ollama veya yerel OpenAI uyumlu sunucu',
    cloudReady: 'Cloud tarafı hazır',
    cloudWaiting: '{count} API anahtarı eksik',
    localLabel: 'Yerel',
    cloudLabel: 'Cloud',
    advancedLabel: 'Gelişmiş',
    you: 'Sen',
    thinkingAgent: 'Araçları ve adımları planlıyor',
    thinkingAnswer: 'Yanıt hazırlanıyor',
    attachedImageSent: 'Ekli görsel gönderildi.',
    toolRan: '{tool} çalıştı',
    toolNeedsPermission: '{tool} izin bekliyor',
    protocolError: 'Ajan protokol hatası',
    toolFailed: '{tool} hata verdi',
    toolDone: '{tool} tamamlandı',
    noActivity: 'Arka plan aktivitesi yok',
    activityRecords: 'Kayıt {count}',
    activityEmpty: 'Henüz aktivite kaydı yok.',
    actionsSummary: '{count} aksiyon',
    actionsWithErrors: '{count} aksiyon · {errors} hata',
    actionsWithWarnings: '{count} aksiyon · {warnings} izin',
    actionsWithAll: '{count} aksiyon · {errors} hata · {warnings} izin',
    taskPlaceholder: 'Görev detaylarını yaz. Şablonlar açıksa görev taslağı otomatik eklenir.',
    desktopPlaceholder: 'Bilgisayarda yapılacak aksiyonu doğrudan yaz. Örnek: Chrome aç ve YouTube’da Baran Gulesen ara.',
    readyComputerFlows: 'Hazır bilgisayar akışları',
    readyTaskTemplates: 'Hazır görev şablonları',
    remove: 'Kaldır',
    imageUploading: 'Görsel yükleniyor...',
    imagesAdded: '{count} görsel eklendi',
    settingsSaving: 'Ayarlar kaydediliyor...',
    settingsSaved: 'Ayarlar kaydedildi',
    deleteChatConfirm: 'Bu sohbet kaydı silinsin mi?',
    deleteTaskConfirm: 'Bu planlanmış görev silinsin mi?',
    deletingChat: 'Sohbet siliniyor...',
    deletedChat: 'Sohbet silindi',
    deletingTask: 'Görev siliniyor...',
    deletedTask: 'Görev silindi',
    loadingChat: 'Sohbet yükleniyor...',
    loadedChat: 'Sohbet yüklendi · {model}',
    error: 'Hata',
    permissionNeeded: 'İzin gerekiyor',
    permissionDenied: 'İzin reddedildi',
    save: 'Kaydet',
    run: 'Uygula',
    noVisionModel: 'Bu görsel için vision destekli bir model bulunamadı.',
    visionSelected: 'Vision modeli seçildi · {model}',
    newChatReady: 'Yeni sohbet hazır',
    delete: 'Sil',
    due: 'Teslim',
    draft: 'Taslak',
    scheduled: 'Planlandı',
    dueSoon: 'Yaklaşıyor',
    overdue: 'Gecikti',
    reminderTriggered: 'Hatırlatma tetiklendi · {title}',
    reminderTitle: 'Görev zamanı geldi',
    reminderBody: '{title} görevinin zamanı geldi.',
    providerReady: 'hazır',
    providerSetup: 'kurulum',
    baseUrl: 'Base URL',
    apiKey: 'API anahtarı',
    macKeychain: 'macOS Keychain',
    environmentVariable: 'ortam değişkeni',
    envOrEmpty: 'ortam değişkeni veya boş',
    clearStoredKey: 'Kayıtlı anahtarı temizle',
    keyWillClear: 'Anahtar temizlenecek',
    leaveBlank: 'Boş bırakırsan mevcut anahtar korunur.',
    secretStorageTitle: 'Gizli Anahtar Saklama',
    secretStorageCopy: 'Cloud provider anahtarları macOS Keychain içinde saklanabilir. Ortam değişkenleri yedek olarak çalışır.',
    groupsTitle: 'Gruplar',
    groupsCopy: '{local} yerel provider, {cloud} cloud provider tanımlı.',
    advancedNoteTitle: 'Gelişmiş not',
    advancedNoteCopy: 'Base URL alanları Yerel ve Cloud sekmelerinde düzenlenir. Bu panel saklama ve bağlantı davranışını özetler.',
    advancedNoteHint: 'Cloud anahtarlarını uygulama içinden kaydet, sonra model değiştirmeden önce yerel endpointleri doğrula.',
    overview: 'özet',
    customEndpoints: 'özel endpointler',
    installSkillBusy: 'Skill yükleniyor...',
    installSkillDone: 'Skill yüklendi',
    loadSkillFile: '.md Dosyası Yükle',
    skillFileLoaded: 'Skill dosyası yüklendi',
    generalTab: 'Genel',
    automationTab: 'Otomasyon',
    extensionsTab: 'Eklentiler',
    skillContentRequired: 'Skill içeriği gerekli.',
    noteCategory: 'genel',
  },
}

boot().catch(showError)

async function boot() {
  await loadLocaleDictionaries()
  bindEvents()
  await refreshSettings()
  renderConversation()
  renderActivity()
  renderComposerContext()
  startReminderLoop()
  setBusy(false, t('ready'))
}

function bindEvents() {
  composer.addEventListener('submit', onSubmit)
  saveSettingsButton.addEventListener('click', onSaveSettings)
  clearButton.addEventListener('click', onClear)
  modelSelect.addEventListener('change', updateModelStatus)
  modeSelect.addEventListener('change', updateModelStatus)
  languageSelect.addEventListener('change', () => {
    state.language = languageSelect.value
    applyTranslations()
  })
  assistantProfileSelect.addEventListener('change', renderAssistantProfileBadges)
  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value))
  reminderDaemonToggle.addEventListener('change', () => {
    reminderStatus.textContent = reminderDaemonToggle.checked ? t('reminderDaemonOn') : t('reminderDaemonOff')
  })
  agentToggle.addEventListener('change', updateModelStatus)
  agentSteps.addEventListener('input', updateModelStatus)
  templateToggle.addEventListener('change', syncTemplateControls)
  taskTemplateToggle.addEventListener('change', syncTemplateControls)
  desktopTemplateToggle?.addEventListener('change', syncTemplateControls)
  approvalDenyButton.addEventListener('click', onApprovalDeny)
  approvalAllowOnceButton.addEventListener('click', () => handlePermissionApproval('once'))
  approvalAllowAlwaysButton.addEventListener('click', () => handlePermissionApproval('always'))
  memorySessionsPanel.addEventListener('click', onSessionCardClick)
  drawerSessionsPanel.addEventListener('click', onSessionCardClick)
  scheduledTasksPanel.addEventListener('click', onScheduledTasksClick)
  drawerTabList.addEventListener('click', onDrawerTabClick)
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
  loadSkillFileButton.addEventListener('click', () => skillFileInput.click())
  skillFileInput.addEventListener('change', onSkillFileSelected)
  installSkillButton.addEventListener('click', onInstallSkill)
  promptInput.addEventListener('input', resizeComposerInput)
  promptInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      composer.requestSubmit()
    }
  })
}

function uiLanguage() {
  return languageSelect?.value || state.language || state.settings?.language?.active || 'en'
}

function localeForUi() {
  return uiLanguage() === 'tr' ? 'tr-TR' : 'en-US'
}

function t(key, variables = {}) {
  const dictionary = state.locales[uiLanguage()] ?? I18N[uiLanguage()] ?? I18N.en
  const fallback = I18N.en[key] ?? key
  const template = dictionary[key] ?? fallback
  return Object.entries(variables).reduce(
    (output, [name, value]) => output.replaceAll(`{${name}}`, String(value)),
    template,
  )
}

async function loadLocaleDictionaries() {
  const entries = await Promise.all(
    ['en', 'tr'].map(async language => {
      try {
        const response = await fetch(`/locales/${language}.json`)
        if (!response.ok) {
          throw new Error(`Locale ${language} not found`)
        }
        return [language, await response.json()]
      } catch {
        return [language, {}]
      }
    }),
  )

  state.locales = Object.fromEntries(entries)
}

function applyTranslations() {
  document.documentElement.lang = uiLanguage()

  for (const node of document.querySelectorAll('[data-i18n]')) {
    const key = node.dataset.i18n
    if (key) {
      node.textContent = t(key)
    }
  }

  for (const node of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = node.dataset.i18nPlaceholder
    if (key) {
      node.placeholder = t(key)
    }
  }

  for (const button of providerTabList.querySelectorAll('[data-provider-tab]')) {
    const key = button.dataset.providerTab === 'local'
      ? 'localLabel'
      : button.dataset.providerTab === 'cloud'
        ? 'cloudLabel'
        : 'advancedLabel'
    button.textContent = t(key)
  }

  for (const button of drawerTabList.querySelectorAll('[data-drawer-tab]')) {
    const key = button.dataset.drawerTab === 'general'
      ? 'generalTab'
      : button.dataset.drawerTab === 'automation'
        ? 'automationTab'
        : button.dataset.drawerTab === 'extensions'
          ? 'extensionsTab'
          : 'activity'
    button.textContent = t(key)
  }

  const themeLabels = {
    auto: 'Auto',
    light: uiLanguage() === 'tr' ? 'Açık' : 'Light',
    dark: uiLanguage() === 'tr' ? 'Koyu' : 'Dark',
  }
  for (const option of themeSelect.options) {
    option.textContent = themeLabels[option.value] ?? option.value
  }

  const modeLabels = {
    ultra: 'Ultra Light',
    pro: 'Pro',
  }
  for (const option of modeSelect.options) {
    option.textContent = modeLabels[option.value] ?? option.value
  }

  for (const option of assistantProfileSelect.options) {
    option.textContent = option.value === 'business-copilot'
      ? (uiLanguage() === 'tr' ? 'İş Kopilotu' : 'Business Copilot')
      : (uiLanguage() === 'tr' ? 'Genel Asistan' : 'General Assistant')
  }

  updateSessionIndicators()
  renderAssistantProfileBadges()
  updateModelStatus()
  renderProviders(state.settings ?? {})
  renderPermissions(state.settings ?? {})
  renderSkills(state.settings ?? {})
  renderPlugins(state.settings ?? {})
  renderTools(state.settings ?? {})
  renderMemory(state.settings ?? {})
  renderReminderSettings(state.settings ?? {})
  renderComposerContext()
  renderActivity()
  renderConversation()
}

function getModeLabels() {
  return {
    chat: t('standardChat'),
    task: t('taskMode'),
    desktop: t('computerControl'),
  }
}

function buildModeExamples(language = uiLanguage()) {
  if (language === 'tr') {
    return {
      desktop: [
        {
          title: 'Chrome ve YouTube',
          hint: 'Chrome açıp YouTube arama sonucunu gösterir.',
          prompt: [
            'Gorev: Google Chrome ac ve YouTube ziyaret et',
            'Amac: Baran Gulesen videolarini bulmak',
            'Kisitlar: Yalnizca Google Chrome kullan, yeni bir sekmede ac',
            'Tamamlanma Kriteri: YouTube sonuc sayfasi gorunuyor',
          ].join('\n'),
        },
        {
          title: 'Finder ve Downloads',
          hint: 'Finder açıp Downloads klasörüne gider.',
          prompt: [
            'Gorev: Finder ac ve Downloads klasorunu goster',
            'Amac: indirilen dosyalari kontrol etmek',
            'Kisitlar: Sadece Finder kullan',
            'Tamamlanma Kriteri: Downloads klasoru ekranda acik',
          ].join('\n'),
        },
        {
          title: 'Ekran görüntüsü',
          hint: 'Ekranı yakalar ve masaüstüne kaydeder.',
          prompt: [
            'Gorev: mevcut ekrandan ekran goruntusu al',
            'Amac: acik pencerenin bir kopyasini kaydetmek',
            'Kisitlar: dosyayi masaustune kaydet',
            'Tamamlanma Kriteri: ekran goruntusu dosyasi olustu',
          ].join('\n'),
        },
        {
          title: 'Chrome ile URL aç',
          hint: 'Google Chrome içinde belirli bir siteyi açar.',
          prompt: [
            'Gorev: Google Chrome ac ve https://openai.com sayfasini ziyaret et',
            'Amac: resmi siteyi kontrol etmek',
            'Kisitlar: yalnizca Google Chrome kullan',
            'Tamamlanma Kriteri: sayfa Chrome icinde acildi',
          ].join('\n'),
        },
        {
          title: 'Finder aç',
          hint: 'Finder uygulamasını ön plana getirir.',
          prompt: [
            'Gorev: Finder ac',
            'Amac: dosyalari gezmeye baslamak',
            'Kisitlar: yalnizca Finder kullan',
            'Tamamlanma Kriteri: Finder acik ve odakta',
          ].join('\n'),
        },
      ],
      task: [
        {
          title: 'Sabah hatırlatıcısı',
          hint: 'Yarın sabah için kısa bir hatırlatıcı kaydı oluşturur.',
          prompt: [
            'Gorev: Sabah toplantisini hatirlat',
            'Amac: yarin 09:00 toplantisini kacirmamak',
            'Kisitlar: kisa ve net olsun',
            `Teslim: ${formatDateTimeOffset(1, 9, 0)}`,
          ].join('\n'),
        },
        {
          title: 'Haftalık rapor',
          hint: 'Bir rapor hazırlık görevini planlar.',
          prompt: [
            'Gorev: Haftalik satis raporunu hazirla',
            'Amac: cuma gunu paylasilacak ozeti hazir tutmak',
            'Kisitlar: mevcut verilerle sinirli kal',
            `Teslim: ${formatNextWeekdayDateTime(5, 18, 0)}`,
          ].join('\n'),
        },
        {
          title: 'Fatura hatırlat',
          hint: 'Sık unutulan ödemeler için kullan.',
          prompt: [
            'Gorev: Elektrik faturasini hatirlat',
            'Amac: son odeme tarihini kacirmamak',
            'Kisitlar: odeme tutari bilinmiyorsa bos birak',
            `Teslim: ${formatDateTimeOffset(3, 17, 0)}`,
          ].join('\n'),
        },
        {
          title: 'İçerik yayınla',
          hint: 'Yaratıcı ekipler için yayın tarihini sabitler.',
          prompt: [
            'Gorev: YouTube videosunu yayinlamayi hatirlat',
            'Amac: yarin 20:00 yayina cikmak',
            'Kisitlar: kisa hatirlatici olsun',
            `Teslim: ${formatDateTimeOffset(1, 20, 0)}`,
          ].join('\n'),
        },
        {
          title: 'Müşteri takibi',
          hint: 'Lead takipleri için görev oluşturur.',
          prompt: [
            'Gorev: Soguk lead takibini yap',
            'Amac: pazartesi 10:30 geri donusleri toplamak',
            'Kisitlar: sadece kisa hatirlatici olustur',
            `Teslim: ${formatNextWeekdayDateTime(1, 10, 30)}`,
          ].join('\n'),
        },
      ],
    }
  }

  return {
    desktop: [
      {
        title: 'Chrome + YouTube',
        hint: 'Opens Chrome and shows a YouTube search result.',
        prompt: [
          'Task: Open Google Chrome and visit YouTube',
          'Goal: find Baran Gulesen videos',
          'Constraints: only use Google Chrome, open it in a new tab',
          'Completion Criteria: YouTube search results are visible',
        ].join('\n'),
      },
      {
        title: 'Finder + Downloads',
        hint: 'Opens Finder and shows the Downloads folder.',
        prompt: [
          'Task: Open Finder and show the Downloads folder',
          'Goal: review downloaded files',
          'Constraints: only use Finder',
          'Completion Criteria: the Downloads folder is visible on screen',
        ].join('\n'),
      },
      {
        title: 'Take screenshot',
        hint: 'Captures the current screen and saves it on the Desktop.',
        prompt: [
          'Task: Capture a screenshot of the current screen',
          'Goal: save a copy of the open window',
          'Constraints: save the file on the Desktop',
          'Completion Criteria: the screenshot file exists',
        ].join('\n'),
      },
      {
        title: 'Open URL in Chrome',
        hint: 'Launches a specific URL in Google Chrome.',
        prompt: [
          'Task: Open Google Chrome and visit https://openai.com',
          'Goal: review the official website',
          'Constraints: only use Google Chrome',
          'Completion Criteria: the page is open in Chrome',
        ].join('\n'),
      },
      {
        title: 'Bring Finder forward',
        hint: 'Focuses Finder for quick file navigation.',
        prompt: [
          'Task: Open Finder',
          'Goal: start browsing files',
          'Constraints: only use Finder',
          'Completion Criteria: Finder is visible and focused',
        ].join('\n'),
      },
    ],
    task: [
      {
        title: 'Morning reminder',
        hint: 'Creates a short reminder for tomorrow morning.',
        prompt: [
          'Task: Remind me about the morning meeting',
          'Goal: avoid missing tomorrow at 09:00',
          'Constraints: keep it short and direct',
          `Due: ${formatDateTimeOffset(1, 9, 0)}`,
        ].join('\n'),
      },
      {
        title: 'Weekly report',
        hint: 'Plans a reminder for the weekly report deadline.',
        prompt: [
          'Task: Prepare the weekly sales report',
          'Goal: keep the summary ready for Friday sharing',
          'Constraints: stay within the current data',
          `Due: ${formatNextWeekdayDateTime(5, 18, 0)}`,
        ].join('\n'),
      },
      {
        title: 'Bill reminder',
        hint: 'Useful for recurring payments you often forget.',
        prompt: [
          'Task: Remind me about the electricity bill',
          'Goal: avoid missing the due date',
          'Constraints: leave the amount blank if unknown',
          `Due: ${formatDateTimeOffset(3, 17, 0)}`,
        ].join('\n'),
      },
      {
        title: 'Publish content',
        hint: 'Useful for creators with a fixed publishing window.',
        prompt: [
          'Task: Remind me to publish the YouTube video',
          'Goal: go live tomorrow at 20:00',
          'Constraints: keep the reminder short',
          `Due: ${formatDateTimeOffset(1, 20, 0)}`,
        ].join('\n'),
      },
      {
        title: 'Client follow-up',
        hint: 'Creates a follow-up reminder for active leads.',
        prompt: [
          'Task: Follow up with the warm leads',
          'Goal: review replies on Monday at 10:30',
          'Constraints: create only a short reminder',
          `Due: ${formatNextWeekdayDateTime(1, 10, 30)}`,
        ].join('\n'),
      },
    ],
  }
}

async function refreshSettings() {
  const settings = await fetchJson('/api/settings')
  state.settings = settings
  renderSettings(settings)
}

function renderSettings(settings) {
  state.language = settings.language?.active ?? 'en'
  if (!state.providerTab || !isValidProviderTab(state.providerTab)) {
    state.providerTab = getDefaultProviderTab(settings)
  }
  state.providerDrafts = createProviderDrafts(settings.providers ?? [])
  languageSelect.value = state.language
  modeSelect.value = settings.mode?.active ?? 'pro'
  assistantProfileSelect.value = settings.assistant?.profile ?? 'business-copilot'
  const theme = settings.theme?.active ?? 'auto'
  themeSelect.value = theme
  applyTheme(theme)
  applyTranslations()
  renderModels(settings)
  renderProviders(settings)
  renderAgent(settings)
  renderComposerTemplateSettings(settings)
  renderReminderSettings(settings)
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

function renderReminderSettings(settings) {
  const reminders = settings.reminders ?? {}
  reminderDaemonToggle.checked = reminders.daemonEnabled !== false
  reminderSoundSelect.value = reminders.sound || 'Glass'
  reminderStatus.textContent = reminderDaemonToggle.checked
    ? reminders.daemon?.installed === false
      ? `${t('reminderDaemonOn')} ${reminders.daemon.message ?? ''}`.trim()
      : t('reminderDaemonOn')
    : t('reminderDaemonOff')
}

function renderModels(settings) {
  modelSelect.innerHTML = ''
  for (const model of settings.models ?? []) {
    const option = document.createElement('option')
    option.value = model.id
    option.textContent = model.available
      ? `${model.id}`
      : `${model.id} · ${t('unavailableShort')}`
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
    : `<div class="empty-card">${escapeHtml(t('noProvidersTab'))}</div>`
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

function renderAdvancedProviderPanel(providers) {
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

function renderAgent(settings) {
  agentToggle.checked = settings.agent?.enabled !== false
  agentSteps.value = String(settings.agent?.maxSteps ?? 6)
}

function renderComposerTemplateSettings(settings) {
  const templates = settings.composerTemplates ?? {}
  templateToggle.checked = templates.enabled !== false
  taskTemplateToggle.checked = templates.autoTaskTemplate !== false
  if (desktopTemplateToggle) {
    desktopTemplateToggle.checked = templates.autoDesktopTemplate !== false
  }
  taskTemplateInput.value = templates.taskTemplate ?? ''
  if (desktopTemplateInput) {
    desktopTemplateInput.value = templates.desktopTemplate ?? ''
  }
  syncTemplateControls()
}

function syncTemplateControls() {
  const templatesEnabled = templateToggle.checked
  taskTemplateToggle.disabled = !templatesEnabled
  if (desktopTemplateToggle) {
    desktopTemplateToggle.disabled = !templatesEnabled
  }
  taskTemplateInput.disabled = !templatesEnabled || !taskTemplateToggle.checked
  if (desktopTemplateInput) {
    desktopTemplateInput.disabled = !templatesEnabled || !(desktopTemplateToggle?.checked ?? true)
  }
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
    skillsPanel.innerHTML = `<div class="empty-card">${escapeHtml(t('noSkills'))}</div>`
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
    pluginsPanel.innerHTML = `<div class="empty-card">${escapeHtml(t('noPlugins'))}</div>`
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
    : `<div class="empty-card">${escapeHtml(t('noSessions'))}</div>`

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
    : `<div class="empty-card">${escapeHtml(t('noNotes'))}</div>`

  scheduledTasksPanel.innerHTML = tasks.length
    ? tasks.map(task => `
        <article class="note-card task-card ${escapeHtml(getTaskTimingState(task))}">
          <div class="note-head task-head">
            <div>
              <strong>${escapeHtml(task.title)}</strong>
              <div class="task-status-pill ${escapeHtml(getTaskTimingState(task))}">${escapeHtml(getTaskStatusLabel(task))}</div>
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
      `).join('')
    : `<div class="empty-card">${escapeHtml(t('noTasks'))}</div>`

  checkDueTasks()
}

function renderSessionCardMarkup(session) {
  return `
    <article class="session-card ${session.sessionId === state.sessionId ? 'active' : ''}">
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

function updateModelStatus() {
  const current = state.settings?.models?.find(model => model.id === modelSelect.value)
  if (!current) {
    modelStatus.textContent = t('modelNotSelected')
    runtimeSummary.textContent = t('runtimeWaiting')
    connectionSummary.textContent = t('noActiveModel')
    sendButton.disabled = true
    return
  }

  const readiness = current.available ? t('readyShort') : t('unavailableShort')
  modelStatus.textContent = `${current.id} ${readiness}`
  runtimeSummary.textContent = current.available
    ? `${formatAssistantProfileLabel(assistantProfileSelect.value)} · ${modeSelect.value.toUpperCase()} · ${agentToggle.checked ? `agent ${normalizeSteps(agentSteps.value)} step` : 'agent off'}`
    : current.availabilityMessage
  connectionSummary.textContent = `${current.id} · ${current.available ? t('online') : t('setupRequired')}`
  sendButton.disabled = !current.available
}

function updateSessionIndicators() {
  const lastUserMessage = findLastUserMessage(state.history)
  const lastParsed = lastUserMessage ? parseMessageContent(lastUserMessage.content) : null
  const titleSource = lastParsed?.text ?? state.history.at(-1)?.content ?? t('newChat')
  chatTitle.textContent = summarizeTitle(titleSource)
  activeSessionMeta.textContent = state.sessionId
    ? `${state.history.length} ${t('messagesLabel')} · ${state.sessionId.slice(0, 8)}…`
    : t('noMessagesYet')
  memorySessionBadge.textContent = state.sessionId
    ? `${t('sessionActive')} · ${state.sessionId.slice(0, 8)}…`
    : t('newSessionBadge')
  workspaceSummary.textContent = state.settings?.workspaceDir
    ? `${t('workspaceLabel')} · ${state.settings.workspaceDir}`
    : t('workspaceReady')
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
        <h3>${assistantProfileSelect.value === 'business-copilot' ? t('emptyBusinessTitle') : t('emptyGeneralTitle')}</h3>
        <p>${assistantProfileSelect.value === 'business-copilot' ? t('emptyBusinessBody') : t('emptyGeneralBody')}</p>
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
      <div class="message-role">${escapeHtml(role === 'assistant' ? 'modAI' : t('you'))}</div>
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

function showThinkingMessage(label = t('thinkingAnswer')) {
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
          <strong>${escapeHtml(t('providerSetupTitle'))}</strong>
          <span class="provider-pill">${escapeHtml(`${localReady + cloudReady}/${localTotal + cloudTotal} ${t('readyShort')}`)}</span>
        </div>
        <div class="provider-status">${escapeHtml(t('providerSetupBody'))}</div>
        <div class="setup-grid">
          <div class="setup-stat">
            <span>${escapeHtml(t('localLabel'))}</span>
            <strong>${escapeHtml(`${localReady}/${localTotal}`)}</strong>
            <small>${escapeHtml(t('localSetupCopy'))}</small>
          </div>
          <div class="setup-stat">
            <span>${escapeHtml(t('cloudLabel'))}</span>
            <strong>${escapeHtml(`${cloudReady}/${cloudTotal}`)}</strong>
            <small>${escapeHtml(missingCloudKeys ? t('cloudWaiting', { count: missingCloudKeys }) : t('cloudReady'))}</small>
          </div>
        </div>
        <div class="onboarding-actions">
          <button type="button" class="secondary" data-open-provider-tab="local">${escapeHtml(t('localSetup'))}</button>
          <button type="button" class="secondary" data-open-provider-tab="cloud">${escapeHtml(t('cloudSetup'))}</button>
          <button type="button" class="secondary" data-open-provider-tab="advanced">${escapeHtml(t('advanced'))}</button>
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

  const modeLabels = getModeLabels()
  const items = []
  if (meta.mode && meta.mode !== 'chat') {
    items.push(`<span class="message-chip">${escapeHtml(modeLabels[meta.mode] ?? meta.mode)}</span>`)
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
    return t('attachedImageSent')
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
      title: t('toolRan', { tool: event.toolName }),
      body: renderInline(event.input),
      createdAt,
    }
  }

  if (event.type === 'permission-required') {
    return {
      level: 'warn',
      title: t('toolNeedsPermission', { tool: event.toolName }),
      body: t('permissionNeeded'),
      createdAt,
    }
  }

  if (event.type === 'protocol-error') {
    return {
      level: 'error',
      title: t('protocolError'),
      body: event.message,
      createdAt,
    }
  }

  const output = renderInline(event?.output)
  return {
    level: event.status === 'error' ? 'error' : 'info',
    title: event.status === 'error'
      ? t('toolFailed', { tool: event.toolName })
      : t('toolDone', { tool: event.toolName }),
    body: output,
    createdAt,
  }
}

function renderActivity() {
  const errors = state.activity.filter(item => item.level === 'error').length
  const warnings = state.activity.filter(item => item.level === 'warn').length
  const total = state.activity.length

  activitySummary.textContent = total
    ? errors && warnings
      ? t('actionsWithAll', { count: total, errors, warnings })
      : errors
        ? t('actionsWithErrors', { count: total, errors })
        : warnings
          ? t('actionsWithWarnings', { count: total, warnings })
          : t('actionsSummary', { count: total })
    : t('noActivity')
  activityHeaderButton.textContent = total ? t('activityRecords', { count: total }) : t('activity')
  toggleActivityButton.textContent = total ? `${t('activity')} ${total}` : t('activity')

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
    : `<div class="empty-card">${escapeHtml(t('activityEmpty'))}</div>`
}

function renderComposerContext() {
  taskModeButton.classList.toggle('active', state.composerMode === 'task')
  desktopModeButton.classList.toggle('active', state.composerMode === 'desktop')
  modeStatusBadge.textContent = getModeLabels()[state.composerMode]
  updateComposerAffordances()
  renderComposerExamples()
  renderAttachmentStrip()
}

function updateComposerAffordances() {
  if (state.composerMode === 'task') {
    promptInput.placeholder = t('taskPlaceholder')
    sendButton.textContent = t('save')
    return
  }

  if (state.composerMode === 'desktop') {
    promptInput.placeholder = t('desktopPlaceholder')
    sendButton.textContent = t('run')
    return
  }

  promptInput.placeholder = t('promptDefault')
  sendButton.textContent = uiLanguage() === 'tr' ? 'Gönder' : 'Send'
}

function renderComposerExamples() {
  const examples = buildModeExamples()[state.composerMode] ?? []
  if (!examples.length) {
    composerExamples.innerHTML = ''
    composerExamples.classList.add('hidden')
    return
  }

  composerExamples.classList.remove('hidden')
  const label = state.composerMode === 'desktop' ? t('readyComputerFlows') : t('readyTaskTemplates')
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
      <button type="button" class="attachment-remove" data-index="${index}">${escapeHtml(t('remove'))}</button>
    </div>
  `).join('')
}

async function onImageInputChange(event) {
  const files = [...(event.target.files ?? [])]
  if (!files.length) {
    return
  }

  setBusy(true, t('imageUploading'))
  try {
    for (const file of files) {
      const uploaded = await uploadImage(file)
      state.pendingAttachments.push(uploaded)
    }
    renderComposerContext()
    setBusy(false, t('imagesAdded', { count: files.length }))
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
    return ''
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
  const example = buildModeExamples()[mode]?.[index]
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
  setBusy(true, t('settingsSaving'))
  try {
    const settings = await fetchJson('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(collectSettingsPatch()),
    })
    state.settings = settings
    renderSettings(settings)
    setBusy(false, t('settingsSaved'))
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
    return uiLanguage() === 'tr'
      ? 'Bu görevi bilgisayar kontrol araçlarıyla tamamla ve yalnız sonucu bildir.'
      : 'Complete this task with computer control tools and report only the outcome.'
  }

  if (state.composerMode === 'task') {
    return uiLanguage() === 'tr'
      ? 'Bu görev için net bir plan oluştur ve görevi kaydet.'
      : 'Create a clear plan for this task and save it.'
  }

  if (state.pendingAttachments.length) {
    return uiLanguage() === 'tr'
      ? 'Ekli görseli kullanarak yardımcı ol.'
      : 'Use the attached image in your response.'
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
    showError(t('noVisionModel'))
    return null
  }

  modelSelect.value = fallback.id
  updateModelStatus()
  statusBox.textContent = t('visionSelected', { model: fallback.id })
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
  setBusy(false, t('newChatReady'))
}

function collectSettingsPatch() {
  const providerUpdates = collectProviderUpdates()

  return {
    defaultModel: modelSelect.value,
    language: {
      active: languageSelect.value,
    },
    assistant: {
      profile: assistantProfileSelect.value,
    },
    mode: {
      active: modeSelect.value,
    },
    theme: {
      active: themeSelect.value,
    },
    reminders: {
      daemonEnabled: reminderDaemonToggle.checked,
      sound: reminderSoundSelect.value,
    },
    agent: {
      enabled: agentToggle.checked,
      maxSteps: normalizeSteps(agentSteps.value),
    },
    composerTemplates: {
      enabled: templateToggle.checked,
      autoTaskTemplate: taskTemplateToggle.checked,
      autoDesktopTemplate: desktopTemplateToggle?.checked ?? (state.settings?.composerTemplates?.autoDesktopTemplate !== false),
      taskTemplate: taskTemplateInput.value,
      desktopTemplate: desktopTemplateInput?.value ?? (state.settings?.composerTemplates?.desktopTemplate ?? ''),
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
  clearButton.textContent = t('keyWillClear')
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
        clearButton.textContent = t('clearStoredKey')
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
  appendMessage('assistant', `${t('error')}: ${message}`, {
    createdAt: new Date().toISOString(),
    error: true,
  })
  setBusy(false, t('error'))
}

async function runChatRequest(request, approvals = {}) {
  setBusy(true, request.agent?.enabled ? `${t('activity')}...` : t('thinkingAnswer'))
  showThinkingMessage(request.agent?.enabled ? t('thinkingAgent') : t('thinkingAnswer'))

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
      title: uiLanguage() === 'tr' ? 'Aktivite kaydı işlenemedi' : 'Failed to render activity entry',
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
      setBusy(false, t('permissionNeeded'))
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
    setBusy(false, `${t('ready')} · ${result.model}`)
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
  approvalTitle.textContent = uiLanguage() === 'tr'
    ? `${request.toolName} için izin gerekiyor`
    : `${request.toolName} needs approval`
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
      title: uiLanguage() === 'tr'
        ? `${state.pendingPermissionRequest.toolName} reddedildi`
        : `${state.pendingPermissionRequest.toolName} denied`,
      body: uiLanguage() === 'tr' ? 'Kullanıcı izin vermedi.' : 'The user did not allow it.',
      createdAt: new Date().toISOString(),
    })
    renderActivity()
  }
  state.pendingPermissionRequest = null
  state.pendingChatRequest = null
  clearThinkingMessage()
  closeApprovalModal()
  setBusy(false, t('permissionDenied'))
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
    event.preventDefault()
    event.stopPropagation()
    const sessionId = deleteButton.dataset.deleteSessionId
    if (!sessionId) {
      return
    }

    const confirmed = window.confirm(t('deleteChatConfirm'))
    if (!confirmed) {
      return
    }

    setBusy(true, t('deletingChat'))
    try {
      await fetchJson(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      })

      if (state.sessionId === sessionId) {
        onClear()
      }

      await refreshMemoryData()
      setBusy(false, t('deletedChat'))
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

  setBusy(true, t('loadingChat'))
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
    setBusy(false, t('loadedChat', { model: session.modelId }))
  } catch (error) {
    showError(error)
  }
}

async function onScheduledTasksClick(event) {
  const deleteButton = event.target.closest('[data-delete-task-id]')
  if (!deleteButton) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const taskId = deleteButton.dataset.deleteTaskId
  if (!taskId) {
    return
  }

  const confirmed = window.confirm(t('deleteTaskConfirm'))
  if (!confirmed) {
    return
  }

  setBusy(true, t('deletingTask'))
  try {
    await fetchJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
    })
    state.remindedTaskIds.delete(taskId)
    await refreshMemoryData()
    setBusy(false, t('deletedTask'))
  } catch (error) {
    showError(error)
  }
}

async function onInstallSkill() {
  const name = skillNameInput.value.trim()
  const description = skillDescriptionInput.value.trim()
  const content = skillContentInput.value.trim()
  if (!content) {
    showError(t('skillContentRequired'))
    return
  }

  setBusy(true, t('installSkillBusy'))
  try {
    const result = await fetchJson('/api/skills', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description, content }),
    })
    state.settings = result.state
    skillNameInput.value = ''
    skillDescriptionInput.value = ''
    skillContentInput.value = ''
    renderSettings(result.state)
    setBusy(false, t('installSkillDone'))
  } catch (error) {
    showError(error)
  }
}

async function onSkillFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) {
    return
  }

  try {
    const content = await file.text()
    if (!skillNameInput.value.trim()) {
      skillNameInput.value = file.name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ')
    }
    if (!skillDescriptionInput.value.trim()) {
      const firstBodyLine = content
        .split('\n')
        .map(line => line.trim())
        .find(line => line && !line.startsWith('#'))
      skillDescriptionInput.value = firstBodyLine || ''
    }
    skillContentInput.value = content
    setBusy(false, t('skillFileLoaded'))
  } catch (error) {
    showError(error)
  } finally {
    skillFileInput.value = ''
  }
}

function onDrawerTabClick(event) {
  const button = event.target.closest('[data-drawer-tab]')
  if (!button) {
    return
  }

  setDrawerTab(button.dataset.drawerTab || 'general')
}

function setDrawerTab(tab) {
  state.activeDrawerTab = ['general', 'automation', 'extensions', 'activity'].includes(tab) ? tab : 'general'

  for (const button of drawerTabList.querySelectorAll('[data-drawer-tab]')) {
    button.classList.toggle('is-active', button.dataset.drawerTab === state.activeDrawerTab)
  }

  for (const section of settingsDrawer.querySelectorAll('[data-drawer-section]')) {
    section.classList.toggle('hidden-section', section.dataset.drawerSection !== state.activeDrawerTab)
  }
}

function startReminderLoop() {
  if (state.reminderTimer) {
    window.clearInterval(state.reminderTimer)
  }

  state.reminderTimer = window.setInterval(() => {
    checkDueTasks()
  }, 30_000)
}

function checkDueTasks() {
  const tasks = state.settings?.tasks ?? []
  const now = Date.now()
  for (const task of tasks) {
    if (!task?.taskId || !task.delivery) {
      continue
    }

    const dueAt = parseDeliveryDate(task.delivery)
    if (!dueAt || dueAt.getTime() > now || state.remindedTaskIds.has(task.taskId)) {
      continue
    }

    state.remindedTaskIds.add(task.taskId)
    emitTaskReminder(task)
  }
}

function emitTaskReminder(task) {
  state.activity.unshift({
    level: 'warn',
    title: t('reminderTitle'),
    body: t('reminderBody', { title: task.title }),
    createdAt: new Date().toISOString(),
  })
  renderActivity()
  statusBox.textContent = t('reminderTriggered', { title: summarizeTitle(task.title) })
  playReminderChime()
  notifyTask(task)
}

function notifyTask(task) {
  if (typeof window.Notification !== 'function') {
    return
  }

  if (window.Notification.permission === 'granted') {
    try {
      new window.Notification(t('reminderTitle'), {
        body: t('reminderBody', { title: task.title }),
      })
    } catch {
      // Ignore notification errors.
    }
  }
}

function playReminderChime() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) {
    return
  }

  try {
    const context = new AudioCtx()
    const now = context.currentTime
    for (const [offset, frequency] of [[0, 880], [0.16, 1174]]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.08, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now + offset)
      oscillator.stop(now + offset + 0.22)
    }
    window.setTimeout(() => {
      context.close().catch(() => {})
    }, 600)
  } catch {
    // Ignore audio failures.
  }
}

function openSettingsDrawer(options = {}) {
  if (isValidProviderTab(options.providerTab)) {
    state.providerTab = options.providerTab
    renderProviders(state.settings ?? {})
  }

  setDrawerTab(options.drawerTab ?? 'general')

  settingsDrawer.classList.remove('hidden')
  drawerScrim.classList.remove('hidden')

  if (options.scrollToProviders) {
    window.requestAnimationFrame(() => {
      providersSection?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }
}

function openActivityDrawer() {
  openSettingsDrawer({ drawerTab: 'activity' })
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

    const match = line.match(/^(Gorev|Görev|Task|Amac|Amaç|Goal|Kisitlar|Kısıtlar|Constraints|Teslim|Due|Tamamlanma Kriteri|Completion Criteria)\s*:\s*(.*)$/i)
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
  if (normalized.startsWith('gorev') || normalized.startsWith('görev') || normalized.startsWith('task')) {
    return 'title'
  }
  if (normalized.startsWith('amac') || normalized.startsWith('amaç') || normalized.startsWith('goal')) {
    return 'goal'
  }
  if (normalized.startsWith('kisit') || normalized.startsWith('kısıt') || normalized.startsWith('constraints')) {
    return 'constraints'
  }
  if (normalized.startsWith('teslim') || normalized.startsWith('due')) {
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
    return t('newChat')
  }
  return text.length <= 42 ? text : `${text.slice(0, 42)}…`
}

function formatAssistantProfileLabel(value) {
  return value === 'business-copilot' ? t('businessCopilot') : t('generalAssistant')
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

function formatDateTimeOffset(days, hour, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, minute, 0, 0)
  return formatDateTimeForTask(date)
}

function formatNextWeekdayDateTime(weekday, hour, minute = 0) {
  const date = new Date()
  const currentDay = date.getDay()
  const offset = (weekday - currentDay + 7) % 7 || 7
  date.setDate(date.getDate() + offset)
  date.setHours(hour, minute, 0, 0)
  return formatDateTimeForTask(date)
}

function formatDateTimeForTask(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function parseDeliveryDate(value) {
  const normalized = String(value ?? '').trim().replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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

  return date.toLocaleString(localeForUi(), {
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

  return date.toLocaleTimeString(localeForUi(), {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTaskTimingState(task) {
  if (!task?.delivery) {
    return 'draft'
  }

  const parsed = parseDeliveryDate(task.delivery)
  if (!parsed) {
    return String(task.status || 'scheduled').toLowerCase()
  }

  const delta = parsed.getTime() - Date.now()
  if (delta < 0) {
    return 'overdue'
  }
  if (delta <= 60 * 60 * 1000) {
    return 'due-soon'
  }
  return 'scheduled'
}

function getTaskStatusLabel(task) {
  const stateValue = getTaskTimingState(task)
  if (stateValue === 'draft') {
    return t('draft')
  }
  if (stateValue === 'overdue') {
    return t('overdue')
  }
  if (stateValue === 'due-soon') {
    return t('dueSoon')
  }
  return t('scheduled')
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
