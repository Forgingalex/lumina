'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { http, createConfig, WagmiProvider } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { celo } from 'viem/chains'
import { celoSepoliaCustom, getActiveConfig } from './utils/constants'

// ── Wagmi Config ──────────────────────────────────────────────────────
const config = getActiveConfig()
const wagmiConfig = createConfig({
  chains: [celo, celoSepoliaCustom],
  connectors: [injected()],
  transports: {
    [celo.id]: http(),
    [celoSepoliaCustom.id]: http('https://rpc.ankr.com/celo_sepolia'),
  },
  ssr: true,
})

const queryClient = new QueryClient()

// ── Theme Context ─────────────────────────────────────────────────────
type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme') as Theme
      if (savedTheme) {
        setTheme(savedTheme)
        document.documentElement.classList.toggle('dark', savedTheme === 'dark')
      } else {
        document.documentElement.classList.add('dark')
      }
    } catch {
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    try {
      localStorage.setItem('theme', newTheme)
    } catch {
      // Ignore localStorage errors
    }
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
          {children}
        </ThemeContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a Providers')
  }
  return context
}

export { wagmiConfig }
