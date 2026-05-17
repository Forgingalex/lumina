'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  type Address,
} from 'viem'
import { celo, celoAlfajores } from 'viem/chains'
import { useDisconnect } from 'wagmi'
import { getActiveConfig, CELO_MAINNET } from '../utils/constants'

const WALLET_ADDRESS_KEY = 'lumina_wallet_address'

type EthereumRequest = {
  method: string
  params?: readonly unknown[] | Record<string, unknown>
}

type EthereumProvider = {
  isMiniPay?: boolean
  request: (args: EthereumRequest) => Promise<unknown>
  on?: (event: string, listener: (...args: readonly unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: readonly unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

const getActiveChain = () => {
  return getActiveConfig().CHAIN_ID === 42220 ? celo : celoAlfajores
}

const publicClient = createPublicClient({
  chain: getActiveChain(),
  transport: http(CELO_MAINNET.RPC_ENDPOINT),
})

const readCachedAddress = (): Address | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const cachedAddress = window.localStorage.getItem(WALLET_ADDRESS_KEY)
  if (!cachedAddress) {
    return null
  }

  try {
    return getAddress(cachedAddress)
  } catch {
    window.localStorage.removeItem(WALLET_ADDRESS_KEY)
    return null
  }
}

const parseAccountResponse = (accounts: unknown): Address | null => {
  if (!Array.isArray(accounts) || typeof accounts[0] !== 'string') {
    return null
  }

  return getAddress(accounts[0])
}

export function useWallet() {
  const [address, setAddress] = useState<Address | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isMiniPay, setIsMiniPay] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { disconnect: wagmiDisconnect } = useDisconnect()

  const provider = typeof window !== 'undefined' ? window.ethereum ?? null : null

  const walletClient = useMemo(() => {
    if (!provider || !address) {
      return null
    }

    return createWalletClient({
      account: address,
      chain: getActiveChain(),
      transport: custom(provider),
    })
  }, [address, provider])

  const connect = useCallback(async (): Promise<Address | null> => {
    if (!provider) {
      setError('MiniPay or another injected Celo wallet was not detected.')
      return null
    }

    setIsConnecting(true)
    setError(null)

    try {
      const accounts = await provider.request({
        method: 'eth_requestAccounts',
        params: [],
      })
      const nextAddress = parseAccountResponse(accounts)

      if (!nextAddress) {
        throw new Error('The wallet did not return a valid Celo address.')
      }

      const chainIdHex = await provider.request({
        method: 'eth_chainId',
        params: [],
      })
      const nextChainId = typeof chainIdHex === 'string' ? Number.parseInt(chainIdHex, 16) : null

      window.localStorage.setItem(WALLET_ADDRESS_KEY, nextAddress)
      setAddress(nextAddress)
      setChainId(nextChainId)
      setIsMiniPay(Boolean(provider.isMiniPay))

      return nextAddress
    } catch (connectionError) {
      const message =
        connectionError instanceof Error
          ? connectionError.message
          : 'Wallet connection was rejected or interrupted.'

      setError(message)
      return null
    } finally {
      setIsConnecting(false)
    }
  }, [provider])

  const disconnectWallet = useCallback(async () => {
    try {
      wagmiDisconnect()
    } catch (e) {
      console.warn('Wagmi disconnect failed:', e)
    }
    window.localStorage.removeItem(WALLET_ADDRESS_KEY)
    window.localStorage.removeItem('lumina_address')
    setAddress(null)
    setChainId(null)
    setError(null)
  }, [wagmiDisconnect])

  useEffect(() => {
    const cachedAddress = readCachedAddress()
    if (cachedAddress) {
      setAddress(cachedAddress)
    }
  }, [])

  useEffect(() => {
    if (!provider) {
      return
    }

    setIsMiniPay(Boolean(provider.isMiniPay))

    if (provider.isMiniPay) {
      void connect()
    }
  }, [connect, provider])

  useEffect(() => {
    if (!provider?.on || !provider.removeListener) {
      return
    }

    const handleAccountsChanged = (...args: readonly unknown[]) => {
      const nextAddress = parseAccountResponse(args[0])
      if (!nextAddress) {
        window.localStorage.removeItem(WALLET_ADDRESS_KEY)
        setAddress(null)
        return
      }

      window.localStorage.setItem(WALLET_ADDRESS_KEY, nextAddress)
      setAddress(nextAddress)
    }

    const handleChainChanged = (...args: readonly unknown[]) => {
      const chainIdHex = args[0]
      setChainId(typeof chainIdHex === 'string' ? Number.parseInt(chainIdHex, 16) : null)
    }

    provider.on('accountsChanged', handleAccountsChanged)
    provider.on('chainChanged', handleChainChanged)

    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged)
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [provider])

  return {
    address,
    avatar: null,
    chainId,
    connect,
    connectWallet: connect,
    disconnect: disconnectWallet,
    disconnectWallet,
    ensName: null,
    error,
    isConnected: Boolean(address),
    isConnecting,
    isMiniPay,
    provider,
    publicClient,
    signer: null,
    walletClient,
  }
}
