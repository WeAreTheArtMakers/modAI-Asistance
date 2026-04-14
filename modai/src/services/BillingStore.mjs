import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { join } from 'node:path'

import { safeJson } from '../utils/json.mjs'

const MAX_WEBHOOK_EVENTS = 40
const MAX_PAYMENTS = 20

export class BillingStore {
  constructor(configStore, options = {}) {
    this.configStore = configStore
    this.now = options.now ?? (() => new Date())
  }

  getFilePath() {
    return join(this.configStore.getBaseDir(), 'billing.json')
  }

  async load() {
    await this.configStore.ensureLayout()
    await mkdir(this.configStore.getBaseDir(), { recursive: true })

    try {
      const raw = await readFile(this.getFilePath(), 'utf8')
      const parsed = JSON.parse(raw)
      const hydrated = this.hydrate(parsed)
      if (safeJson(parsed) !== safeJson(hydrated)) {
        await this.save(hydrated)
      }
      return hydrated
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        const initial = this.createInitialState()
        await this.save(initial)
        return initial
      }
      throw error
    }
  }

  async save(state) {
    const normalized = this.hydrate(state)
    await writeFile(this.getFilePath(), safeJson(normalized), 'utf8')
    return normalized
  }

  async update(mutator) {
    const current = await this.load()
    const next = await mutator(structuredClone(current))
    return this.save(next)
  }

  async resetLocalState({ preserveDevice = true } = {}) {
    return this.update(current => {
      const initial = this.createInitialState()
      if (preserveDevice !== false && current?.device) {
        initial.device = {
          ...initial.device,
          ...current.device,
        }
      }
      return initial
    })
  }

  async startTrial({ trialDays = 7, deviceName = '' } = {}) {
    const trialLength = Math.max(1, Number(trialDays) || 7)
    const now = this.now()
    return this.update(current => {
      if (current.activation?.status === 'active') {
        throw new Error('This device is already activated')
      }
      if (current.trial?.startedAt) {
        return current
      }

      if (deviceName.trim()) {
        current.device.name = deviceName.trim()
      }

      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + trialLength)
      current.trial = {
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        deviceId: current.device.id,
        deviceName: deviceName.trim() || current.device.name,
      }
      return current
    })
  }

  async issueLicense({
    source = 'manual',
    planId = '',
    planLabel = '',
    email = '',
    activationLimit = 2,
    expiresAt = null,
    orderId = '',
    provider = '',
    metadata = {},
    providedLicenseKey = '',
  } = {}) {
    return this.update(current => {
      const existing = current.licenses.find(license =>
        orderId && license.orderId === orderId && license.source === source,
      )
      if (existing) {
        existing.provider = provider || existing.provider
        existing.planId = planId || existing.planId
        existing.planLabel = planLabel || existing.planLabel
        existing.email = email.trim() || existing.email
        existing.activationLimit = Math.max(1, Number(activationLimit) || existing.activationLimit || 1)
        existing.expiresAt = expiresAt ?? existing.expiresAt
        existing.status = 'active'
        existing.metadata = { ...(existing.metadata ?? {}), ...(metadata ?? {}) }
        return current
      }

      current.licenses.unshift({
        id: randomUUID(),
        source,
        provider,
        planId,
        planLabel,
        email: email.trim(),
        licenseKey: providedLicenseKey || generateLicenseKey(),
        activationLimit: Math.max(1, Number(activationLimit) || 1),
        createdAt: this.now().toISOString(),
        expiresAt,
        status: 'active',
        orderId,
        activations: [],
        metadata,
      })
      return current
    })
  }

  async activateStoredLicense({ licenseKey, email = '', deviceName = '' } = {}) {
    const trimmedKey = String(licenseKey ?? '').trim()
    if (!trimmedKey) {
      throw new Error('License key is required')
    }

    return this.update(current => {
      const license = current.licenses.find(item => item.licenseKey === trimmedKey)
      if (!license) {
        throw new Error('License key not found')
      }
      if (license.email && email && license.email.toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error('Email does not match the license owner')
      }
      if (license.expiresAt && new Date(license.expiresAt).getTime() < this.now().getTime()) {
        license.status = 'expired'
        throw new Error('License has expired')
      }

      const existingActivation = license.activations.find(item => item.deviceId === current.device.id)
      if (deviceName.trim()) {
        current.device.name = deviceName.trim()
      }
      const activation = existingActivation ?? {
        id: randomUUID(),
        deviceId: current.device.id,
        deviceName: deviceName.trim() || current.device.name,
        instanceId: existingActivation?.instanceId ?? '',
        activatedAt: this.now().toISOString(),
      }
      if (!existingActivation) {
        if (license.activations.length >= license.activationLimit) {
          throw new Error('Activation limit reached for this license')
        }
        license.activations.push(activation)
      } else {
        existingActivation.deviceName = deviceName.trim() || existingActivation.deviceName || current.device.name
      }

      current.activation = {
        status: 'active',
        source: license.source,
        provider: license.provider,
        licenseKey: license.licenseKey,
        planId: license.planId,
        planLabel: license.planLabel,
        email: license.email,
        deviceId: current.device.id,
        deviceName: deviceName.trim() || current.device.name,
        instanceId: activation.instanceId ?? '',
        activatedAt: activation.activatedAt,
        expiresAt: license.expiresAt,
      }
      return current
    })
  }

  async saveRemoteActivation({
    source = 'lemon-squeezy',
    provider = 'lemon-squeezy',
    licenseKey,
    email = '',
    planId = '',
    planLabel = '',
    activationLimit = 1,
    instanceId = '',
    expiresAt = null,
    deviceName = '',
    orderId = '',
    metadata = {},
  }) {
    const trimmedKey = String(licenseKey ?? '').trim()
    if (!trimmedKey) {
      throw new Error('License key is required')
    }

    return this.update(current => {
      if (deviceName.trim()) {
        current.device.name = deviceName.trim()
      }
      let license = current.licenses.find(item => item.licenseKey === trimmedKey)
      if (!license) {
        license = {
          id: randomUUID(),
          source,
          provider,
          planId,
          planLabel,
          email: email.trim(),
          licenseKey: trimmedKey,
          activationLimit: Math.max(1, Number(activationLimit) || 1),
          createdAt: this.now().toISOString(),
          expiresAt,
          status: 'active',
          orderId,
          activations: [],
          metadata,
        }
        current.licenses.unshift(license)
      } else {
        license.planId = planId || license.planId
        license.planLabel = planLabel || license.planLabel
        license.email = email.trim() || license.email
        license.activationLimit = Math.max(1, Number(activationLimit) || license.activationLimit || 1)
        license.expiresAt = expiresAt ?? license.expiresAt
        license.status = 'active'
        license.orderId = orderId || license.orderId
        license.metadata = { ...(license.metadata ?? {}), ...(metadata ?? {}) }
      }

      const existingActivation = license.activations.find(item => item.deviceId === current.device.id)
      if (!existingActivation) {
        license.activations.push({
          id: randomUUID(),
          deviceId: current.device.id,
          deviceName: deviceName.trim() || current.device.name,
          instanceId: String(instanceId ?? ''),
          activatedAt: this.now().toISOString(),
        })
      } else {
        existingActivation.instanceId = String(instanceId ?? existingActivation.instanceId ?? '')
        existingActivation.deviceName = deviceName.trim() || existingActivation.deviceName || current.device.name
      }

      current.activation = {
        status: 'active',
        source,
        provider,
        licenseKey: trimmedKey,
        planId: license.planId,
        planLabel: license.planLabel,
        email: license.email,
        deviceId: current.device.id,
        deviceName: deviceName.trim() || current.device.name,
        instanceId: String(instanceId ?? ''),
        activatedAt: this.now().toISOString(),
        expiresAt,
      }
      return current
    })
  }

  async createPayment(payment = {}) {
    return this.update(current => {
      current.payments = [
        {
          id: randomUUID(),
          provider: payment.provider ?? 'sandbox',
          providerPaymentId: String(payment.providerPaymentId ?? ''),
          orderId: String(payment.orderId ?? ''),
          planId: String(payment.planId ?? ''),
          planLabel: String(payment.planLabel ?? ''),
          email: String(payment.email ?? '').trim(),
          payCurrency: String(payment.payCurrency ?? '').toLowerCase(),
          payAmount: String(payment.payAmount ?? ''),
          priceAmount: Number(payment.priceAmount ?? 0) || 0,
          priceCurrency: String(payment.priceCurrency ?? 'usd'),
          payAddress: String(payment.payAddress ?? ''),
          payUrl: String(payment.payUrl ?? ''),
          paymentKind: String(payment.paymentKind ?? ''),
          checkoutSessionId: String(payment.checkoutSessionId ?? ''),
          checkoutStatus: String(payment.checkoutStatus ?? ''),
          subscriptionId: String(payment.subscriptionId ?? ''),
          subscriptionStatus: String(payment.subscriptionStatus ?? ''),
          currentPeriodEnd: payment.currentPeriodEnd ?? null,
          payerAddress: String(payment.payerAddress ?? '').trim(),
          payerName: String(payment.payerName ?? '').trim(),
          cryptoNetwork: String(payment.cryptoNetwork ?? ''),
          cryptoNetworkLabel: String(payment.cryptoNetworkLabel ?? ''),
          cryptoAsset: String(payment.cryptoAsset ?? ''),
          cryptoAssetLabel: String(payment.cryptoAssetLabel ?? ''),
          recipientName: String(payment.recipientName ?? ''),
          recipientBankName: String(payment.recipientBankName ?? ''),
          bankSwift: String(payment.bankSwift ?? ''),
          bankFastAlias: String(payment.bankFastAlias ?? ''),
          paymentReference: String(payment.paymentReference ?? ''),
          tokenAddress: String(payment.tokenAddress ?? ''),
          assetKind: String(payment.assetKind ?? ''),
          assetDecimals: Number(payment.assetDecimals ?? 0) || 0,
          expectedAmountAtomic: String(payment.expectedAmountAtomic ?? ''),
          quoteExpiresAt: payment.quoteExpiresAt ?? null,
          confirmationsRequired: Number(payment.confirmationsRequired ?? 0) || 0,
          explorerUrl: String(payment.explorerUrl ?? ''),
          purchaseId: String(payment.purchaseId ?? ''),
          payinExtraId: String(payment.payinExtraId ?? ''),
          txHash: String(payment.txHash ?? ''),
          status: String(payment.paymentStatus ?? 'waiting'),
          actuallyPaid: String(payment.actuallyPaid ?? ''),
          outcomeAmount: String(payment.outcomeAmount ?? ''),
          outcomeCurrency: String(payment.outcomeCurrency ?? ''),
          createdAt: this.now().toISOString(),
          updatedAt: this.now().toISOString(),
          claimedAt: null,
          licenseKey: '',
          raw: payment.raw ?? {},
        },
        ...current.payments.filter(item => item.providerPaymentId !== payment.providerPaymentId).slice(0, MAX_PAYMENTS - 1),
      ]
      return current
    })
  }

  async updatePaymentStatus(providerPaymentId, update = {}, issueOptions = {}) {
    return this.update(current => {
      const payment = current.payments.find(item => item.providerPaymentId === providerPaymentId)
      if (!payment) {
        throw new Error('Payment not found')
      }

      Object.assign(payment, {
        status: String(update.paymentStatus ?? payment.status),
        email: String(update.email ?? payment.email).trim(),
        payAmount: String(update.payAmount ?? payment.payAmount),
        payAddress: String(update.payAddress ?? payment.payAddress),
        payUrl: String(update.payUrl ?? payment.payUrl),
        paymentKind: String(update.paymentKind ?? payment.paymentKind ?? ''),
        checkoutSessionId: String(update.checkoutSessionId ?? payment.checkoutSessionId ?? ''),
        checkoutStatus: String(update.checkoutStatus ?? payment.checkoutStatus ?? ''),
        subscriptionId: String(update.subscriptionId ?? payment.subscriptionId ?? ''),
        subscriptionStatus: String(update.subscriptionStatus ?? payment.subscriptionStatus ?? ''),
        currentPeriodEnd: update.currentPeriodEnd ?? payment.currentPeriodEnd ?? null,
        payerAddress: String(update.payerAddress ?? payment.payerAddress),
        payerName: String(update.payerName ?? payment.payerName).trim(),
        recipientName: String(update.recipientName ?? payment.recipientName),
        recipientBankName: String(update.recipientBankName ?? payment.recipientBankName),
        bankSwift: String(update.bankSwift ?? payment.bankSwift),
        bankFastAlias: String(update.bankFastAlias ?? payment.bankFastAlias),
        paymentReference: String(update.paymentReference ?? payment.paymentReference),
        actuallyPaid: String(update.actuallyPaid ?? payment.actuallyPaid),
        txHash: String(update.txHash ?? payment.txHash),
        purchaseId: String(update.purchaseId ?? payment.purchaseId),
        outcomeAmount: String(update.outcomeAmount ?? payment.outcomeAmount),
        outcomeCurrency: String(update.outcomeCurrency ?? payment.outcomeCurrency),
        updatedAt: this.now().toISOString(),
        raw: update.raw ?? payment.raw,
      })

      if (!payment.licenseKey && issueOptions.issueLicense === true) {
        const license = {
          id: randomUUID(),
          source: issueOptions.source ?? 'crypto',
          provider: payment.provider,
          planId: payment.planId,
          planLabel: payment.planLabel,
          email: payment.email,
          licenseKey: generateLicenseKey(),
          activationLimit: Math.max(1, Number(issueOptions.activationLimit ?? 2) || 1),
          createdAt: this.now().toISOString(),
          expiresAt: issueOptions.expiresAt ?? null,
          status: 'active',
          orderId: String(issueOptions.orderId ?? payment.orderId),
          activations: [],
          metadata: {
            providerPaymentId: payment.providerPaymentId,
          },
        }
        current.licenses.unshift(license)
        payment.licenseKey = license.licenseKey
      }

      return current
    })
  }

  async claimPaymentLicense({ providerPaymentId, email = '', deviceName = '' } = {}) {
    const current = await this.load()
    const payment = current.payments.find(item => item.providerPaymentId === providerPaymentId)
    if (!payment) {
      throw new Error('Payment not found')
    }
    if (!payment.licenseKey) {
      throw new Error('This payment does not have a claimable license yet')
    }
    if (payment.email && email && payment.email.toLowerCase() !== email.trim().toLowerCase()) {
      throw new Error('Email does not match the payment owner')
    }

    await this.activateStoredLicense({
      licenseKey: payment.licenseKey,
      email: payment.email || email,
      deviceName,
    })

    return this.update(next => {
      const item = next.payments.find(entry => entry.providerPaymentId === providerPaymentId)
      if (item) {
        item.claimedAt = this.now().toISOString()
      }
      return next
    })
  }

  async recordWebhookEvent({
    provider,
    eventName,
    providerObjectId = '',
    status = '',
    payload = {},
  }) {
    return this.update(current => {
      current.webhookEvents.unshift({
        id: randomUUID(),
        provider,
        eventName,
        providerObjectId: String(providerObjectId ?? ''),
        status: String(status ?? ''),
        receivedAt: this.now().toISOString(),
        payload,
      })
      current.webhookEvents = current.webhookEvents.slice(0, MAX_WEBHOOK_EVENTS)
      return current
    })
  }

  async getClientState({ catalog, environment }) {
    const current = await this.load()
    return buildBillingClientState(current, {
      catalog,
      environment,
      now: this.now(),
    })
  }

  createInitialState() {
    return {
      version: 1,
      device: {
        id: randomUUID(),
        name: defaultDeviceName(),
        createdAt: this.now().toISOString(),
      },
      trial: null,
      activation: null,
      licenses: [],
      payments: [],
      webhookEvents: [],
    }
  }

  hydrate(state = {}) {
    const initial = this.createInitialState()
    const next = {
      ...initial,
      ...state,
      device: {
        ...initial.device,
        ...(state.device ?? {}),
      },
      licenses: Array.isArray(state.licenses) ? state.licenses.map(license => ({
        id: String(license.id ?? randomUUID()),
        source: String(license.source ?? 'manual'),
        provider: String(license.provider ?? ''),
        planId: String(license.planId ?? ''),
        planLabel: String(license.planLabel ?? ''),
        email: String(license.email ?? '').trim(),
        licenseKey: String(license.licenseKey ?? ''),
        activationLimit: Math.max(1, Number(license.activationLimit ?? 1) || 1),
        createdAt: license.createdAt ?? this.now().toISOString(),
        expiresAt: license.expiresAt ?? null,
        status: String(license.status ?? 'active'),
        orderId: String(license.orderId ?? ''),
        activations: Array.isArray(license.activations) ? license.activations.map(activation => ({
          id: String(activation.id ?? randomUUID()),
          deviceId: String(activation.deviceId ?? ''),
          deviceName: String(activation.deviceName ?? ''),
          instanceId: String(activation.instanceId ?? ''),
          activatedAt: activation.activatedAt ?? this.now().toISOString(),
        })) : [],
        metadata: license.metadata ?? {},
      })) : [],
      payments: Array.isArray(state.payments) ? state.payments.slice(0, MAX_PAYMENTS).map(payment => ({
        id: String(payment.id ?? randomUUID()),
        provider: String(payment.provider ?? 'sandbox'),
        providerPaymentId: String(payment.providerPaymentId ?? ''),
        orderId: String(payment.orderId ?? ''),
        planId: String(payment.planId ?? ''),
        planLabel: String(payment.planLabel ?? ''),
        email: String(payment.email ?? '').trim(),
        payCurrency: String(payment.payCurrency ?? '').toLowerCase(),
        payAmount: String(payment.payAmount ?? ''),
        priceAmount: Number(payment.priceAmount ?? 0) || 0,
        priceCurrency: String(payment.priceCurrency ?? 'usd'),
        payAddress: String(payment.payAddress ?? ''),
        payUrl: String(payment.payUrl ?? ''),
        paymentKind: String(payment.paymentKind ?? ''),
        checkoutSessionId: String(payment.checkoutSessionId ?? ''),
        checkoutStatus: String(payment.checkoutStatus ?? ''),
        subscriptionId: String(payment.subscriptionId ?? ''),
        subscriptionStatus: String(payment.subscriptionStatus ?? ''),
        currentPeriodEnd: payment.currentPeriodEnd ?? null,
        payerAddress: String(payment.payerAddress ?? '').trim(),
        payerName: String(payment.payerName ?? '').trim(),
        cryptoNetwork: String(payment.cryptoNetwork ?? ''),
        cryptoNetworkLabel: String(payment.cryptoNetworkLabel ?? ''),
        cryptoAsset: String(payment.cryptoAsset ?? ''),
        cryptoAssetLabel: String(payment.cryptoAssetLabel ?? ''),
        recipientName: String(payment.recipientName ?? ''),
        recipientBankName: String(payment.recipientBankName ?? ''),
        bankSwift: String(payment.bankSwift ?? ''),
        bankFastAlias: String(payment.bankFastAlias ?? ''),
        paymentReference: String(payment.paymentReference ?? ''),
        tokenAddress: String(payment.tokenAddress ?? ''),
        assetKind: String(payment.assetKind ?? ''),
        assetDecimals: Number(payment.assetDecimals ?? 0) || 0,
        expectedAmountAtomic: String(payment.expectedAmountAtomic ?? ''),
        quoteExpiresAt: payment.quoteExpiresAt ?? null,
        confirmationsRequired: Number(payment.confirmationsRequired ?? 0) || 0,
        explorerUrl: String(payment.explorerUrl ?? ''),
        purchaseId: String(payment.purchaseId ?? ''),
        payinExtraId: String(payment.payinExtraId ?? ''),
        txHash: String(payment.txHash ?? ''),
        status: String(payment.status ?? 'waiting'),
        actuallyPaid: String(payment.actuallyPaid ?? ''),
        outcomeAmount: String(payment.outcomeAmount ?? ''),
        outcomeCurrency: String(payment.outcomeCurrency ?? ''),
        createdAt: payment.createdAt ?? this.now().toISOString(),
        updatedAt: payment.updatedAt ?? this.now().toISOString(),
        claimedAt: payment.claimedAt ?? null,
        licenseKey: String(payment.licenseKey ?? ''),
        raw: payment.raw ?? {},
      })) : [],
      webhookEvents: Array.isArray(state.webhookEvents) ? state.webhookEvents.slice(0, MAX_WEBHOOK_EVENTS) : [],
    }

    if (next.activation?.status === 'active' && next.activation.expiresAt) {
      const expiresAt = new Date(next.activation.expiresAt).getTime()
      if (Number.isFinite(expiresAt) && expiresAt < this.now().getTime()) {
        next.activation.status = 'expired'
      }
    }

    return next
  }
}

export function buildBillingClientState(state, { catalog, environment, now }) {
  const activeActivation = state.activation?.status === 'active' ? state.activation : null
  const trial = buildTrialState(state.trial, now)
  const entitlementStatus = activeActivation
    ? 'active'
    : trial.active
      ? 'trial'
      : trial.startedAt
        ? 'expired'
        : 'inactive'

  const plansById = new Map((catalog?.allPlans ?? []).map(plan => [plan.id, plan]))
  const activationPlan = activeActivation ? plansById.get(activeActivation.planId) : null

  return {
    environment,
    device: {
      id: state.device.id,
      name: state.device.name,
    },
    entitlement: {
      status: entitlementStatus,
      trialDaysRemaining: trial.remainingDays,
      source: activeActivation?.source ?? '',
      email: activeActivation?.email ?? '',
      planId: activeActivation?.planId ?? '',
      planLabel: activeActivation?.planLabel ?? activationPlan?.label ?? '',
      expiresAt: activeActivation?.expiresAt ?? null,
      licenseKeyMasked: maskLicenseKey(activeActivation?.licenseKey ?? ''),
      activatedAt: activeActivation?.activatedAt ?? null,
      trialExpiresAt: trial.expiresAt,
    },
    trial,
    activation: activeActivation ? {
      ...activeActivation,
      licenseKeyMasked: maskLicenseKey(activeActivation.licenseKey),
    } : {
      status: state.activation?.status ?? 'inactive',
      source: '',
      email: '',
      planId: '',
      planLabel: '',
      expiresAt: null,
      licenseKeyMasked: '',
      activatedAt: null,
      instanceId: '',
      deviceName: state.device.name,
    },
    plans: {
      card: (catalog?.cardPlans ?? []).map(plan => ({
        id: plan.id,
        label: plan.label,
        amountUsd: plan.amountUsd,
        intervalLabel: plan.intervalLabel,
        checkoutProvider: plan.checkoutProvider ?? '',
        available: Boolean(plan.checkoutUrl || plan.checkoutProvider),
      })),
      bank: (catalog?.bankPlans ?? []).map(plan => ({
        id: plan.id,
        label: plan.label,
        amountUsd: plan.amountUsd,
        intervalLabel: plan.intervalLabel,
        available: environment?.bank?.configured === true,
      })),
      crypto: (catalog?.cryptoPlans ?? []).map(plan => ({
        id: plan.id,
        label: plan.label,
        amountUsd: plan.amountUsd,
        intervalLabel: plan.intervalLabel,
        currencies: plan.currencies ?? ['usdc', 'usdt'],
      })),
    },
    networks: (catalog?.cryptoNetworks ?? []).map(network => ({
      id: network.id,
      label: network.label,
      family: network.family,
      recipientAddress: network.recipientAddress,
      verificationReady: network.verificationReady === true,
      verificationEnvKey: network.verificationEnvKey ?? '',
      assets: network.assets ?? [],
    })),
    payments: state.payments.map(payment => ({
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      orderId: payment.orderId,
      planId: payment.planId,
      planLabel: payment.planLabel,
      email: payment.email,
      payCurrency: payment.payCurrency,
      payAmount: payment.payAmount,
      priceAmount: payment.priceAmount,
      priceCurrency: payment.priceCurrency,
      payAddress: payment.payAddress,
      payUrl: payment.payUrl,
      paymentKind: payment.paymentKind,
      checkoutSessionId: payment.checkoutSessionId,
      checkoutStatus: payment.checkoutStatus,
      subscriptionId: payment.subscriptionId,
      subscriptionStatus: payment.subscriptionStatus,
      currentPeriodEnd: payment.currentPeriodEnd,
      payerAddress: payment.payerAddress,
      payerName: payment.payerName,
      cryptoNetwork: payment.cryptoNetwork,
      cryptoNetworkLabel: payment.cryptoNetworkLabel,
      cryptoAsset: payment.cryptoAsset,
      cryptoAssetLabel: payment.cryptoAssetLabel,
      recipientName: payment.recipientName,
      recipientBankName: payment.recipientBankName,
      bankSwift: payment.bankSwift,
      bankFastAlias: payment.bankFastAlias,
      paymentReference: payment.paymentReference,
      quoteExpiresAt: payment.quoteExpiresAt,
      confirmationsRequired: payment.confirmationsRequired,
      explorerUrl: payment.explorerUrl,
      status: payment.status,
      txHash: payment.txHash,
      outcomeAmount: payment.outcomeAmount,
      outcomeCurrency: payment.outcomeCurrency,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      claimedAt: payment.claimedAt,
      licenseKeyMasked: maskLicenseKey(payment.licenseKey),
      claimable: Boolean(payment.licenseKey) && !payment.claimedAt,
    })),
    lastWebhookEvents: state.webhookEvents.slice(0, 6).map(event => ({
      provider: event.provider,
      eventName: event.eventName,
      providerObjectId: event.providerObjectId,
      status: event.status,
      receivedAt: event.receivedAt,
    })),
  }
}

function buildTrialState(trial, now) {
  if (!trial?.startedAt) {
    return {
      eligible: true,
      active: false,
      startedAt: null,
      expiresAt: null,
      remainingDays: 0,
    }
  }

  const expiresAt = trial.expiresAt ? new Date(trial.expiresAt).getTime() : 0
  const remainingMs = expiresAt - now.getTime()
  return {
    eligible: false,
    active: remainingMs > 0,
    startedAt: trial.startedAt,
    expiresAt: trial.expiresAt,
    remainingDays: remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 86_400_000)) : 0,
  }
}

function defaultDeviceName() {
  return `${hostname()} (${process.arch})`
}

function generateLicenseKey() {
  return ['MODAI', randomBlock(), randomBlock(), randomBlock()].join('-')
}

function randomBlock() {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

function maskLicenseKey(value) {
  const key = String(value ?? '').trim()
  if (!key) {
    return ''
  }
  return `${key.slice(0, 5)}••••${key.slice(-4)}`
}
