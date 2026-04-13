import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import {
  createDirectCryptoInvoice,
  getBillingEnvironment,
  getDirectCryptoNetworks,
  resolveBillingPlan,
  verifyLemonWebhookSignature,
  verifyNowPaymentsWebhookSignature,
} from '../src/services/billingGateway.mjs'

test('billing gateway resolves known plans', () => {
  const plan = resolveBillingPlan('pro-annual')
  assert.equal(plan.label, 'Pro Annual')
  assert.equal(plan.amountUsd, 199)
})

test('billing gateway creates direct wallet invoices for supported networks', async () => {
  const networks = getDirectCryptoNetworks()
  assert.equal(networks.some(network => network.id === 'solana'), true)

  const invoice = await createDirectCryptoInvoice({
    plan: resolveBillingPlan('founder-pass'),
    networkId: 'solana',
    assetId: 'usdc',
    email: 'buyer@example.com',
    deviceName: 'QA Mac',
  })

  assert.equal(invoice.provider, 'wallet-direct')
  assert.equal(invoice.cryptoNetwork, 'solana')
  assert.equal(invoice.cryptoAsset, 'usdc')
  assert.match(invoice.payAddress, /^3X4w9TJS/)
})

test('billing gateway reports direct wallet checkout as live when wallet rails are available', () => {
  const previousEthereumRpc = process.env.MODAI_ETHEREUM_RPC_URL
  const previousNowPayments = process.env.NOWPAYMENTS_API_KEY

  delete process.env.MODAI_ETHEREUM_RPC_URL
  delete process.env.NOWPAYMENTS_API_KEY

  try {
    const environment = getBillingEnvironment()
    assert.equal(environment.crypto.mode, 'direct-wallet')
    assert.equal(environment.crypto.sandboxMode, false)

    const solana = environment.crypto.directWallets.find(network => network.id === 'solana')
    const ethereum = environment.crypto.directWallets.find(network => network.id === 'ethereum')

    assert.equal(solana?.verificationReady, true)
    assert.equal(ethereum?.verificationReady, false)
    assert.equal(ethereum?.verificationEnvKey, 'MODAI_ETHEREUM_RPC_URL')
  } finally {
    if (previousEthereumRpc === undefined) {
      delete process.env.MODAI_ETHEREUM_RPC_URL
    } else {
      process.env.MODAI_ETHEREUM_RPC_URL = previousEthereumRpc
    }
    if (previousNowPayments === undefined) {
      delete process.env.NOWPAYMENTS_API_KEY
    } else {
      process.env.NOWPAYMENTS_API_KEY = previousNowPayments
    }
  }
})

test('billing gateway verifies Lemon and NOWPayments webhook signatures', () => {
  const rawBody = JSON.stringify({ ok: true, id: 'evt_1' })
  const lemonSecret = 'lemon-secret'
  const cryptoSecret = 'crypto-secret'
  const lemonSig = createHmac('sha256', lemonSecret).update(rawBody).digest('hex')
  const cryptoSig = createHmac('sha256', cryptoSecret).update(rawBody).digest('hex')

  assert.equal(verifyLemonWebhookSignature(rawBody, lemonSig, lemonSecret), true)
  assert.equal(verifyNowPaymentsWebhookSignature(rawBody, cryptoSig, cryptoSecret), true)
  assert.equal(verifyLemonWebhookSignature(rawBody, 'bad-signature', lemonSecret), false)
})
