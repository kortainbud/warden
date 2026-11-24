import type { Metadata } from 'next'
import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/source-serif-4'
import './globals.css'
import { GeistPixelSquare } from 'geist/font/pixel'

export const metadata: Metadata = {
  title: { default: 'Warden: firewall and monitor for agent wallets on Solana', template: '%s · Warden' },
  description: 'Warden checks every transaction an AI agent tries to sign, blocks the ones a human never asked for, and watches every agent wallet in real time with a kill switch.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistPixelSquare.variable}>
      <body className="min-h-dvh bg-page text-ink">{children}</body>
    </html>
  )
}
