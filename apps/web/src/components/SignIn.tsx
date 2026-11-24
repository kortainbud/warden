'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from '@/components/icons'
import { Mark } from './brand'
import { Card, Spinner } from './ui'
import { solanaWallets, useSession, type StdWallet } from '@/lib/session'

const INSTALL = [
  { name: 'Phantom', url: 'https://phantom.com/download' },
  { name: 'Solflare', url: 'https://solflare.com/download' },
  { name: 'Backpack', url: 'https://backpack.app/downloads' },
]

export default function SignIn() {
  const signIn = useSession((s) => s.signIn)
  const [wallets, setWallets] = useState<StdWallet[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setWallets(solanaWallets())
    const t = setTimeout(() => setWallets(solanaWallets()), 500) // extensions register late
    return () => clearTimeout(t)
  }, [])

  const go = async (w: StdWallet) => {
    setBusy(w.name)
    setError(null)
    try {
      await signIn(w)
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Sign-in failed.'
      setError(/reject|denied|cancel/i.test(m) ? 'Request cancelled in your wallet.' : m)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-[15px] font-semibold"><Mark />Warden</Link>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Sign in with your wallet</h1>
        <p className="mt-2 text-[14px] text-muted">
          Use the wallet that owns your agents. Signing in proves you hold it; it cannot move funds or approve anything.
        </p>
        <Card className="mt-6 p-2">
          {wallets.length ? (
            wallets.map((w) => (
              <button key={w.name} disabled={!!busy} onClick={() => go(w)}
                className="flex h-12 w-full items-center gap-3 rounded-[8px] px-3 text-left text-[14px] hover:bg-sunken disabled:opacity-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.icon} alt="" className="size-6 rounded-md" />
                <span className="flex-1 font-medium">{w.name}</span>
                {busy === w.name ? <span className="flex items-center gap-2 text-[12.5px] text-muted"><Spinner className="size-3.5" />Check your wallet</span> : <span className="text-[12.5px] text-ok">Detected</span>}
              </button>
            ))
          ) : (
            <div className="px-3 py-3">
              <p className="text-[13.5px] text-ink-2">No Solana wallet found in this browser. Install one, then reload this page.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {INSTALL.map((i) => (
                  <a key={i.name} href={i.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong px-3 text-[13px] hover:border-ink-2/40">
                    {i.name}<ArrowUpRight size={12} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </Card>
        {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
        <p className="mt-6 text-[12.5px] text-muted">Email sign-in is not available yet.</p>
      </div>
    </div>
  )
}
