import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { decodeEventLog, getAddress, isAddress, type Address, type Hex } from 'viem'
import { CELO_MAINNET } from '../../utils/constants'
import { getLuminaEnv, hasSupabaseConfig, LuminaConfigurationError, type LuminaRuntimeEnv } from '../../utils/env'
import {
  buildUsdTransferTransaction,
  calculateSplits,
  normalizeFlowRules,
  requireBalancedRules,
  wrapGasless,
  LuminaFlowError,
} from '../../utils/flow-core'
import type { FlowRule, OrchestrationAction, RevenueEvent } from '../../../types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const transferEventAbi = [
  {
    type: 'event',
    name: 'Transfer',
    anonymous: false,
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

type JsonRecord = Record<string, unknown>

interface SerializedFlowSplit {
  readonly recipientLabel: string
  readonly address: Address
  readonly percentage: number
  readonly amount: string
}

interface SerializedAction {
  readonly eventId: string
  readonly rule: FlowRule
  readonly amount: string
  readonly transaction: {
    readonly to: Address
    readonly value: string
    readonly data: Hex
    readonly feeCurrency: Address
    readonly type: '0x7b'
  }
}

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const readString = (record: JsonRecord, key: string): string | null => {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

const readBigInt = (value: unknown): bigint | null => {
  if (typeof value === 'bigint') {
    return value
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return BigInt(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  try {
    return BigInt(value)
  } catch {
    return null
  }
}

const readAddress = (value: unknown): Address | null => {
  return typeof value === 'string' && isAddress(value) ? getAddress(value) : null
}

const readHex = (value: unknown): Hex | null => {
  return typeof value === 'string' && value.startsWith('0x') ? (value as Hex) : null
}

const verifyWebhookSignature = (rawBody: string, request: NextRequest): boolean => {
  const secret = process.env.LUMINA_WEBHOOK_SECRET
  if (!secret) {
    return true
  }

  const signature = request.headers.get('x-lumina-signature')
  if (!signature) {
    return false
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature.replace(/^sha256=/, ''))

  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer)
}

const parseRule = (value: unknown): FlowRule | null => {
  if (!isRecord(value)) {
    return null
  }

  const recipientLabel = readString(value, 'recipientLabel')
  const address = readAddress(value.address)
  const percentage = value.percentage

  if (!recipientLabel || !address || typeof percentage !== 'number') {
    return null
  }

  return {
    recipientLabel,
    address,
    percentage,
    isActive: value.isActive !== false,
  }
}

const readInlineRules = (body: JsonRecord): FlowRule[] | null => {
  const candidate = Array.isArray(body.flowRules)
    ? body.flowRules
    : Array.isArray(body.rules)
      ? body.rules
      : null

  if (!candidate) {
    return null
  }

  const rules = candidate.map(parseRule)
  if (rules.some((rule) => rule === null)) {
    throw new LuminaFlowError('Invalid flowRules payload.')
  }

  return normalizeFlowRules(rules as FlowRule[])
}

const parseRevenueEvent = (value: unknown): RevenueEvent | null => {
  if (!isRecord(value)) {
    return null
  }

  const token = readAddress(value.token)
  const from = readAddress(value.from)
  const to = readAddress(value.to)
  const transactionHash = readHex(value.transactionHash)
  const amount = readBigInt(value.amount)
  const blockNumber = readBigInt(value.blockNumber)
  const logIndex = typeof value.logIndex === 'number' ? value.logIndex : null

  if (!token || !from || !to || !transactionHash || amount === null || blockNumber === null || logIndex === null) {
    return null
  }

  return {
    id: `${transactionHash}:${logIndex}`,
    chainId: CELO_MAINNET.CHAIN_ID,
    token,
    from,
    to,
    amount,
    transactionHash,
    blockNumber,
    logIndex,
    occurredAt: readString(value, 'occurredAt') ?? new Date().toISOString(),
  }
}

const parseRawTransferLog = (value: unknown): RevenueEvent | null => {
  if (!isRecord(value)) {
    return null
  }

  const token = readAddress(value.address)
  const data = readHex(value.data)
  const nestedTransaction = isRecord(value.transaction) ? value.transaction : null
  const transactionHash = readHex(value.transactionHash ?? nestedTransaction?.hash)
  const topics = Array.isArray(value.topics) ? value.topics.filter((topic): topic is Hex => readHex(topic) !== null) : null
  const blockNumber = readBigInt(value.blockNumber)
  const logIndex = typeof value.logIndex === 'number' ? value.logIndex : readBigInt(value.logIndex)

  if (!token || !data || !transactionHash || !topics || topics.length < 3 || blockNumber === null || logIndex === null) {
    return null
  }

  try {
    const transferTopics = topics as [Hex, ...Hex[]]
    const decoded = decodeEventLog({
      abi: transferEventAbi,
      data,
      topics: transferTopics,
    })

    if (decoded.eventName !== 'Transfer') {
      return null
    }

    return {
      id: `${transactionHash}:${logIndex.toString()}`,
      chainId: CELO_MAINNET.CHAIN_ID,
      token,
      from: getAddress(decoded.args.from),
      to: getAddress(decoded.args.to),
      amount: decoded.args.value,
      transactionHash,
      blockNumber,
      logIndex: Number(logIndex),
      occurredAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

const parseAlchemyActivity = (value: unknown): RevenueEvent | null => {
  if (!isRecord(value)) {
    return null
  }

  const rawContract = isRecord(value.rawContract) ? value.rawContract : null
  const token = readAddress(rawContract?.address)
  const from = readAddress(value.fromAddress)
  const to = readAddress(value.toAddress)
  const transactionHash = readHex(value.hash)
  const amount = readBigInt(rawContract?.rawValue)

  if (!token || !from || !to || !transactionHash || amount === null) {
    return null
  }

  return {
    id: `${transactionHash}:0`,
    chainId: CELO_MAINNET.CHAIN_ID,
    token,
    from,
    to,
    amount,
    transactionHash,
    blockNumber: 0n,
    logIndex: 0,
    occurredAt: new Date().toISOString(),
  }
}

const collectEvents = (body: JsonRecord): RevenueEvent[] => {
  const candidates: unknown[] = []

  for (const key of ['event', 'transfer']) {
    if (body[key]) {
      candidates.push(body[key])
    }
  }

  for (const key of ['events', 'logs', 'data']) {
    if (Array.isArray(body[key])) {
      candidates.push(...body[key])
    }
  }

  if (isRecord(body.event) && isRecord(body.event.activity) && Array.isArray(body.event.activity)) {
    candidates.push(...body.event.activity)
  }

  if (isRecord(body.event) && Array.isArray(body.event.activity)) {
    candidates.push(...body.event.activity)
  }

  if (isRecord(body.event) && Array.isArray(body.event.logs)) {
    candidates.push(...body.event.logs)
  }

  if (candidates.length === 0) {
    candidates.push(body)
  }

  return candidates
    .map((candidate) => parseRevenueEvent(candidate) ?? parseRawTransferLog(candidate) ?? parseAlchemyActivity(candidate))
    .filter((event): event is RevenueEvent => event !== null)
}

interface SupabaseRuleRow {
  readonly recipient_label: string
  readonly address: string
  readonly percentage: number
  readonly is_active: boolean
}

const fetchSupabaseRules = async (merchantAddress: Address, env: LuminaRuntimeEnv): Promise<FlowRule[] | null> => {
  if (!hasSupabaseConfig(env)) {
    return null
  }

  const url = new URL('/rest/v1/flow_rules', env.SUPABASE_URL)
  url.searchParams.set('merchant_address', `eq.${merchantAddress.toLowerCase()}`)
  url.searchParams.set('is_active', 'eq.true')
  url.searchParams.set('select', 'recipient_label,address,percentage,is_active')

  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new LuminaFlowError(`Unable to fetch Supabase flow rules: ${response.status}`)
  }

  const rows = (await response.json()) as SupabaseRuleRow[]
  return normalizeFlowRules(
    rows.map((row) => ({
      recipientLabel: row.recipient_label,
      address: getAddress(row.address),
      percentage: row.percentage,
      isActive: row.is_active,
    }))
  )
}

const resolveRules = async (
  merchantAddress: Address,
  inlineRules: FlowRule[] | null,
  env: LuminaRuntimeEnv
): Promise<FlowRule[]> => {
  if (inlineRules) {
    return inlineRules
  }

  const supabaseRules = await fetchSupabaseRules(merchantAddress, env)
  if (supabaseRules) {
    return supabaseRules
  }

  throw new LuminaFlowError(
    'No FlowRule set was supplied and Supabase is not configured. Send flowRules in the webhook body or configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  )
}

const serializeAction = (action: OrchestrationAction): SerializedAction => ({
  eventId: action.eventId,
  rule: action.rule,
  amount: action.amount.toString(),
  transaction: {
    to: action.transaction.to,
    value: (action.transaction.value ?? 0n).toString(),
    data: action.transaction.data,
    feeCurrency: action.transaction.feeCurrency,
    type: action.transaction.type,
  },
})

export async function POST(request: NextRequest) {
  try {
    const env = getLuminaEnv()
    const rawBody = await request.text()

    if (!verifyWebhookSignature(rawBody, request)) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
    }

    const body = JSON.parse(rawBody) as unknown
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Webhook body must be a JSON object.' }, { status: 400 })
    }

    const inlineRules = readInlineRules(body)
    const events = collectEvents(body).filter(
      (event) => event.chainId === CELO_MAINNET.CHAIN_ID && event.token.toLowerCase() === CELO_MAINNET.USDm_TOKEN.toLowerCase()
    )

    if (events.length === 0) {
      return NextResponse.json({ accepted: false, reason: 'No Celo USDC Transfer event found.' }, { status: 202 })
    }

    const orchestration = await Promise.all(
      events.map(async (event) => {
        const rules = await resolveRules(event.to, inlineRules, env)
        requireBalancedRules(rules)

        const splits = calculateSplits(event.amount, rules)
        const actions = splits.map((split) => {
          const rule = rules.find((candidate) => candidate.address === split.address && candidate.recipientLabel === split.recipientLabel)
          if (!rule) {
            throw new LuminaFlowError('Split calculation produced an action without a matching FlowRule.')
          }

          return {
            eventId: event.id,
            rule,
            amount: split.amount,
            transaction: wrapGasless(buildUsdTransferTransaction(split.address, split.amount), env.USDM_ADAPTER),
          } satisfies OrchestrationAction
        })

        return {
          event: {
            ...event,
            amount: event.amount.toString(),
            blockNumber: event.blockNumber.toString(),
          },
          splits: splits.map(
            (split): SerializedFlowSplit => ({
              recipientLabel: split.recipientLabel,
              address: split.address,
              percentage: split.percentage,
              amount: split.amount.toString(),
            })
          ),
          actions: actions.map(serializeAction),
        }
      })
    )

    return NextResponse.json({
      accepted: true,
      chainId: CELO_MAINNET.CHAIN_ID,
      feeCurrency: env.USDM_ADAPTER,
      orchestration,
    })
  } catch (error) {
    const status = error instanceof LuminaConfigurationError ? 500 : error instanceof LuminaFlowError ? 422 : 400
    const message = error instanceof Error ? error.message : 'Unable to orchestrate revenue event.'
    return NextResponse.json({ error: message }, { status })
  }
}
