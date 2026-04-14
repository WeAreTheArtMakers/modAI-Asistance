import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'

import {
  createBankTransferInvoice,
  extractStripeWebhookRecord,
  extractCryptomusWebhookRecord,
  createDirectCryptoInvoice,
  getBillingEnvironment,
  getDirectCryptoNetworks,
  resolveBillingPlan,
  verifyCryptomusWebhookSignature,
  verifyLemonWebhookSignature,
  verifyNowPaymentsWebhookSignature,
  verifyStripeWebhookSignature,
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

test('billing gateway creates IBAN invoices when bank transfer checkout is configured', async () => {
  const previous = {
    MODAI_BANK_ACCOUNT_NAME: process.env.MODAI_BANK_ACCOUNT_NAME,
    MODAI_BANK_NAME: process.env.MODAI_BANK_NAME,
    MODAI_BANK_IBAN: process.env.MODAI_BANK_IBAN,
    MODAI_BANK_QUOTE_CURRENCY: process.env.MODAI_BANK_QUOTE_CURRENCY,
    MODAI_BANK_USD_TO_TRY_RATE: process.env.MODAI_BANK_USD_TO_TRY_RATE,
    MODAI_BANK_REFERENCE_PREFIX: process.env.MODAI_BANK_REFERENCE_PREFIX,
  }

  process.env.MODAI_BANK_ACCOUNT_NAME = 'Mod Art Collective'
  process.env.MODAI_BANK_NAME = 'QNB'
  process.env.MODAI_BANK_IBAN = 'TR000000000000000000000001'
  process.env.MODAI_BANK_QUOTE_CURRENCY = 'TRY'
  process.env.MODAI_BANK_USD_TO_TRY_RATE = '38.5'
  process.env.MODAI_BANK_REFERENCE_PREFIX = 'MODAI'

  try {
    const invoice = await createBankTransferInvoice({
      plan: resolveBillingPlan('pro-annual'),
      email: 'buyer@example.com',
      deviceName: 'QA Mac',
    })

    assert.equal(invoice.provider, 'bank-transfer')
    assert.equal(invoice.paymentKind, 'bank')
    assert.equal(invoice.payCurrency, 'try')
    assert.equal(invoice.recipientBankName, 'QNB')
    assert.match(invoice.paymentReference, /^MODAI-/)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
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

test('billing gateway verifies Stripe webhook signatures and extracts checkout metadata', () => {
  const payload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        object: 'checkout.session',
        client_reference_id: 'order-123',
        payment_status: 'paid',
        status: 'complete',
        customer_details: {
          email: 'buyer@example.com',
        },
        metadata: {
          plan_id: 'pro-annual',
          plan_label: 'Pro Annual',
        },
        subscription: {
          id: 'sub_123',
          status: 'active',
          current_period_end: 1_776_000_000,
        },
      },
    },
  }
  const rawBody = JSON.stringify(payload)
  const secret = 'whsec_test'
  const timestamp = Math.floor(Date.now() / 1000)
  const signedPayload = `${timestamp}.${rawBody}`
  const digest = createHmac('sha256', secret).update(signedPayload).digest('hex')
  const signature = `t=${timestamp},v1=${digest}`

  assert.equal(verifyStripeWebhookSignature(rawBody, signature, secret), true)

  const record = extractStripeWebhookRecord(payload)
  assert.equal(record.provider, 'stripe')
  assert.equal(record.providerPaymentId, 'cs_test_123')
  assert.equal(record.orderId, 'order-123')
  assert.equal(record.planId, 'pro-annual')
  assert.equal(record.paymentStatus, 'finished')
  assert.equal(record.subscriptionId, 'sub_123')
})

test('billing gateway verifies Cryptomus webhook signatures and extracts payment metadata', () => {
  const unsignedPayload = {
    uuid: 'invoice-123',
    order_id: 'order-789',
    amount: '199.00',
    currency: 'USD',
    payer_amount: '199.12',
    payer_currency: 'USDT',
    network: 'base',
    address: '0x123',
    txid: '0xabc',
    payment_status: 'paid',
    additional_data: JSON.stringify({
      email: 'buyer@example.com',
    }),
  }
  const apiKey = 'cryptomus-secret'
  const digest = createHash('md5')
    .update(Buffer.from(JSON.stringify(unsignedPayload), 'utf8').toString('base64') + apiKey)
    .digest('hex')

  const payload = {
    ...unsignedPayload,
    sign: digest,
  }

  assert.equal(verifyCryptomusWebhookSignature(payload, apiKey), true)

  const record = extractCryptomusWebhookRecord(payload)
  assert.equal(record.provider, 'cryptomus')
  assert.equal(record.providerPaymentId, 'invoice-123')
  assert.equal(record.orderId, 'order-789')
  assert.equal(record.paymentStatus, 'finished')
  assert.equal(record.payCurrency, 'usdt')
})
