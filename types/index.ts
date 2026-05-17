import type { Address, Hex } from 'viem'

export type BasisPoints = number

export interface FlowRule {
  readonly recipientLabel: string
  readonly address: Address
  readonly percentage: BasisPoints
  readonly isActive: boolean
}

export interface RevenueEvent {
  readonly id: string
  readonly chainId: 42220 | 11142220
  readonly token: Address
  readonly from: Address
  readonly to: Address
  readonly amount: bigint
  readonly transactionHash: Hex
  readonly blockNumber: bigint
  readonly logIndex: number
  readonly occurredAt: string
}

export interface FlowSplit {
  readonly recipientLabel: string
  readonly address: Address
  readonly percentage: BasisPoints
  readonly amount: bigint
}

export interface OrchestrationAction {
  readonly eventId: string
  readonly rule: FlowRule
  readonly amount: bigint
  readonly transaction: Cip64Transaction
}

export interface BusinessMetrics {
  readonly monthlyRecurringRevenue: bigint
  readonly volatilityBasisPoints: BasisPoints
  readonly luminaScore: number
}

export interface LuminaTransaction {
  readonly account?: Address
  readonly to: Address
  readonly data: Hex
  readonly value?: bigint
  readonly gas?: bigint
}

export interface Cip64Transaction extends LuminaTransaction {
  readonly feeCurrency: Address
  readonly type: '0x7b'
}

export interface LocalCurrencyQuote {
  readonly currency: 'NGN' | 'KES' | 'BRL'
  readonly token: Address
  readonly amountOut: bigint
  readonly decimals: number
  readonly quotedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
//  Phase 3: Vault & Statement Types
// ─────────────────────────────────────────────────────────────────────────────

/** On-chain vault state read from LuminaVault.sol */
export interface VaultState {
  readonly balance: bigint
  readonly totalOrchestrated: bigint
  readonly depositCount: bigint
  readonly firstDepositAt: bigint
  readonly lastDepositAt: bigint
  readonly withdrawalRequestAt: bigint
  readonly score: bigint
  readonly withdrawalUnlockAt: bigint
}

/** A single USDm transfer record from the PoC Engine */
export interface TransactionHistory {
  readonly hash: string
  readonly from: string
  readonly to: string
  readonly amount: string
  readonly timestamp: string
  readonly direction: 'inbound' | 'outbound'
}

/** Monthly cashflow bucket in the financial statement */
export interface MonthlyBreakdown {
  readonly month: string
  readonly inbound: string
  readonly outbound: string
  readonly net: string
  readonly txCount: number
}

/** Local currency valuation entry */
export interface LocalValuation {
  readonly currency: string
  readonly netFlowLocal: string
  readonly mrrLocal: string
  readonly quotedAt: string
}

/** Full response from /api/statement (Financial Attestation) */
export interface StatementData {
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
  readonly monthlyBreakdown: readonly MonthlyBreakdown[]
  readonly localValuation: readonly LocalValuation[]
  readonly transfers: readonly TransactionHistory[]
  readonly error?: string
}

/** Vault interaction tab state for the frontend */
export type VaultTab = 'deposit' | 'withdraw' | 'statement'

/** Withdrawal status computed from on-chain state */
export type WithdrawalStatus =
  | { readonly state: 'none' }
  | { readonly state: 'pending'; readonly unlockAt: bigint }
  | { readonly state: 'ready' }

export interface TreasuryData {
  readonly usdc: bigint
  readonly cusd: bigint
  readonly usdt: bigint
  readonly aggregateBalance: bigint
}
