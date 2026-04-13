import { escapeHtml, getTaskStatusLabel, getTaskTimingState } from './utils.js'

export function renderBillingPanelMarkup(billing, { draft, t, formatTimestamp }) {
  const entitlement = billing?.entitlement ?? { status: 'inactive' }
  const activation = billing?.activation ?? { status: 'inactive' }
  const cardPlans = billing?.plans?.card ?? []
  const cryptoPlans = billing?.plans?.crypto ?? []
  const cryptoNetworks = billing?.networks ?? []
  const cryptoMode = billing?.environment?.crypto?.mode ?? 'sandbox'
  const latestPayment = (billing?.payments ?? [])[0] ?? null
  const currentCryptoPlan = cryptoPlans.find(plan => plan.id === draft.cryptoPlanId) ?? cryptoPlans[0] ?? null
  const currentNetwork = cryptoNetworks.find(network => network.id === draft.networkId) ?? cryptoNetworks[0] ?? null
  const currentAsset = currentNetwork?.assets?.find(asset => asset.id === draft.assetId) ?? currentNetwork?.assets?.[0] ?? null
  const paymentMarkup = latestPayment ? renderLatestPaymentMarkup(latestPayment, { t, formatTimestamp, sandboxMode: billing?.environment?.crypto?.sandboxMode === true }) : ''

  return `
    <div class="billing-shell">
      <div class="billing-status-card">
        <div class="billing-status-head">
          <div>
            <div class="section-title">${escapeHtml(t('billingStatusTitle'))}</div>
            <strong>${escapeHtml(getEntitlementLabel(entitlement.status, t))}</strong>
          </div>
          <span class="billing-status-pill ${escapeHtml(entitlement.status)}">${escapeHtml(getEntitlementPill(entitlement.status, t))}</span>
        </div>
        <p class="billing-copy">${escapeHtml(getEntitlementCopy(entitlement, activation, t))}</p>
        <div class="billing-summary-grid">
          <div class="billing-summary-item">
            <span>${escapeHtml(t('billingDeviceLabel'))}</span>
            <strong>${escapeHtml(billing?.device?.name ?? draft.deviceName)}</strong>
          </div>
          <div class="billing-summary-item">
            <span>${escapeHtml(t('billingEmailLabel'))}</span>
            <strong>${escapeHtml(activation.email || latestPayment?.email || draft.email || t('billingUnset'))}</strong>
          </div>
          <div class="billing-summary-item">
            <span>${escapeHtml(t('billingPlanLabel'))}</span>
            <strong>${escapeHtml(entitlement.planLabel || activation.planLabel || t('billingUnset'))}</strong>
          </div>
          <div class="billing-summary-item">
            <span>${escapeHtml(t('billingExpiryLabel'))}</span>
            <strong>${escapeHtml(entitlement.expiresAt ? formatTimestamp(entitlement.expiresAt) : entitlement.trialExpiresAt ? formatTimestamp(entitlement.trialExpiresAt) : t('billingUnset'))}</strong>
          </div>
        </div>
      </div>

      <form class="billing-form-card" data-billing-form="activate">
        <div class="section-title">${escapeHtml(t('billingActivateTitle'))}</div>
        <p class="billing-copy">${escapeHtml(t('billingActivateCopy'))}</p>
        <div class="field-grid">
          <label class="field">
            <span>${escapeHtml(t('billingEmailLabel'))}</span>
            <input type="email" name="email" value="${escapeHtml(draft.email)}" placeholder="you@example.com" />
          </label>
          <label class="field">
            <span>${escapeHtml(t('billingDeviceLabel'))}</span>
            <input type="text" name="deviceName" value="${escapeHtml(draft.deviceName)}" placeholder="MacBook Air" />
          </label>
          <label class="field">
            <span>${escapeHtml(t('billingLicenseKeyLabel'))}</span>
            <input type="text" name="licenseKey" value="${escapeHtml(draft.licenseKey)}" placeholder="MODAI-XXXX-XXXX-XXXX" autocomplete="off" />
          </label>
        </div>
        <div class="billing-actions">
          <button type="button" class="secondary" data-billing-action="start-trial" ${billing?.trial?.eligible ? '' : 'disabled'}>${escapeHtml(t('billingStartTrial'))}</button>
          <button type="submit" class="primary">${escapeHtml(t('billingActivateButton'))}</button>
        </div>
      </form>

      <div class="billing-rail-grid">
        <section class="billing-form-card">
          <div class="section-title">${escapeHtml(t('billingCardRailTitle'))}</div>
          <p class="billing-copy">${escapeHtml(t('billingCardRailCopy'))}</p>
          <div class="billing-plan-list">
            ${cardPlans.length ? cardPlans.map(plan => `
              <button
                type="button"
                class="billing-plan-button"
                data-billing-action="open-card"
                data-plan-id="${escapeHtml(plan.id)}"
              >
                <span>${escapeHtml(plan.label)}</span>
                <strong>$${escapeHtml(String(plan.amountUsd))}</strong>
                <small>${escapeHtml(plan.intervalLabel)}</small>
              </button>
            `).join('') : `<div class="empty-card">${escapeHtml(t('billingCardSetupNeeded'))}</div>`}
          </div>
        </section>

        <section class="billing-form-card">
          <div class="section-title">${escapeHtml(t('billingCryptoRailTitle'))}</div>
          <p class="billing-copy">${escapeHtml(t('billingCryptoRailCopy'))}</p>
          <div class="billing-inline-note ${escapeHtml(cryptoMode === 'direct-wallet' ? 'live' : 'warn')}">${escapeHtml(
            cryptoMode === 'direct-wallet'
              ? t('billingCryptoModeLive')
              : t('billingCryptoModeSandbox'),
          )}</div>
          <div class="field-grid">
            <label class="field">
              <span>${escapeHtml(t('billingCryptoPlanTitle'))}</span>
              <select name="cryptoPlanId">
                ${cryptoPlans.map(plan => `
                  <option value="${escapeHtml(plan.id)}" ${plan.id === (currentCryptoPlan?.id ?? '') ? 'selected' : ''}>${escapeHtml(`${plan.label} · $${plan.amountUsd}`)}</option>
                `).join('')}
              </select>
            </label>
            <label class="field">
              <span>${escapeHtml(t('billingNetworkLabel'))}</span>
              <select name="networkId">
                ${cryptoNetworks.map(network => `
                  <option value="${escapeHtml(network.id)}" ${network.id === (currentNetwork?.id ?? '') ? 'selected' : ''}>${escapeHtml(network.label)}</option>
                `).join('')}
              </select>
            </label>
            <label class="field">
              <span>${escapeHtml(t('billingCryptoCurrencyLabel'))}</span>
              <select name="assetId">
                ${(currentNetwork?.assets ?? []).map(asset => `
                  <option value="${escapeHtml(asset.id)}" ${asset.id === (currentAsset?.id ?? '') ? 'selected' : ''}>${escapeHtml(asset.label)}</option>
                `).join('')}
              </select>
            </label>
            <label class="field">
              <span>${escapeHtml(t('billingPayerWalletLabel'))}</span>
              <input type="text" name="payerAddress" value="${escapeHtml(draft.payerAddress)}" placeholder="${escapeHtml(t('billingPayerWalletPlaceholder'))}" />
            </label>
          </div>
          ${currentNetwork ? `
            <div class="billing-inline-note">${escapeHtml(t('billingRecipientHint', {
              network: currentNetwork.label,
              address: currentNetwork.recipientAddress,
            }))}</div>
          ` : ''}
          ${currentNetwork ? `
            <div class="billing-inline-note ${escapeHtml(currentNetwork.verificationReady ? 'live' : 'warn')}">${escapeHtml(
              currentNetwork.verificationReady
                ? t('billingNetworkVerificationReady', { network: currentNetwork.label })
                : t('billingNetworkVerificationNeeded', {
                    network: currentNetwork.label,
                    setting: currentNetwork.verificationEnvKey || currentNetwork.label,
                  }),
            )}</div>
          ` : ''}
          <div class="billing-actions">
            <button type="button" class="primary" data-billing-action="create-crypto-payment">${escapeHtml(t('billingCreateCryptoPayment'))}</button>
          </div>
          ${paymentMarkup}
        </section>
      </div>
    </div>
  `
}

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
        <div class="task-actions">
          <button
            type="button"
            class="secondary task-edit"
            data-edit-task-id="${escapeHtml(task.taskId)}"
          >${escapeHtml(t('editTask'))}</button>
          <button
            type="button"
            class="secondary task-delete"
            data-delete-task-id="${escapeHtml(task.taskId)}"
            aria-label="${escapeHtml(t('delete'))}"
          >×</button>
        </div>
      </div>
      ${task.goal ? `<div class="note-body">${escapeHtml(task.goal)}</div>` : ''}
      ${task.delivery ? `<div class="note-time">${escapeHtml(t('due'))}: ${escapeHtml(task.delivery)}</div>` : ''}
    </article>
  `
}

function renderLatestPaymentMarkup(payment, { t, formatTimestamp, sandboxMode }) {
  const waitingDirectWallet = payment.provider === 'wallet-direct' && payment.status === 'waiting'
  return `
    <div class="billing-payment-card ${escapeHtml(payment.status)}">
      <div class="billing-payment-head">
        <strong>${escapeHtml(payment.planLabel || payment.planId || t('billingLatestPaymentTitle'))}</strong>
        <span class="billing-status-pill ${escapeHtml(payment.status)}">${escapeHtml(getPaymentStatusLabel(payment.status, t))}</span>
      </div>
      ${waitingDirectWallet ? `
        <div class="billing-step-list">
          <div class="billing-step-item">
            <span>1</span>
            <div>
              <strong>${escapeHtml(t('billingStepSendTitle'))}</strong>
              <p>${escapeHtml(t('billingStepSendBody', {
                amount: `${payment.payAmount} ${String(payment.payCurrency || '').toUpperCase()}`,
              }))}</p>
            </div>
          </div>
          <div class="billing-step-item">
            <span>2</span>
            <div>
              <strong>${escapeHtml(t('billingStepAddressTitle'))}</strong>
              <p>${escapeHtml(t('billingStepAddressBody', {
                network: payment.cryptoNetworkLabel || t('billingUnset'),
              }))}</p>
            </div>
          </div>
          <div class="billing-step-item">
            <span>3</span>
            <div>
              <strong>${escapeHtml(t('billingStepVerifyTitle'))}</strong>
              <p>${escapeHtml(t('billingStepVerifyBody'))}</p>
            </div>
          </div>
        </div>
      ` : ''}
      <div class="billing-payment-grid">
        <div>
          <span>${escapeHtml(t('billingPayAmountLabel'))}</span>
          <strong>${escapeHtml(`${payment.payAmount || '-'} ${String(payment.payCurrency || '').toUpperCase()}`)}</strong>
          ${payment.payAmount ? `<button type="button" class="billing-copy-button" data-copy-value="${escapeHtml(payment.payAmount)}">${escapeHtml(t('billingCopyAmount'))}</button>` : ''}
        </div>
        <div>
          <span>${escapeHtml(t('billingNetworkLabel'))}</span>
          <strong>${escapeHtml(payment.cryptoNetworkLabel || t('billingUnset'))}</strong>
        </div>
        <div>
          <span>${escapeHtml(t('billingPaymentUpdatedLabel'))}</span>
          <strong>${escapeHtml(formatTimestamp(payment.updatedAt))}</strong>
        </div>
        <div>
          <span>${escapeHtml(t('billingQuoteExpiryLabel'))}</span>
          <strong>${escapeHtml(payment.quoteExpiresAt ? formatTimestamp(payment.quoteExpiresAt) : t('billingUnset'))}</strong>
        </div>
      </div>
      ${payment.payAddress ? `
        <div class="billing-address-shell">
          <code class="billing-address">${escapeHtml(payment.payAddress)}</code>
          <button type="button" class="secondary billing-copy-address" data-copy-value="${escapeHtml(payment.payAddress)}">${escapeHtml(t('billingCopyAddress'))}</button>
        </div>
      ` : ''}
      <div class="billing-inline-note">${escapeHtml(waitingDirectWallet ? t('billingTxHashHintWaiting') : t('billingTxHashHint'))}</div>
      <form class="billing-verify-form" data-billing-form="verify-payment" data-payment-id="${escapeHtml(payment.providerPaymentId)}">
        <div class="field-grid">
          <label class="field">
            <span>${escapeHtml(t('billingTxHashLabel'))}</span>
            <input type="text" name="txHash" value="" placeholder="${escapeHtml(t('billingTxHashPlaceholder'))}" autocomplete="off" />
          </label>
        </div>
        <div class="billing-actions">
          <button type="submit" class="primary">${escapeHtml(t('billingVerifyTransfer'))}</button>
          <button type="button" class="secondary" data-billing-action="refresh-payment" data-payment-id="${escapeHtml(payment.providerPaymentId)}">${escapeHtml(t('billingRefreshPayment'))}</button>
          ${sandboxMode && payment.provider === 'sandbox' && payment.status !== 'finished' ? `
            <button type="button" class="secondary" data-billing-action="simulate-payment" data-payment-id="${escapeHtml(payment.providerPaymentId)}">${escapeHtml(t('billingSimulatePayment'))}</button>
          ` : ''}
          ${payment.claimable ? `
            <button type="button" class="primary" data-billing-action="claim-payment" data-payment-id="${escapeHtml(payment.providerPaymentId)}">${escapeHtml(t('billingApplyLicense'))}</button>
          ` : ''}
        </div>
      </form>
      <div class="billing-actions">
        ${payment.txHash && payment.explorerUrl ? `
          <a class="secondary billing-link-button" href="${escapeHtml(`${payment.explorerUrl}${payment.txHash}`)}" target="_blank" rel="noreferrer">${escapeHtml(t('billingOpenExplorer'))}</a>
        ` : ''}
      </div>
      ${payment.licenseKeyMasked ? `<div class="billing-inline-note">${escapeHtml(t('billingLicenseReady', { key: payment.licenseKeyMasked }))}</div>` : ''}
    </div>
  `
}

function getPaymentStatusLabel(status, t) {
  if (status === 'waiting') {
    return t('billingStatusWaitingPayment')
  }
  if (status === 'finished' || status === 'confirmed' || status === 'sending') {
    return t('billingStatusPaid')
  }
  if (status === 'failed' || status === 'expired' || status === 'refunded') {
    return t('billingStatusFailed')
  }
  return status
}

function getEntitlementLabel(status, t) {
  if (status === 'active') {
    return t('billingStatusActive')
  }
  if (status === 'trial') {
    return t('billingStatusTrial')
  }
  if (status === 'expired') {
    return t('billingStatusExpired')
  }
  return t('billingStatusInactive')
}

function getEntitlementPill(status, t) {
  if (status === 'active') {
    return t('billingPillActive')
  }
  if (status === 'trial') {
    return t('billingPillTrial')
  }
  if (status === 'expired') {
    return t('billingPillExpired')
  }
  return t('billingPillInactive')
}

function getEntitlementCopy(entitlement, activation, t) {
  if (entitlement.status === 'active') {
    return t('billingActiveCopy', {
      source: activation.source || 'license',
      plan: entitlement.planLabel || t('billingUnset'),
    })
  }
  if (entitlement.status === 'trial') {
    return t('billingTrialCopy', {
      days: entitlement.trialDaysRemaining || 0,
    })
  }
  if (entitlement.status === 'expired') {
    return t('billingExpiredCopy')
  }
  return t('billingInactiveCopy')
}
