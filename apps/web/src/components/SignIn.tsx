'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from '@/components/icons'
import { Mark } from './brand'
import { Spinner } from './ui'
import Dither from './Dither'
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
      <div className="w-full max-w-[420px] overflow-hidden rounded-[22px] border border-line bg-white">
        <div className="relative h-28">
          <Dither className="absolute inset-0 h-full w-full" cell={4} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
          <Link href="/" className="absolute bottom-3 left-6 inline-flex items-center gap-2 text-[16px] font-semibold tracking-[-0.03em]"><Mark size={22} />warden</Link>
        </div>
        <div className="px-6 pb-6">
          <h1 className="text-[24px] font-medium tracking-[-0.03em]">Connect your wallet</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">Use the wallet that owns your agents. Signing in proves you hold it; it cannot move funds or approve anything.</p>
          <div className="eyebrow mb-2 mt-6">Sign a message</div>
          <div className="space-y-2">
            {wallets.length ? wallets.map((w) => (
              <button key={w.name} disabled={!!busy} onClick={() => go(w)}
                className="flex h-12 w-full items-center gap-3 rounded-full border border-line-strong px-4 text-left text-[14px] hover:border-ink-2/40 disabled:opacity-60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.icon} alt="" className="size-6 rounded-md" />
                <span className="flex-1">{w.name}</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ok">{busy === w.name ? 'Check your wallet…' : 'Detected'}</span>
              </button>
            )) : INSTALL.map((i) => (
              <a key={i.name} href={i.url} target="_blank" rel="noreferrer" className="flex h-12 w-full items-center gap-3 rounded-full border border-line px-4 text-[14px] text-muted hover:border-ink-2/30 hover:text-ink">
                {i.name}<span className="ml-auto inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">Install<ArrowUpRight size={11} /></span>
              </a>
            ))}
          </div>
          {busy && <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted"><Spinner className="size-3.5" />Approve the sign-in request in your wallet.</div>}
          {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
          <p className="mt-6 border-t border-line pt-4 text-[12.5px] leading-relaxed text-faint">Warden never asks for a seed phrase or private key. Email sign-in is not available yet.</p>
        </div>
      </div>
    </div>
  )
}
