import { getAddress, type Address } from 'viem'

export class LuminaConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LuminaConfigurationError'
  }
}

export interface LuminaRuntimeEnv {
  readonly CELO_RPC: string
  readonly USDM_ADAPTER: Address
  readonly NEXT_PUBLIC_API_URL: string
  readonly SUPABASE_URL?: string
  readonly SUPABASE_SERVICE_ROLE_KEY?: string
}

const requiredKeys = ['CELO_RPC', 'USDM_ADAPTER', 'NEXT_PUBLIC_API_URL'] as const

const readRequiredEnv = (key: (typeof requiredKeys)[number]): string => {
  const value = process.env[key]
  if (!value || value.trim().length === 0) {
    throw new LuminaConfigurationError(
      `Missing required Lumina environment variable: ${key}. Configure it in Vercel before deploying protocol routes.`
    )
  }

  return value.trim()
}

const readAddressEnv = (key: 'USDM_ADAPTER'): Address => {
  try {
    return getAddress(readRequiredEnv(key))
  } catch (error) {
    if (error instanceof LuminaConfigurationError) {
      throw error
    }

    throw new LuminaConfigurationError(`${key} must be a valid EVM address.`)
  }
}

const readUrlEnv = (key: 'CELO_RPC' | 'NEXT_PUBLIC_API_URL'): string => {
  const value = readRequiredEnv(key)
  try {
    return new URL(value).toString().replace(/\/$/, '')
  } catch {
    throw new LuminaConfigurationError(`${key} must be a valid absolute URL.`)
  }
}

export const getLuminaEnv = (): LuminaRuntimeEnv => {
  return {
    CELO_RPC: readUrlEnv('CELO_RPC'),
    USDM_ADAPTER: readAddressEnv('USDM_ADAPTER'),
    NEXT_PUBLIC_API_URL: readUrlEnv('NEXT_PUBLIC_API_URL'),
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

export const hasSupabaseConfig = (
  env: Pick<LuminaRuntimeEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>
): env is LuminaRuntimeEnv & Required<Pick<LuminaRuntimeEnv, 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'>> => {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
}
