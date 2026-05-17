'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { createPublicClient, http, encodeFunctionData, parseUnits, formatUnits, type Address } from 'viem'
import {
  getActiveConfig,
  LUMINA_VAULT_ABI,
  USDC_ABI,
} from '../utils/constants'
import { useWallet } from './useWallet'

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

  // ── Sync Business Profile ──────────────────────────────────────────
  const syncProfile = useCallback(async () => {
    if (!address) return
    try {
      const result = await publicClient.readContract({
        address: config.VAULT,
        abi: LUMINA_VAULT_ABI,
        functionName: 'getMerchantProfile',
        args: [address],
      })
      const [vBalance, vScore] = result as readonly [bigint, bigint, bigint]
      setBalance(vBalance ?? 0n)
      setScore(vScore ?? 0n)
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
          feeCurrency: config.ADAPTER, // CIP-64 Gasless logic
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
        feeCurrency: config.ADAPTER, // CIP-64 Gasless logic
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
    depositStage,
    depositError,
    showSuccessToast,
    handleDeposit,
    syncProfile,
    dismissToast: () => setShowSuccessToast(false),
  }
}
