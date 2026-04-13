import { elements } from './dom.js'
import { createInitialState } from './state.js'
import {
  cssEscape,
  escapeHtml,
  findLastUserMessage,
  formatClock,
  formatDateTimeOffset,
  formatNextWeekdayDateTime,
  formatTimestamp,
  getDefaultProviderTab,
  isValidProviderTab,
  normalizeSteps,
  parseDeliveryDate,
  parseMessageContent,
  parseTaskDraft,
  readFileAsDataUrl,
  renderInline,
  serializeMessageContent,
  summarizeTitle,
  summarizeWorkspacePath,
} from './utils.js'
import {
  renderAdvancedProviderPanel,
  renderBillingPanelMarkup,
  renderNoteCardMarkup,
  renderProviderCardMarkup,
  renderSessionCardMarkup,
  renderTaskCardMarkup,
} from './renderers.js'

const {
  shell,
  sidebar,
  chatHeader,
  modeSelect,
  assistantProfileSelect,
  themeSelect,
  languageSelect,
  modelSelect,
  modelStatus,
  modeStatusBadge,
  assistantProfileBadge,
  runtimeSummary,
  providersPanel,
  providerTabList,
  providersSection,
  agentToggle,
  agentSteps,
  templateToggle,
  taskTemplateToggle,
  desktopTemplateToggle,
  taskTemplateInput,
  desktopTemplateInput,
  permissionsPanel,
  skillsPanel,
  pluginsPanel,
  toolsPanel,
  integrationsPanel,
  mcpPanel,
  mcpDiagnosticsPanel,
  memorySessionsPanel,
  drawerSessionsPanel,
  billingPanel,
  memoryNotesPanel,
  scheduledTasksPanel,
  saveSettingsButton,
  messages,
  composer,
  promptInput,
  statusBox,
  sendButton,
  clearButton,
  confirmOverlay,
  confirmTitle,
  confirmMessage,
  confirmCancelButton,
  confirmApproveButton,
  taskEditorOverlay,
  taskEditorForm,
  taskEditorTitleInput,
  taskEditorGoalInput,
  taskEditorConstraintsInput,
  taskEditorDueInput,
  taskEditorCompletionInput,
  taskEditorCancelButton,
  approvalOverlay,
  approvalTitle,
  approvalMessage,
  approvalInput,
  approvalDenyButton,
  approvalAllowOnceButton,
  approvalAllowAlwaysButton,
  activeSessionMeta,
  headerModelSummary,
  headerWorkspaceSummary,
  headerSessionSummary,
  memorySessionBadge,
  connectionSummary,
  workspaceSummary,
  chatTitle,
  commandPaletteButton,
  commandPaletteOverlay,
  commandPaletteInput,
  commandPaletteResults,
  sidebarToggleButton,
  toggleHeaderButton,
  toggleOutlineButton,
  toggleSettingsButton,
  closeSettingsButton,
  settingsSizeButton,
  drawerNewChatButton,
  settingsDrawer,
  drawerScrim,
  drawerTabList,
  activityShell,
  activityPanel,
  activitySummary,
  toggleActivityButton,
  activityHeaderButton,
  workspaceOutline,
  workspaceOutlineRoot,
  workspaceRootInput,
  saveWorkspaceRootButton,
  workspaceOutlineTree,
  workspaceFileEditorShell,
  workspaceFileTitle,
  workspaceFileMeta,
  workspaceFileInput,
  insertWorkspacePathButton,
  saveWorkspaceFileButton,
  closeWorkspaceFileButton,
  refreshOutlineButton,
  closeOutlineButton,
  attachImageButton,
  imageInput,
  taskModeButton,
  desktopModeButton,
  attachmentStrip,
  composerExamples,
  skillNameInput,
  skillDescriptionInput,
  skillContentInput,
  skillFileInput,
  loadSkillFileButton,
  installSkillButton,
  reminderDaemonToggle,
  reminderSoundSelect,
  reminderStatus,
  chatsSection,
  toggleChatsButton,
} = elements

const state = createInitialState()
let confirmDialogResolve = null
let taskEditorResolve = null
const FIRST_RUN_GUIDE_KEY = 'modai-first-run-guide-v1'
const MCP_PRESETS = {
  github: {
    id: 'github',
    name: 'GitHub MCP',
    transport: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
    authType: 'bearer',
    authTokenEnv: 'GITHUB_TOKEN',
    headersText: '{\n  "Authorization": "Bearer YOUR_GITHUB_PAT"\n}',
    docsUrl: 'https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/set-up-the-github-mcp-server',
  },
  notion: {
    id: 'notion',
    name: 'Notion MCP',
    transport: 'http',
    url: 'https://mcp.notion.com/mcp',
    headersText: '',
    docsUrl: 'https://developers.notion.com/guides/mcp/get-started-with-mcp',
  },
  figma: {
    id: 'figma',
    name: 'Figma MCP',
    transport: 'http',
    url: 'https://mcp.figma.com/mcp',
    headersText: '',
    docsUrl: 'https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server',
  },
  browser: {
    id: 'browser',
    name: 'Browser bridge',
    transport: 'stdio',
    command: '',
    argsText: '',
    headersText: '',
    docsUrl: '',
  },
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
    quickStartTitle: 'Quick Start',
    quickStartCopy: 'Install, unlock, choose a plan, connect a model, and run your first workflow.',
    guideInstallTitle: 'Move modAI to Applications',
    guideInstallBody: 'Keep the app in Applications so updates, permissions, and future activation behave predictably.',
    guideGatekeeperTitle: 'Allow the first launch',
    guideGatekeeperBody: 'If macOS blocks the app, use Open Anyway or keep Sentinel nearby as an optional Gatekeeper utility.',
    guidePaymentTitle: 'Choose payment and activation',
    guidePaymentBody: 'The launch page should handle trial, card checkout, crypto checkout, and license delivery in one flow.',
    guideProviderTitle: 'Connect a model provider',
    guideProviderBody: 'Start with Ollama for local use, then add Gemini or Anthropic only when you need cloud reasoning.',
    guideWorkflowTitle: 'Run a workflow pack',
    guideWorkflowBody: 'Give new users a Founder, Sales, or Research starting pack so the first value appears in minutes.',
    openLaunchSite: 'Open launch site',
    openProviderSetup: 'Open provider setup',
    openSentinel: 'Open Sentinel',
    billingCardLabel: 'Card billing',
    billingCardTitle: 'Keep recurring plans simple',
    billingCardBody: 'Use a merchant-of-record flow for monthly and yearly plans so tax, invoicing, and failed payment recovery stay out of the app binary.',
    billingCryptoLabel: 'Stablecoin checkout',
    billingCryptoTitle: 'Offer USDC and USDT',
    billingCryptoBody: 'Crypto should be available for annual plans, founder passes, or credit bundles with immediate license delivery after payment.',
    billingActivationLabel: 'Activation',
    billingActivationTitle: 'Keep the first run friction low',
    billingActivationBody: 'Trial, purchase, and activation should feel like one guided path instead of three unrelated setup tasks.',
    billingStatusTitle: 'Trial and Activation',
    billingActivateTitle: 'Start trial or activate',
    billingActivateCopy: 'A new user should be able to start the trial, paste a license key, or continue from a completed payment without leaving the app.',
    billingDeviceLabel: 'Device',
    billingEmailLabel: 'Email',
    billingPlanLabel: 'Plan',
    billingExpiryLabel: 'Expires',
    billingLicenseKeyLabel: 'License key',
    billingStartTrial: 'Start 7-day trial',
    billingActivateButton: 'Activate license',
    billingCardRailTitle: 'Card checkout',
    billingCardRailCopy: 'Use Lemon Squeezy for recurring card billing and instant license delivery on one-time plans.',
    billingCardSetupNeeded: 'Add Lemon Squeezy checkout URLs to enable card purchases.',
    billingCryptoRailTitle: 'USDC / USDT checkout',
    billingCryptoRailCopy: 'Create a crypto invoice, watch the payment state, and claim the issued license on this device.',
    billingCryptoModeLive: 'Live direct-wallet checkout is enabled. Send the exact quoted amount and verify the on-chain transfer to issue the license.',
    billingCryptoModeSandbox: 'Crypto checkout is still in local test mode. Configure live rails before selling the app.',
    billingCryptoPlanTitle: 'Crypto plan',
    billingCryptoCurrencyLabel: 'Stablecoin',
    billingNetworkLabel: 'Network',
    billingNetworkVerificationReady: '{network} is ready for automatic transfer verification.',
    billingNetworkVerificationNeeded: '{network} needs {setting} before transfer verification can issue licenses.',
    billingPayerWalletLabel: 'Payer wallet (optional)',
    billingPayerWalletPlaceholder: 'Sender wallet used for the payment',
    billingRecipientHint: '{network} invoice address: {address}',
    billingCreateCryptoPayment: 'Create crypto payment',
    billingLatestPaymentTitle: 'Latest payment',
    billingPayAmountLabel: 'Pay amount',
    billingPaymentUpdatedLabel: 'Updated',
    billingQuoteExpiryLabel: 'Quote expires',
    billingRefreshPayment: 'Refresh status',
    billingSimulatePayment: 'Simulate paid',
    billingApplyLicense: 'Apply license',
    billingLicenseReady: 'License ready: {key}',
    billingStatusWaitingPayment: 'awaiting transfer',
    billingStatusPaid: 'payment received',
    billingStatusFailed: 'payment issue',
    billingStepSendTitle: 'Send the exact quoted amount',
    billingStepSendBody: 'Transfer exactly {amount} from your wallet. The quoted amount is unique for this invoice.',
    billingStepAddressTitle: 'Use the invoice address',
    billingStepAddressBody: 'Send only on {network} to the address shown below.',
    billingStepVerifyTitle: 'Paste the transaction hash',
    billingStepVerifyBody: 'After the transfer is confirmed on-chain, paste the transaction hash and verify the payment.',
    billingCopyAmount: 'Copy amount',
    billingCopyAddress: 'Copy address',
    billingCopied: 'Copied to clipboard',
    billingTxHashLabel: 'Transaction hash',
    billingTxHashPlaceholder: 'Paste the on-chain transaction hash',
    billingTxHashHint: 'Professional flow: create the invoice, send the exact quoted amount, then paste the transaction hash for verification.',
    billingTxHashHintWaiting: 'This invoice is waiting for a real on-chain payment. Send the exact quoted amount, then paste the transaction hash below.',
    billingTxHashRequired: 'Transaction hash is required.',
    billingVerifyTransfer: 'Verify transfer',
    billingVerifyingTransfer: 'Verifying transfer...',
    billingTransferVerified: 'Transfer verified',
    billingOpenExplorer: 'Open explorer',
    billingStatusActive: 'Active license',
    billingStatusTrial: 'Trial running',
    billingStatusExpired: 'Access expired',
    billingStatusInactive: 'No license yet',
    billingPillActive: 'licensed',
    billingPillTrial: 'trial',
    billingPillExpired: 'expired',
    billingPillInactive: 'inactive',
    billingActiveCopy: 'This device is activated through {source}. Current plan: {plan}.',
    billingTrialCopy: 'The free trial is active. {days} day(s) remain before activation is required.',
    billingExpiredCopy: 'Trial or paid access has expired. Activate a license or complete a payment to continue.',
    billingInactiveCopy: 'No active trial or license is attached to this device yet.',
    billingUnset: 'Not set',
    billingTrialStarted: 'Trial started',
    billingActivating: 'Activating license...',
    billingActivated: 'License activated',
    billingStartingCrypto: 'Creating crypto payment...',
    billingCryptoReady: 'Crypto payment created',
    billingRefreshingPayment: 'Refreshing payment...',
    billingPaymentUpdated: 'Payment state refreshed',
    billingClaimingLicense: 'Applying license...',
    billingClaimed: 'License applied',
    billingOpeningCheckout: 'Opening checkout...',
    sentinelNoteTitle: 'Gatekeeper support note',
    sentinelNoteBody: 'For advanced users who want clearer Gatekeeper visibility, recommend Sentinel as an optional companion utility in the support flow, not a requirement.',
    workflowPacksTitle: 'Workflow Packs',
    workflowPacksCopy: 'Launch with three persona packs so new users can see value before they start customizing prompts.',
    packFounderLabel: 'Founder OS',
    packFounderTitle: 'Daily operator pack',
    packFounderBody: 'Inbox triage, launch checklist, follow-up drafting, meeting prep, and daily execution snapshots.',
    packSalesLabel: 'Sales Operator',
    packSalesTitle: 'Follow-through pack',
    packSalesBody: 'Lead reminders, objection handling, CRM note cleanup, and proposal follow-up flows.',
    packResearchLabel: 'Research Desk',
    packResearchTitle: 'Decision support pack',
    packResearchBody: 'Source gathering, comparison notes, synthesis, and action-list generation with memory support.',
    openAutomationGuide: 'Open automation tab',
    openPricingPage: 'Open pricing',
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
    headerSessionLabel: 'Session',
    headerModelLabel: 'Model',
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
    deleteChatConfirmTitle: 'Delete saved chat',
    deleteChatConfirmBody: 'Delete the old chat "{title}"? This cannot be undone.',
    deleteTaskConfirm: 'Delete this scheduled task?',
    deleteTaskConfirmTitle: 'Delete scheduled task',
    deleteTaskConfirmBody: 'Delete the task "{title}"? This cannot be undone.',
    deletingChat: 'Deleting chat...',
    deletedChat: 'Chat deleted',
    deletingTask: 'Deleting task...',
    deletedTask: 'Task deleted',
    editTask: 'Edit Task',
    editingTask: 'Saving task...',
    taskUpdated: 'Task updated',
    confirmAction: 'Confirm Action',
    confirm: 'Confirm',
    cancel: 'Cancel',
    editTaskDetails: 'Edit task details',
    editTaskCopy: 'Update the scheduled task fields below.',
    taskTitleLabel: 'Task title',
    taskGoalLabel: 'Goal',
    taskConstraintsLabel: 'Constraints',
    taskDueLabel: 'Due',
    taskCompletionLabel: 'Completion criteria',
    saveTaskChanges: 'Save Task',
    taskTitleRequired: 'Task title is required.',
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
    extensionsTab: 'Integrations',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    minimizeTopBar: 'Minimize top bar',
    restoreTopBar: 'Restore top bar',
    integrationsTitle: 'Integrations',
    integrationsCopy: 'Keep MCP, plugins, desktop control, and skill-based workflows visible from one tight operator surface.',
    integrationsDesktopLabel: 'Desktop control',
    integrationsDesktopBody: 'Browser actions, screenshots, files, and computer-use flows stay accessible from the same operator surface.',
    integrationsPluginsLabel: 'Plugins',
    integrationsPluginsBody: 'Active plugins should become one-click integrations instead of hidden settings.',
    integrationsSkillsLabel: 'Skills',
    integrationsSkillsBody: 'Package repeatable workflows like GitHub review, research, and follow-up as reusable skills.',
    integrationsMcpLabel: 'MCP servers',
    integrationsMcpBody: 'Remote and local connectors should be configurable here instead of living as a static suggestion.',
    integrationsActiveCount: '{count} active',
    integrationsReadyCount: '{count} ready',
    mcpServersTitle: 'MCP Servers',
    mcpServersCopy: 'Add remote or local MCP connectors, enable only the ones you trust, and keep setup in the same settings flow.',
    mcpAddCustom: 'Add custom MCP',
    mcpPresetLabel: 'Quick presets',
    mcpEmpty: 'No MCP servers yet. Add a preset or create a custom connector.',
    mcpPresetGithub: 'GitHub',
    mcpPresetNotion: 'Notion',
    mcpPresetFigma: 'Figma',
    mcpPresetBrowser: 'Browser',
    mcpPresetGithubBody: 'Remote GitHub MCP with optional PAT header support.',
    mcpPresetNotionBody: 'Hosted Notion MCP over remote HTTP with OAuth.',
    mcpPresetFigmaBody: 'Hosted Figma MCP for design context and Dev Mode flows.',
    mcpPresetBrowserBody: 'Custom browser or Playwright bridge for local automation.',
    mcpEnabled: 'Enabled',
    mcpDisabled: 'Disabled',
    mcpReady: 'Configured',
    mcpNeedsSetup: 'Needs setup',
    mcpNameLabel: 'Connector name',
    mcpTransportLabel: 'Transport',
    mcpUrlLabel: 'Remote URL',
    mcpCommandLabel: 'Command',
    mcpArgsLabel: 'Arguments',
    mcpHeadersLabel: 'Headers JSON',
    mcpRemove: 'Remove',
    mcpOpenDocs: 'Docs',
    mcpTransportHttp: 'Remote HTTP',
    mcpTransportSse: 'Legacy SSE',
    mcpTransportStdio: 'Local stdio',
    mcpAuthLabel: 'Auth',
    mcpAuthNone: 'No auth',
    mcpAuthBearer: 'Bearer token',
    mcpAuthOauth: 'OAuth / PKCE',
    mcpAuthTokenEnvLabel: 'Token env var',
    mcpAuthTokenLabel: 'Token',
    mcpAuthTokenPlaceholder: 'Paste a bearer token to store securely',
    mcpClearToken: 'Clear token',
    mcpOauthAuthorizationUrlLabel: 'Authorization URL',
    mcpOauthTokenUrlLabel: 'Token URL',
    mcpOauthClientIdLabel: 'Client ID',
    mcpOauthClientSecretEnvLabel: 'Client secret env',
    mcpOauthScopesLabel: 'Scopes',
    mcpOauthAuthorize: 'Authorize OAuth',
    mcpOauthStarting: 'Opening OAuth...',
    mcpOauthStarted: 'OAuth opened in browser',
    mcpOauthHint: 'Leave endpoints empty to use MCP OAuth discovery when the server supports it.',
    mcpTestConnection: 'Test connection',
    mcpToolCount: '{count} tools',
    mcpConnected: 'Connected',
    mcpConnectionError: 'Connection error',
    mcpDisabledState: 'Disabled',
    mcpReadyState: 'Ready for runtime',
    mcpAuthReady: 'Auth ready',
    mcpAuthMissing: 'Auth missing',
    mcpSecretKeychain: 'Keychain',
    mcpSecretEnv: 'Environment',
    mcpSecretConfig: 'In app',
    connectorDiagnosticsTitle: 'Connector Diagnostics',
    connectorDiagnosticsCopy: 'Check auth readiness, connection state, and live tool discovery before the agent uses a connector.',
    connectorDiagnosticsEmpty: 'Save or test a connector to see live diagnostics.',
    workspaceOutlineTitle: 'Workspace Outline',
    workspaceOutlineCopy: 'Browse key folders, jump to files, and push paths into the composer.',
    workspaceOutlineEmpty: 'No workspace files available yet.',
    workspaceOutlineInsert: 'Insert path',
    workspaceOutlineOpen: 'Outline',
    workspaceRootPlaceholder: '/Users/bg/Desktop/project',
    workspaceRootSave: 'Use folder',
    workspaceRootSaving: 'Switching workspace...',
    workspaceRootSaved: 'Workspace changed',
    workspaceFileEditorTitle: 'File Editor',
    workspaceFileEditorCopy: 'Open a text file from the outline to edit it inside this workspace.',
    workspaceFilePlaceholder: 'Select a workspace file',
    workspaceFileSave: 'Save file',
    workspaceFileSaved: 'File saved',
    workspaceFileDirty: 'Unsaved changes',
    workspaceFileLoading: 'Opening file...',
    workspaceFileLoadError: 'Could not open file',
    commandPaletteTitle: 'Command Palette',
    commandPaletteHint: 'Jump to chats, tools, settings, and files from one compact panel.',
    commandPaletteSearchLabel: 'Search',
    commandPalettePlaceholder: 'Type a command, chat title, or file path',
    commandPaletteOpen: 'Open command palette',
    commandPaletteEmpty: 'No matching commands or files.',
    commandPaletteSectionActions: 'Actions',
    commandPaletteSectionChats: 'Chats',
    commandPaletteSectionFiles: 'Files',
    commandPaletteActionNewChat: 'Start a new chat',
    commandPaletteActionSettings: 'Open settings',
    commandPaletteActionActivity: 'Open activity',
    commandPaletteActionOutline: 'Toggle workspace outline',
    commandPaletteActionProviders: 'Jump to providers',
    commandPaletteActionExtensions: 'Jump to integrations',
    commandPaletteActionAutomation: 'Jump to automation',
    commandPaletteActionFocusComposer: 'Focus composer',
    insertedPath: 'Path added to composer',
    collapseChats: 'Collapse chats',
    expandChats: 'Expand chats',
    expandPanel: 'Expand panel',
    shrinkPanel: 'Shrink panel',
    refresh: 'Refresh',
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
    quickStartTitle: 'Hızlı Başlangıç',
    quickStartCopy: 'Kur, ilk açılışı onayla, plan seç, modeli bağla ve ilk workflow’unu çalıştır.',
    guideInstallTitle: 'modAI uygulamasını Applications klasörüne taşı',
    guideInstallBody: 'Uygulamayı Applications içinde tutmak güncellemeler, izinler ve aktivasyon davranışı için daha güvenli akış sağlar.',
    guideGatekeeperTitle: 'İlk açılışı onayla',
    guideGatekeeperBody: 'macOS uygulamayı engellerse Open Anyway kullan veya opsiyonel Gatekeeper yardımcısı olarak Sentinel’i elinde tut.',
    guidePaymentTitle: 'Ödeme ve aktivasyonu seç',
    guidePaymentBody: 'Lansman sayfası trial, kart ödemesi, kripto ödemesi ve lisans teslimini tek akışta çözmeli.',
    guideProviderTitle: 'Bir model provider bağla',
    guideProviderBody: 'Yerel kullanım için Ollama ile başla, daha güçlü cloud akıl yürütmesi gerektiğinde Gemini veya Anthropic ekle.',
    guideWorkflowTitle: 'Bir workflow pack çalıştır',
    guideWorkflowBody: 'Yeni kullanıcıya Founder, Sales veya Research başlangıç paketi ver ki ilk değer dakikalar içinde görünsün.',
    openLaunchSite: 'Lansman sitesini aç',
    openProviderSetup: 'Provider ayarlarını aç',
    openSentinel: 'Sentinel aç',
    billingCardLabel: 'Kart ile ödeme',
    billingCardTitle: 'Tekrarlayan planları sade tut',
    billingCardBody: 'Aylık ve yıllık planlar için merchant-of-record akışı kullan; vergi, fatura ve başarısız ödeme toparlama uygulama binary’sinin dışında kalsın.',
    billingCryptoLabel: 'Stablecoin ödeme',
    billingCryptoTitle: 'USDC ve USDT sun',
    billingCryptoBody: 'Kripto ödeme yıllık plan, founder pass veya kredi paketi için kullanılmalı; ödeme sonrası lisans anında teslim edilmeli.',
    billingActivationLabel: 'Aktivasyon',
    billingActivationTitle: 'İlk açılış sürtünmesini düşür',
    billingActivationBody: 'Trial, satın alma ve aktivasyon üç ayrı kurulum işi gibi değil tek yönlendirilmiş akış gibi hissettirmeli.',
    billingStatusTitle: 'Trial ve Aktivasyon',
    billingActivateTitle: 'Trial başlat veya lisans aktive et',
    billingActivateCopy: 'Yeni kullanıcı uygulamadan çıkmadan trial başlatabilmeli, lisans anahtarını yapıştırabilmeli veya tamamlanan ödemeden devam edebilmelidir.',
    billingDeviceLabel: 'Cihaz',
    billingEmailLabel: 'E-posta',
    billingPlanLabel: 'Plan',
    billingExpiryLabel: 'Bitiş',
    billingLicenseKeyLabel: 'Lisans anahtarı',
    billingStartTrial: '7 günlük trial başlat',
    billingActivateButton: 'Lisansı aktive et',
    billingCardRailTitle: 'Kart ile ödeme',
    billingCardRailCopy: 'Tekrarlayan kart ödemeleri ve tek seferlik planlarda anında lisans teslimi için Lemon Squeezy kullan.',
    billingCardSetupNeeded: 'Kart satın alımını açmak için Lemon Squeezy checkout URL’lerini ekle.',
    billingCryptoRailTitle: 'USDC / USDT ödeme',
    billingCryptoRailCopy: 'Kripto ödeme oluştur, ödeme durumunu izle ve üretilen lisansı bu cihaza uygula.',
    billingCryptoModeLive: 'Canlı direct-wallet checkout açık. Tam quoted tutarı gönder ve lisansı üretmek için zincir üstü transferi doğrula.',
    billingCryptoModeSandbox: 'Kripto checkout hâlâ yerel test modunda. Uygulamayı satışa çıkarmadan önce canlı ödeme raylarını bağla.',
    billingCryptoPlanTitle: 'Kripto planı',
    billingCryptoCurrencyLabel: 'Stablecoin',
    billingNetworkLabel: 'Ağ',
    billingNetworkVerificationReady: '{network} otomatik transfer doğrulaması için hazır.',
    billingNetworkVerificationNeeded: '{network} için zincir üstü transfer doğrulaması lisans üretebilsin diye önce {setting} tanımlanmalı.',
    billingPayerWalletLabel: 'Gönderen cüzdan (opsiyonel)',
    billingPayerWalletPlaceholder: 'Ödemeyi gönderen cüzdan adresi',
    billingRecipientHint: '{network} ödeme adresi: {address}',
    billingCreateCryptoPayment: 'Kripto ödeme oluştur',
    billingLatestPaymentTitle: 'Son ödeme',
    billingPayAmountLabel: 'Ödenecek tutar',
    billingPaymentUpdatedLabel: 'Güncellendi',
    billingQuoteExpiryLabel: 'Teklif bitişi',
    billingRefreshPayment: 'Durumu yenile',
    billingSimulatePayment: 'Ödendi simüle et',
    billingApplyLicense: 'Lisansı uygula',
    billingLicenseReady: 'Lisans hazır: {key}',
    billingStatusWaitingPayment: 'transfer bekleniyor',
    billingStatusPaid: 'ödeme alındı',
    billingStatusFailed: 'ödeme sorunu',
    billingStepSendTitle: 'Tam quoted tutarı gönder',
    billingStepSendBody: 'Cüzdanından tam olarak {amount} gönder. Bu tutar bu invoice için benzersizdir.',
    billingStepAddressTitle: 'Invoice adresini kullan',
    billingStepAddressBody: 'Yalnızca {network} ağı üzerinden aşağıdaki adrese gönder.',
    billingStepVerifyTitle: 'İşlem hash’ini yapıştır',
    billingStepVerifyBody: 'Transfer zincirde onaylandıktan sonra işlem hash’ini yapıştır ve ödemeyi doğrula.',
    billingCopyAmount: 'Tutarı kopyala',
    billingCopyAddress: 'Adresi kopyala',
    billingCopied: 'Panoya kopyalandı',
    billingTxHashLabel: 'İşlem hash’i',
    billingTxHashPlaceholder: 'Zincir üzerindeki işlem hash’ini yapıştır',
    billingTxHashHint: 'Profesyonel akış: invoice oluştur, tam quoted tutarı gönder, sonra doğrulama için işlem hash’ini yapıştır.',
    billingTxHashHintWaiting: 'Bu invoice gerçek zincir ödemesini bekliyor. Tam quoted tutarı gönder, sonra aşağıya işlem hash’ini yapıştır.',
    billingTxHashRequired: 'İşlem hash’i gerekli.',
    billingVerifyTransfer: 'Transferi doğrula',
    billingVerifyingTransfer: 'Transfer doğrulanıyor...',
    billingTransferVerified: 'Transfer doğrulandı',
    billingOpenExplorer: 'Explorer aç',
    billingStatusActive: 'Aktif lisans',
    billingStatusTrial: 'Trial açık',
    billingStatusExpired: 'Erişim bitti',
    billingStatusInactive: 'Henüz lisans yok',
    billingPillActive: 'aktif',
    billingPillTrial: 'trial',
    billingPillExpired: 'süresi doldu',
    billingPillInactive: 'pasif',
    billingActiveCopy: 'Bu cihaz {source} üzerinden aktive edildi. Geçerli plan: {plan}.',
    billingTrialCopy: 'Ücretsiz trial aktif. Aktivasyon gerekmeden önce {days} gün kaldı.',
    billingExpiredCopy: 'Trial veya ücretli erişimin süresi doldu. Devam etmek için lisans aktive et veya ödeme tamamla.',
    billingInactiveCopy: 'Bu cihaza henüz aktif trial veya lisans bağlanmadı.',
    billingUnset: 'Tanımlı değil',
    billingTrialStarted: 'Trial başlatıldı',
    billingActivating: 'Lisans aktive ediliyor...',
    billingActivated: 'Lisans aktive edildi',
    billingStartingCrypto: 'Kripto ödeme oluşturuluyor...',
    billingCryptoReady: 'Kripto ödeme hazır',
    billingRefreshingPayment: 'Ödeme durumu yenileniyor...',
    billingPaymentUpdated: 'Ödeme durumu yenilendi',
    billingClaimingLicense: 'Lisans uygulanıyor...',
    billingClaimed: 'Lisans uygulandı',
    billingOpeningCheckout: 'Checkout açılıyor...',
    sentinelNoteTitle: 'Gatekeeper destek notu',
    sentinelNoteBody: 'Gatekeeper durumunu daha net görmek isteyen ileri seviye kullanıcılara Sentinel’i destek akışında opsiyonel yardımcı araç olarak öner; zorunlu hale getirme.',
    workflowPacksTitle: 'Workflow Packler',
    workflowPacksCopy: 'Yeni kullanıcı prompt özelleştirmeye geçmeden önce değer görsün diye çıkışta üç persona pack ile başla.',
    packFounderLabel: 'Founder OS',
    packFounderTitle: 'Günlük operatör paketi',
    packFounderBody: 'Inbox triage, lansman checklist’i, follow-up taslağı, toplantı hazırlığı ve günlük yürütme özetleri.',
    packSalesLabel: 'Sales Operator',
    packSalesTitle: 'Takip odaklı paket',
    packSalesBody: 'Lead hatırlatmaları, objection handling, CRM not temizliği ve proposal follow-up akışları.',
    packResearchLabel: 'Research Desk',
    packResearchTitle: 'Karar destek paketi',
    packResearchBody: 'Kaynak toplama, karşılaştırma notları, sentez ve memory destekli aksiyon listesi üretimi.',
    openAutomationGuide: 'Automation sekmesini aç',
    openPricingPage: 'Fiyatlandırmayı aç',
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
    headerSessionLabel: 'Oturum',
    headerModelLabel: 'Model',
    noMessagesYet: 'Henüz mesaj yok',
    messagesLabel: 'mesaj',
    workspaceLabel: 'Çalışma alanı',
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
    deleteChatConfirmTitle: 'Sohbet kaydını sil',
    deleteChatConfirmBody: 'Eski sohbet "{title}" silinsin mi? Bu işlem geri alınamaz.',
    deleteTaskConfirm: 'Bu planlanmış görev silinsin mi?',
    deleteTaskConfirmTitle: 'Planlanmış görevi sil',
    deleteTaskConfirmBody: '"{title}" görevi silinsin mi? Bu işlem geri alınamaz.',
    deletingChat: 'Sohbet siliniyor...',
    deletedChat: 'Sohbet silindi',
    deletingTask: 'Görev siliniyor...',
    deletedTask: 'Görev silindi',
    editTask: 'Düzenle',
    editingTask: 'Görev kaydediliyor...',
    taskUpdated: 'Görev güncellendi',
    confirmAction: 'İşlemi Onayla',
    confirm: 'Onayla',
    cancel: 'Vazgeç',
    editTaskDetails: 'Görev detaylarını düzenle',
    editTaskCopy: 'Aşağıdaki alanlardan planlanmış görevi güncelle.',
    taskTitleLabel: 'Görev başlığı',
    taskGoalLabel: 'Amaç',
    taskConstraintsLabel: 'Kısıtlar',
    taskDueLabel: 'Teslim',
    taskCompletionLabel: 'Tamamlanma kriteri',
    saveTaskChanges: 'Görevi Kaydet',
    taskTitleRequired: 'Görev başlığı gerekli.',
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
    extensionsTab: 'Entegrasyonlar',
    collapseSidebar: 'Sol kenar cubugunu daralt',
    expandSidebar: 'Sol kenar cubugunu genislet',
    minimizeTopBar: 'Ust barı kucult',
    restoreTopBar: 'Ust barı geri getir',
    integrationsTitle: 'Entegrasyonlar',
    integrationsCopy: 'MCP, plugin, desktop control ve skill tabanli workflowlari tek bir operator yuzeyinde derli toplu tut.',
    integrationsDesktopLabel: 'Desktop control',
    integrationsDesktopBody: 'Browser aksiyonlari, screenshot, dosyalar ve computer-use akislari ayni operator yuzeyinde kalsin.',
    integrationsPluginsLabel: 'Pluginler',
    integrationsPluginsBody: 'Aktif pluginler gizli ayar yerine tek tiklik entegrasyona donusmeli.',
    integrationsSkillsLabel: 'Skilller',
    integrationsSkillsBody: 'GitHub review, research ve follow-up gibi tekrarli isleri yeniden kullanilabilir skill olarak paketle.',
    integrationsMcpLabel: 'MCP sunuculari',
    integrationsMcpBody: 'Remote ve local connectorlar burada gercekten konfigure edilebilmeli, sadece oneride kalmamali.',
    integrationsActiveCount: '{count} aktif',
    integrationsReadyCount: '{count} hazir',
    mcpServersTitle: 'MCP Sunuculari',
    mcpServersCopy: 'Remote veya local MCP connectorlarini ekle, sadece guvendiklerini acik tut ve ayarlari ayni akista yonet.',
    mcpAddCustom: 'Ozel MCP ekle',
    mcpPresetLabel: 'Hazir presetler',
    mcpEmpty: 'Henuz MCP sunucusu yok. Bir preset ekle veya ozel connector olustur.',
    mcpPresetGithub: 'GitHub',
    mcpPresetNotion: 'Notion',
    mcpPresetFigma: 'Figma',
    mcpPresetBrowser: 'Browser',
    mcpPresetGithubBody: 'Opsiyonel PAT header destegiyle remote GitHub MCP.',
    mcpPresetNotionBody: 'OAuth ile calisan hosted Notion MCP.',
    mcpPresetFigmaBody: 'Design context ve Dev Mode akislari icin hosted Figma MCP.',
    mcpPresetBrowserBody: 'Local otomasyon icin custom browser veya Playwright bridge.',
    mcpEnabled: 'Acik',
    mcpDisabled: 'Kapali',
    mcpReady: 'Hazir',
    mcpNeedsSetup: 'Kurulum gerekli',
    mcpNameLabel: 'Connector adi',
    mcpTransportLabel: 'Transport',
    mcpUrlLabel: 'Remote URL',
    mcpCommandLabel: 'Komut',
    mcpArgsLabel: 'Argumanlar',
    mcpHeadersLabel: 'Headers JSON',
    mcpRemove: 'Kaldir',
    mcpOpenDocs: 'Dokuman',
    mcpTransportHttp: 'Remote HTTP',
    mcpTransportSse: 'Legacy SSE',
    mcpTransportStdio: 'Local stdio',
    mcpAuthLabel: 'Yetki',
    mcpAuthNone: 'Yetki yok',
    mcpAuthBearer: 'Bearer token',
    mcpAuthOauth: 'OAuth / PKCE',
    mcpAuthTokenEnvLabel: 'Token ortam degiskeni',
    mcpAuthTokenLabel: 'Token',
    mcpAuthTokenPlaceholder: 'Guvenli saklamak icin bearer token yapistir',
    mcpClearToken: 'Token temizle',
    mcpOauthAuthorizationUrlLabel: 'Authorization URL',
    mcpOauthTokenUrlLabel: 'Token URL',
    mcpOauthClientIdLabel: 'Client ID',
    mcpOauthClientSecretEnvLabel: 'Client secret env',
    mcpOauthScopesLabel: 'Scope listesi',
    mcpOauthAuthorize: 'OAuth yetkilendir',
    mcpOauthStarting: 'OAuth aciliyor...',
    mcpOauthStarted: 'OAuth tarayicida acildi',
    mcpOauthHint: 'Server destekliyorsa MCP OAuth discovery kullanmak icin endpointleri bos birak.',
    mcpTestConnection: 'Baglantiyi test et',
    mcpToolCount: '{count} arac',
    mcpConnected: 'Bagli',
    mcpConnectionError: 'Baglanti hatasi',
    mcpDisabledState: 'Kapali',
    mcpReadyState: 'Runtime icin hazir',
    mcpAuthReady: 'Yetki hazir',
    mcpAuthMissing: 'Yetki eksik',
    mcpSecretKeychain: 'Keychain',
    mcpSecretEnv: 'Ortam',
    mcpSecretConfig: 'Uygulama ici',
    connectorDiagnosticsTitle: 'Connector Diagnostigi',
    connectorDiagnosticsCopy: 'Ajan connector kullanmadan once yetki durumunu, baglantiyi ve canli tool kesfini kontrol et.',
    connectorDiagnosticsEmpty: 'Canli diagnostik gormek icin connectoru kaydet veya test et.',
    workspaceOutlineTitle: 'Calisma Alani Ozeti',
    workspaceOutlineCopy: 'Ana klasorleri gez, dosyalara atla ve pathleri composer icine ekle.',
    workspaceOutlineEmpty: 'Henuz gosterilecek workspace dosyasi yok.',
    workspaceOutlineInsert: 'Path ekle',
    workspaceOutlineOpen: 'Outline',
    workspaceRootPlaceholder: '/Users/bg/Desktop/proje',
    workspaceRootSave: 'Klasoru kullan',
    workspaceRootSaving: 'Workspace degistiriliyor...',
    workspaceRootSaved: 'Workspace degisti',
    workspaceFileEditorTitle: 'Dosya Editoru',
    workspaceFileEditorCopy: 'Workspace icinde duzenlemek icin outlinedan bir text dosyasi ac.',
    workspaceFilePlaceholder: 'Bir workspace dosyasi sec',
    workspaceFileSave: 'Dosyayi kaydet',
    workspaceFileSaved: 'Dosya kaydedildi',
    workspaceFileDirty: 'Kaydedilmemis degisiklik var',
    workspaceFileLoading: 'Dosya aciliyor...',
    workspaceFileLoadError: 'Dosya acilamadi',
    commandPaletteTitle: 'Komut Paleti',
    commandPaletteHint: 'Tek bir kompakt panelden sohbetlere, araclara, ayarlara ve dosyalara gec.',
    commandPaletteSearchLabel: 'Ara',
    commandPalettePlaceholder: 'Komut, sohbet basligi veya dosya yolu yaz',
    commandPaletteOpen: 'Komut paletini ac',
    commandPaletteEmpty: 'Eslesen komut veya dosya yok.',
    commandPaletteSectionActions: 'Aksiyonlar',
    commandPaletteSectionChats: 'Sohbetler',
    commandPaletteSectionFiles: 'Dosyalar',
    commandPaletteActionNewChat: 'Yeni sohbet baslat',
    commandPaletteActionSettings: 'Ayarlari ac',
    commandPaletteActionActivity: 'Aktiviteyi ac',
    commandPaletteActionOutline: 'Workspace outline ac/kapat',
    commandPaletteActionProviders: 'Providerlara git',
    commandPaletteActionExtensions: 'Integrations sekmesine git',
    commandPaletteActionAutomation: 'Automation sekmesine git',
    commandPaletteActionFocusComposer: 'Composer odagini ac',
    insertedPath: 'Path composer icine eklendi',
    collapseChats: 'Sohbetleri daralt',
    expandChats: 'Sohbetleri genişlet',
    expandPanel: 'Paneli genişlet',
    shrinkPanel: 'Paneli daralt',
    refresh: 'Yenile',
    skillContentRequired: 'Skill içeriği gerekli.',
    noteCategory: 'genel',
  },
}

boot().catch(showError)

async function boot() {
  await loadLocaleDictionaries()
  bindEvents()
  await refreshSettings()
  maybeShowFirstRunGuide()
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
  settingsDrawer.addEventListener('click', onSettingsDrawerActionClick)
  settingsDrawer.addEventListener('input', onSettingsDrawerInput)
  settingsDrawer.addEventListener('submit', onSettingsDrawerSubmit)
  providersPanel.addEventListener('click', onProviderPanelClick)
  providersPanel.addEventListener('input', onProviderPanelInput)
  providerTabList.addEventListener('click', onProviderTabClick)
  commandPaletteButton?.addEventListener('click', () => openCommandPalette())
  commandPaletteOverlay?.addEventListener('click', event => {
    if (event.target === commandPaletteOverlay) {
      closeCommandPalette()
    }
  })
  commandPaletteInput?.addEventListener('input', event => {
    state.commandPaletteQuery = event.target.value
    renderCommandPalette()
  })
  commandPaletteInput?.addEventListener('keydown', onCommandPaletteKeydown)
  commandPaletteResults?.addEventListener('click', onCommandPaletteClick)
  sidebarToggleButton?.addEventListener('click', toggleSidebar)
  toggleHeaderButton?.addEventListener('click', toggleHeaderBar)
  toggleOutlineButton?.addEventListener('click', toggleWorkspaceOutline)
  toggleSettingsButton.addEventListener('click', openSettingsDrawer)
  closeSettingsButton.addEventListener('click', closeSettingsDrawer)
  settingsSizeButton?.addEventListener('click', toggleDrawerSize)
  saveWorkspaceRootButton?.addEventListener('click', saveWorkspaceRoot)
  refreshOutlineButton?.addEventListener('click', refreshWorkspaceOutline)
  closeOutlineButton?.addEventListener('click', closeWorkspaceOutline)
  workspaceOutlineTree?.addEventListener('click', onWorkspaceOutlineClick)
  workspaceFileInput?.addEventListener('input', onWorkspaceFileInput)
  saveWorkspaceFileButton?.addEventListener('click', saveWorkspaceFile)
  insertWorkspacePathButton?.addEventListener('click', () => insertPathIntoComposer(state.workspaceFile.path))
  closeWorkspaceFileButton?.addEventListener('click', closeWorkspaceFile)
  drawerNewChatButton.addEventListener('click', onClear)
  drawerScrim.addEventListener('click', closeSettingsDrawer)
  toggleActivityButton.addEventListener('click', openActivityDrawer)
  activityHeaderButton.addEventListener('click', openActivityDrawer)
  toggleChatsButton?.addEventListener('click', toggleChatsSection)
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
  confirmCancelButton?.addEventListener('click', () => resolveConfirmDialog(false))
  confirmApproveButton?.addEventListener('click', () => resolveConfirmDialog(true))
  confirmOverlay?.addEventListener('click', event => {
    if (event.target === confirmOverlay) {
      resolveConfirmDialog(false)
    }
  })
  taskEditorCancelButton?.addEventListener('click', () => closeTaskEditor())
  taskEditorOverlay?.addEventListener('click', event => {
    if (event.target === taskEditorOverlay) {
      closeTaskEditor()
    }
  })
  taskEditorForm?.addEventListener('submit', onTaskEditorSubmit)
  window.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('focus', () => {
    if (!state.pendingMcpOAuthRefresh) {
      return
    }
    state.pendingMcpOAuthRefresh = false
    void refreshSettings()
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

function setStatusIndicator(label, tone = 'ready') {
  if (!statusBox) {
    return
  }

  statusBox.dataset.tone = tone
  const copy = statusBox.querySelector('.status-copy')
  if (copy) {
    copy.textContent = label
    return
  }
  statusBox.textContent = label
}

function setHeaderSummary(node, label, value, tone = 'neutral', title = '') {
  if (!node) {
    return
  }

  node.dataset.tone = tone
  if (title) {
    node.title = title
  } else {
    node.removeAttribute('title')
  }

  const labelNode = node.querySelector('.header-context-label')
  const valueNode = node.querySelector('.header-context-value')
  if (labelNode && valueNode) {
    labelNode.textContent = label
    valueNode.textContent = value
    return
  }

  node.textContent = value
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
  renderIntegrations(state.settings ?? {})
  renderMcpDiagnostics(state.settings ?? {})
  renderMcpServers(state.settings ?? {})
  renderSkills(state.settings ?? {})
  renderPlugins(state.settings ?? {})
  renderTools(state.settings ?? {})
  renderMemory(state.settings ?? {})
  renderReminderSettings(state.settings ?? {})
  renderWorkspaceOutline()
  renderCommandPalette()
  renderComposerContext()
  renderActivity()
  renderConversation()
  syncChatsSectionUi()
  syncShellLayout()
  syncHeaderLayout()
  syncOutlineLayout()
  syncDrawerLayout()
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
            'Amac: Baran Gulesen ara',
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
            'Gorev: Google Chrome ac ve https://fusungulesen.com sayfasini ziyaret et',
            'Amac: siteyi kontrol etmek',
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
          'Goal: find Baran Gulesen',
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
          'Task: Open Google Chrome and visit https://fusungulesen.com',
          'Goal: review the website',
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
  await refreshWorkspaceOutline()
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
  renderBilling(settings)
  renderPermissions(settings)
  renderIntegrations(settings)
  renderMcpDiagnostics(settings)
  renderMcpServers(settings)
  renderSkills(settings)
  renderPlugins(settings)
  renderTools(settings)
  renderMemory(settings)
  renderAssistantProfileBadges()
  updateModelStatus()
  updateSessionIndicators()
  renderComposerContext()
  resizeComposerInput()
  syncShellLayout()
  syncHeaderLayout()
  syncOutlineLayout()
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

function renderBilling(settings) {
  if (!billingPanel) {
    return
  }

  syncBillingDraft(settings.billing)
  billingPanel.innerHTML = renderBillingPanelMarkup(settings.billing, {
    draft: state.billingDraft,
    t,
    formatTimestamp: value => formatTimestamp(value, localeForUi()),
  })

  void maybeAutoClaimLatestPayment(settings.billing)
}

function syncBillingDraft(billing) {
  if (!billing) {
    return
  }

  const networks = billing.networks ?? []
  const currentNetwork = networks.find(network => network.id === state.billingDraft.networkId) ?? networks[0] ?? null
  const currentAsset = currentNetwork?.assets?.find(asset => asset.id === state.billingDraft.assetId) ?? currentNetwork?.assets?.[0] ?? null

  if (!state.billingDraft.deviceName) {
    state.billingDraft.deviceName = billing.device?.name ?? ''
  }
  if (!state.billingDraft.email) {
    state.billingDraft.email = billing.activation?.email || billing.payments?.[0]?.email || ''
  }
  if (!state.billingDraft.cryptoPlanId) {
    state.billingDraft.cryptoPlanId = billing.plans?.crypto?.[0]?.id ?? 'pro-annual'
  }
  state.billingDraft.cardPlanId ||= billing.plans?.card?.[0]?.id ?? 'starter-monthly'
  state.billingDraft.networkId = currentNetwork?.id ?? state.billingDraft.networkId
  state.billingDraft.assetId = currentAsset?.id ?? state.billingDraft.assetId
  state.billingDraft.cryptoCurrency = currentAsset?.id ?? (state.billingDraft.cryptoCurrency || 'usdc')
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
    providersPanel.innerHTML = renderAdvancedProviderPanel(providers, { t })
    return
  }

  const visibleProviders = providers.filter(provider => provider.group === state.providerTab)
  providersPanel.innerHTML = visibleProviders.length
    ? visibleProviders.map(provider => renderProviderCardMarkup(provider, {
        draft: state.providerDrafts[provider.id] ?? {
          baseUrl: provider.baseUrl || '',
          apiKey: '',
          clearApiKey: false,
        },
        t,
      })).join('')
    : `<div class="empty-card">${escapeHtml(t('noProvidersTab'))}</div>`
}

function renderProviderTabs() {
  for (const button of providerTabList.querySelectorAll('[data-provider-tab]')) {
    button.classList.toggle('is-active', button.dataset.providerTab === state.providerTab)
  }
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

function renderIntegrations(settings) {
  if (!integrationsPanel) {
    return
  }

  const plugins = settings.plugins ?? []
  const skills = settings.skills ?? []
  const tools = settings.tools ?? []
  const mcpServers = cloneMcpServers(settings)
  const desktopTools = tools.filter(tool => tool.requiredMode === 'desktop').length
  const activePlugins = plugins.filter(plugin => plugin.active).length
  const activeSkills = skills.filter(skill => skill.active).length
  const activeMcp = mcpServers.filter(server => server.enabled).length
  const mcpHeadline = activeMcp
    ? t('integrationsActiveCount', { count: activeMcp })
    : ['github', 'notion', 'figma'].map(getMcpPresetLabel).join(' · ')
  const mcpBody = activeMcp
    ? mcpServers.filter(server => server.enabled).slice(0, 3).map(server => server.name).join(' · ')
    : t('integrationsMcpBody')

  const cards = [
    {
      label: t('integrationsDesktopLabel'),
      value: t('integrationsReadyCount', { count: desktopTools }),
      body: t('integrationsDesktopBody'),
    },
    {
      label: t('integrationsPluginsLabel'),
      value: t('integrationsActiveCount', { count: activePlugins }),
      body: t('integrationsPluginsBody'),
    },
    {
      label: t('integrationsSkillsLabel'),
      value: t('integrationsActiveCount', { count: activeSkills }),
      body: t('integrationsSkillsBody'),
    },
    {
      label: t('integrationsMcpLabel'),
      value: mcpHeadline,
      body: mcpBody,
    },
  ]

  integrationsPanel.innerHTML = cards.map(card => `
    <article class="launch-card integration-card">
      <span class="launch-kicker">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <p>${escapeHtml(card.body)}</p>
    </article>
  `).join('')
}

function renderMcpDiagnostics(settings) {
  if (!mcpDiagnosticsPanel) {
    return
  }

  const servers = cloneMcpServers(settings)
  const diagnostics = settings?.mcp?.diagnostics ?? []

  if (!servers.length) {
    mcpDiagnosticsPanel.innerHTML = `<div class="empty-card">${escapeHtml(t('connectorDiagnosticsEmpty'))}</div>`
    return
  }

  mcpDiagnosticsPanel.innerHTML = servers.map(server => {
    const diagnostic = diagnostics.find(item => item.serverId === server.id) ?? null
    const authReady = server.authType === 'none' || server.hasAuthToken || server.authTokenSource || server.authTokenEnv
    const authState = authReady ? t('mcpAuthReady') : t('mcpAuthMissing')
    const authTone = authReady ? 'ready' : 'warn'
    const storage = formatMcpSecretSource(server.authTokenSource || (server.authTokenEnv ? 'env' : ''))
    const connectionState = diagnostic
      ? diagnostic.ok
        ? t('mcpConnected')
        : diagnostic.status === 'disabled'
          ? t('mcpDisabledState')
          : t('mcpConnectionError')
      : t('mcpNeedsSetup')
    const toolState = diagnostic?.toolCount
      ? t('mcpToolCount', { count: diagnostic.toolCount })
      : t('mcpReadyState')

    return `
      <article class="mcp-diagnostic-card" data-mcp-index="${escapeHtml(server.id)}">
        <div class="mcp-card-head">
          <div class="mcp-card-copy">
            <strong>${escapeHtml(server.name)}</strong>
            <div class="mcp-chip-row">
              <span class="mcp-status-chip ${diagnostic?.ok ? 'ready' : diagnostic?.status === 'disabled' ? 'muted' : 'warn'}">${escapeHtml(connectionState)}</span>
              <span class="mcp-status-chip ${authTone}">${escapeHtml(authState)}</span>
              <span class="message-chip">${escapeHtml(toolState)}</span>
            </div>
          </div>
          <div class="mcp-card-actions">
            <button type="button" class="secondary" data-mcp-action="test-server" data-mcp-id="${escapeHtml(server.id)}">${escapeHtml(t('mcpTestConnection'))}</button>
          </div>
        </div>
        <div class="provider-inline-note">
          ${escapeHtml(storage ? `${storage} · ${diagnostic?.endpoint || server.url || server.command || ''}` : diagnostic?.endpoint || server.url || server.command || '')}
        </div>
        ${diagnostic?.error ? `<div class="provider-inline-note error-note">${escapeHtml(diagnostic.error)}</div>` : ''}
      </article>
    `
  }).join('')
}

function renderMcpServers(settings) {
  if (!mcpPanel) {
    return
  }

  const servers = cloneMcpServers(settings)
  const presetButtons = [
    ['github', t('mcpPresetGithub')],
    ['notion', t('mcpPresetNotion')],
    ['figma', t('mcpPresetFigma')],
    ['browser', t('mcpPresetBrowser')],
  ]

  mcpPanel.innerHTML = `
    <div class="mcp-toolbar">
      <div class="mcp-toolbar-copy">${escapeHtml(t('mcpPresetLabel'))}</div>
      <div class="mcp-toolbar-actions">
        ${presetButtons.map(([presetId, label]) => `
          <button type="button" class="secondary mcp-preset-button" data-mcp-action="add-preset" data-mcp-preset="${escapeHtml(presetId)}">${escapeHtml(label)}</button>
        `).join('')}
      </div>
    </div>
    ${servers.length
      ? `<div class="mcp-stack">${servers.map((server, index) => renderMcpServerCardMarkup(settings, server, index)).join('')}</div>`
      : `<div class="empty-card">${escapeHtml(t('mcpEmpty'))}</div>`}
  `
}

function renderMcpServerCardMarkup(settings, server, index) {
  const preset = server.presetId ? MCP_PRESETS[server.presetId] ?? null : null
  const diagnostic = (settings?.mcp?.diagnostics ?? []).find(item => item.serverId === server.id) ?? null
  const isRemote = server.transport === 'http' || server.transport === 'sse'
  const isConfigured = isRemote
    ? Boolean(server.url.trim())
    : Boolean(server.command.trim())
  const transportLabel = server.transport === 'http'
    ? t('mcpTransportHttp')
    : server.transport === 'sse'
      ? t('mcpTransportSse')
      : t('mcpTransportStdio')
  const statusLabel = isConfigured ? t('mcpReady') : t('mcpNeedsSetup')
  const enabledLabel = server.enabled ? t('mcpEnabled') : t('mcpDisabled')

  return `
    <article class="mcp-card" data-mcp-index="${index}">
      <div class="mcp-card-head">
        <div class="mcp-card-copy">
          <strong>${escapeHtml(server.name)}</strong>
          <div class="mcp-chip-row">
            <span class="message-chip">${escapeHtml(transportLabel)}</span>
            ${preset ? `<span class="message-chip">${escapeHtml(getMcpPresetLabel(server.presetId))}</span>` : ''}
            <span class="mcp-status-chip ${isConfigured ? 'ready' : 'warn'}">${escapeHtml(statusLabel)}</span>
            ${diagnostic ? `<span class="message-chip">${escapeHtml(diagnostic.ok ? t('mcpToolCount', { count: diagnostic.toolCount ?? 0 }) : t('mcpConnectionError'))}</span>` : ''}
          </div>
        </div>
        <div class="mcp-card-actions">
          <label class="mcp-enable-toggle">
            <input type="checkbox" data-mcp-field="enabled" ${server.enabled ? 'checked' : ''} />
            <span>${escapeHtml(enabledLabel)}</span>
          </label>
          <button type="button" class="secondary" data-mcp-action="test-server" data-mcp-id="${escapeHtml(server.id)}">${escapeHtml(t('mcpTestConnection'))}</button>
          ${preset?.docsUrl ? `<button type="button" class="secondary" data-open-url="${escapeHtml(preset.docsUrl)}">${escapeHtml(t('mcpOpenDocs'))}</button>` : ''}
          <button type="button" class="secondary" data-mcp-action="remove-server" data-mcp-index="${index}">${escapeHtml(t('mcpRemove'))}</button>
        </div>
      </div>
      <div class="field-grid mcp-field-grid">
        <label class="field compact-field">
          <span>${escapeHtml(t('mcpNameLabel'))}</span>
          <input type="text" data-mcp-field="name" value="${escapeHtml(server.name)}" />
        </label>
        <label class="field compact-field">
          <span>${escapeHtml(t('mcpTransportLabel'))}</span>
          <select data-mcp-field="transport">
            <option value="http" ${server.transport === 'http' ? 'selected' : ''}>${escapeHtml(t('mcpTransportHttp'))}</option>
            <option value="sse" ${server.transport === 'sse' ? 'selected' : ''}>${escapeHtml(t('mcpTransportSse'))}</option>
            <option value="stdio" ${server.transport === 'stdio' ? 'selected' : ''}>${escapeHtml(t('mcpTransportStdio'))}</option>
          </select>
        </label>
        ${isRemote ? `
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpUrlLabel'))}</span>
            <input type="text" data-mcp-field="url" value="${escapeHtml(server.url)}" placeholder="https://example.com/mcp" />
          </label>
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpHeadersLabel'))}</span>
            <textarea data-mcp-field="headersText" rows="3" placeholder='{"Authorization":"Bearer ..."}'>${escapeHtml(server.headersText)}</textarea>
          </label>
        ` : `
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpCommandLabel'))}</span>
            <input type="text" data-mcp-field="command" value="${escapeHtml(server.command)}" placeholder="npx" />
          </label>
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpArgsLabel'))}</span>
            <input type="text" data-mcp-field="argsText" value="${escapeHtml(server.argsText)}" placeholder="-y mcp-remote https://example.com/mcp" />
          </label>
        `}
        <label class="field compact-field">
          <span>${escapeHtml(t('mcpAuthLabel'))}</span>
          <select data-mcp-field="authType">
            <option value="none" ${server.authType === 'none' ? 'selected' : ''}>${escapeHtml(t('mcpAuthNone'))}</option>
            <option value="bearer" ${server.authType === 'bearer' ? 'selected' : ''}>${escapeHtml(t('mcpAuthBearer'))}</option>
            <option value="oauth" ${server.authType === 'oauth' ? 'selected' : ''}>${escapeHtml(t('mcpAuthOauth'))}</option>
          </select>
        </label>
        <label class="field compact-field">
          <span>${escapeHtml(t('mcpAuthTokenEnvLabel'))}</span>
          <input type="text" data-mcp-field="authTokenEnv" value="${escapeHtml(server.authTokenEnv)}" placeholder="GITHUB_TOKEN" />
        </label>
        ${server.authType === 'bearer' ? `
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpAuthTokenLabel'))}</span>
            <input type="password" data-mcp-field="authToken" value="${escapeHtml(server.authToken)}" placeholder="${escapeHtml(t('mcpAuthTokenPlaceholder'))}" />
          </label>
        ` : ''}
        ${server.authType === 'oauth' && isRemote ? `
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpOauthAuthorizationUrlLabel'))}</span>
            <input type="text" data-mcp-field="oauthAuthorizationUrl" value="${escapeHtml(server.oauthAuthorizationUrl)}" placeholder="https://provider.com/oauth/authorize" />
          </label>
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpOauthTokenUrlLabel'))}</span>
            <input type="text" data-mcp-field="oauthTokenUrl" value="${escapeHtml(server.oauthTokenUrl)}" placeholder="https://provider.com/oauth/token" />
          </label>
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpOauthClientIdLabel'))}</span>
            <input type="text" data-mcp-field="oauthClientId" value="${escapeHtml(server.oauthClientId)}" placeholder="client_id or leave empty for dynamic registration" />
          </label>
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpOauthClientSecretEnvLabel'))}</span>
            <input type="text" data-mcp-field="oauthClientSecretEnv" value="${escapeHtml(server.oauthClientSecretEnv)}" placeholder="MCP_OAUTH_CLIENT_SECRET" />
          </label>
          <label class="field compact-field">
            <span>${escapeHtml(t('mcpOauthScopesLabel'))}</span>
            <input type="text" data-mcp-field="oauthScopes" value="${escapeHtml(server.oauthScopes)}" placeholder="read write" />
          </label>
        ` : ''}
      </div>
      <div class="mcp-footer-row">
        ${server.authType === 'oauth' && isRemote
          ? `<div class="provider-inline-note">${escapeHtml(t('mcpOauthHint'))}</div>`
          : preset ? `<div class="provider-inline-note">${escapeHtml(getMcpPresetBody(server.presetId))}</div>` : '<div></div>'}
        <div class="mcp-footer-actions">
          ${server.hasAuthToken || server.authTokenSource || server.authTokenEnv
            ? `<div class="provider-inline-note">${escapeHtml(formatMcpSecretSource(server.authTokenSource || (server.authTokenEnv ? 'env' : 'config')))}</div>`
            : '<div></div>'}
          ${server.authType === 'oauth' && isRemote
            ? `<button type="button" class="secondary" data-mcp-action="start-oauth" data-mcp-id="${escapeHtml(server.id)}">${escapeHtml(t('mcpOauthAuthorize'))}</button>`
            : '<div></div>'}
          ${server.authType === 'bearer'
            ? `<button type="button" class="secondary" data-mcp-action="clear-token" data-mcp-index="${index}">${escapeHtml(t('mcpClearToken'))}</button>`
            : '<div></div>'}
        </div>
      </div>
      ${diagnostic?.error ? `<div class="provider-inline-note error-note">${escapeHtml(diagnostic.error)}</div>` : ''}
    </article>
  `
}

function getMcpPresetLabel(presetId) {
  if (presetId === 'github') {
    return t('mcpPresetGithub')
  }
  if (presetId === 'notion') {
    return t('mcpPresetNotion')
  }
  if (presetId === 'figma') {
    return t('mcpPresetFigma')
  }
  if (presetId === 'browser') {
    return t('mcpPresetBrowser')
  }
  return 'MCP'
}

function getMcpPresetBody(presetId) {
  if (presetId === 'github') {
    return t('mcpPresetGithubBody')
  }
  if (presetId === 'notion') {
    return t('mcpPresetNotionBody')
  }
  if (presetId === 'figma') {
    return t('mcpPresetFigmaBody')
  }
  if (presetId === 'browser') {
    return t('mcpPresetBrowserBody')
  }
  return ''
}

function cloneMcpServers(settings = state.settings) {
  return (settings?.mcp?.servers ?? []).map(server => ({
    id: String(server.id ?? '').trim() || createClientId('mcp'),
    presetId: String(server.presetId ?? '').trim(),
    name: String(server.name ?? '').trim() || 'Custom MCP',
    transport: ['http', 'sse', 'stdio'].includes(server.transport) ? server.transport : 'stdio',
    url: String(server.url ?? '').trim(),
    command: String(server.command ?? '').trim(),
    argsText: String(server.argsText ?? '').trim(),
    headersText: String(server.headersText ?? '').trim(),
    authType: ['none', 'bearer', 'oauth'].includes(server.authType) ? server.authType : 'none',
    authTokenEnv: String(server.authTokenEnv ?? '').trim(),
    authTokenSource: String(server.authTokenSource ?? '').trim(),
    authToken: String(server.authToken ?? ''),
    oauthAuthorizationUrl: String(server.oauthAuthorizationUrl ?? '').trim(),
    oauthTokenUrl: String(server.oauthTokenUrl ?? '').trim(),
    oauthClientId: String(server.oauthClientId ?? '').trim(),
    oauthClientSecretEnv: String(server.oauthClientSecretEnv ?? '').trim(),
    oauthScopes: String(server.oauthScopes ?? '').trim(),
    hasAuthToken: server.hasAuthToken === true,
    clearAuthToken: server.clearAuthToken === true,
    enabled: server.enabled !== false,
  }))
}

function createClientId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createMcpServer(source = {}) {
  return {
    id: createClientId('mcp'),
    presetId: String(source.presetId ?? '').trim(),
    name: String(source.name ?? '').trim() || 'Custom MCP',
    transport: ['http', 'sse', 'stdio'].includes(source.transport) ? source.transport : 'stdio',
    url: String(source.url ?? '').trim(),
    command: String(source.command ?? '').trim(),
    argsText: String(source.argsText ?? '').trim(),
    headersText: String(source.headersText ?? '').trim(),
    authType: ['none', 'bearer', 'oauth'].includes(source.authType) ? source.authType : 'none',
    authTokenEnv: String(source.authTokenEnv ?? '').trim(),
    authTokenSource: String(source.authTokenSource ?? '').trim(),
    authToken: String(source.authToken ?? ''),
    oauthAuthorizationUrl: String(source.oauthAuthorizationUrl ?? '').trim(),
    oauthTokenUrl: String(source.oauthTokenUrl ?? '').trim(),
    oauthClientId: String(source.oauthClientId ?? '').trim(),
    oauthClientSecretEnv: String(source.oauthClientSecretEnv ?? '').trim(),
    oauthScopes: String(source.oauthScopes ?? '').trim(),
    hasAuthToken: source.hasAuthToken === true,
    clearAuthToken: source.clearAuthToken === true,
    enabled: source.enabled !== false,
  }
}

function formatMcpSecretSource(source) {
  if (source === 'keychain') {
    return t('mcpSecretKeychain')
  }
  if (source === 'env') {
    return t('mcpSecretEnv')
  }
  if (source === 'config') {
    return t('mcpSecretConfig')
  }
  return ''
}

function ensureMcpSettingsState() {
  const servers = cloneMcpServers(state.settings)
  state.settings = {
    ...(state.settings ?? {}),
    mcp: {
      ...(state.settings?.mcp ?? {}),
      servers,
    },
  }
  return servers
}

function upsertMcpDiagnostic(diagnostic) {
  const current = [...(state.settings?.mcp?.diagnostics ?? [])]
  const index = current.findIndex(item => item.serverId === diagnostic.serverId)
  if (index >= 0) {
    current[index] = diagnostic
  } else {
    current.push(diagnostic)
  }
  return current
}

async function testMcpServerConnection(serverId) {
  const servers = ensureMcpSettingsState()
  const server = servers.find(item => item.id === serverId)
  if (!server) {
    return
  }

  setBusy(true, t('mcpTestConnection'))
  try {
    const result = await fetchJson('/api/mcp/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ server }),
    })

    const diagnostic = result.diagnostic
    const nextServers = result.mcp?.servers ?? servers
    state.settings = {
      ...state.settings,
      mcp: {
        ...(state.settings?.mcp ?? {}),
        servers: nextServers,
        diagnostics: diagnostic ? upsertMcpDiagnostic(diagnostic) : (state.settings?.mcp?.diagnostics ?? []),
      },
    }
    renderMcpDiagnostics(state.settings)
    renderMcpServers(state.settings)
    renderIntegrations(state.settings)
    setBusy(false, diagnostic?.ok ? t('mcpConnected') : t('mcpConnectionError'))
  } catch (error) {
    showError(error)
  }
}

async function startMcpOAuth(serverId) {
  const servers = ensureMcpSettingsState()
  const server = servers.find(item => item.id === serverId)
  if (!server) {
    return
  }

  server.authType = 'oauth'
  setBusy(true, t('mcpOauthStarting'))
  try {
    const result = await fetchJson('/api/mcp/oauth/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ server }),
    })
    if (!result.authorizationUrl) {
      throw new Error('OAuth start did not return an authorization URL')
    }
    await fetchJson('/api/open-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: result.authorizationUrl }),
    })
    state.pendingMcpOAuthRefresh = true
    setBusy(false, t('mcpOauthStarted'))
  } catch (error) {
    showError(error)
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
  syncTaskReminderState(tasks)

  const sessionMarkup = sessions.length
    ? sessions.map(session => renderSessionCardMarkup(session, {
        activeSessionId: state.sessionId,
        t,
        formatTimestamp: value => formatTimestamp(value, localeForUi()),
      })).join('')
    : `<div class="empty-card">${escapeHtml(t('noSessions'))}</div>`

  memorySessionsPanel.innerHTML = sessionMarkup
  drawerSessionsPanel.innerHTML = sessionMarkup

  memoryNotesPanel.innerHTML = notes.length
    ? notes.map(note => renderNoteCardMarkup(note, {
        formatTimestamp: value => formatTimestamp(value, localeForUi()),
      })).join('')
    : `<div class="empty-card">${escapeHtml(t('noNotes'))}</div>`

  scheduledTasksPanel.innerHTML = tasks.length
    ? tasks.map(task => renderTaskCardMarkup(task, { t })).join('')
    : `<div class="empty-card">${escapeHtml(t('noTasks'))}</div>`

  checkDueTasks()
}

function updateModelStatus() {
  const current = state.settings?.models?.find(model => model.id === modelSelect.value)
  if (!current) {
    modelStatus.textContent = t('modelNotSelected')
    runtimeSummary.textContent = t('runtimeWaiting')
    connectionSummary.textContent = t('noActiveModel')
    setHeaderSummary(headerModelSummary, t('headerModelLabel'), t('noActiveModel'), 'muted')
    sendButton.disabled = true
    setStatusIndicator(t('modelNotSelected'), 'muted')
    return
  }

  const readiness = current.available ? t('readyShort') : t('unavailableShort')
  modelStatus.textContent = `${current.id} ${readiness}`
  runtimeSummary.textContent = current.available
    ? `${formatAssistantProfileLabel(assistantProfileSelect.value)} · ${modeSelect.value.toUpperCase()} · ${agentToggle.checked ? `agent ${normalizeSteps(agentSteps.value)} step` : 'agent off'}`
    : current.availabilityMessage
    connectionSummary.textContent = `${current.id} · ${current.available ? t('online') : t('setupRequired')}`
  setHeaderSummary(
    headerModelSummary,
    t('headerModelLabel'),
    current.id,
    current.available ? 'online' : 'warning',
    `${current.id} · ${current.available ? t('online') : t('setupRequired')}`,
  )
  sendButton.disabled = !current.available
  setStatusIndicator(current.available ? t('ready') : t('setupRequired'), current.available ? 'ready' : 'warning')
}

function updateSessionIndicators() {
  const lastUserMessage = findLastUserMessage(state.history)
  const lastParsed = lastUserMessage ? parseMessageContent(lastUserMessage.content) : null
  const titleSource = lastParsed?.text ?? state.history.at(-1)?.content ?? t('newChat')
  chatTitle.textContent = summarizeTitle(titleSource, t('newChat'))
  activeSessionMeta.textContent = state.sessionId
    ? `${state.history.length} ${t('messagesLabel')} · ${state.sessionId.slice(0, 8)}…`
    : t('noMessagesYet')
  memorySessionBadge.textContent = state.sessionId
    ? `${t('sessionActive')} · ${state.sessionId.slice(0, 8)}…`
    : t('newSessionBadge')
  const workspacePath = state.settings?.workspaceDir || ''
  const workspaceDisplay = workspacePath
    ? summarizeWorkspacePath(workspacePath)
    : t('workspaceReady')
  workspaceSummary.textContent = workspacePath
    ? `${t('workspaceLabel')} · ${workspaceDisplay}`
    : t('workspaceReady')
  setHeaderSummary(
    headerWorkspaceSummary,
    t('workspaceLabel'),
    workspaceDisplay,
    workspacePath ? 'ready' : 'muted',
    workspacePath,
  )
  setHeaderSummary(
    headerSessionSummary,
    t('headerSessionLabel'),
    state.sessionId ? state.sessionId.slice(0, 8) : t('newSessionBadge'),
    state.sessionId ? 'ready' : 'muted',
    state.sessionId || '',
  )
}

async function refreshWorkspaceOutline() {
  try {
    state.workspaceOutline = await fetchJson('/api/workspace/outline')
  } catch {
    state.workspaceOutline = null
  }
  renderWorkspaceOutline()
  renderCommandPalette()
}

async function saveWorkspaceRoot() {
  const nextRoot = workspaceRootInput?.value?.trim()
  if (!nextRoot) {
    return
  }

  setBusy(true, t('workspaceRootSaving'))
  try {
    const result = await fetchJson('/api/workspace/root', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: nextRoot }),
    })
    state.settings = {
      ...(state.settings ?? {}),
      workspaceDir: result.workspaceDir,
    }
    state.workspaceOutline = result.outline ?? null
    closeWorkspaceFile()
    renderWorkspaceOutline()
    renderCommandPalette()
    renderHeaderContext()
    setBusy(false, t('workspaceRootSaved'))
  } catch (error) {
    showError(error)
  }
}

function renderWorkspaceOutline() {
  if (!workspaceOutlineRoot || !workspaceOutlineTree) {
    return
  }

  const root = state.workspaceOutline?.root || state.settings?.workspaceDir || '~'
  workspaceOutlineRoot.textContent = summarizeWorkspacePath(root)
  if (workspaceRootInput && document.activeElement !== workspaceRootInput) {
    workspaceRootInput.value = root
  }

  const nodes = state.workspaceOutline?.nodes ?? []
  workspaceOutlineTree.innerHTML = nodes.length
    ? `<div class="outline-tree">${renderOutlineNodes(nodes)}</div>`
    : `<div class="empty-card">${escapeHtml(t('workspaceOutlineEmpty'))}</div>`
  renderWorkspaceFileEditor()
}

function renderWorkspaceFileEditor() {
  if (!workspaceFileEditorShell || !workspaceFileInput || !workspaceFileTitle || !workspaceFileMeta) {
    return
  }

  const currentFile = state.workspaceFile ?? {}
  const hasFile = Boolean(currentFile.path)
  workspaceFileEditorShell.classList.toggle('hidden', !hasFile)
  if (!hasFile) {
    workspaceFileInput.value = ''
    workspaceFileTitle.textContent = t('workspaceFileEditorTitle')
    workspaceFileMeta.textContent = t('workspaceFileEditorCopy')
    return
  }

  workspaceFileTitle.textContent = currentFile.path
  workspaceFileMeta.textContent = currentFile.dirty
    ? t('workspaceFileDirty')
    : `${formatFileSize(currentFile.size)}${currentFile.modifiedAt ? ` · ${formatTimestamp(currentFile.modifiedAt)}` : ''}`

  if (document.activeElement !== workspaceFileInput && workspaceFileInput.value !== currentFile.content) {
    workspaceFileInput.value = currentFile.content
  }
}

async function loadWorkspaceFile(path) {
  const relativePath = String(path ?? '').trim()
  if (!relativePath) {
    return
  }

  setBusy(true, t('workspaceFileLoading'))
  try {
    const file = await fetchJson(`/api/workspace/file?path=${encodeURIComponent(relativePath)}`)
    state.workspaceFile = {
      path: file.path,
      content: file.content ?? '',
      dirty: false,
      size: file.size ?? 0,
      modifiedAt: file.modifiedAt ?? '',
    }
    openWorkspaceOutline()
    renderWorkspaceFileEditor()
    setBusy(false, file.path)
    window.requestAnimationFrame(() => workspaceFileInput?.focus())
  } catch (error) {
    setBusy(false, t('workspaceFileLoadError'), 'error')
    showError(error)
  }
}

function onWorkspaceFileInput(event) {
  state.workspaceFile = {
    ...(state.workspaceFile ?? {}),
    content: event.target.value,
    dirty: true,
  }
  renderWorkspaceFileEditor()
}

async function saveWorkspaceFile() {
  const currentFile = state.workspaceFile ?? {}
  if (!currentFile.path) {
    return
  }

  setBusy(true, t('workspaceFileSave'))
  try {
    const result = await fetchJson('/api/workspace/file', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: currentFile.path,
        content: currentFile.content ?? '',
      }),
    })
    state.workspaceFile = {
      ...currentFile,
      dirty: false,
      size: result.size ?? currentFile.size,
      modifiedAt: result.modifiedAt ?? currentFile.modifiedAt,
    }
    renderWorkspaceFileEditor()
    await refreshWorkspaceOutline()
    setBusy(false, t('workspaceFileSaved'))
  } catch (error) {
    showError(error)
  }
}

function closeWorkspaceFile() {
  state.workspaceFile = {
    path: '',
    content: '',
    dirty: false,
    size: 0,
    modifiedAt: '',
  }
  renderWorkspaceFileEditor()
}

function formatFileSize(size) {
  const value = Number(size)
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }
  if (value < 1024) {
    return `${Math.round(value)} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function renderOutlineNodes(nodes) {
  return nodes.map(node => {
    if (node.type === 'dir') {
      return `
        <details class="outline-node" open>
          <summary>
            <span class="outline-node-name">${escapeHtml(node.name)}</span>
            <span class="outline-node-path">${escapeHtml(node.relativePath || node.path)}</span>
          </summary>
          <div class="outline-node-children">
            ${renderOutlineNodes(node.children ?? [])}
          </div>
        </details>
      `
    }

    return `
      <button type="button" class="outline-file" data-outline-path="${escapeHtml(node.relativePath || node.path)}">
        <span class="outline-node-name">${escapeHtml(node.name)}</span>
        <span class="outline-node-path">${escapeHtml(node.relativePath || node.path)}</span>
      </button>
    `
  }).join('')
}

function flattenOutlineNodes(nodes, bucket = []) {
  for (const node of nodes ?? []) {
    bucket.push(node)
    if (Array.isArray(node.children) && node.children.length) {
      flattenOutlineNodes(node.children, bucket)
    }
  }
  return bucket
}

function toggleWorkspaceOutline() {
  state.outlineOpen = !state.outlineOpen
  syncOutlineLayout()
}

function openWorkspaceOutline() {
  state.outlineOpen = true
  syncOutlineLayout()
}

function closeWorkspaceOutline() {
  state.outlineOpen = false
  syncOutlineLayout()
}

function syncOutlineLayout() {
  if (workspaceOutline) {
    workspaceOutline.classList.toggle('hidden', !state.outlineOpen)
  }
  if (shell) {
    shell.dataset.outlineOpen = String(state.outlineOpen)
  }
  if (toggleOutlineButton) {
    toggleOutlineButton.classList.toggle('is-active', state.outlineOpen)
    toggleOutlineButton.setAttribute('aria-label', t('workspaceOutlineOpen'))
    toggleOutlineButton.setAttribute('title', t('workspaceOutlineOpen'))
  }
}

function insertPathIntoComposer(path) {
  const nextValue = String(path ?? '').trim()
  if (!nextValue) {
    return
  }

  promptInput.value = promptInput.value.trim()
    ? `${promptInput.value.trim()}\n${nextValue}`
    : nextValue
  resizeComposerInput()
  promptInput.focus()
  setStatusIndicator(t('insertedPath'), 'ready')
}

function openCommandPalette(query = '') {
  state.commandPaletteOpen = true
  state.commandPaletteQuery = query
  syncCommandPalette()
}

function closeCommandPalette() {
  state.commandPaletteOpen = false
  syncCommandPalette()
}

function syncCommandPalette() {
  if (!commandPaletteOverlay) {
    return
  }

  if (commandPaletteButton) {
    commandPaletteButton.setAttribute('aria-label', t('commandPaletteOpen'))
    commandPaletteButton.setAttribute('title', t('commandPaletteOpen'))
  }
  commandPaletteOverlay.classList.toggle('hidden', !state.commandPaletteOpen)
  if (commandPaletteInput) {
    commandPaletteInput.value = state.commandPaletteQuery
  }
  renderCommandPalette()

  if (state.commandPaletteOpen) {
    window.requestAnimationFrame(() => {
      commandPaletteInput?.focus()
      commandPaletteInput?.select()
    })
  }
}

function renderCommandPalette() {
  if (!commandPaletteResults) {
    return
  }

  const query = state.commandPaletteQuery.trim().toLowerCase()
  const sections = buildCommandPaletteSections(query)
  const visibleSections = sections.filter(section => section.items.length)

  if (!visibleSections.length) {
    commandPaletteResults.innerHTML = `<div class="empty-card">${escapeHtml(t('commandPaletteEmpty'))}</div>`
    return
  }

  commandPaletteResults.innerHTML = visibleSections.map(section => `
    <section class="command-palette-section">
      <div class="command-palette-section-title">${escapeHtml(section.title)}</div>
      <div class="command-palette-list">
        ${section.items.map((item, index) => `
          <button type="button" class="command-palette-item" data-command-kind="${escapeHtml(item.kind)}" data-command-value="${escapeHtml(item.value)}" ${index === 0 ? 'data-command-default="true"' : ''}>
            <span class="command-palette-item-title">${escapeHtml(item.title)}</span>
            <span class="command-palette-item-meta">${escapeHtml(item.meta)}</span>
          </button>
        `).join('')}
      </div>
    </section>
  `).join('')
}

function buildCommandPaletteSections(query) {
  const actions = [
    { value: 'new-chat', title: t('commandPaletteActionNewChat'), meta: t('newChat') },
    { value: 'settings', title: t('commandPaletteActionSettings'), meta: t('settings') },
    { value: 'activity', title: t('commandPaletteActionActivity'), meta: t('activity') },
    { value: 'outline', title: t('commandPaletteActionOutline'), meta: t('workspaceOutlineTitle') },
    { value: 'providers', title: t('commandPaletteActionProviders'), meta: t('localLabel') },
    { value: 'extensions', title: t('commandPaletteActionExtensions'), meta: t('extensionsTab') },
    { value: 'automation', title: t('commandPaletteActionAutomation'), meta: t('automationTab') },
    { value: 'composer', title: t('commandPaletteActionFocusComposer'), meta: '⌘↩' },
  ]
    .filter(item => matchesCommandQuery(item, query))
    .map(item => ({ ...item, kind: 'action' }))

  const chats = (state.settings?.sessions ?? [])
    .map(session => ({
      kind: 'chat',
      value: session.sessionId,
      title: summarizeTitle(session.preview, t('newChat')),
      meta: session.sessionId.slice(0, 8),
    }))
    .filter(item => matchesCommandQuery(item, query))
    .slice(0, 6)

  const files = flattenOutlineNodes(state.workspaceOutline?.nodes ?? [])
    .filter(node => node.type === 'file')
    .map(node => ({
      kind: 'file',
      value: node.relativePath || node.path,
      title: node.name,
      meta: node.relativePath || node.path,
    }))
    .filter(item => matchesCommandQuery(item, query))
    .slice(0, 10)

  return [
    { title: t('commandPaletteSectionActions'), items: actions },
    { title: t('commandPaletteSectionChats'), items: chats },
    { title: t('commandPaletteSectionFiles'), items: files },
  ]
}

function matchesCommandQuery(item, query) {
  if (!query) {
    return true
  }
  const haystack = `${item.title} ${item.meta} ${item.value}`.toLowerCase()
  return haystack.includes(query)
}

async function handleCommandPaletteSelection(kind, value) {
  if (kind === 'action') {
    if (value === 'new-chat') {
      onClear()
    } else if (value === 'settings') {
      openSettingsDrawer({ drawerTab: 'general' })
    } else if (value === 'activity') {
      openActivityDrawer()
    } else if (value === 'outline') {
      toggleWorkspaceOutline()
    } else if (value === 'providers') {
      openSettingsDrawer({ drawerTab: 'general', providerTab: 'local', scrollToProviders: true })
    } else if (value === 'extensions') {
      openSettingsDrawer({ drawerTab: 'extensions' })
    } else if (value === 'automation') {
      openSettingsDrawer({ drawerTab: 'automation' })
    } else if (value === 'composer') {
      promptInput.focus()
    }
    closeCommandPalette()
    return
  }

  if (kind === 'chat') {
    closeCommandPalette()
    await loadSessionById(value)
    return
  }

  if (kind === 'file') {
    closeCommandPalette()
    await loadWorkspaceFile(value)
  }
}

function onCommandPaletteClick(event) {
  const button = event.target.closest('[data-command-kind]')
  if (!button) {
    return
  }

  void handleCommandPaletteSelection(button.dataset.commandKind, button.dataset.commandValue)
}

function onCommandPaletteKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeCommandPalette()
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const firstItem = commandPaletteResults?.querySelector('[data-command-kind]')
    if (firstItem) {
      void handleCommandPaletteSelection(firstItem.dataset.commandKind, firstItem.dataset.commandValue)
    }
  }
}

function onWorkspaceOutlineClick(event) {
  const button = event.target.closest('[data-outline-path]')
  if (!button) {
    return
  }

  void loadWorkspaceFile(button.dataset.outlinePath)
}

function onGlobalKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (state.commandPaletteOpen) {
      closeCommandPalette()
    } else {
      openCommandPalette()
    }
    return
  }

  if (event.key === 'Escape' && state.commandPaletteOpen) {
    event.preventDefault()
    closeCommandPalette()
  }
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
  const timeLabel = meta.createdAt ? formatClock(meta.createdAt, localeForUi()) : ''
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
      <div class="message-time">${escapeHtml(formatClock(new Date().toISOString(), localeForUi()))}</div>
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
            <span>${escapeHtml(formatClock(item.createdAt, localeForUi()))}</span>
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
    await refreshWorkspaceOutline()
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
  setStatusIndicator(t('visionSelected', { model: fallback.id }), 'ready')
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
  if (window.matchMedia('(max-width: 980px)').matches) {
    closeSettingsDrawer()
  }
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
    mcp: {
      servers: cloneMcpServers(state.settings),
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
  setStatusIndicator(label, isBusy ? 'busy' : 'ready')
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
    if (result.model && [...modelSelect.options].some(option => option.value === result.model)) {
      modelSelect.value = result.model
      updateModelStatus()
    }

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
    const routeLabel = result.route && result.route !== 'general' ? ` · ${result.route}` : ''
    const autoLabel = result.autoSelectedModel ? ' · auto' : ''
    setBusy(false, `${t('ready')} · ${result.model}${routeLabel}${autoLabel}`)
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

function showConfirmDialog({ title, message }) {
  if (!confirmOverlay || !confirmTitle || !confirmMessage) {
    return Promise.resolve(window.confirm(message || title || 'Confirm'))
  }

  if (confirmDialogResolve) {
    resolveConfirmDialog(false)
  }

  confirmTitle.textContent = title
  confirmMessage.textContent = message
  confirmOverlay.classList.remove('hidden')

  return new Promise(resolve => {
    confirmDialogResolve = resolve
  })
}

function resolveConfirmDialog(approved) {
  if (confirmOverlay) {
    confirmOverlay.classList.add('hidden')
  }

  const resolve = confirmDialogResolve
  confirmDialogResolve = null
  if (resolve) {
    resolve(Boolean(approved))
  }
}

function openTaskEditor(task) {
  if (!taskEditorOverlay || !taskEditorForm) {
    return Promise.resolve(null)
  }

  if (taskEditorResolve) {
    closeTaskEditor()
  }

  taskEditorForm.dataset.taskId = task.taskId
  taskEditorTitleInput.value = task.title ?? ''
  taskEditorGoalInput.value = task.goal ?? ''
  taskEditorConstraintsInput.value = task.constraints ?? ''
  taskEditorDueInput.value = toDateTimeLocalValue(task.delivery)
  taskEditorCompletionInput.value = task.completion ?? ''
  taskEditorOverlay.classList.remove('hidden')
  taskEditorTitleInput.focus()
  taskEditorTitleInput.select()

  return new Promise(resolve => {
    taskEditorResolve = resolve
  })
}

function closeTaskEditor(result = null) {
  if (taskEditorOverlay) {
    taskEditorOverlay.classList.add('hidden')
  }
  if (taskEditorForm) {
    taskEditorForm.dataset.taskId = ''
  }

  const resolve = taskEditorResolve
  taskEditorResolve = null
  if (resolve) {
    resolve(result)
  }
}

async function onTaskEditorSubmit(event) {
  event.preventDefault()

  const title = taskEditorTitleInput.value.trim()
  if (!title) {
    showError(t('taskTitleRequired'))
    taskEditorTitleInput.focus()
    return
  }

  closeTaskEditor({
    title,
    goal: taskEditorGoalInput.value.trim(),
    constraints: taskEditorConstraintsInput.value.trim(),
    delivery: fromDateTimeLocalValue(taskEditorDueInput.value),
    completion: taskEditorCompletionInput.value.trim(),
  })
}

function toDateTimeLocalValue(value) {
  return String(value ?? '').trim().replace(' ', 'T')
}

function fromDateTimeLocalValue(value) {
  return String(value ?? '').trim().replace('T', ' ')
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

function removeSessionFromLocalState(sessionId) {
  if (!state.settings) {
    return
  }

  state.settings = {
    ...state.settings,
    sessions: (state.settings.sessions ?? []).filter(session => session.sessionId !== sessionId),
    notes: (state.settings.notes ?? []).filter(note => note.sessionId !== sessionId),
    tasks: (state.settings.tasks ?? []).filter(task => task.sessionId !== sessionId),
  }
  renderMemory(state.settings)
}

function removeTaskFromLocalState(taskId) {
  if (!state.settings) {
    return
  }

  state.settings = {
    ...state.settings,
    tasks: (state.settings.tasks ?? []).filter(task => task.taskId !== taskId),
  }
  renderMemory(state.settings)
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

    const session = (state.settings?.sessions ?? []).find(item => item.sessionId === sessionId)
    const confirmed = await showConfirmDialog({
      title: t('deleteChatConfirmTitle'),
      message: t('deleteChatConfirmBody', {
        title: summarizeTitle(session?.preview, t('newChat')),
      }),
    })
    if (!confirmed) {
      return
    }

    setBusy(true, t('deletingChat'))
    try {
      await fetchJson(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      })
      removeSessionFromLocalState(sessionId)

      if (state.sessionId === sessionId) {
        onClear()
      }

      await refreshMemoryData()
      setBusy(false, t('deletedChat'))
    } catch (error) {
      await refreshMemoryData()
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

  await loadSessionById(sessionId)
}

async function loadSessionById(sessionId) {
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
  const editButton = event.target.closest('[data-edit-task-id]')
  if (editButton) {
    event.preventDefault()
    event.stopPropagation()

    const taskId = editButton.dataset.editTaskId
    const task = (state.settings?.tasks ?? []).find(item => item.taskId === taskId)
    if (!task) {
      return
    }

    const payload = await openTaskEditor(task)
    if (!payload) {
      return
    }

    setBusy(true, t('editingTask'))
    try {
      await fetchJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      state.remindedTaskIds.delete(taskId)
      await refreshMemoryData()
      setBusy(false, t('taskUpdated'))
    } catch (error) {
      await refreshMemoryData()
      showError(error)
    }
    return
  }

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

  const task = (state.settings?.tasks ?? []).find(item => item.taskId === taskId)
  const confirmed = await showConfirmDialog({
    title: t('deleteTaskConfirmTitle'),
    message: t('deleteTaskConfirmBody', {
      title: summarizeTitle(task?.title, t('newTask')),
    }),
  })
  if (!confirmed) {
    return
  }

  setBusy(true, t('deletingTask'))
  try {
    await fetchJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
    })
    removeTaskFromLocalState(taskId)
    state.remindedTaskIds.delete(taskId)
    await refreshMemoryData()
    setBusy(false, t('deletedTask'))
  } catch (error) {
    await refreshMemoryData()
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

async function onSettingsDrawerActionClick(event) {
  const guideAction = event.target.closest('[data-guide-action]')
  if (guideAction) {
    const action = guideAction.dataset.guideAction
    if (action === 'providers') {
      openSettingsDrawer({ drawerTab: 'general', providerTab: 'local', scrollToProviders: true })
      return
    }
    if (action === 'automation') {
      openSettingsDrawer({ drawerTab: 'automation' })
      return
    }
  }

  const mcpAction = event.target.closest('[data-mcp-action]')
  if (mcpAction) {
    event.preventDefault()
    const action = mcpAction.dataset.mcpAction
    const servers = ensureMcpSettingsState()

    if (action === 'add-server') {
      servers.push(createMcpServer({
        name: 'Custom MCP',
        transport: 'stdio',
        enabled: false,
      }))
    }

    if (action === 'add-preset') {
      const presetId = mcpAction.dataset.mcpPreset
      const preset = presetId ? MCP_PRESETS[presetId] : null
      if (preset) {
        const existing = servers.find(server => server.presetId === preset.id)
        if (existing) {
          existing.name ||= preset.name
          existing.transport = existing.transport || preset.transport
          existing.url ||= preset.url ?? ''
          existing.command ||= preset.command ?? ''
          existing.argsText ||= preset.argsText ?? ''
          existing.headersText ||= preset.headersText ?? ''
          existing.authType ||= preset.authType ?? 'none'
          existing.authTokenEnv ||= preset.authTokenEnv ?? ''
          existing.oauthAuthorizationUrl ||= preset.oauthAuthorizationUrl ?? ''
          existing.oauthTokenUrl ||= preset.oauthTokenUrl ?? ''
          existing.oauthClientId ||= preset.oauthClientId ?? ''
          existing.oauthClientSecretEnv ||= preset.oauthClientSecretEnv ?? ''
          existing.oauthScopes ||= preset.oauthScopes ?? ''
          existing.enabled = true
        } else {
          servers.push(createMcpServer({
            presetId: preset.id,
            name: preset.name,
            transport: preset.transport,
            url: preset.url ?? '',
            command: preset.command ?? '',
            argsText: preset.argsText ?? '',
            headersText: preset.headersText ?? '',
            authType: preset.authType ?? 'none',
            authTokenEnv: preset.authTokenEnv ?? '',
            oauthAuthorizationUrl: preset.oauthAuthorizationUrl ?? '',
            oauthTokenUrl: preset.oauthTokenUrl ?? '',
            oauthClientId: preset.oauthClientId ?? '',
            oauthClientSecretEnv: preset.oauthClientSecretEnv ?? '',
            oauthScopes: preset.oauthScopes ?? '',
            enabled: true,
          }))
        }
      }
    }

    if (action === 'remove-server') {
      const index = Number(mcpAction.dataset.mcpIndex)
      if (Number.isFinite(index) && index >= 0) {
        servers.splice(index, 1)
      }
    }

    if (action === 'clear-token') {
      const index = Number(mcpAction.dataset.mcpIndex)
      if (Number.isFinite(index) && index >= 0 && servers[index]) {
        servers[index].authToken = ''
        servers[index].hasAuthToken = false
        servers[index].authTokenSource = ''
        servers[index].clearAuthToken = true
      }
    }

    if (action === 'test-server') {
      const serverId = mcpAction.dataset.mcpId
      if (serverId) {
        await testMcpServerConnection(serverId)
      }
      return
    }

    if (action === 'start-oauth') {
      const serverId = mcpAction.dataset.mcpId
      if (serverId) {
        await startMcpOAuth(serverId)
      }
      return
    }

    state.settings = {
      ...state.settings,
      mcp: {
        ...(state.settings?.mcp ?? {}),
        servers,
      },
    }
    renderMcpDiagnostics(state.settings)
    renderMcpServers(state.settings)
    renderIntegrations(state.settings)
    return
  }

  const billingAction = event.target.closest('[data-billing-action]')
  if (billingAction) {
    event.preventDefault()
    const action = billingAction.dataset.billingAction
    if (action === 'start-trial') {
      await startBillingTrial()
      return
    }
    if (action === 'open-card') {
      await openCardCheckout(billingAction.dataset.planId)
      return
    }
    if (action === 'create-crypto-payment') {
      await createBillingCryptoPayment()
      return
    }
    if (action === 'refresh-payment') {
      await refreshBillingPayment(billingAction.dataset.paymentId)
      return
    }
    if (action === 'simulate-payment') {
      await simulateBillingPayment(billingAction.dataset.paymentId)
      return
    }
    if (action === 'claim-payment') {
      await claimBillingPayment(billingAction.dataset.paymentId)
      return
    }
  }

  const copyAction = event.target.closest('[data-copy-value]')
  if (copyAction) {
    event.preventDefault()
    await copyBillingValue(copyAction.dataset.copyValue || '')
    return
  }

  const externalAction = event.target.closest('[data-open-url]')
  if (!externalAction) {
    return
  }

  const url = externalAction.dataset.openUrl
  if (!url) {
    return
  }

  event.preventDefault()
  try {
    await fetchJson('/api/open-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    setBusy(false, t('ready'))
  } catch (error) {
    showError(error)
  }
}

function onSettingsDrawerInput(event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }

  const mcpField = target.closest('[data-mcp-field]')
  if (
    mcpField &&
    (mcpField instanceof HTMLInputElement || mcpField instanceof HTMLSelectElement || mcpField instanceof HTMLTextAreaElement)
  ) {
    const wrapper = mcpField.closest('[data-mcp-index]')
    const index = Number(wrapper?.dataset.mcpIndex)
    if (Number.isFinite(index)) {
      const servers = ensureMcpSettingsState()
      const server = servers[index]
      if (server) {
        const field = mcpField.dataset.mcpField
        if (field === 'enabled') {
          server.enabled = mcpField instanceof HTMLInputElement ? mcpField.checked : Boolean(mcpField.value)
          renderMcpDiagnostics(state.settings)
          renderMcpServers(state.settings)
          renderIntegrations(state.settings)
          return
        }

        if (field) {
          server[field] = mcpField.value
          if (field === 'authToken') {
            server.hasAuthToken = Boolean(mcpField.value.trim()) || server.hasAuthToken
            server.clearAuthToken = false
          }
          if (field === 'authTokenEnv') {
            server.authTokenSource = mcpField.value.trim() ? 'env' : server.authTokenSource
          }
          if (field === 'transport' || field === 'authType') {
            renderMcpDiagnostics(state.settings)
            renderMcpServers(state.settings)
            renderIntegrations(state.settings)
            return
          }
        }
      }
    }
    return
  }

  const form = target.closest('[data-billing-form]')
  if (!form) {
    return
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
    const { name, value } = target
    if (name && Object.hasOwn(state.billingDraft, name)) {
      state.billingDraft[name] = value
      if (name === 'networkId') {
        const selectedNetwork = state.settings?.billing?.networks?.find(network => network.id === value)
        const firstAsset = selectedNetwork?.assets?.[0]?.id ?? 'usdc'
        if (!(selectedNetwork?.assets ?? []).some(asset => asset.id === state.billingDraft.assetId)) {
          state.billingDraft.assetId = firstAsset
        }
        state.billingDraft.cryptoCurrency = state.billingDraft.assetId
        renderBilling(state.settings ?? {})
        return
      }
      if (name === 'assetId') {
        state.billingDraft.cryptoCurrency = value
        renderBilling(state.settings ?? {})
        return
      }
    }
  }
}

async function onSettingsDrawerSubmit(event) {
  const form = event.target.closest?.('[data-billing-form]')
  if (!form) {
    return
  }

  event.preventDefault()
  const type = form.dataset.billingForm
  if (type === 'activate') {
    await activateBillingLicense()
    return
  }
  if (type === 'crypto') {
    await createBillingCryptoPayment()
    return
  }
  if (type === 'verify-payment') {
    const paymentId = form.dataset.paymentId
    const txHashInput = form.querySelector('input[name="txHash"]')
    await verifyBillingTransfer(paymentId, txHashInput?.value ?? '')
  }
}

async function startBillingTrial() {
  setBusy(true, t('billingTrialStarted'))
  try {
    const result = await fetchJson('/api/billing/trial/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deviceName: state.billingDraft.deviceName,
      }),
    })
    await applyBillingResult(result)
    setBusy(false, t('billingTrialStarted'))
  } catch (error) {
    showError(error)
  }
}

async function activateBillingLicense() {
  setBusy(true, t('billingActivating'))
  try {
    const result = await fetchJson('/api/billing/activate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: state.billingDraft.email,
        deviceName: state.billingDraft.deviceName,
        licenseKey: state.billingDraft.licenseKey,
      }),
    })
    state.billingDraft.licenseKey = ''
    await applyBillingResult(result)
    setBusy(false, t('billingActivated'))
  } catch (error) {
    showError(error)
  }
}

async function openCardCheckout(planId) {
  if (!planId) {
    return
  }

  setBusy(true, t('billingOpeningCheckout'))
  try {
    const result = await fetchJson('/api/billing/checkout/card', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId }),
    })
    state.billingDraft.cardPlanId = planId
    await fetchJson('/api/open-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: result.url }),
    })
    setBusy(false, t('ready'))
  } catch (error) {
    showError(error)
  }
}

async function createBillingCryptoPayment() {
  setBusy(true, t('billingStartingCrypto'))
  try {
    const result = await fetchJson('/api/billing/checkout/crypto', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        planId: state.billingDraft.cryptoPlanId,
        networkId: state.billingDraft.networkId,
        assetId: state.billingDraft.assetId,
        email: state.billingDraft.email,
        deviceName: state.billingDraft.deviceName,
        payerAddress: state.billingDraft.payerAddress,
      }),
    })
    await applyBillingResult(result)
    const latestPayment = result.billing?.payments?.[0]
    if (latestPayment?.payUrl) {
      await fetchJson('/api/open-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: latestPayment.payUrl }),
      })
    }
    setBusy(false, t('billingCryptoReady'))
  } catch (error) {
    showError(error)
  }
}

async function verifyBillingTransfer(paymentId, txHash) {
  if (!paymentId || !String(txHash).trim()) {
    showError(new Error(t('billingTxHashRequired')))
    return
  }

  setBusy(true, t('billingVerifyingTransfer'))
  try {
    const result = await fetchJson(`/api/billing/payments/${encodeURIComponent(paymentId)}/verify-transfer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        txHash,
        payerAddress: state.billingDraft.payerAddress,
      }),
    })
    state.billingDraft.txHash = ''
    await applyBillingResult(result)
    setBusy(false, t('billingTransferVerified'))
  } catch (error) {
    showError(error)
  }
}

async function copyBillingValue(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    setBusy(false, t('billingCopied'))
  } catch (error) {
    showError(error)
  }
}

async function refreshBillingPayment(paymentId) {
  if (!paymentId) {
    return
  }

  setBusy(true, t('billingRefreshingPayment'))
  try {
    const result = await fetchJson(`/api/billing/payments/${encodeURIComponent(paymentId)}/refresh`, {
      method: 'POST',
    })
    await applyBillingResult(result)
    setBusy(false, t('billingPaymentUpdated'))
  } catch (error) {
    showError(error)
  }
}

async function simulateBillingPayment(paymentId) {
  if (!paymentId) {
    return
  }

  setBusy(true, t('billingRefreshingPayment'))
  try {
    const result = await fetchJson(`/api/billing/payments/${encodeURIComponent(paymentId)}/simulate-finish`, {
      method: 'POST',
    })
    await applyBillingResult(result)
    setBusy(false, t('billingPaymentUpdated'))
  } catch (error) {
    showError(error)
  }
}

async function claimBillingPayment(paymentId) {
  if (!paymentId) {
    return
  }

  setBusy(true, t('billingClaimingLicense'))
  try {
    state.billingClaimingPaymentIds.add(paymentId)
    const result = await fetchJson(`/api/billing/payments/${encodeURIComponent(paymentId)}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: state.billingDraft.email,
        deviceName: state.billingDraft.deviceName,
      }),
    })
    await applyBillingResult(result)
    setBusy(false, t('billingClaimed'))
  } catch (error) {
    showError(error)
  } finally {
    state.billingClaimingPaymentIds.delete(paymentId)
  }
}

async function applyBillingResult(result) {
  if (!result?.billing || !state.settings) {
    return
  }
  state.settings = {
    ...state.settings,
    billing: result.billing,
  }
  renderBilling(state.settings)
}

async function maybeAutoClaimLatestPayment(billing) {
  const payment = (billing?.payments ?? []).find(item => item.claimable)
  if (!payment || state.billingClaimingPaymentIds.has(payment.providerPaymentId)) {
    return
  }

  const draftEmail = String(state.billingDraft.email ?? '').trim().toLowerCase()
  const paymentEmail = String(payment.email ?? '').trim().toLowerCase()
  if (draftEmail && paymentEmail && draftEmail !== paymentEmail) {
    return
  }

  state.billingClaimingPaymentIds.add(payment.providerPaymentId)
  try {
    const result = await fetchJson(`/api/billing/payments/${encodeURIComponent(payment.providerPaymentId)}/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: state.billingDraft.email,
        deviceName: state.billingDraft.deviceName,
      }),
    })
    await applyBillingResult(result)
  } catch {
    // Ignore automatic claim failures and keep the explicit action visible.
  } finally {
    state.billingClaimingPaymentIds.delete(payment.providerPaymentId)
  }
}

function toggleChatsSection() {
  state.chatsExpanded = !state.chatsExpanded
  syncChatsSectionUi()
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed
  syncShellLayout()
}

function syncShellLayout() {
  if (shell) {
    shell.dataset.sidebarCollapsed = String(state.sidebarCollapsed)
  }
  if (sidebar) {
    sidebar.dataset.collapsed = String(state.sidebarCollapsed)
  }
  if (sidebarToggleButton) {
    const label = state.sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')
    sidebarToggleButton.setAttribute('aria-label', label)
    sidebarToggleButton.setAttribute('title', label)
    sidebarToggleButton.classList.toggle('is-active', state.sidebarCollapsed)
  }
  if (clearButton) {
    clearButton.setAttribute('title', t('newChat'))
  }
}

function syncChatsSectionUi() {
  if (!chatsSection || !toggleChatsButton) {
    return
  }

  chatsSection.classList.toggle('is-collapsed', !state.chatsExpanded)
  toggleChatsButton.innerHTML = state.chatsExpanded
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5"></path></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 5.5 4.5 4.5-4.5 4.5"></path></svg>'
  toggleChatsButton.setAttribute('aria-expanded', String(state.chatsExpanded))
  toggleChatsButton.setAttribute('aria-label', state.chatsExpanded ? t('collapseChats') : t('expandChats'))
}

function toggleHeaderBar() {
  state.headerMinimized = !state.headerMinimized
  syncHeaderLayout()
}

function syncHeaderLayout() {
  if (chatHeader) {
    chatHeader.dataset.minimized = String(state.headerMinimized)
  }
  if (toggleHeaderButton) {
    const label = state.headerMinimized ? t('restoreTopBar') : t('minimizeTopBar')
    toggleHeaderButton.setAttribute('aria-label', label)
    toggleHeaderButton.setAttribute('title', label)
    toggleHeaderButton.classList.toggle('is-active', state.headerMinimized)
  }
}

function toggleDrawerSize() {
  state.drawerExpanded = !state.drawerExpanded
  syncDrawerLayout()
}

function syncDrawerLayout() {
  if (settingsDrawer) {
    settingsDrawer.dataset.size = state.drawerExpanded ? 'wide' : 'compact'
  }
  if (settingsSizeButton) {
    settingsSizeButton.textContent = state.drawerExpanded ? '−' : '+'
    settingsSizeButton.setAttribute('aria-label', state.drawerExpanded ? t('shrinkPanel') : t('expandPanel'))
    settingsSizeButton.setAttribute('title', state.drawerExpanded ? t('shrinkPanel') : t('expandPanel'))
  }
  if (shell) {
    shell.dataset.drawerExpanded = String(state.drawerExpanded)
  }
}

function startReminderLoop() {
  if (state.reminderTimer) {
    window.clearInterval(state.reminderTimer)
  }

  checkDueTasks()
  state.reminderTimer = window.setInterval(() => {
    checkDueTasks()
  }, 30_000)
}

function syncTaskReminderState(tasks) {
  const activeTaskIds = new Set()
  const now = Date.now()

  for (const task of tasks) {
    if (!task?.taskId) {
      continue
    }

    activeTaskIds.add(task.taskId)
    const dueAt = parseDeliveryDate(task.delivery)
    if (!dueAt || dueAt.getTime() > now) {
      state.remindedTaskIds.delete(task.taskId)
    }
  }

  for (const taskId of Array.from(state.remindedTaskIds)) {
    if (!activeTaskIds.has(taskId)) {
      state.remindedTaskIds.delete(taskId)
    }
  }
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
  setStatusIndicator(t('reminderTriggered', { title: summarizeTitle(task.title, t('newChat')) }), 'warning')
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
  syncDrawerLayout()

  if (options.scrollToProviders) {
    window.requestAnimationFrame(() => {
      providersSection?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }
}

function maybeShowFirstRunGuide() {
  if (!state.settings) {
    return
  }

  const hasHistory = (state.settings.sessions?.length ?? 0) > 0
    || (state.settings.notes?.length ?? 0) > 0
    || (state.settings.tasks?.length ?? 0) > 0

  try {
    if (!hasHistory && !window.localStorage.getItem(FIRST_RUN_GUIDE_KEY)) {
      window.localStorage.setItem(FIRST_RUN_GUIDE_KEY, '1')
      openSettingsDrawer({ drawerTab: 'general' })
      setStatusIndicator(t('quickStartCopy'), 'muted')
    }
  } catch {
    if (!hasHistory) {
      openSettingsDrawer({ drawerTab: 'general' })
      setStatusIndicator(t('quickStartCopy'), 'muted')
    }
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

async function fetchJson(url, init) {
  const response = await fetch(url, init)
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

function formatAssistantProfileLabel(value) {
  return value === 'business-copilot' ? t('businessCopilot') : t('generalAssistant')
}
