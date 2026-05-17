import { encodeFunctionData, getAddress, isAddress, type Address } from 'viem'
import { BASIS_POINTS_DENOMINATOR, CELO_MAINNET } from './constants'
import type { Cip64Transaction, FlowRule, FlowSplit, LuminaTransaction } from '../../types'

const erc20TransferAbi = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export class LuminaFlowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LuminaFlowError'
  }
}

export const normalizeFlowRule = (rule: FlowRule): FlowRule => {
  const recipientLabel = rule.recipientLabel.trim()
  if (!recipientLabel) {
    throw new LuminaFlowError('Flow rule recipientLabel cannot be empty.')
  }

  if (!Number.isInteger(rule.percentage) || rule.percentage < 0 || rule.percentage > BASIS_POINTS_DENOMINATOR) {
    throw new LuminaFlowError('Flow rule percentage must be an integer between 0 and 10000 basis points.')
  }

  if (!isAddress(rule.address)) {
    throw new LuminaFlowError(`Flow rule "${recipientLabel}" has an invalid recipient address.`)
  }

  return {
    recipientLabel,
    address: getAddress(rule.address),
    percentage: rule.percentage,
    isActive: Boolean(rule.isActive),
  }
}

export const normalizeFlowRules = (rules: readonly FlowRule[]): FlowRule[] => {
  const normalizedRules = rules.map(normalizeFlowRule)
  const activeTotal = normalizedRules
    .filter((rule) => rule.isActive)
    .reduce((sum, rule) => sum + rule.percentage, 0)

  if (activeTotal > BASIS_POINTS_DENOMINATOR) {
    throw new LuminaFlowError('Active flow rules cannot allocate more than 10000 basis points.')
  }

  return normalizedRules
}

export const requireBalancedRules = (rules: readonly FlowRule[]): void => {
  const activeTotal = rules.filter((rule) => rule.isActive).reduce((sum, rule) => sum + rule.percentage, 0)
  if (activeTotal !== BASIS_POINTS_DENOMINATOR) {
    throw new LuminaFlowError('Webhook orchestration requires active rules to total exactly 10000 basis points.')
  }
}

export const calculateSplits = (totalAmount: bigint, rules: readonly FlowRule[]): FlowSplit[] => {
  if (totalAmount < 0n) {
    throw new LuminaFlowError('Split amount cannot be negative.')
  }

  const activeRules = normalizeFlowRules(rules).filter((rule) => rule.isActive && rule.percentage > 0)
  if (activeRules.length === 0) {
    return []
  }

  const splits = activeRules.map((rule) => ({
    recipientLabel: rule.recipientLabel,
    address: rule.address,
    percentage: rule.percentage,
    amount: (totalAmount * BigInt(rule.percentage)) / BigInt(BASIS_POINTS_DENOMINATOR),
  }))

  const activeTotal = activeRules.reduce((sum, rule) => sum + rule.percentage, 0)
  const allocated = splits.reduce((sum, split) => sum + split.amount, 0n)
  const targetAmount = (totalAmount * BigInt(activeTotal)) / BigInt(BASIS_POINTS_DENOMINATOR)
  const remainder = targetAmount - allocated

  if (remainder > 0n) {
    const largestSplit = splits.reduce((candidate, split) =>
      split.percentage > candidate.percentage ? split : candidate
    )
    const index = splits.findIndex((split) => split.address === largestSplit.address)
    splits[index] = {
      ...splits[index],
      amount: splits[index].amount + remainder,
    }
  }

  return splits.filter((split) => split.amount > 0n)
}

export const buildUsdTransferTransaction = (recipient: Address, amount: bigint): LuminaTransaction => {
  return {
    to: CELO_MAINNET.USDm_TOKEN,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20TransferAbi,
      functionName: 'transfer',
      args: [recipient, amount],
    }),
  }
}

export const wrapGasless = (tx: LuminaTransaction, feeCurrency: Address = CELO_MAINNET.USDm_ADAPTER): Cip64Transaction => {
  return {
    ...tx,
    feeCurrency,
    type: '0x7b',
  }
}
