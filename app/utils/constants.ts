'use client'

import type { Address, Hex } from 'viem'

// ─────────────────────────────────────────────────────────────────────────────
//  Custom Chain Definition: Celo Sepolia
// ─────────────────────────────────────────────────────────────────────────────

export const celoSepoliaCustom = {
  id: 11142220,
  name: 'Celo Sepolia',
  network: 'celo-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: { http: ['https://rpc.ankr.com/celo_sepolia'] },
    public: { http: ['https://rpc.ankr.com/celo_sepolia'] },
  },
  blockExplorers: {
    default: { name: 'CeloScan', url: 'https://alfajores.celoscan.io' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11' as Address,
      blockCreated: 13912,
    },
  },
  testnet: true,
} as const

// ─────────────────────────────────────────────────────────────────────────────
//  Environment & Chain Config
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  mainnet: {
    NAME: 'CELO MAINNET',
    CHAIN_ID: 42220,
    VAULT: '0x92F849B5542656353efb979F3e1872187Cc7dC8E' as Address,
    TOKEN: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as Address, // USDC
    ADAPTER: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address, // USDC Adapter
    RPC: 'https://forno.celo.org',
  },
  sepolia: {
    NAME: 'CELO SEPOLIA',
    CHAIN_ID: 11142220,
    VAULT: '0xBC1163Ea4994A45385558eD5538B2b92DC4aa7cD' as Address,
    TOKEN: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address, // USDC
    ADAPTER: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address,
    RPC: 'https://rpc.ankr.com/celo_sepolia',
  },
} as const

export function getActiveConfig() {
  const env = process.env.NEXT_PUBLIC_NETWORK_ENV || 'sepolia'
  return env === 'mainnet' ? CONFIG.mainnet : CONFIG.sepolia
}

/** Legacy config object — kept for backward compatibility with existing components */
export const CELO_MAINNET = {
  CHAIN_ID: getActiveConfig().CHAIN_ID,
  USDm_TOKEN: getActiveConfig().TOKEN,
  USDm_ADAPTER: getActiveConfig().ADAPTER,
  LUMINA_VAULT: getActiveConfig().VAULT,
  RPC_ENDPOINT: getActiveConfig().RPC,
} as const

export const BASIS_POINTS_DENOMINATOR = 10_000 as const

export const getExplorerLink = (hash: Hex | string): string => {
  const config = getActiveConfig()
  return config.CHAIN_ID === 42220
    ? `https://celoscan.io/tx/${hash}`
    : `https://alfajores.celoscan.io/tx/${hash}`
}

export const getAddressExplorerLink = (address: Address | string): string => {
  const config = getActiveConfig()
  return config.CHAIN_ID === 42220
    ? `https://celoscan.io/address/${address}`
    : `https://alfajores.celoscan.io/address/${address}`
}

// ─────────────────────────────────────────────────────────────────────────────
//  LuminaVault ABI
// ─────────────────────────────────────────────────────────────────────────────

export const LUMINA_VAULT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getMerchantProfile',
    stateMutability: 'view',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [
      { name: 'balance', type: 'uint256' },
      { name: 'score', type: 'uint256' },
      { name: 'lastActivity', type: 'uint256' },
    ],
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
//  USDC ABI (ERC20)
// ─────────────────────────────────────────────────────────────────────────────

export const USDC_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
] as const

/** @deprecated Use USDC_ABI */
export const ERC20_ABI = USDC_ABI
