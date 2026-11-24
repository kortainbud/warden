'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import {
  Bell, BellRinging, ChartLineUp, Flask, GearSix, HandPalm, List, ListChecks, ShieldWarning, SignOut, Snowflake, Wallet, X,
} from '@phosphor-icons/react'
import { Mark } from './brand'
import { Button, cx } from './ui'
import { useApi, send } from '@/lib/api'
import { useSession } from '@/lib/session'
import { short } from '@/lib/format'
import SignIn from './SignIn'

const NAV = [
  { href: '/app', label: 'Overview', icon: ChartLineUp, exact: true },
  { href: '/app/approvals', label: 'Approvals', icon: HandPalm, badge: 'holds' as const },
  { href: '/app/wallets', label: 'Wallets', icon: Wallet },
  { href: '/app/checks', label: 'Checks', icon: ListChecks },
  { href: '/app/test', label: 'Test a transaction', icon: Flask },
  { href: '/app/threats', label: 'Threat Network', icon: ShieldWarning },
  { href: '/app/alerts', label: 'Alerts', icon: Bell, badge: 'alerts' as const },
  { href: '/app/settings', label: 'Settings', icon: GearSix },
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

  if (!checked) return <div className="min-h-dvh bg-page" />
  if (!address) return <SignIn />
  return <Shell address={address} demo={demo} signOut={signOut}>{children}</Shell>
}

function Shell({ address, demo, signOut, children }: { address: string; demo: boolean; signOut: () => Promise<void>; children: ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const holds = useApi<{ data: unknown[] }>('checks?status=held&limit=50', { poll: 15_000 })
  const alerts = useApi<{ unread: number }>('alerts?limit=1', { poll: 15_000 })
  const counts = { holds: holds.data?.data.length ?? 0, alerts: alerts.data?.unread ?? 0 }
  useEffect(() => setOpen(false), [path])

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? path === href : path.startsWith(href)
        const n = badge ? counts[badge] : 0
        return (
          <Link key={href} href={href}
            className={cx('flex h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[14px]', active ? 'bg-sunken font-medium text-ink' : 'text-ink-2 hover:bg-sunken/70')}>
            <Icon size={18} weight={active ? 'fill' : 'regular'} className={active ? 'text-ink' : 'text-muted'} />
            <span className="flex-1">{label}</span>
            {n > 0 && <span className={cx('tnum rounded-full px-1.5 text-[11.5px] font-semibold leading-5', badge === 'holds' ? 'bg-warn-bg text-warn' : 'bg-sunken text-ink-2')}>{n}</span>}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-dvh bg-page">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-line px-3 py-4 lg:flex">
          <Link href="/" className="mb-5 flex items-center gap-2 px-2 text-[15px] font-semibold tracking-[-0.02em]"><Mark size={20} />Warden</Link>
          {nav}
          <div className="mt-auto space-y-2 px-1">
            <KillSwitch />
            <Account address={address} demo={demo} signOut={async () => { await signOut(); router.push('/') }} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-page/95 px-4 backdrop-blur lg:hidden">
            <Link href="/app" className="flex items-center gap-2 text-[15px] font-semibold"><Mark size={20} />Warden</Link>
            <div className="flex items-center gap-1">
              <Link href="/app/alerts" className="relative inline-flex size-9 items-center justify-center rounded-full hover:bg-sunken" aria-label="Alerts">
                <BellRinging size={19} />
                {counts.alerts > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-bad" />}
              </Link>
              <button onClick={() => setOpen(true)} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-sunken" aria-label="Menu"><List size={20} /></button>
            </div>
          </header>
          {open && (
            <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
              <div className="absolute inset-y-0 right-0 flex w-[280px] max-w-[85vw] flex-col bg-page px-3 py-4">
                <div className="mb-4 flex items-center justify-between px-2">
                  <span className="text-[15px] font-semibold">Menu</span>
                  <button onClick={() => setOpen(false)} aria-label="Close" className="inline-flex size-8 items-center justify-center rounded-full hover:bg-sunken"><X size={18} /></button>
                </div>
                {nav}
                <div className="mt-auto space-y-2 px-1">
                  <KillSwitch />
                  <Account address={address} demo={demo} signOut={async () => { await signOut(); router.push('/') }} />
                </div>
              </div>
            </div>
          )}
          {demo && (
            <div className="border-b border-info/20 bg-info-bg px-4 py-2 text-center text-[12.5px] text-info">
              Demo workspace with fictional wallets and data. Nothing here touches the chain.
            </div>
          )}
          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

function Account({ address, demo, signOut }: { address: string; demo: boolean; signOut: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5">
      <div className="min-w-0">
        <div className="text-[12px] text-muted">{demo ? 'Demo owner' : 'Owner wallet'}</div>
        <div className="truncate font-mono text-[12.5px]">{short(address)}</div>
      </div>
      {!demo && <button onClick={signOut} title="Sign out" aria-label="Sign out" className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink"><SignOut size={16} /></button>}
    </div>
  )
}

function KillSwitch() {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (confirming)
    return (
      <div className="rounded-[10px] border border-bad/25 bg-bad-bg p-3">
        <div className="text-[13px] font-medium text-bad">Freeze every wallet?</div>
        <p className="mt-1 text-[12.5px] text-ink-2">Every check is blocked until you unfreeze. Unfreezing needs your wallet signature.</p>
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
      <button onClick={() => { setMsg(null); setConfirming(true) }}
        className="flex h-9 w-full items-center gap-2 rounded-[8px] border border-bad/25 px-2.5 text-[13.5px] font-medium text-bad hover:bg-bad-bg">
        <Snowflake size={16} weight="bold" />Kill switch
      </button>
      {msg && <div className="mt-1.5 px-1 text-[12px] text-muted">{msg}</div>}
    </div>
  )
}
