export function createInitialState() {
  return {
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
    chatsExpanded: true,
    drawerExpanded: false,
  }
}
