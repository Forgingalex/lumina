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
    VAULT: '0x962fc12bfA3D64e4Ea8c2F7CE92Ab9fCc064CCEF' as Address,
    TOKEN: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as Address, // USDC
    ADAPTER: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address, // USDC Adapter
    STABLES: {
      USDC: {
        TOKEN: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as Address,
        ADAPTER: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address,
      },
      cUSD: {
        TOKEN: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as Address,
        ADAPTER: '0x765DE816845861e75A25fCA122bb6898B8B1282a' as Address,
      },
      USDT: {
        TOKEN: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e' as Address,
        ADAPTER: '0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72' as Address,
      },
    },
    RPC: 'https://forno.celo.org',
  },
  sepolia: {
    NAME: 'CELO SEPOLIA',
    CHAIN_ID: 11142220,
    VAULT: '0xBC1163Ea4994A45385558eD5538B2b92DC4aa7cD' as Address,
    TOKEN: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address, // USDC
    ADAPTER: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address,
    STABLES: {
      USDC: {
        TOKEN: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address,
        ADAPTER: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address,
      },
      cUSD: {
        TOKEN: '0x874069Fa1Eb16D44d622F2e0Ca25eeA17227FC71' as Address,
        ADAPTER: '0x874069Fa1Eb16D44d622F2e0Ca25eeA17227FC71' as Address,
      },
      USDT: {
        TOKEN: '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e' as Address,
        ADAPTER: '0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72' as Address,
      },
    },
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
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getMerchantProfile',
    stateMutability: 'view',
    inputs: [{ name: 'merchant', type: 'address' }],
    outputs: [
      { name: 'score', type: 'uint256' },
      { name: 'totalVolume', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'balances',
    stateMutability: 'view',
    inputs: [
      { name: 'merchant', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
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
