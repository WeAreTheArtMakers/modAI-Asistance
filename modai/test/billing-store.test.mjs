import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConfigStore } from '../src/services/ConfigStore.mjs'
import { BillingStore, buildBillingClientState } from '../src/services/BillingStore.mjs'
import { getBillingCatalog, getBillingEnvironment } from '../src/services/billingGateway.mjs'

test('BillingStore starts a trial and exposes entitlement state', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-billing-trial-'))
  const configStore = new ConfigStore({ baseDir, fallbackBaseDir: baseDir })
  const store = new BillingStore(configStore, {
    now: () => new Date('2026-04-13T09:00:00.000Z'),
  })

  const state = await store.startTrial({ trialDays: 7, deviceName: 'Test Mac' })
  const billing = buildBillingClientState(state, {
    catalog: getBillingCatalog(),
    environment: getBillingEnvironment(),
    now: new Date('2026-04-13T09:00:00.000Z'),
  })

  assert.equal(billing.trial.active, true)
  assert.equal(billing.trial.remainingDays, 7)
  assert.equal(billing.entitlement.status, 'trial')
  assert.equal(billing.device.name, 'Test Mac')
})

test('BillingStore can issue and activate local licenses plus claim crypto licenses', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-billing-license-'))
  const configStore = new ConfigStore({ baseDir, fallbackBaseDir: baseDir })
  const store = new BillingStore(configStore, {
    now: () => new Date('2026-04-13T10:00:00.000Z'),
  })

  let state = await store.issueLicense({
    source: 'manual',
    provider: 'manual',
    planId: 'pro-annual',
    planLabel: 'Pro Annual',
    email: 'buyer@example.com',
    activationLimit: 2,
    orderId: 'order-1',
  })
  const issuedLicenseKey = state.licenses[0].licenseKey

  state = await store.activateStoredLicense({
    licenseKey: issuedLicenseKey,
    email: 'buyer@example.com',
    deviceName: 'Studio Mac',
  })
  assert.equal(state.activation.status, 'active')
  assert.equal(state.activation.licenseKey, issuedLicenseKey)

  state = await store.createPayment({
    provider: 'sandbox',
    providerPaymentId: 'sandbox-payment-1',
    orderId: 'crypto-order-1',
    planId: 'founder-pass',
    planLabel: 'Founder Pass',
    email: 'crypto@example.com',
    payCurrency: 'usdc',
    payAmount: '299',
    priceAmount: 299,
    paymentStatus: 'waiting',
    payAddress: 'sandbox-usdc-address',
  })
  state = await store.updatePaymentStatus('sandbox-payment-1', {
    paymentStatus: 'finished',
    outcomeAmount: '299',
    outcomeCurrency: 'usdc',
  }, {
    issueLicense: true,
    source: 'crypto',
    activationLimit: 5,
  })

  assert.equal(state.payments[0].licenseKey.startsWith('MODAI-'), true)

  state = await store.claimPaymentLicense({
    providerPaymentId: 'sandbox-payment-1',
    email: 'crypto@example.com',
    deviceName: 'Studio Mac',
  })

  assert.equal(state.activation.planId, 'founder-pass')
  assert.equal(state.activation.source, 'crypto')
})

test('BillingStore can reset local billing state while preserving the current device', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'modai-billing-reset-'))
  const configStore = new ConfigStore({ baseDir, fallbackBaseDir: baseDir })
  const store = new BillingStore(configStore, {
    now: () => new Date('2026-04-13T11:00:00.000Z'),
  })

  let state = await store.startTrial({ trialDays: 7, deviceName: 'QA Mac' })
  state = await store.issueLicense({
    source: 'crypto',
    provider: 'cryptomus',
    planId: 'founder-pass',
    planLabel: 'Founder Pass',
    email: 'buyer@example.com',
    activationLimit: 5,
    orderId: 'order-2',
  })

  state = await store.resetLocalState()

  assert.equal(state.device.name, 'QA Mac')
  assert.equal(state.trial, null)
  assert.equal(state.activation, null)
  assert.deepEqual(state.licenses, [])
  assert.deepEqual(state.payments, [])
  assert.deepEqual(state.webhookEvents, [])
})
