import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Lumina | On-Chain Cashflow Orchestration',
  description: 'A Celo and MiniPay financial operating system for programmable USDm revenue.',
  other: {
    'talentapp:project_verification': '0130e2b027f6cae9a83aa4e6f1305052aa962e3361ae73974e79037b0639f7551b311e3e09adc8e1429c688d643a2ebf11ea3071c4a53483ab1ccec21034c25f',
  },
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
