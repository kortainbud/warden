'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useApi } from '@/lib/api'
import { ms, timeAgo, usd } from '@/lib/format'
import type { AlertRow, CheckRow, WalletRow } from '@/lib/types'
import { ButtonLink, Card, CardHeader, Empty, ErrorNote, LoadingBlock, PageHeader, Pill, Stat, StatStrip, severityTone } from '@/components/ui'
import { HoldCard } from '@/components/checks'
import { DailyBars } from '@/components/charts'
import { PixelIcon, PixelMeter, meterColor } from '@/components/pixel'
import Dither from '@/components/Dither'

interface Overview {
  wallets: { total: number; frozen: number; enforce: number }
  checks_7d: { total: number; approve: number; hold: number; block: number; would_block_shadow: number; fast_path_p50_ms: number | null; fast_path_p99_ms: number | null }
  activity_24h: { transactions: number; outflow_usd: number }
  overrides: { owner_overrides: number; labelled: number }
  pending_holds: CheckRow[]
  recent_alerts: AlertRow[]
  days: { day: string; outflow_usd: number | null; txs: number }[]
}

export default function OverviewPage() {
  const { data, error, loading, reload } = useApi<Overview>('overview', { poll: 15_000 })
  const wallets = useApi<{ data: WalletRow[] }>('wallets', { poll: 30_000 })
  const reloadWallets = wallets.reload
  useEffect(() => {
    const f = () => { void reload(); void reloadWallets() }
    window.addEventListener('warden:refresh', f)
    return () => window.removeEventListener('warden:refresh', f)
  }, [reload, reloadWallets])

  if (loading && !data) return <LoadingBlock />
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />
  if (!data) return null

  if (data.wallets.total === 0)
    return (
      <>
        <PageHeader eyebrow="Overview" title="Add your first agent wallet" sub="Paste any Solana address your agent signs with. Warden backfills 30 days of history, learns what normal looks like, and alerts you when something is off. No code needed." />
        <Card className="relative overflow-hidden">
          <Dither className="absolute inset-y-0 right-0 h-full w-1/2" />
          <div className="relative bg-gradient-to-r from-surface via-surface/90 to-transparent px-6 py-10 sm:px-8">
            <div className="eyebrow">Step 1 of 3</div>
            <p className="mt-2 max-w-md text-[15px] text-ink-2">Monitoring works on any address. When you are ready, add the SDK so your agent checks with Warden before signing.</p>
            <ButtonLink href="/app/wallets?add=1" variant="primary" className="mt-6">Add a wallet</ButtonLink>
          </div>
        </Card>
      </>
    )

  const c = data.checks_7d
  const pending = data.pending_holds.length
  const ws = wallets.data?.data ?? []

  return (
    <>
      {/* hero: the big number over the dither */}
      <Card className="relative mb-5 overflow-hidden">
        <Dither className="absolute inset-0 h-full w-full" />
        <div className="relative grid gap-6 bg-gradient-to-r from-surface via-surface/90 to-surface/10 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <div>
            <div className="eyebrow">Last 7 days · all wallets</div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="tnum font-pixel text-[80px] leading-none sm:text-[112px]">{c.total}</span>
              <span className="text-[20px] text-faint">checks</span>
            </div>
            <div className="mt-4 text-[17px]">
              <span className="text-ok">{c.approve} approved</span><span className="text-faint"> · </span>
              <span className="text-warn">{c.hold} held</span><span className="text-faint"> · </span>
              <span className="text-bad">{c.block} blocked</span>
              {c.would_block_shadow > 0 && <span className="text-info"> · {c.would_block_shadow} flagged in shadow</span>}
            </div>
          </div>
          <div className="lg:justify-self-end">
            <p className="max-w-[380px] text-[15px] leading-relaxed text-ink-2">
              {pending ? `${pending} payment${pending === 1 ? '' : 's'} need${pending === 1 ? 's' : ''} your decision. No answer before the timeout means deny.` : `Nothing needs you right now. Warden is watching ${data.wallets.total} wallet${data.wallets.total === 1 ? '' : 's'}.`}
            </p>
            <ButtonLink href={pending ? '/app/approvals' : '/app/test'} variant="primary" className="mt-4">
              <PixelIcon name={pending ? 'approvals' : 'spark'} size={12} color="#ffffff" />{pending ? 'Review approvals' : 'Test a transaction'}
            </ButtonLink>
          </div>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Spend against daily cap" action={<Link href="/app/wallets" className="text-[12.5px] text-muted hover:text-ink">All wallets</Link>} />
          <div className="space-y-5 px-5 pb-6 sm:px-6">
            {ws.length ? ws.slice(0, 6).map((w) => {
              const pct = w.daily_cap_usd ? (w.outflow_usd_24h / w.daily_cap_usd) * 100 : 0
              return (
                <Link key={w.id} href={`/app/wallets/${w.id}`} className="block">
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="truncate">{w.label}{w.frozen && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-bad">frozen</span>}</span>
                    <span className="tnum shrink-0 font-mono text-[11px] text-faint">{usd(w.outflow_usd_24h)} / {w.daily_cap_usd !== null ? usd(w.daily_cap_usd, { compact: true }) : 'no cap'}</span>
                  </div>
                  <PixelMeter value={Math.max(pct, w.outflow_usd_24h > 0 ? 1.5 : 0)} cols={52} rows={2} cell={6} gap={2} color={meterColor(pct)} className="mt-2" />
                </Link>
              )
            }) : <p className="text-[13.5px] text-muted">No wallets yet.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="What happened" action={<Link href="/app/alerts" className="text-[12.5px] text-muted hover:text-ink">All alerts</Link>} />
          {data.recent_alerts.length ? (
            <ul className="px-5 pb-4 sm:px-6">
              {data.recent_alerts.slice(0, 7).map((a) => (
                <li key={a.id}>
                  <Link href={a.ref?.startsWith('chk_') ? `/app/checks/${a.ref}` : a.wallet_id ? `/app/wallets/${a.wallet_id}` : '/app/alerts'} className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-baseline gap-3 py-2 text-[13.5px] hover:text-ink">
                    <Pill tone={severityTone(a.severity)}>{a.severity}</Pill>
                    <span className="truncate text-ink-2">{a.title}</span>
                    <span className="text-[12px] text-faint">{timeAgo(a.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty title="No alerts yet" body="Alerts appear here and in the channels you set up in Settings." />}
        </Card>
      </div>

      <div className="mb-5">
        <StatStrip>{[
          <Stat key="w" label="Wallets" value={data.wallets.total} sub={`${data.wallets.enforce} enforcing${data.wallets.frozen ? ` · ${data.wallets.frozen} frozen` : ''}`} />,
          <Stat key="o" label="Outflow, 24h" value={usd(data.activity_24h.outflow_usd, { compact: true })} sub={`${data.activity_24h.transactions} transactions`} />,
          <Stat key="l" label="Fast path p50" value={ms(c.fast_path_p50_ms)} sub={c.fast_path_p99_ms !== null ? `p99 ${ms(c.fast_path_p99_ms)} · target 250 ms` : 'No checks yet'} />,
          <Stat key="f" label="Owner overrides" value={data.overrides.owner_overrides} sub={`${data.overrides.labelled} labelled verdicts`} />,
        ]}</StatStrip>
      </div>

      {pending > 0 && (
        <section className="mb-5 space-y-3">
          <div className="eyebrow px-1">Needs your decision</div>
          {data.pending_holds.slice(0, 2).map((h) => <HoldCard key={h.id} c={h} onDone={reload} />)}
          {pending > 2 && <Link href="/app/approvals" className="block px-1 text-[13px] text-muted hover:text-ink">{pending - 2} more in Approvals →</Link>}
        </section>
      )}

      <Card>
        <CardHeader title="Outflow · last 14 days" sub="From monitored onchain activity, net of swaps" />
        <div className="px-5 pb-6 sm:px-6"><DailyBars days={data.days} /></div>
      </Card>
    </>
  )
}
