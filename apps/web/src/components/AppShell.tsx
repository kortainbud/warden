'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { PixelMark } from './hydra/bits'
import { PixelIcon } from './pixel'
import { Button, cx } from './ui'
import { useApi, send } from '@/lib/api'
import { useSession } from '@/lib/session'
import { isAddressLike, short, timeAgo } from '@/lib/format'
import type { WalletRow } from '@/lib/types'

const NAV: { href: string; label: string; exact?: boolean; badge?: 'holds' | 'alerts' }[] = [
  { href: '/app', label: 'Overview', exact: true },
  { href: '/app/approvals', label: 'Approvals', badge: 'holds' },
  { href: '/app/wallets', label: 'Wallets' },
  { href: '/app/checks', label: 'Checks' },
  { href: '/app/threats', label: 'Threat Network' },
  { href: '/app/alerts', label: 'Alerts', badge: 'alerts' },
]

// Remember in-app navigation so "Back" can return to the exact origin (see Back.tsx).
function useTrackHistory() {
  const path = usePathname()
  useEffect(() => {
    try {
      const stack: string[] = JSON.parse(sessionStorage.getItem('warden.nav') ?? '[]')
      const full = path + window.location.search
      if (stack[stack.length - 1] !== full) stack.push(full)
      sessionStorage.setItem('warden.nav', JSON.stringify(stack.slice(-30)))
    } catch { /* ignore */ }
  }, [path])
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { address, checked, demo, refresh, signOut } = useSession()
  const router = useRouter()
  useEffect(() => { void refresh() }, [refresh])
  useTrackHistory()
  useEffect(() => {
    if (checked && !address) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
  }, [checked, address, router])
  if (!checked || !address) return <div className="flex min-h-dvh items-center justify-center bg-page"><span className="blink size-3 bg-brand" /></div>
  return <Shell address={address} demo={demo} signOut={signOut}>{children}</Shell>
}

function Shell({ address, demo, signOut, children }: { address: string; demo: boolean; signOut: () => Promise<void>; children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const holds = useApi<{ data: unknown[] }>('checks?status=held&limit=50', { poll: 15_000 })
  const alerts = useApi<{ unread: number }>('alerts?limit=1', { poll: 15_000 })
  const wallets = useApi<{ data: WalletRow[] }>('wallets', { poll: 30_000 })
  const counts = { holds: holds.data?.data.length ?? 0, alerts: alerts.data?.unread ?? 0 }
  const reloadWallets = wallets.reload, reloadHolds = holds.reload
  useEffect(() => {
    const f = () => { void reloadWallets(); void reloadHolds() }
    window.addEventListener('warden:refresh', f)
    return () => window.removeEventListener('warden:refresh', f)
  }, [reloadWallets, reloadHolds])

  const ws = wallets.data?.data ?? []
  const enforcing = ws.filter((w) => w.mode === 'enforce').length
  const frozen = ws.filter((w) => w.frozen).length
  const lastSync = ws.map((w) => w.last_synced_at).filter(Boolean).sort().pop() ?? null

  return (
    <div className="min-h-dvh bg-page">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-page/90 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1440px] items-center gap-6 px-4 sm:px-8">
          <Link href="/app" className="flex shrink-0 items-center gap-2 text-[20px] font-medium tracking-[-0.03em]"><PixelMark size={20} />Warden</Link>
          <nav className="hidden h-full items-stretch lg:flex">
            {NAV.map(({ href, label, exact, badge }) => {
              const active = exact ? path === href : path.startsWith(href)
              const n = badge ? counts[badge] : 0
              return (
                <Link key={href} href={href} className={cx('group relative flex items-center gap-1.5 px-3.5 text-[14px] transition-colors', active ? 'text-ink' : 'text-muted hover:text-ink')}>
                  {label}
                  {n > 0 && <span className={cx('px-1 font-mono text-[10.5px]', badge === 'holds' ? 'bg-warn text-[#0b0716]' : 'bg-brand text-white')}>{n}</span>}
                  <span className={cx('absolute inset-x-3.5 bottom-0 h-[2px] transition-all', active ? 'bg-brand' : 'bg-transparent group-hover:bg-line-strong')} />
                </Link>
              )
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SearchBox wallets={ws} />
            <Link href="/app/test" className="px-btn hidden h-9 items-center gap-2 bg-brand px-3.5 text-[13.5px] font-medium text-white sm:inline-flex">
              <PixelIcon name="spark" size={11} color="#ffffff" />Test a transaction
            </Link>
            <KillSwitch />
            <AccountMenu address={address} demo={demo} onSignOut={async () => { await signOut(); router.push('/login') }} />
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex overflow-x-auto border-t border-line px-2 [scrollbar-width:none] lg:hidden">
          {NAV.map(({ href, label, exact, badge }) => {
            const active = exact ? path === href : path.startsWith(href)
            const n = badge ? counts[badge] : 0
            return <Link key={href} href={href} className={cx('relative whitespace-nowrap px-3 py-2.5 text-[13px]', active ? 'text-ink' : 'text-muted')}>{label}{n > 0 ? ` ${n}` : ''}{active && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-brand" />}</Link>
          })}
          <Link href="/app/test" className={cx('relative whitespace-nowrap px-3 py-2.5 text-[13px]', path.startsWith('/app/test') ? 'text-ink' : 'text-lav')}>Test</Link>
        </nav>
        <div aria-hidden><div className="h-px bg-brand" /><div className="mt-[5px] h-px bg-line" /></div>
      </header>

      {/* Status strip: replaces the old workspace meter */}
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-faint sm:px-8">
          <span className="flex items-center gap-2 text-ok"><span className="blink size-1.5 bg-ok" />Live</span>
          <span><span className="text-ink-2">{ws.length}</span> wallet{ws.length === 1 ? '' : 's'}</span>
          <span><span className="text-ok">{enforcing}</span> enforcing</span>
          <span><span className="text-info">{ws.length - enforcing}</span> shadow</span>
          {frozen > 0 && <span className="text-bad">{frozen} frozen</span>}
          {counts.holds > 0 && <Link href="/app/approvals" className="text-warn hover:underline">{counts.holds} awaiting approval</Link>}
          <span className="ml-auto hidden sm:inline">Synced {timeAgo(lastSync)}</span>
          {demo && <span className="text-info">Demo workspace · fictional data</span>}
        </div>
      </div>

      <main className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <div className="min-h-[calc(100dvh-140px)] border-line py-8 sm:border-x sm:px-8 lg:py-10">{children}</div>
      </main>
    </div>
  )
}

function AccountMenu({ address, demo, onSignOut }: { address: string; demo: boolean; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account" className={cx('flex h-9 items-center gap-2 border px-2.5 text-[12.5px] transition-colors', open ? 'border-lav' : 'border-line-strong hover:border-lav')}>
        <span className="size-4 bg-brand" />
        <span className="hidden font-mono sm:inline">{demo ? 'demo' : short(address, 4)}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 border border-line-strong bg-surface [animation:fadeUp_.2s_ease-out]">
          <div className="border-b border-line px-3.5 py-3">
            <div className="eyebrow">Owner wallet</div>
            <div className="mt-1 break-all font-mono text-[11.5px] text-ink-2">{demo ? 'Demo workspace' : address}</div>
          </div>
          <Link href="/app/settings" onClick={() => setOpen(false)} className="block px-3.5 py-2.5 text-[13.5px] text-ink-2 hover:bg-sunken hover:text-ink">API keys</Link>
          <Link href="/app/settings?tab=channels" onClick={() => setOpen(false)} className="block px-3.5 py-2.5 text-[13.5px] text-ink-2 hover:bg-sunken hover:text-ink">Alert channels</Link>
          <Link href="/docs" className="block px-3.5 py-2.5 text-[13.5px] text-ink-2 hover:bg-sunken hover:text-ink">Docs ↗</Link>
          {!demo && <button onClick={onSignOut} className="block w-full border-t border-line px-3.5 py-2.5 text-left text-[13.5px] text-muted hover:bg-sunken hover:text-bad">Sign out</button>}
        </div>
      )}
    </div>
  )
}

/** ⌘K: jump to one of your wallets, or look the address up in the Threat Network. */
function SearchBox({ wallets }: { wallets: WalletRow[] }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const router = useRouter()
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus() } }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = v.trim()
    const mine = wallets.find((w) => w.address === q || w.label.toLowerCase() === q.toLowerCase())
    if (mine) { setV(''); router.push(`/app/wallets/${mine.id}`); return }
    if (!isAddressLike(q)) { setErr(true); return }
    setV('')
    ref.current?.blur()
    router.push(`/app/threats?q=${q}`)
  }
  return (
    <form onSubmit={submit} className={cx('hidden h-9 w-60 items-center gap-2 border bg-surface px-3 transition-[border-color,width] focus-within:w-80 focus-within:border-lav xl:flex', err ? 'border-bad/50' : 'border-line-strong')}>
      <PixelIcon name="search" size={12} className="text-faint" />
      <input ref={ref} value={v} onChange={(e) => { setV(e.target.value); setErr(false) }} placeholder="Wallet or any address" aria-label="Search wallets or look up an address" spellCheck={false} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
      <kbd className="font-mono text-[10.5px] text-faint">⌘K</kbd>
    </form>
  )
}

/** Header kill switch: a red button that opens a confirm panel. */
function KillSwitch() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setMsg(null); setOpen((o) => !o) }} aria-label="Kill switch" title="Kill switch"
        className={cx('px-btn flex h-9 items-center gap-2 border px-2.5 text-[13px] font-medium text-bad transition-colors', open ? 'border-bad bg-bad-bg' : 'border-bad/40 hover:bg-bad-bg')}>
        <PixelIcon name="snow" size={12} /><span className="hidden md:inline">Kill switch</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 border border-bad/40 bg-surface p-4 [animation:fadeUp_.2s_ease-out]">
          <div className="font-pixel text-[18px] text-bad">Freeze every wallet?</div>
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">Every check is blocked until you unfreeze. Unfreezing needs your wallet signature.</p>
          {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="danger" disabled={busy} onClick={async () => {
              setBusy(true)
              try {
                const r = await send<{ frozen: number }>('freeze-all', 'POST')
                setMsg(`${r.frozen} wallet${r.frozen === 1 ? '' : 's'} frozen`)
                window.dispatchEvent(new Event('warden:refresh'))
              } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
            }}>Freeze all</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}
