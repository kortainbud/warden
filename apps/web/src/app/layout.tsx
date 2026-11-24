import type { Metadata } from 'next'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Warden: firewall and monitor for agent wallets on Solana', template: '%s · Warden' },
  description: 'Warden checks every transaction an AI agent tries to sign, blocks the ones a human never asked for, and watches every agent wallet in real time with a kill switch.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
