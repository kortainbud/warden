'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from '@/components/icons'
import { PixelMark, Label } from '@/components/hydra/bits'
import { AsciiShield } from '@/components/hydra/anim'
import { solanaWallets, useSession, type StdWallet } from '@/lib/session'

interface Known { name: string; match: string; logo: string; install: string; deeplink?: (url: string, ref: string) => string }
// Official logos in /public/wallets. Any other Wallet Standard wallet is detected automatically.
const MAIN: Known[] = [
  { name: 'Phantom', match: 'phantom', logo: '/wallets/phantom.svg', install: 'https://phantom.com/download', deeplink: (u, r) => `https://phantom.app/ul/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(r)}` },
  { name: 'Solflare', match: 'solflare', logo: '/wallets/solflare.svg', install: 'https://solflare.com/download', deeplink: (u, r) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(u)}?ref=${encodeURIComponent(r)}` },
  { name: 'Backpack', match: 'backpack', logo: '/wallets/backpack.png', install: 'https://backpack.app/downloads' },
]
const MORE: Known[] = [
  { name: 'Jupiter Wallet', match: 'jupiter', logo: '/wallets/jupiter.svg', install: 'https://jup.ag/mobile' },
  { name: 'Coinbase Wallet', match: 'coinbase', logo: '/wallets/coinbase.svg', install: 'https://www.coinbase.com/wallet/downloads' },
  { name: 'Trust Wallet', match: 'trust', logo: '/wallets/trust.svg', install: 'https://trustwallet.com/download' },
  { name: 'Exodus', match: 'exodus', logo: '/wallets/exodus.svg', install: 'https://www.exodus.com/download/' },
  { name: 'Ledger', match: 'ledger', logo: '/wallets/ledger.svg', install: 'https://www.ledger.com/ledger-live' },
]
const isMobile = () => typeof navigator !== 'undefined' && /iphone|ipad|android/i.test(navigator.userAgent)

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
  const [more, setMore] = useState(false)

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
            {MAIN.map((k, i) => <WalletRow key={k.name} k={k} wallets={wallets} busy={busy} go={go} delay={100 + i * 70} />)}
            {wallets.filter((w) => ![...MAIN, ...MORE].some((k) => w.name.toLowerCase().includes(k.match))).map((w, i) => (
              <WalletButton key={w.name} name={w.name} logo={w.icon} busy={busy} onClick={() => go(w)} delay={310 + i * 70} />
            ))}
            <button onClick={() => setMore((m) => !m)} aria-expanded={more}
              className="group flex h-[52px] w-full items-center gap-3 border border-line px-4 text-left text-[15px] text-muted transition-all hover:border-lav hover:text-ink [animation:fadeUp_.5s_ease-out_both]" style={{ animationDelay: '320ms' }}>
              <span className="flex -space-x-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {MORE.slice(0, 4).map((k) => <img key={k.name} src={k.logo} alt="" className="size-6 border-2 border-page bg-page" />)}
              </span>
              <span className="flex-1">More wallets</span>
              <span className={`font-mono text-[13px] transition-transform ${more ? 'rotate-90' : ''}`}>›</span>
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ${more ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="space-y-2 overflow-hidden">
                {MORE.map((k) => <WalletRow key={k.name} k={k} wallets={wallets} busy={busy} go={go} delay={0} />)}
                <p className="px-1 pt-1 text-[12px] text-faint">Using another Solana wallet? Any wallet that supports the Wallet Standard shows up here automatically once installed.</p>
              </div>
            </div>
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
            Warden never asks for a seed phrase or private key. By continuing you agree to the <Link href="/terms" className="underline decoration-line-strong underline-offset-2 hover:text-lav">Terms</Link> and <Link href="/privacy" className="underline decoration-line-strong underline-offset-2 hover:text-lav">Privacy Policy</Link>.
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

function WalletButton({ name, logo, busy, onClick, delay, href, tag }: { name: string; logo: string; busy: string | null; onClick?: () => void; delay: number; href?: string; tag?: string }) {
  const cls = 'group flex h-[52px] w-full items-center gap-3 border px-4 text-left text-[15px] transition-all [animation:fadeUp_.5s_ease-out_both]'
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="" className="size-6 object-contain" />
      <span className="flex-1">{name}</span>
      {href ? (
        <span className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint group-hover:text-lav">{tag}<ArrowUpRight size={11} /></span>
      ) : (
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ok">{busy === name ? <span className="blink text-lav">Check your wallet</span> : 'Detected'}</span>
      )}
      {!href && <span className="text-lav opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">→</span>}
    </>
  )
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={`${cls} border-line text-muted hover:border-lav hover:text-ink`} style={{ animationDelay: `${delay}ms` }}>{inner}</a>
  return <button disabled={!!busy} onClick={onClick} className={`${cls} border-line-strong bg-surface hover:border-lav hover:bg-sunken disabled:opacity-60`} style={{ animationDelay: `${delay}ms` }}>{inner}</button>
}

function WalletRow({ k, wallets, busy, go, delay }: { k: Known; wallets: StdWallet[]; busy: string | null; go: (w: StdWallet) => void; delay: number }) {
  const w = wallets.find((x) => x.name.toLowerCase().includes(k.match))
  if (w) return <WalletButton name={w.name} logo={k.logo} busy={busy} onClick={() => go(w)} delay={delay} />
  const mobileLink = isMobile() && k.deeplink && typeof window !== 'undefined' ? k.deeplink(window.location.href, window.location.origin) : null
  return <WalletButton name={k.name} logo={k.logo} busy={busy} delay={delay} href={mobileLink ?? k.install} tag={mobileLink ? 'Open in app' : 'Install'} />
}
