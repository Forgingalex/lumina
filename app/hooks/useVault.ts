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

export type DepositStage = 'idle' | 'approving' | 'depositing' | 'confirmed' | 'error'

export function useVault() {
  const { address, walletClient } = useWallet()
  const config = getActiveConfig()

  // ── Strict Public Client Initialization ───────────────────────────
  const publicClient = useMemo(() => createPublicClient({
    transport: http(config.RPC),
    // No chain parameter here to avoid validation conflicts, we pass chainId in calls
  }), [config.RPC])

  const [balance, setBalance] = useState<bigint>(0n)
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

  // ── Sync Business Profile ──────────────────────────────────────────
  const syncProfile = useCallback(async () => {
    if (!address) return
    try {
      const stables = config.STABLES
      const [usdcBal, cusdBal, usdtBal, vaultProfile] = await Promise.all([
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
        publicClient.readContract({
          address: config.VAULT,
          abi: LUMINA_VAULT_ABI,
          functionName: 'getMerchantProfile',
          args: [address],
        }).catch(err => {
          console.error('LuminaVault sync failure:', err)
          return [0n, 0n, 0n] as const
        })
      ])

      const [vBalance, vScore] = vaultProfile as readonly [bigint, bigint, bigint]
      setBalance(vBalance ?? 0n)
      setScore(vScore ?? 0n)
      setTreasuryData({
        usdc: usdcBal,
        cusd: cusdBal,
        usdt: usdtBal,
        aggregateBalance: usdcBal + cusdBal + usdtBal,
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
  const handleDeposit = useCallback(async (amountHuman: string) => {
    if (!address || !walletClient) {
      setDepositError('Wallet trust anchor inactive.')
      return
    }

    setDepositStage('approving')
    setDepositError(null)
    setShowSuccessToast(false)

    try {
      const amount = parseUnits(amountHuman, 18)
      
      // Fetch latest balances concurrently to choose the best gas currency
      const stables = config.STABLES
      const [usdcBal, cusdBal, usdtBal] = await Promise.all([
        publicClient.readContract({
          address: stables.USDC.TOKEN,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).catch(() => 0n),
        publicClient.readContract({
          address: stables.cUSD.TOKEN,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).catch(() => 0n),
        publicClient.readContract({
          address: stables.USDT.TOKEN,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).catch(() => 0n),
      ])

      // Detect which token has a non-zero balance (prioritizing USDC, then cUSD, then USDT)
      let feeCurrency: Address = stables.USDC.ADAPTER
      if (usdcBal > 0n) {
        feeCurrency = stables.USDC.ADAPTER
      } else if (cusdBal > 0n) {
        feeCurrency = stables.cUSD.ADAPTER
      } else if (usdtBal > 0n) {
        feeCurrency = stables.USDT.ADAPTER
      }

      // Stage 1: Validate Allowance
      const allowance = await publicClient.readContract({
        address: config.TOKEN,
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
          to: config.TOKEN,
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
        args: [amount],
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
      // Handle UserRejectedRequest
      if (error.code === 4001 || error?.message?.includes('rejected')) {
        setDepositError('Signature cancelled by user.')
      } else {
        setDepositError(error.message || 'Orchestration failed.')
      }
    }
  }, [address, walletClient, publicClient, config, syncProfile])

  return {
    balance,
    score,
    treasuryData,
    depositStage,
    depositError,
    showSuccessToast,
    handleDeposit,
    syncProfile,
    dismissToast: () => setShowSuccessToast(false),
  }
}
