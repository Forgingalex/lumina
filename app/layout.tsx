import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Lumina | On-Chain Cashflow Orchestration',
  description: 'A Celo and MiniPay financial operating system for programmable USDm revenue.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#050505',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-display antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
