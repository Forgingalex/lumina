import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress, type Address } from 'viem'
import { hasSupabaseConfig, type LuminaRuntimeEnv } from '../../utils/env'
import { normalizeFlowRules, LuminaFlowError } from '../../utils/flow-core'
import type { FlowRule } from '../../../types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const readAddress = (value: unknown): Address | null => {
  return typeof value === 'string' && isAddress(value) ? getAddress(value) : null
}

const parseFlowRule = (value: unknown): FlowRule | null => {
  if (!isRecord(value)) {
    return null
  }

  const recipientLabel = typeof value.recipientLabel === 'string' ? value.recipientLabel : null
  const address = readAddress(value.address)
  const percentage = typeof value.percentage === 'number' ? value.percentage : null

  if (!recipientLabel || !address || percentage === null) {
    return null
  }

  return {
    recipientLabel,
    address,
    percentage,
    isActive: value.isActive !== false,
  }
}

const getOptionalRuntimeEnv = (): Pick<LuminaRuntimeEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'> => ({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})

const persistSupabaseRules = async (merchantAddress: Address, rules: readonly FlowRule[]) => {
  const env = getOptionalRuntimeEnv()
  if (!hasSupabaseConfig(env)) {
    return false
  }

  const response = await fetch(new URL('/rest/v1/flow_rules', env.SUPABASE_URL), {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(
      rules.map((rule) => ({
        merchant_address: merchantAddress.toLowerCase(),
        recipient_label: rule.recipientLabel,
        address: rule.address.toLowerCase(),
        percentage: rule.percentage,
        is_active: rule.isActive,
      }))
    ),
  })

  if (!response.ok) {
    throw new LuminaFlowError(`Supabase rule persistence failed with status ${response.status}.`)
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 })
    }

    const merchantAddress = readAddress(body.merchantAddress)
    if (!merchantAddress) {
      return NextResponse.json({ error: 'merchantAddress must be a valid EVM address.' }, { status: 400 })
    }

    if (!Array.isArray(body.flowRules)) {
      return NextResponse.json({ error: 'flowRules must be an array.' }, { status: 400 })
    }

    const parsedRules = body.flowRules.map(parseFlowRule)
    if (parsedRules.some((rule) => rule === null)) {
      return NextResponse.json({ error: 'Every flow rule must include recipientLabel, address, percentage, and isActive.' }, { status: 400 })
    }

    const flowRules = normalizeFlowRules(parsedRules as FlowRule[])
    const persistedRemotely = await persistSupabaseRules(merchantAddress, flowRules)

    return NextResponse.json({
      ok: true,
      storage: persistedRemotely ? 'supabase' : 'local',
      activeBasisPoints: flowRules.filter((rule) => rule.isActive).reduce((sum, rule) => sum + rule.percentage, 0),
      flowRules,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save Flow Rules.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
