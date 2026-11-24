'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from '@/components/icons'
import { PixelMark, Label } from '@/components/hydra/bits'
import { AsciiShield } from '@/components/hydra/anim'
import { solanaWallets, useSession, type StdWallet } from '@/lib/session'

const INSTALL = [
  { name: 'Phantom', url: 'https://phantom.com/download' },
  { name: 'Solflare', url: 'https://solflare.com/download' },
  { name: 'Backpack', url: 'https://backpack.app/downloads' },
]

const STEPS = [
  ['Connect', 'Sign a message with the wallet that owns your agents. It cannot move funds.'],
  ['Add a wallet', 'Paste an agent wallet address. Warden backfills 30 days and learns normal.'],
  ['Go live', 'Watch in shadow mode, then add the SDK and switch to enforce.'],
] as const

/** Login and sign-up share one screen: Warden accounts are wallets, so both start with a signature. */
export default function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next')?.startsWith('/app') ? sp.get('next')! : mode === 'signup' ? '/app/wallets?add=1' : '/app'
  const { address, checked, refresh, signIn } = useSession()
  const [wallets, setWallets] = useState<StdWallet[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { if (checked && address) router.replace(next) }, [checked, address, next, router])
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
      router.replace(next)
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Sign-in failed.'
      setError(/reject|denied|cancel/i.test(m) ? 'Request cancelled in your wallet.' : m)
      setBusy(null)
    }
  }

  const signup = mode === 'signup'
  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] bg-page text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[20px] font-medium tracking-[-0.03em]"><PixelMark size={20} />Warden</Link>
          <Link href={signup ? '/login' : '/signup'} className="text-[13.5px] text-muted hover:text-lav">
            {signup ? <>Have an account? <span className="text-ink underline decoration-brand underline-offset-4">Log in</span></> : <>New here? <span className="text-ink underline decoration-brand underline-offset-4">Sign up</span></>}
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-14 [animation:fadeUp_.6s_ease-out]">
          <Label>{signup ? 'Sign up' : 'Log in'}</Label>
          <h1 className="font-pixel mt-5 text-[40px] leading-[1.04] sm:text-[48px]">{signup ? 'Protect Your First Agent.' : 'Welcome Back.'}</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-muted">
            {signup
              ? 'Your Warden account is your wallet. Connect the wallet that owns your agents; no email, no password, no keys shared.'
              : 'Connect the wallet that owns your agents. Signing in proves you hold it; it cannot move funds or approve anything.'}
          </p>

          <div className="mt-8 space-y-2">
            {wallets.length ? wallets.map((w, i) => (
              <button key={w.name} disabled={!!busy} onClick={() => go(w)}
                className="group flex h-[52px] w-full items-center gap-3 border border-line-strong bg-surface px-4 text-left text-[15px] transition-all hover:border-lav hover:bg-sunken disabled:opacity-60 [animation:fadeUp_.5s_ease-out_both]"
                style={{ animationDelay: `${100 + i * 70}ms` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.icon} alt="" className="size-6" />
                <span className="flex-1">{w.name}</span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ok">{busy === w.name ? <span className="blink text-lav">Check your wallet</span> : 'Detected'}</span>
                <span className="text-lav opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">→</span>
              </button>
            )) : (
              <>
                <div className="border border-line bg-surface px-4 py-3 text-[13.5px] text-muted">No Solana wallet found in this browser. Install one, then reload this page.</div>
                {INSTALL.map((i, n) => (
                  <a key={i.name} href={i.url} target="_blank" rel="noreferrer"
                    className="group flex h-[52px] items-center gap-3 border border-line px-4 text-[15px] text-muted transition-all hover:border-lav hover:text-ink [animation:fadeUp_.5s_ease-out_both]" style={{ animationDelay: `${100 + n * 70}ms` }}>
                    {i.name}<span className="ml-auto inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint group-hover:text-lav">Install<ArrowUpRight size={11} /></span>
                  </a>
                ))}
              </>
            )}
          </div>
          {error && <p className="mt-3 border-l-2 border-bad pl-3 text-[13px] text-bad">{error}</p>}

          {signup && (
            <ol className="mt-10 border-t border-line">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-4 border-b border-line py-4">
                  <span className="font-pixel text-[20px] leading-none text-lav">0{i + 1}</span>
                  <span><span className="block text-[14px] font-medium">{t}</span><span className="mt-0.5 block text-[13px] text-muted">{d}</span></span>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-8 text-[12.5px] leading-relaxed text-faint">
            Warden never asks for a seed phrase or private key. {signup ? 'Monitoring is free to start.' : 'Email sign-in is not available yet.'}
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden border-l border-line bg-surface lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.14),transparent_65%)]" />
        <AsciiShield className="absolute inset-0" />
        <div className="absolute bottom-8 left-8 right-8 flex flex-wrap gap-2">
          {['Two signatures', 'Fails closed', 'Owner recovery key', 'Shadow mode first'].map((t, i) => (
            <span key={t} className={`${i % 2 ? 'float-b' : 'float-a'} border border-line-strong bg-page/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-lav backdrop-blur`}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
