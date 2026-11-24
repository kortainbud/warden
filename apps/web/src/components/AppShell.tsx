'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { PixelMark } from './hydra/bits'
import { PixelIcon, PixelMeter, type PixelName } from './pixel'
import Dither from './Dither'
import { Button, cx } from './ui'
import { useApi, send } from '@/lib/api'
import { useSession } from '@/lib/session'
import { isAddressLike, short } from '@/lib/format'
import type { WalletRow } from '@/lib/types'


const NAV: { href: string; label: string; icon: PixelName; exact?: boolean; badge?: 'holds' | 'alerts' }[] = [
  { href: '/app', label: 'Overview', icon: 'overview', exact: true },
  { href: '/app/approvals', label: 'Approvals', icon: 'approvals', badge: 'holds' },
  { href: '/app/wallets', label: 'Wallets', icon: 'wallets' },
  { href: '/app/checks', label: 'Checks', icon: 'checks' },
  { href: '/app/test', label: 'Test a transaction', icon: 'test' },
  { href: '/app/threats', label: 'Threat Network', icon: 'shield' },
  { href: '/app/alerts', label: 'Alerts', icon: 'alerts', badge: 'alerts' },
  { href: '/app/settings', label: 'Settings', icon: 'settings' },
]

const TITLES: [RegExp, string][] = [
  [/^\/app\/approvals/, 'Approvals'], [/^\/app\/wallets\/.+/, 'Wallet'], [/^\/app\/wallets/, 'Wallets'], [/^\/app\/checks\/.+/, 'Check'],
  [/^\/app\/checks/, 'Checks'], [/^\/app\/test/, 'Test a transaction'], [/^\/app\/threats/, 'Threat Network'], [/^\/app\/alerts/, 'Alerts'],
  [/^\/app\/settings/, 'Settings'], [/^\/app$/, 'Overview'],
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
  useEffect(() => { void refresh() }, [refresh])
  useTrackHistory()
  const router = useRouter()
  useEffect(() => {
    if (checked && !address) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
  }, [checked, address, router])
  if (!checked || !address) return <div className="flex min-h-dvh items-center justify-center bg-page"><span className="blink size-3 bg-brand" /></div>
  return <Shell address={address} demo={demo} signOut={signOut}>{children}</Shell>
}

function Shell({ address, demo, signOut, children }: { address: string; demo: boolean; signOut: () => Promise<void>; children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const holds = useApi<{ data: unknown[] }>('checks?status=held&limit=50', { poll: 15_000 })
  const alerts = useApi<{ unread: number }>('alerts?limit=1', { poll: 15_000 })
  const wallets = useApi<{ data: WalletRow[] }>('wallets', { poll: 30_000 })
  const counts = { holds: holds.data?.data.length ?? 0, alerts: alerts.data?.unread ?? 0 }
  const reloadWallets = wallets.reload, reloadHolds = holds.reload
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    const f = () => { void reloadWallets(); void reloadHolds() }
    window.addEventListener('warden:refresh', f)
    return () => window.removeEventListener('warden:refresh', f)
  }, [reloadWallets, reloadHolds])
  const title = TITLES.find(([re]) => re.test(path))?.[1] ?? 'Warden'
  const out = async () => { await signOut(); router.push('/login') }

  const ws = wallets.data?.data ?? []
  const enforcing = ws.filter((w) => w.mode === 'enforce').length
  const frozen = ws.filter((w) => w.frozen).length

  const sidebar = (
    <>
      <div className="mt-7 px-3.5">
        <div className="eyebrow">Workspace</div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <span className="font-mono text-[13px]" title={address}>{demo ? 'Demo owner' : short(address, 5)}</span>
          <span className={cx('text-[13px] font-medium tabular-nums', frozen ? 'text-bad' : 'text-ink')}>{frozen ? `${frozen} frozen` : `${enforcing}/${ws.length}`}</span>
        </div>
        <PixelMeter value={ws.length ? (enforcing / ws.length) * 100 : 0} cols={30} rows={2} cell={4} gap={2} className="mt-2.5" label={`${enforcing} of ${ws.length} wallets enforcing`} />
        <div className="mt-1.5 text-[11.5px] text-faint">{ws.length ? `${enforcing} of ${ws.length} wallets enforcing` : 'No wallets yet'}</div>
      </div>

      <nav className="mt-7 space-y-0.5">
        {NAV.map(({ href, label, icon, exact, badge }) => {
          const active = exact ? path === href : path.startsWith(href)
          const n = badge ? counts[badge] : 0
          return (
            <Link key={href} href={href} className={cx('relative flex h-9 items-center gap-3 px-3.5 text-[13.5px] transition-all', active ? 'bg-sunken text-ink' : 'text-muted hover:bg-sunken/60 hover:pl-4 hover:text-ink')}>
              {active && <span className="absolute inset-y-0 left-0 w-[2px] bg-brand" />}<PixelIcon name={icon} size={14} color={active ? '#c8b9ff' : 'currentColor'} />
              {label}
              {n > 0 && <span className={cx('ml-auto inline-flex h-5 min-w-5 items-center justify-center px-1.5 font-mono text-[10.5px] font-medium', badge === 'holds' ? 'bg-warn text-[#0b0716]' : 'bg-brand text-white')}>{n}</span>}
            </Link>
          )
        })}
      </nav>

      {ws.length > 0 && (
        <>
          <div className="eyebrow px-3.5 pb-2 pt-6">Wallets</div>
          {ws.slice(0, 6).map((w) => (
            <Link key={w.id} href={`/app/wallets/${w.id}`} className={cx('flex h-8 items-center gap-2 px-3.5 pl-[42px] text-[12.5px] transition-colors', path.startsWith(`/app/wallets/${w.id}`) ? 'text-ink' : 'text-muted hover:text-ink')}>
              <span className="truncate">{w.label}</span>
              <span className={cx('ml-auto font-mono text-[10px] uppercase tracking-[0.08em]', w.frozen ? 'text-bad' : w.mode === 'enforce' ? 'text-ok' : 'text-info')}>{w.frozen ? 'frozen' : w.mode}</span>
            </Link>
          ))}
        </>
      )}
    </>
  )

  const footer = (
    <div className="space-y-2.5">
      <KillSwitch />
      <div className="flex items-center gap-2.5 border border-line bg-surface py-1.5 pl-2 pr-1.5">
        <span className="inline-flex size-6 items-center justify-center bg-brand"><PixelIcon name="wallets" size={12} color="#ffffff" /></span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12px]" title={address}>{demo ? 'demo' : short(address, 4)}</span>
        {!demo && <button onClick={out} className="px-2.5 py-1 text-[11.5px] text-faint hover:text-lav">Sign out</button>}
      </div>
      <div className="relative overflow-hidden border border-line">
        <Dither className="absolute inset-0 h-full w-full" cell={3} />
        <div className="relative bg-gradient-to-r from-page via-page/85 to-page/10 p-4">
          <div className="font-pixel text-[16px]">Protected wallets</div>
          <p className="mt-1 text-[12px] leading-snug text-ink-2">Two signatures: your agent’s and Warden’s. Warden can never move funds alone.</p>
          <div className="mt-3 inline-flex bg-brand px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white">After audit</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-page lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col px-3 pb-3 pt-5 lg:flex">
        <Link href="/" className="flex items-center gap-2 px-3.5 text-[20px] font-medium tracking-[-0.03em]"><PixelMark size={20} />Warden</Link>
        <div className="flex-1 overflow-y-auto [scrollbar-width:none]">{sidebar}</div>
        {footer}
      </aside>

      <div className="min-w-0 flex-1 lg:py-3 lg:pr-3">
        <div className="min-h-dvh bg-surface lg:min-h-[calc(100dvh-24px)] lg:border lg:border-line">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-8">
            <Link href="/app" className="flex items-center gap-2 lg:hidden" aria-label="Warden"><PixelMark size={22} /></Link>
            <span className="font-pixel truncate text-[16px] text-ink-2">{title}</span>
            <div className="ml-auto flex items-center gap-2">
              <SearchBox wallets={ws} />
              <Link href="/app/alerts" className="px-btn relative inline-flex size-9 items-center justify-center border border-line-strong bg-page text-muted hover:text-ink" aria-label="Alerts" title="Alerts">
                <PixelIcon name="alerts" size={13} />
                {counts.alerts > 0 && <span className="blink absolute -right-1 -top-1 size-2.5 bg-bad" />}
              </Link>
              <Link href="/app/test" className="px-btn hidden h-9 items-center gap-2 bg-brand px-4 text-[13px] font-medium text-white sm:inline-flex">
                <PixelIcon name="spark" size={12} color="#ffffff" />Test a transaction
              </Link>
              <button onClick={() => setOpen(true)} className="inline-flex size-9 items-center justify-center border border-line-strong bg-page lg:hidden" aria-label="Menu">
                <span className="space-y-[3px]"><span className="block h-px w-3.5 bg-ink" /><span className="block h-px w-3.5 bg-ink" /><span className="block h-px w-3.5 bg-ink" /></span>
              </button>
            </div>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 [scrollbar-width:none] lg:hidden">
            {NAV.map(({ href, label, exact, badge }) => {
              const active = exact ? path === href : path.startsWith(href)
              const n = badge ? counts[badge] : 0
              return <Link key={href} href={href} className={cx('whitespace-nowrap px-3.5 py-1.5 text-[13px]', active ? 'bg-brand text-white' : 'text-muted')}>{label}{n > 0 ? ` · ${n}` : ''}</Link>
            })}
          </nav>
          {demo && <div className="border-b border-line bg-info-bg px-4 py-2 text-center font-mono text-[11.5px] uppercase tracking-[0.06em] text-info">Demo workspace with fictional wallets and data. Nothing here touches the chain.</div>}
          <main className="mx-auto max-w-[1240px] px-4 py-8 lg:px-8 lg:py-10">{children}</main>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[290px] max-w-[88vw] flex-col overflow-y-auto bg-page px-3 pb-3 pt-4">
            <div className="flex items-center justify-between px-3.5">
              <span className="flex items-center gap-2 text-[18px] font-medium"><PixelMark size={18} />Warden</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-[13px] text-muted">Close</button>
            </div>
            <div className="flex-1">{sidebar}</div>
            <div className="mt-6">{footer}</div>
          </div>
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
    <form onSubmit={submit} className={cx('hidden h-9 w-72 items-center gap-2 border bg-page px-3.5 transition-colors focus-within:border-lav md:flex', err ? 'border-bad/50' : 'border-line-strong')}>
      <PixelIcon name="search" size={13} className="text-faint" />
      <input ref={ref} value={v} onChange={(e) => { setV(e.target.value); setErr(false) }} placeholder="Wallet name or any address" aria-label="Search wallets or look up an address" spellCheck={false} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
      <kbd className="font-mono text-[10.5px] text-faint">⌘K</kbd>
    </form>
  )
}

function KillSwitch() {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (confirming)
    return (
      <div className="border border-bad/30 bg-bad-bg p-3.5">
        <div className="text-[13px] font-medium text-bad">Freeze every wallet?</div>
        <p className="mt-1 text-[12px] leading-snug text-ink-2">Every check is blocked until you unfreeze. Unfreezing needs your wallet signature.</p>
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" variant="danger" disabled={busy} onClick={async () => {
            setBusy(true)
            try {
              const r = await send<{ frozen: number }>('freeze-all', 'POST')
              setMsg(`${r.frozen} wallet${r.frozen === 1 ? '' : 's'} frozen`)
              setConfirming(false)
              window.dispatchEvent(new Event('warden:refresh'))
            } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
          }}>Freeze all</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      </div>
    )
  return (
    <div>
      <button onClick={() => { setMsg(null); setConfirming(true) }} className="flex h-9 w-full items-center justify-center gap-2 border border-bad/40 bg-page text-[13px] font-medium text-bad transition-colors hover:bg-bad-bg">
        <PixelIcon name="snow" size={12} />Kill switch
      </button>
      {msg && <div className="mt-1.5 px-2 text-center text-[11.5px] text-muted">{msg}</div>}
    </div>
  )
}
