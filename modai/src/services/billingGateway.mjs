import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const BILLING_PLANS = [
  {
    id: 'starter-monthly',
    label: 'Starter Monthly',
    kind: 'subscription',
    billingRail: 'card',
    amountUsd: 12,
    activationLimit: 2,
    intervalLabel: 'Monthly',
    cardUrlEnv: 'MODAI_LEMON_STARTER_MONTHLY_URL',
  },
  {
    id: 'pro-annual',
    label: 'Pro Annual',
    kind: 'license',
    billingRail: 'hybrid',
    amountUsd: 199,
    activationLimit: 5,
    intervalLabel: 'Annual',
    cardUrlEnv: 'MODAI_LEMON_PRO_ANNUAL_URL',
  },
  {
    id: 'founder-pass',
    label: 'Founder Pass',
    kind: 'license',
    billingRail: 'hybrid',
    amountUsd: 299,
    activationLimit: 5,
    intervalLabel: 'One-time',
    cardUrlEnv: 'MODAI_LEMON_FOUNDER_URL',
  },
]

const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const DIRECT_CRYPTO_NETWORKS = {
  solana: {
    id: 'solana',
    label: 'Solana',
    family: 'solana',
    recipientAddress: '3X4w9TJSjiQVsQrwhTZ2a7CEKNvgt7QRp15ZtmAd72nj',
    rpcUrlEnv: 'MODAI_SOLANA_RPC_URL',
    defaultRpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerTxBase: 'https://explorer.solana.com/tx/',
    assets: {
      usdc: {
        id: 'usdc',
        label: 'USDC',
        decimals: 6,
        kind: 'spl',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      },
      usdt: {
        id: 'usdt',
        label: 'USDT',
        decimals: 6,
        kind: 'spl',
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      },
    },
  },
  ethereum: {
    id: 'ethereum',
    label: 'Ethereum',
    family: 'evm',
    recipientAddress: '0x7aAA6Bf8D0D33D7d26201E0Ad350f2be821f70f1',
    rpcUrlEnv: 'MODAI_ETHEREUM_RPC_URL',
    explorerTxBase: 'https://etherscan.io/tx/',
    assets: {
      usdc: {
        id: 'usdc',
        label: 'USDC',
        decimals: 6,
        kind: 'erc20',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      },
      usdt: {
        id: 'usdt',
        label: 'USDT',
        decimals: 6,
        kind: 'erc20',
        tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      },
    },
  },
  avalanche: {
    id: 'avalanche',
    label: 'Avalanche C-Chain',
    family: 'evm',
    recipientAddress: '0x7aAA6Bf8D0D33D7d26201E0Ad350f2be821f70f1',
    rpcUrlEnv: 'MODAI_AVALANCHE_RPC_URL',
    explorerTxBase: 'https://snowtrace.io/tx/',
    assets: {
      usdc: {
        id: 'usdc',
        label: 'USDC',
        decimals: 6,
        kind: 'erc20',
        tokenAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      },
      usdt: {
        id: 'usdt',
        label: 'USDT',
        decimals: 6,
        kind: 'erc20',
        tokenAddress: '0x9702230A8Ea53601f5cd2dc00fDBC13d4Df4A8c7',
      },
    },
  },
  base: {
    id: 'base',
    label: 'Base',
    family: 'evm',
    recipientAddress: '0x748bcF72eFA19eFEf100C5ED382D2c99520f057C',
    rpcUrlEnv: 'MODAI_BASE_RPC_URL',
    explorerTxBase: 'https://basescan.org/tx/',
    assets: {
      usdc: {
        id: 'usdc',
        label: 'USDC',
        decimals: 6,
        kind: 'erc20',
        tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      },
    },
  },
  monad: {
    id: 'monad',
    label: 'Monad',
    family: 'evm',
    recipientAddress: '0x748bcF72eFA19eFEf100C5ED382D2c99520f057C',
    rpcUrlEnv: 'MODAI_MONAD_RPC_URL',
    explorerTxBase: '',
    assets: {
      usdc: {
        id: 'usdc',
        label: 'USDC',
        decimals: 6,
        kind: 'erc20',
        tokenAddress: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
      },
    },
  },
  bsc: {
    id: 'bsc',
    label: 'BNB Smart Chain',
    family: 'evm',
    recipientAddress: '0x7aAA6Bf8D0D33D7d26201E0Ad350f2be821f70f1',
    rpcUrlEnv: 'MODAI_BSC_RPC_URL',
    explorerTxBase: 'https://bscscan.com/tx/',
    assets: {
      usdc: {
        id: 'usdc',
        label: 'USDC',
        decimals: 18,
        kind: 'erc20',
        tokenAddressEnv: 'MODAI_BSC_USDC_CONTRACT',
      },
      usdt: {
        id: 'usdt',
        label: 'USDT',
        decimals: 18,
        kind: 'erc20',
        tokenAddressEnv: 'MODAI_BSC_USDT_CONTRACT',
      },
    },
  },
  bitcoin: {
    id: 'bitcoin',
    label: 'Bitcoin',
    family: 'bitcoin',
    recipientAddress: 'bc1p5qcj6lquhmpy4lz5qzkv4g3th6zh9keh5xdye5mt09k2fzmtd0ysucwhzs',
    apiBaseEnv: 'MODAI_BITCOIN_API_BASE',
    defaultApiBase: 'https://blockstream.info/api',
    explorerTxBase: 'https://blockstream.info/tx/',
    assets: {
      btc: {
        id: 'btc',
        label: 'BTC',
        decimals: 8,
        kind: 'btc',
      },
    },
  },
}

export function getBillingCatalog() {
  return {
    trialDays: 7,
    cardPlans: BILLING_PLANS.filter(plan => Boolean(getCardCheckoutUrl(plan.id))).map(plan => ({
      ...plan,
      checkoutUrl: getCardCheckoutUrl(plan.id),
    })),
    cryptoPlans: BILLING_PLANS.filter(plan => plan.billingRail === 'hybrid').map(plan => ({
      ...plan,
      currencies: ['usdc', 'usdt'],
    })),
    cryptoNetworks: getDirectCryptoNetworks(),
    allPlans: BILLING_PLANS.map(plan => ({
      ...plan,
      checkoutUrl: getCardCheckoutUrl(plan.id),
      currencies: plan.billingRail === 'hybrid' ? ['usdc', 'usdt'] : [],
    })),
  }
}

export function resolveBillingPlan(planId) {
  const plan = BILLING_PLANS.find(item => item.id === planId)
  if (!plan) {
    throw new Error('Unknown billing plan')
  }
  return {
    ...plan,
    checkoutUrl: getCardCheckoutUrl(plan.id),
    currencies: plan.billingRail === 'hybrid' ? ['usdc', 'usdt'] : [],
  }
}

export function getCardCheckoutUrl(planId) {
  const plan = BILLING_PLANS.find(item => item.id === planId)
  if (!plan) {
    return ''
  }
  return String(process.env[plan.cardUrlEnv] ?? '').trim()
}

export function getBillingEnvironment() {
  const webhookBaseUrl = String(process.env.MODAI_BILLING_WEBHOOK_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const lemonUrlsConfigured = BILLING_PLANS.some(plan => Boolean(getCardCheckoutUrl(plan.id)))
  const lemonWebhookSecret = String(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET ?? '').trim()
  const nowPaymentsApiKey = String(process.env.NOWPAYMENTS_API_KEY ?? '').trim()
  const nowPaymentsIpnSecret = String(process.env.NOWPAYMENTS_IPN_SECRET ?? '').trim()
  const directWallets = getDirectCryptoNetworks()
  const directWalletConfigured = directWallets.length > 0
  const processorConfigured = Boolean(nowPaymentsApiKey)

  return {
    webhookBaseUrl,
    lemon: {
      cardCheckoutConfigured: lemonUrlsConfigured,
      webhookConfigured: Boolean(lemonWebhookSecret),
      licenseApiAvailable: true,
    },
    crypto: {
      configured: directWalletConfigured || processorConfigured,
      webhookConfigured: Boolean(nowPaymentsIpnSecret),
      sandboxMode: !directWalletConfigured && !processorConfigured,
      mode: directWalletConfigured ? 'direct-wallet' : processorConfigured ? 'processor' : 'sandbox',
      directWallets,
    },
  }
}

export async function activateLemonLicense({
  licenseKey,
  instanceId = '',
  deviceName,
  fetchImpl = fetch,
}) {
  const trimmedKey = String(licenseKey ?? '').trim()
  if (!trimmedKey) {
    throw new Error('License key is required')
  }

  const validatePayload = new URLSearchParams({ license_key: trimmedKey })
  if (instanceId) {
    validatePayload.set('instance_id', instanceId)
  }
  const validateResponse = await fetchImpl('https://api.lemonsqueezy.com/v1/licenses/validate', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: validatePayload,
  })
  const validateBody = await validateResponse.json()
  if (!validateResponse.ok || validateBody.valid === false) {
    throw new Error(validateBody.error || 'Lemon Squeezy license validation failed')
  }

  let activationBody = {
    activated: false,
    error: null,
    license_key: validateBody.license_key,
    instance: validateBody.instance,
    meta: validateBody.meta,
  }

  if (!validateBody.instance) {
    const activatePayload = new URLSearchParams({
      license_key: trimmedKey,
      instance_name: String(deviceName ?? 'modAI device').trim() || 'modAI device',
    })
    const activateResponse = await fetchImpl('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: activatePayload,
    })
    activationBody = await activateResponse.json()
    if (!activateResponse.ok || activationBody.activated === false) {
      throw new Error(activationBody.error || 'Lemon Squeezy license activation failed')
    }
  }

  const lemonLicense = activationBody.license_key ?? validateBody.license_key ?? {}
  const lemonMeta = activationBody.meta ?? validateBody.meta ?? {}
  return {
    source: 'lemon-squeezy',
    licenseKey: lemonLicense.key ?? trimmedKey,
    status: lemonLicense.status ?? 'active',
    activationLimit: Number(lemonLicense.activation_limit ?? 1) || 1,
    activationUsage: Number(lemonLicense.activation_usage ?? 0) || 0,
    instanceId: activationBody.instance?.id ?? validateBody.instance?.id ?? '',
    instanceName: activationBody.instance?.name ?? validateBody.instance?.name ?? deviceName ?? '',
    expiresAt: lemonLicense.expires_at ?? null,
    email: lemonMeta.customer_email ?? '',
    customerName: lemonMeta.customer_name ?? '',
    orderId: String(lemonMeta.order_id ?? ''),
    productName: lemonMeta.product_name ?? '',
    variantName: lemonMeta.variant_name ?? '',
    planLabel: [lemonMeta.product_name, lemonMeta.variant_name].filter(Boolean).join(' · '),
    raw: {
      validate: validateBody,
      activate: activationBody,
    },
  }
}

export async function createNowPaymentsPayment({
  plan,
  currency,
  email,
  deviceId,
  deviceName,
  fetchImpl = fetch,
}) {
  const normalizedCurrency = String(currency ?? '').trim().toLowerCase()
  if (!['usdc', 'usdt'].includes(normalizedCurrency)) {
    throw new Error('Only USDC and USDT are supported for crypto checkout')
  }

  const orderId = `modai-${plan.id}-${Date.now()}-${randomUUID().slice(0, 8)}`
  const webhookBaseUrl = String(process.env.MODAI_BILLING_WEBHOOK_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const apiKey = String(process.env.NOWPAYMENTS_API_KEY ?? '').trim()
  if (!apiKey) {
    return {
      provider: 'sandbox',
      providerPaymentId: `sandbox-${randomUUID()}`,
      orderId,
      paymentStatus: 'waiting',
      payCurrency: normalizedCurrency,
      payAmount: String(plan.amountUsd),
      payAddress: `sandbox-${normalizedCurrency}-${randomUUID().slice(0, 18)}`,
      payinExtraId: '',
      purchaseId: '',
      priceAmount: plan.amountUsd,
      priceCurrency: 'usd',
      email,
      deviceId,
      deviceName,
      payUrl: '',
      raw: {
        simulated: true,
      },
    }
  }

  const payload = {
    price_amount: plan.amountUsd,
    price_currency: 'usd',
    pay_currency: normalizedCurrency,
    order_id: orderId,
    order_description: `modAI ${plan.label}`,
  }

  if (email) {
    payload.customer_email = email
  }
  if (webhookBaseUrl) {
    payload.ipn_callback_url = `${webhookBaseUrl}/api/webhooks/crypto`
    payload.success_url = `${webhookBaseUrl}/?checkout=success`
    payload.cancel_url = `${webhookBaseUrl}/?checkout=cancelled`
  }

  const response = await fetchImpl('https://api.nowpayments.io/v1/payment', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || data.error || 'NOWPayments payment creation failed')
  }

  return {
    provider: 'nowpayments',
    providerPaymentId: String(data.payment_id ?? data.id ?? ''),
    orderId,
    paymentStatus: String(data.payment_status ?? 'waiting'),
    payCurrency: String(data.pay_currency ?? normalizedCurrency),
    payAmount: String(data.pay_amount ?? ''),
    payAddress: String(data.pay_address ?? ''),
    payinExtraId: String(data.payin_extra_id ?? ''),
    purchaseId: String(data.purchase_id ?? ''),
    priceAmount: Number(data.price_amount ?? plan.amountUsd),
    priceCurrency: String(data.price_currency ?? 'usd'),
    email,
    deviceId,
    deviceName,
    payUrl: String(data.invoice_url ?? data.pay_url ?? ''),
    raw: data,
  }
}

export async function refreshNowPaymentsPayment(providerPaymentId, { fetchImpl = fetch } = {}) {
  const apiKey = String(process.env.NOWPAYMENTS_API_KEY ?? '').trim()
  if (!apiKey) {
    return null
  }

  const response = await fetchImpl(`https://api.nowpayments.io/v1/payment/${encodeURIComponent(providerPaymentId)}`, {
    headers: {
      'x-api-key': apiKey,
    },
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || data.error || 'NOWPayments payment refresh failed')
  }
  return {
    providerPaymentId: String(data.payment_id ?? providerPaymentId),
    paymentStatus: String(data.payment_status ?? 'waiting'),
    payCurrency: String(data.pay_currency ?? ''),
    payAmount: String(data.pay_amount ?? ''),
    actuallyPaid: String(data.actually_paid ?? ''),
    payAddress: String(data.pay_address ?? ''),
    purchaseId: String(data.purchase_id ?? ''),
    outcomeAmount: String(data.outcome_amount ?? ''),
    outcomeCurrency: String(data.outcome_currency ?? ''),
    txHash: String(data.payin_hash ?? ''),
    raw: data,
  }
}

export function getDirectCryptoNetworks() {
  return Object.values(DIRECT_CRYPTO_NETWORKS)
    .map(network => {
      const assets = Object.values(network.assets)
        .map(asset => resolveDirectCryptoAsset(network.id, asset.id))
        .filter(Boolean)

      if (!assets.length) {
        return null
      }

      return {
        id: network.id,
        label: network.label,
        family: network.family,
        recipientAddress: network.recipientAddress,
        verificationReady: isDirectWalletVerificationReady(network),
        verificationEnvKey: getDirectWalletVerificationEnvKey(network),
        assets: assets.map(asset => ({
          id: asset.id,
          label: asset.label,
        })),
      }
    })
    .filter(Boolean)
}

function isDirectWalletVerificationReady(network) {
  if (network.family === 'solana' || network.family === 'bitcoin') {
    return true
  }
  if (network.family === 'evm') {
    return Boolean(String(process.env[network.rpcUrlEnv] ?? '').trim())
  }
  return false
}

function getDirectWalletVerificationEnvKey(network) {
  if (network.family === 'evm') {
    return network.rpcUrlEnv
  }
  return ''
}

export function resolveDirectCryptoAsset(networkId, assetId) {
  const network = DIRECT_CRYPTO_NETWORKS[networkId]
  if (!network) {
    return null
  }

  const asset = network.assets[assetId]
  if (!asset) {
    return null
  }

  const tokenAddress = asset.tokenAddressEnv
    ? String(process.env[asset.tokenAddressEnv] ?? '').trim()
    : asset.tokenAddress

  if (asset.kind === 'erc20' && !tokenAddress) {
    return null
  }

  return {
    ...asset,
    tokenAddress,
  }
}

export async function createDirectCryptoInvoice({
  plan,
  networkId,
  assetId,
  email,
  deviceName,
  payerAddress = '',
  fetchImpl = fetch,
}) {
  const network = DIRECT_CRYPTO_NETWORKS[networkId]
  const asset = resolveDirectCryptoAsset(networkId, assetId)
  if (!network || !asset) {
    throw new Error('Selected crypto network or asset is not configured')
  }

  const quoted = asset.kind === 'btc'
    ? await quoteBitcoinAmount(plan.amountUsd, { fetchImpl })
    : quoteStableAmount(plan.amountUsd, asset.decimals)

  const orderId = `modai-${plan.id}-${network.id}-${Date.now()}-${randomUUID().slice(0, 8)}`
  const quoteExpiresAt = new Date(Date.now() + 20 * 60_000).toISOString()
  const confirmationsRequired = network.family === 'bitcoin' ? 1 : network.family === 'solana' ? 1 : 2

  return {
    provider: 'wallet-direct',
    providerPaymentId: `wallet-${randomUUID()}`,
    orderId,
    paymentStatus: 'waiting',
    payCurrency: asset.id,
    payAmount: quoted.displayAmount,
    payAddress: network.recipientAddress,
    priceAmount: plan.amountUsd,
    priceCurrency: 'usd',
    email,
    deviceName,
    payUrl: '',
    payerAddress: String(payerAddress ?? '').trim(),
    cryptoNetwork: network.id,
    cryptoNetworkLabel: network.label,
    cryptoAsset: asset.id,
    cryptoAssetLabel: asset.label,
    tokenAddress: asset.tokenAddress ?? '',
    assetKind: asset.kind,
    assetDecimals: asset.decimals,
    expectedAmountAtomic: quoted.atomicAmount,
    quoteExpiresAt,
    confirmationsRequired,
    explorerUrl: network.explorerTxBase,
    raw: {
      quoted,
    },
  }
}

export async function verifyDirectCryptoTransfer(payment, { txHash, payerAddress = '', fetchImpl = fetch }) {
  const networkId = payment.cryptoNetwork
  const assetId = payment.cryptoAsset
  const network = DIRECT_CRYPTO_NETWORKS[networkId]
  const asset = resolveDirectCryptoAsset(networkId, assetId)
  if (!network || !asset) {
    throw new Error('Selected crypto network or asset is not configured')
  }

  const paymentInput = {
    txHash: String(txHash ?? '').trim(),
    payerAddress: String(payerAddress ?? payment.payerAddress ?? '').trim(),
    recipientAddress: payment.payAddress,
    expectedAmountAtomic: String(payment.expectedAmountAtomic ?? ''),
    confirmationsRequired: Number(payment.confirmationsRequired ?? 1) || 1,
    tokenAddress: asset.tokenAddress ?? '',
    mint: asset.mint ?? '',
    assetDecimals: Number(payment.assetDecimals ?? asset.decimals ?? 0) || asset.decimals,
    quoteExpiresAt: payment.quoteExpiresAt,
    explorerTxBase: network.explorerTxBase,
  }

  if (!paymentInput.txHash) {
    throw new Error('Transaction hash is required')
  }
  if (paymentInput.quoteExpiresAt && new Date(paymentInput.quoteExpiresAt).getTime() < Date.now()) {
    throw new Error('This crypto invoice has expired. Create a new one before verifying the transfer.')
  }

  if (network.family === 'evm') {
    return verifyEvmTransfer(network, paymentInput, { fetchImpl })
  }
  if (network.family === 'solana') {
    return verifySolanaTransfer(network, paymentInput, { fetchImpl })
  }
  if (network.family === 'bitcoin') {
    return verifyBitcoinTransfer(network, paymentInput, { fetchImpl })
  }

  throw new Error('Unsupported crypto network')
}

export function verifyLemonWebhookSignature(rawBody, signature, secret) {
  return verifyWebhookSignature({
    rawBody,
    signature,
    secret,
    algorithms: ['sha256'],
  })
}

export function verifyNowPaymentsWebhookSignature(rawBody, signature, secret) {
  return verifyWebhookSignature({
    rawBody,
    signature,
    secret,
    algorithms: ['sha256', 'sha512'],
  })
}

export function extractLemonWebhookRecord(payload = {}) {
  const data = payload.data ?? {}
  const attributes = data.attributes ?? {}
  const eventName = payload.meta?.event_name ?? ''
  const type = data.type ?? ''
  return {
    provider: 'lemon-squeezy',
    eventName,
    type,
    providerObjectId: String(data.id ?? ''),
    orderId: String(attributes.order_id ?? ''),
    email: String(attributes.user_email ?? payload.meta?.custom_data?.email ?? ''),
    productName: String(attributes.product_name ?? attributes.first_order_item?.product_name ?? ''),
    variantName: String(attributes.variant_name ?? attributes.first_order_item?.variant_name ?? ''),
    licenseKey: String(attributes.key ?? ''),
    status: String(attributes.status ?? ''),
    activationLimit: Number(attributes.activation_limit ?? 0) || 0,
    expiresAt: attributes.expires_at ?? null,
    orderIdentifier: String(attributes.identifier ?? ''),
    createdAt: attributes.created_at ?? new Date().toISOString(),
    raw: payload,
  }
}

export function extractNowPaymentsWebhookRecord(payload = {}) {
  return {
    provider: 'nowpayments',
    providerPaymentId: String(payload.payment_id ?? payload.id ?? ''),
    orderId: String(payload.order_id ?? ''),
    email: String(payload.customer_email ?? ''),
    paymentStatus: String(payload.payment_status ?? ''),
    priceAmount: Number(payload.price_amount ?? 0) || 0,
    priceCurrency: String(payload.price_currency ?? 'usd'),
    payAmount: String(payload.pay_amount ?? ''),
    payCurrency: String(payload.pay_currency ?? ''),
    actuallyPaid: String(payload.actually_paid ?? ''),
    payAddress: String(payload.pay_address ?? ''),
    outcomeAmount: String(payload.outcome_amount ?? ''),
    outcomeCurrency: String(payload.outcome_currency ?? ''),
    txHash: String(payload.payin_hash ?? ''),
    createdAt: payload.created_at ?? new Date().toISOString(),
    raw: payload,
  }
}

export function isSuccessfulCryptoStatus(status) {
  return ['confirmed', 'finished', 'sending'].includes(String(status ?? '').trim().toLowerCase())
}

export function isFinalCryptoStatus(status) {
  return ['confirmed', 'finished', 'sending', 'failed', 'expired', 'refunded', 'partially_paid'].includes(
    String(status ?? '').trim().toLowerCase(),
  )
}

function quoteStableAmount(usdAmount, decimals) {
  const fraction = Number(`0.${String(randomUUID().slice(0, 4).replace(/[^0-9]/g, '') || '137').padEnd(4, '7').slice(0, 4)}`)
  const amount = (Number(usdAmount) + fraction).toFixed(Math.min(decimals, 6))
  return {
    displayAmount: trimNumericString(amount),
    atomicAmount: toAtomicAmount(amount, decimals),
  }
}

async function quoteBitcoinAmount(usdAmount, { fetchImpl }) {
  const response = await fetchImpl('https://api.coinbase.com/v2/prices/BTC-USD/spot')
  const data = await response.json()
  const spot = Number(data?.data?.amount ?? 0)
  if (!response.ok || !Number.isFinite(spot) || spot <= 0) {
    throw new Error('Failed to fetch BTC spot price')
  }

  const uniqueSats = 137 + Number(randomUUID().slice(0, 3).replace(/[^0-9]/g, '') || 0)
  const rawAmount = Number(usdAmount) / spot + uniqueSats / 100_000_000
  const fixed = rawAmount.toFixed(8)
  return {
    displayAmount: trimNumericString(fixed),
    atomicAmount: toAtomicAmount(fixed, 8),
  }
}

async function verifyEvmTransfer(network, input, { fetchImpl }) {
  const rpcUrl = String(process.env[network.rpcUrlEnv] ?? '').trim()
  if (!rpcUrl) {
    throw new Error(`${network.label} verification requires ${network.rpcUrlEnv}`)
  }

  const [receipt, latestBlock, tx] = await Promise.all([
    callJsonRpc(rpcUrl, 'eth_getTransactionReceipt', [input.txHash], { fetchImpl }),
    callJsonRpc(rpcUrl, 'eth_blockNumber', [], { fetchImpl }),
    callJsonRpc(rpcUrl, 'eth_getTransactionByHash', [input.txHash], { fetchImpl }),
  ])
  if (!receipt || receipt.status !== '0x1') {
    throw new Error('Transaction is missing or not successful')
  }

  const latest = hexToBigInt(latestBlock)
  const blockNumber = hexToBigInt(receipt.blockNumber)
  const confirmations = Number(latest - blockNumber + 1n)
  if (confirmations < input.confirmationsRequired) {
    throw new Error(`Waiting for confirmations (${confirmations}/${input.confirmationsRequired})`)
  }

  const recipientTopic = padAddressTopic(input.recipientAddress)
  const payerTopic = input.payerAddress ? padAddressTopic(input.payerAddress) : ''
  const expectedAtomic = BigInt(input.expectedAmountAtomic)
  const matchingLog = (receipt.logs ?? []).find(log => (
    String(log.address ?? '').toLowerCase() === input.tokenAddress.toLowerCase()
    && Array.isArray(log.topics)
    && log.topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC
    && log.topics[2]?.toLowerCase() === recipientTopic
    && (!payerTopic || log.topics[1]?.toLowerCase() === payerTopic)
    && hexToBigInt(log.data ?? '0x0') >= expectedAtomic
  ))

  if (!matchingLog) {
    throw new Error('No matching token transfer was found for this invoice')
  }

  return {
    paymentStatus: 'finished',
    txHash: input.txHash,
    payerAddress: tx?.from ?? input.payerAddress,
    payAddress: input.recipientAddress,
    actuallyPaid: fromAtomicAmount(hexToBigInt(matchingLog.data ?? '0x0').toString(), input.assetDecimals),
    outcomeAmount: fromAtomicAmount(hexToBigInt(matchingLog.data ?? '0x0').toString(), input.assetDecimals),
    outcomeCurrency: '',
    confirmations,
    raw: {
      receipt,
      tx,
    },
  }
}

async function verifySolanaTransfer(network, input, { fetchImpl }) {
  const rpcUrl = String(process.env[network.rpcUrlEnv] ?? '').trim() || network.defaultRpcUrl
  const transaction = await callJsonRpc(rpcUrl, 'getTransaction', [
    input.txHash,
    {
      commitment: 'finalized',
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
    },
  ], { fetchImpl })
  if (!transaction?.meta) {
    throw new Error('Solana transaction not found or not finalized')
  }

  const postBalances = transaction.meta.postTokenBalances ?? []
  const preBalances = transaction.meta.preTokenBalances ?? []
  const recipientPost = postBalances.find(entry => (
    entry.owner === input.recipientAddress && entry.mint === input.mint
  ))
  const recipientPre = preBalances.find(entry => (
    entry.owner === input.recipientAddress && entry.mint === input.mint
  ))

  const received = BigInt(recipientPost?.uiTokenAmount?.amount ?? '0') - BigInt(recipientPre?.uiTokenAmount?.amount ?? '0')
  if (received < BigInt(input.expectedAmountAtomic)) {
    throw new Error('No matching Solana token transfer was found for this invoice')
  }

  if (input.payerAddress) {
    const payerPost = postBalances.find(entry => entry.owner === input.payerAddress && entry.mint === input.mint)
    const payerPre = preBalances.find(entry => entry.owner === input.payerAddress && entry.mint === input.mint)
    const sent = BigInt(payerPre?.uiTokenAmount?.amount ?? '0') - BigInt(payerPost?.uiTokenAmount?.amount ?? '0')
    if (sent < BigInt(input.expectedAmountAtomic)) {
      throw new Error('The payer wallet does not match the verified transfer')
    }
  }

  return {
    paymentStatus: 'finished',
    txHash: input.txHash,
    payAddress: input.recipientAddress,
    payerAddress: input.payerAddress,
    actuallyPaid: fromAtomicAmount(received.toString(), input.assetDecimals),
    outcomeAmount: fromAtomicAmount(received.toString(), input.assetDecimals),
    outcomeCurrency: '',
    confirmations: input.confirmationsRequired,
    raw: {
      transaction,
    },
  }
}

async function verifyBitcoinTransfer(network, input, { fetchImpl }) {
  const apiBase = String(process.env[network.apiBaseEnv] ?? '').trim() || network.defaultApiBase
  const txResponse = await fetchImpl(`${apiBase}/tx/${encodeURIComponent(input.txHash)}`)
  const tx = await txResponse.json()
  if (!txResponse.ok) {
    throw new Error('Bitcoin transaction lookup failed')
  }

  const expectedSats = BigInt(input.expectedAmountAtomic)
  const matchingOutput = (tx.vout ?? []).find(output => (
    output.scriptpubkey_address === input.recipientAddress && BigInt(output.value ?? 0) >= expectedSats
  ))
  if (!matchingOutput) {
    throw new Error('No matching BTC output was found for this invoice')
  }

  if (input.payerAddress) {
    const payerInput = (tx.vin ?? []).find(vin => vin.prevout?.scriptpubkey_address === input.payerAddress)
    if (!payerInput) {
      throw new Error('The payer wallet does not match the verified BTC transfer')
    }
  }

  let confirmations = tx.status?.confirmed ? 1 : 0
  if (tx.status?.confirmed && tx.status.block_height) {
    const tipResponse = await fetchImpl(`${apiBase}/blocks/tip/height`)
    const tipText = await tipResponse.text()
    const tip = Number(tipText)
    if (tipResponse.ok && Number.isFinite(tip)) {
      confirmations = tip - Number(tx.status.block_height) + 1
    }
  }

  if (confirmations < input.confirmationsRequired) {
    throw new Error(`Waiting for confirmations (${confirmations}/${input.confirmationsRequired})`)
  }

  return {
    paymentStatus: 'finished',
    txHash: input.txHash,
    payAddress: input.recipientAddress,
    payerAddress: input.payerAddress,
    actuallyPaid: fromAtomicAmount(String(matchingOutput.value ?? 0), 8),
    outcomeAmount: fromAtomicAmount(String(matchingOutput.value ?? 0), 8),
    outcomeCurrency: 'btc',
    confirmations,
    raw: {
      transaction: tx,
    },
  }
}

async function callJsonRpc(url, method, params, { fetchImpl }) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  })
  const data = await response.json()
  if (!response.ok || data.error) {
    throw new Error(data?.error?.message || `${method} failed`)
  }
  return data.result
}

function toAtomicAmount(value, decimals) {
  const [whole, fraction = ''] = String(value).split('.')
  return `${whole}${fraction.padEnd(decimals, '0').slice(0, decimals)}`.replace(/^0+(?=\d)/, '')
}

function fromAtomicAmount(value, decimals) {
  const normalized = String(value).replace(/^0+/, '') || '0'
  const padded = normalized.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals) || '0'
  const fraction = padded.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

function trimNumericString(value) {
  return String(value).replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '')
}

function padAddressTopic(address) {
  return `0x${String(address).toLowerCase().replace(/^0x/, '').padStart(64, '0')}`
}

function hexToBigInt(value) {
  return BigInt(String(value ?? '0x0'))
}

function verifyWebhookSignature({ rawBody, signature, secret, algorithms }) {
  const normalizedSecret = String(secret ?? '').trim()
  const normalizedSignature = String(signature ?? '').trim()
  if (!normalizedSecret || !normalizedSignature) {
    return false
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ''), 'utf8')
  const signatureBuffer = Buffer.from(normalizedSignature, 'utf8')

  return algorithms.some(algorithm => {
    const digest = Buffer.from(createHmac(algorithm, normalizedSecret).update(payload).digest('hex'), 'utf8')
    return digest.length === signatureBuffer.length && timingSafeEqual(digest, signatureBuffer)
  })
}
