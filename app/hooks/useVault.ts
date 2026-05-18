'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { createPublicClient, http, encodeFunctionData, parseUnits, type Address } from 'viem'
import {
  getActiveConfig,
  LUMINA_VAULT_ABI,
  USDC_ABI,
} from '../utils/constants'
import { useWallet } from './useWallet'
import type { TreasuryData } from '../../types'

export type DepositStage = 'idle' | 'approving' | 'depositing' | 'withdrawing' | 'confirmed' | 'error'

export interface VaultBalances {
  usdc: bigint
  cusd: bigint
  usdt: bigint
}

export function useVault() {
  const { address, walletClient } = useWallet()
  const config = getActiveConfig()

  // ── Strict Public Client Initialization ───────────────────────────
  const publicClient = useMemo(() => createPublicClient({
    transport: http(config.RPC),
  }), [config.RPC])

  const [balance, setBalance] = useState<bigint>(0n) // aggregate vault balance (18 decimals scaled)
  const [score, setScore] = useState<bigint>(0n)
  const [depositStage, setDepositStage] = useState<DepositStage>('idle')
  const [depositError, setDepositError] = useState<string | null>(null)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [treasuryData, setTreasuryData] = useState<TreasuryData>({
    usdc: 0n,
    cusd: 0n,
    usdt: 0n,
    aggregateBalance: 0n,
  })
  const [vaultBalances, setVaultBalances] = useState<VaultBalances>({
    usdc: 0n,
    cusd: 0n,
    usdt: 0n,
  })

  // ── Sync Business Profile ──────────────────────────────────────────
  const syncProfile = useCallback(async () => {
    if (!address) return
    try {
      const stables = config.STABLES
      const [
        usdcBal,
        cusdBal,
        usdtBal,
        vaultUsdc,
        vaultCusd,
        vaultUsdt,
        vaultProfile
      ] = await Promise.all([
        // Wallet Balances
        publicClient.readContract({
          address: stables.USDC.TOKEN,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).catch(err => {
          console.error('USDC balance fetch error:', err)
          return 0n
        }),
        publicClient.readContract({
          address: stables.cUSD.TOKEN,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).catch(err => {
          console.error('cUSD balance fetch error:', err)
          return 0n
        }),
        publicClient.readContract({
          address: stables.USDT.TOKEN,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).catch(err => {
          console.error('USDT balance fetch error:', err)
          return 0n
        }),
        // Vault Balances
        publicClient.readContract({
          address: config.VAULT,
          abi: LUMINA_VAULT_ABI,
          functionName: 'balances',
          args: [address, stables.USDC.TOKEN],
        }).catch(err => {
          console.error('Vault USDC balance fetch error:', err)
          return 0n
        }),
        publicClient.readContract({
          address: config.VAULT,
          abi: LUMINA_VAULT_ABI,
          functionName: 'balances',
          args: [address, stables.cUSD.TOKEN],
        }).catch(err => {
          console.error('Vault cUSD balance fetch error:', err)
          return 0n
        }),
        publicClient.readContract({
          address: config.VAULT,
          abi: LUMINA_VAULT_ABI,
          functionName: 'balances',
          args: [address, stables.USDT.TOKEN],
        }).catch(err => {
          console.error('Vault USDT balance fetch error:', err)
          return 0n
        }),
        // Merchant Profile (Score)
        publicClient.readContract({
          address: config.VAULT,
          abi: LUMINA_VAULT_ABI,
          functionName: 'getMerchantProfile',
          args: [address],
        }).catch(err => {
          console.error('LuminaVault sync failure:', err)
          return [0n, 0n] as const
        })
      ])

      const [vScore] = vaultProfile as readonly [bigint, bigint]
      setScore(vScore ?? 0n)

      // Normalize all values to 18 decimals for aggregate presentation
      const usdcScaled = usdcBal * (10n ** 12n)
      const usdtScaled = usdtBal * (10n ** 12n)
      const walletAggregate = usdcScaled + cusdBal + usdtScaled

      const vUsdcScaled = vaultUsdc * (10n ** 12n)
      const vUsdtScaled = vaultUsdt * (10n ** 12n)
      const vaultAggregate = vUsdcScaled + vaultCusd + vUsdtScaled

      setBalance(vaultAggregate)
      setVaultBalances({
        usdc: vaultUsdc,
        cusd: vaultCusd,
        usdt: vaultUsdt,
      })

      setTreasuryData({
        usdc: usdcBal,
        cusd: cusdBal,
        usdt: usdtBal,
        aggregateBalance: walletAggregate,
      })
    } catch (e) {
      console.error('LuminaVault sync failure:', e)
    }
  }, [address, publicClient, config])

  // 8s Polling Interval
  useEffect(() => {
    void syncProfile()
    const interval = setInterval(() => { void syncProfile() }, 8000)
    return () => clearInterval(interval)
  }, [syncProfile])

  // ── Orchestration State Machine (Approve -> Deposit) ───────────────
  const handleDeposit = useCallback(async (tokenSymbol: 'USDC' | 'cUSD' | 'USDT', amountHuman: string) => {
    if (!address || !walletClient) {
      setDepositError('Wallet trust anchor inactive.')
      return
    }

    setDepositStage('approving')
    setDepositError(null)
    setShowSuccessToast(false)

    try {
      const stables = config.STABLES
      const tokenConfig = stables[tokenSymbol]
      if (!tokenConfig) throw new Error(`Unsupported token: ${tokenSymbol}`)

      const decimals = tokenSymbol === 'cUSD' ? 18 : 6
      const amount = parseUnits(amountHuman, decimals)
      const feeCurrency = tokenConfig.ADAPTER

      // Stage 1: Validate & Execute Allowance
      const allowance = await publicClient.readContract({
        address: tokenConfig.TOKEN,
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [address, config.VAULT],
      }) as bigint

      if (allowance < amount) {
        const approveData = encodeFunctionData({
          abi: USDC_ABI,
          functionName: 'approve',
          args: [config.VAULT, amount],
        })

        const approveHash = await walletClient.sendTransaction({
          account: address,
          to: tokenConfig.TOKEN,
          data: approveData,
          feeCurrency, // CIP-64 Gasless logic
        } as any)

        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      // Stage 2: Orchestrate Deposit
      setDepositStage('depositing')
      const depositData = encodeFunctionData({
        abi: LUMINA_VAULT_ABI,
        functionName: 'deposit',
        args: [tokenConfig.TOKEN, amount],
      })

      const depositHash = await walletClient.sendTransaction({
        account: address,
        to: config.VAULT,
        data: depositData,
        feeCurrency, // CIP-64 Gasless logic
      } as any)

      await publicClient.waitForTransactionReceipt({ hash: depositHash })

      // Success Cycle
      setDepositStage('confirmed')
      setShowSuccessToast(true)
      await syncProfile()
      setTimeout(() => setShowSuccessToast(false), 5000)

    } catch (error: any) {
      setDepositStage('error')
      if (error.code === 4001 || error?.message?.includes('rejected')) {
        setDepositError('Signature cancelled by user.')
      } else {
        setDepositError(error.message || 'Deposit execution failed.')
      }
    }
  }, [address, walletClient, publicClient, config, syncProfile])

  // ── Orchestration State Machine (Withdrawal Execution) ───────────────
  const handleWithdraw = useCallback(async (tokenSymbol: 'USDC' | 'cUSD' | 'USDT', amountHuman: string) => {
    if (!address || !walletClient) {
      setDepositError('Wallet trust anchor inactive.')
      return
    }

    setDepositStage('withdrawing')
    setDepositError(null)
    setShowSuccessToast(false)

    try {
      const stables = config.STABLES
      const tokenConfig = stables[tokenSymbol]
      if (!tokenConfig) throw new Error(`Unsupported token: ${tokenSymbol}`)

      const decimals = tokenSymbol === 'cUSD' ? 18 : 6
      const amount = parseUnits(amountHuman, decimals)
      const feeCurrency = tokenConfig.ADAPTER

      // Execute Withdrawal
      const withdrawData = encodeFunctionData({
        abi: LUMINA_VAULT_ABI,
        functionName: 'withdraw',
        args: [tokenConfig.TOKEN, amount],
      })

      const withdrawHash = await walletClient.sendTransaction({
        account: address,
        to: config.VAULT,
        data: withdrawData,
        feeCurrency, // CIP-64 Gasless logic
      } as any)

      await publicClient.waitForTransactionReceipt({ hash: withdrawHash })

      // Success Cycle
      setDepositStage('confirmed')
      setShowSuccessToast(true)
      await syncProfile()
      setTimeout(() => setShowSuccessToast(false), 5000)

    } catch (error: any) {
      setDepositStage('error')
      if (error.code === 4001 || error?.message?.includes('rejected')) {
        setDepositError('Signature cancelled by user.')
      } else {
        setDepositError(error.message || 'Withdrawal execution failed.')
      }
    }
  }, [address, walletClient, publicClient, config, syncProfile])

  return {
    balance,
    score,
    treasuryData,
    vaultBalances,
    depositStage,
    depositError,
    showSuccessToast,
    handleDeposit,
    handleWithdraw,
    syncProfile,
    dismissToast: () => setShowSuccessToast(false),
  }
}
