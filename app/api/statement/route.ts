import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress, type Address } from 'viem'

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────

const CELO_CHAIN_ID = 42220
const USDC_TOKEN = '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B'
const USDC_DECIMALS = 18n
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/** 90 days of history */
const LOOKBACK_DAYS = 90

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

interface CovalentTransfer {
  readonly block_signed_at: string
  readonly tx_hash: string
  readonly from_address: string
  readonly to_address: string
  readonly transfer_type: string
  readonly delta: string
  readonly delta_quote: number | null
  readonly contract_decimals: number
  readonly contract_address: string
  readonly contract_ticker_symbol: string
}

interface CovalentTransferResponse {
  readonly data?: {
    readonly items?: ReadonlyArray<{
      readonly transfers?: readonly CovalentTransfer[]
    }>
  }
  readonly error?: boolean
  readonly error_message?: string
}

interface TransferRecord {
  readonly hash: string
  readonly from: string
  readonly to: string
  readonly amount: bigint
  readonly timestamp: string
  readonly direction: 'inbound' | 'outbound'
}

interface MonthlyBucket {
  readonly month: string       // YYYY-MM
  readonly inbound: bigint
  readonly outbound: bigint
  readonly txCount: number
}

export interface StatementResponse {
  readonly ok: boolean
  readonly merchant: string
  readonly generatedAt: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly summary: {
    readonly totalInbound: string
    readonly totalOutbound: string
    readonly netFlow: string
    readonly transactionCount: number
    readonly mrr: string
    readonly churnVolatility: string
    readonly avgDaysBetweenDeposits: string
  }
  readonly monthlyBreakdown: ReadonlyArray<{
    readonly month: string
    readonly inbound: string
    readonly outbound: string
    readonly net: string
    readonly txCount: number
  }>
  readonly localValuation: ReadonlyArray<{
    readonly currency: string
    readonly netFlowLocal: string
    readonly mrrLocal: string
    readonly quotedAt: string
  }>
  readonly transfers: ReadonlyArray<{
    readonly hash: string
    readonly from: string
    readonly to: string
    readonly amount: string
    readonly timestamp: string
    readonly direction: 'inbound' | 'outbound'
  }>
  readonly error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
//  Utilities (Deterministic BigInt Math)
// ─────────────────────────────────────────────────────────────────────────────

const formatUsdc = (value: bigint): string => {
  const whole = value / 10n ** USDC_DECIMALS
  const frac = value % 10n ** USDC_DECIMALS
  const fracStr = frac.toString().padStart(Number(USDC_DECIMALS), '0').slice(0, 6)
  const sign = value < 0n ? '-' : ''
  const absWhole = whole < 0n ? -whole : whole
  return `${sign}${absWhole.toString()}.${fracStr}`
}

const absBigInt = (v: bigint): bigint => (v < 0n ? -v : v)

/**
 * Standard deviation of intervals between timestamps (in days),
 * computed entirely in BigInt to avoid floating-point drift.
 * Returns a string representing the result with 2 decimal places.
 */
const computeVolatility = (timestamps: readonly string[]): string => {
  if (timestamps.length < 2) return '0.00'

  const sorted = [...timestamps]
    .map((t) => BigInt(Math.floor(new Date(t).getTime() / 1000)))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const intervals: bigint[] = []
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i] - sorted[i - 1])
  }

  if (intervals.length === 0) return '0.00'

  // Mean (in seconds)
  const sum = intervals.reduce((acc, v) => acc + v, 0n)
  const mean = sum / BigInt(intervals.length)

  // Variance (in seconds^2), then sqrt → std dev in seconds
  const varianceSum = intervals.reduce((acc, v) => {
    const diff = v - mean
    return acc + diff * diff
  }, 0n)
  const variance = varianceSum / BigInt(intervals.length)

  // Integer sqrt (Babylonian)
  let stdDevSeconds = 0n
  if (variance > 0n) {
    let z = (variance + 1n) / 2n
    let y = variance
    while (z < y) {
      y = z
      z = (variance / z + z) / 2n
    }
    stdDevSeconds = y
  }

  // Convert to days (86400 seconds per day), with 2 decimal precision
  const stdDevDays100 = (stdDevSeconds * 100n) / 86400n
  const whole = stdDevDays100 / 100n
  const frac = absBigInt(stdDevDays100 % 100n)
  return `${whole}.${frac.toString().padStart(2, '0')}`
}

const computeAvgDaysBetweenDeposits = (timestamps: readonly string[]): string => {
  if (timestamps.length < 2) return '0.00'

  const sorted = [...timestamps]
    .map((t) => BigInt(Math.floor(new Date(t).getTime() / 1000)))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

  const totalSpan = sorted[sorted.length - 1] - sorted[0]
  const avgSeconds100 = (totalSpan * 100n) / BigInt(sorted.length - 1)
  const days100 = avgSeconds100 / 86400n
  const whole = days100 / 100n
  const frac = days100 % 100n
  return `${whole}.${frac.toString().padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Covalent Data Fetcher
// ─────────────────────────────────────────────────────────────────────────────

const fetchTransfers = async (
  merchantAddress: Address,
  apiKey: string
): Promise<TransferRecord[]> => {
  const lowerMerchant = merchantAddress.toLowerCase()
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - LOOKBACK_DAYS)

  const url = new URL(
    `https://api.covalenthq.com/v1/${CELO_CHAIN_ID}/address/${lowerMerchant}/transfers_v2/`
  )
  url.searchParams.set('contract-address', USDC_TOKEN)
  url.searchParams.set('starting-block', 'earliest')
  url.searchParams.set('ending-block', 'latest')
  url.searchParams.set('page-size', '500')

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    throw new Error(`Covalent API returned ${response.status}: ${response.statusText}`)
  }

  const body = (await response.json()) as CovalentTransferResponse

  if (body.error) {
    throw new Error(`Covalent error: ${body.error_message ?? 'Unknown'}`)
  }

  const items = body.data?.items ?? []
  const records: TransferRecord[] = []

  for (const item of items) {
    const transfers = item.transfers ?? []
    for (const transfer of transfers) {
      const txDate = new Date(transfer.block_signed_at)
      if (txDate < startDate) continue

      const from = transfer.from_address.toLowerCase()
      const to = transfer.to_address.toLowerCase()
      const isInbound = to === lowerMerchant
      const isOutbound = from === lowerMerchant

      if (!isInbound && !isOutbound) continue

      records.push({
        hash: transfer.tx_hash,
        from: transfer.from_address,
        to: transfer.to_address,
        amount: BigInt(transfer.delta || '0'),
        timestamp: transfer.block_signed_at,
        direction: isInbound ? 'inbound' : 'outbound',
      })
    }
  }

  return records
}

// ─────────────────────────────────────────────────────────────────────────────
//  Financial Aggregation
// ─────────────────────────────────────────────────────────────────────────────

const aggregateMonthly = (records: readonly TransferRecord[]): MonthlyBucket[] => {
  const buckets = new Map<string, { inbound: bigint; outbound: bigint; txCount: number }>()

  for (const record of records) {
    const date = new Date(record.timestamp)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!buckets.has(month)) {
      buckets.set(month, { inbound: 0n, outbound: 0n, txCount: 0 })
    }

    const bucket = buckets.get(month)!
    bucket.txCount += 1

    if (record.direction === 'inbound') {
      bucket.inbound += record.amount
    } else {
      bucket.outbound += record.amount
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }))
}

const computeMRR = (monthlyBuckets: readonly MonthlyBucket[]): bigint => {
  if (monthlyBuckets.length === 0) return 0n

  // MRR = average of monthly inbound revenue over available months
  const totalInbound = monthlyBuckets.reduce((acc, b) => acc + b.inbound, 0n)
  return totalInbound / BigInt(monthlyBuckets.length)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Local Currency Valuation (Mento)
// ─────────────────────────────────────────────────────────────────────────────

interface LocalValuationEntry {
  currency: string
  netFlowLocal: string
  mrrLocal: string
  quotedAt: string
}

const getLocalValuations = async (
  netFlow: bigint,
  mrr: bigint,
  rpcUrl: string
): Promise<LocalValuationEntry[]> => {
  try {
    const { fetchMentoLocalParity } = await import('../../utils/mento')
    const quotes = await fetchMentoLocalParity(rpcUrl)
    const oneUsd = 10n ** USDC_DECIMALS

    return quotes.map((quote) => {
      // Scale: (amount * localRate) / 1 USDC_TOKEN
      const netFlowLocal = oneUsd > 0n ? (absBigInt(netFlow) * quote.amountOut) / oneUsd : 0n
      const mrrLocal = oneUsd > 0n ? (mrr * quote.amountOut) / oneUsd : 0n

      return {
        currency: quote.currency,
        netFlowLocal: formatUsdc(netFlowLocal),
        mrrLocal: formatUsdc(mrrLocal),
        quotedAt: quote.quotedAt,
      }
    })
  } catch {
    // Mento SDK may fail on testnet; gracefully degrade
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Route Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawAddress = searchParams.get('address')

  if (!rawAddress || !isAddress(rawAddress)) {
    return NextResponse.json(
      { ok: false, error: 'Missing or invalid `address` query parameter.' },
      { status: 400 }
    )
  }

  const covalentKey = process.env.COVALENT_KEY
  if (!covalentKey) {
    return NextResponse.json(
      { ok: false, error: 'Server misconfiguration: COVALENT_KEY not set.' },
      { status: 500 }
    )
  }

  const merchantAddress = getAddress(rawAddress)
  const rpcUrl = process.env.CELO_RPC || 'https://forno.celo.org'

  try {
    // ── Fetch on-chain transfer history ──────────────────────────────
    const transfers = await fetchTransfers(merchantAddress, covalentKey)

    // ── Aggregate ────────────────────────────────────────────────────
    const totalInbound = transfers
      .filter((t) => t.direction === 'inbound')
      .reduce((acc, t) => acc + t.amount, 0n)

    const totalOutbound = transfers
      .filter((t) => t.direction === 'outbound')
      .reduce((acc, t) => acc + t.amount, 0n)

    const netFlow = totalInbound - totalOutbound

    const inboundTimestamps = transfers
      .filter((t) => t.direction === 'inbound')
      .map((t) => t.timestamp)

    const monthlyBuckets = aggregateMonthly(transfers)
    const mrr = computeMRR(monthlyBuckets)
    const churnVolatility = computeVolatility(inboundTimestamps)
    const avgDays = computeAvgDaysBetweenDeposits(inboundTimestamps)

    // ── Local currency valuations via Mento ──────────────────────────
    const localValuation = await getLocalValuations(netFlow, mrr, rpcUrl)

    // ── Construct response ───────────────────────────────────────────
    const now = new Date()
    const periodStart = new Date()
    periodStart.setDate(periodStart.getDate() - LOOKBACK_DAYS)

    const response: StatementResponse = {
      ok: true,
      merchant: merchantAddress,
      generatedAt: now.toISOString(),
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      summary: {
        totalInbound: formatUsdc(totalInbound),
        totalOutbound: formatUsdc(totalOutbound),
        netFlow: formatUsdc(netFlow),
        transactionCount: transfers.length,
        mrr: formatUsdc(mrr),
        churnVolatility,
        avgDaysBetweenDeposits: avgDays,
      },
      monthlyBreakdown: monthlyBuckets.map((b) => ({
        month: b.month,
        inbound: formatUsdc(b.inbound),
        outbound: formatUsdc(b.outbound),
        net: formatUsdc(b.inbound - b.outbound),
        txCount: b.txCount,
      })),
      localValuation,
      transfers: transfers.slice(0, 100).map((t) => ({
        hash: t.hash,
        from: t.from,
        to: t.to,
        amount: formatUsdc(t.amount),
        timestamp: t.timestamp,
        direction: t.direction,
      })),
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate statement.'
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
