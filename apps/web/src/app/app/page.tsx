'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { ArrowRight, Plus } from '@/components/icons'
import { useApi } from '@/lib/api'
import { ms, timeAgo, usd } from '@/lib/format'
import type { AlertRow, CheckRow } from '@/lib/types'
import { ButtonLink, Card, CardHeader, Empty, ErrorNote, LoadingBlock, PageHeader, Pill, Stat, severityTone } from '@/components/ui'
import { HoldCard } from '@/components/checks'
import { DailyBars, VerdictMix } from '@/components/charts'

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
  useEffect(() => {
    const f = () => void reload()
    window.addEventListener('warden:refresh', f)
    return () => window.removeEventListener('warden:refresh', f)
  }, [reload])

  if (loading && !data) return <LoadingBlock />
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />
  if (!data) return null

  if (data.wallets.total === 0)
    return (
      <>
        <PageHeader title="Overview" />
        <Card>
          <Empty
            title="Add your first agent wallet"
            body="Paste any Solana address your agent uses. Warden backfills 30 days of history, learns what normal spending looks like, and alerts you when something is off. No code needed."
            action={<ButtonLink href="/app/wallets?add=1" variant="primary"><Plus size={15} weight="bold" />Add a wallet</ButtonLink>}
          />
        </Card>
      </>
    )

  const c = data.checks_7d
  return (
    <>
      <PageHeader title="Overview" sub="Everything your agents tried to sign, and everything that happened onchain." />

      {data.pending_holds.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-[14px] font-semibold">Needs your decision</h2>
          {data.pending_holds.slice(0, 3).map((h) => <HoldCard key={h.id} c={h} onDone={reload} />)}
          {data.pending_holds.length > 3 && <Link href="/app/approvals" className="text-[13px] text-muted hover:text-ink">{data.pending_holds.length - 3} more in Approvals →</Link>}
        </section>
      )}

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line lg:grid-cols-4">
        {[
          <Stat key="w" label="Wallets" value={data.wallets.total} sub={`${data.wallets.enforce} enforcing${data.wallets.frozen ? ` · ${data.wallets.frozen} frozen` : ''}`} />,
          <Stat key="o" label="Outflow, 24h" value={usd(data.activity_24h.outflow_usd, { compact: true })} sub={`${data.activity_24h.transactions} transactions`} />,
          <Stat key="c" label="Checks, 7d" value={c.total} sub={c.would_block_shadow ? `${c.would_block_shadow} flagged in shadow mode` : `${c.block} blocked · ${c.hold} held`} />,
          <Stat key="l" label="Fast-path latency" value={ms(c.fast_path_p50_ms)} sub={c.fast_path_p99_ms !== null ? `p99 ${ms(c.fast_path_p99_ms)} · target 250 ms` : 'No checks yet'} />,
        ].map((s, i) => <div key={i} className="bg-surface px-4 py-4 sm:px-5">{s}</div>)}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Outflow across all wallets" sub="From monitored onchain activity" />
          <div className="px-4 py-4 sm:px-5"><DailyBars days={data.days} /></div>
          <div className="border-t border-line px-4 py-4 sm:px-5">
            <div className="mb-2.5 text-[13px] text-muted">Verdicts, last 7 days</div>
            <VerdictMix approve={c.approve} hold={c.hold} block={c.block} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent alerts" action={<Link href="/app/alerts" className="text-[13px] text-muted hover:text-ink">All</Link>} />
          {data.recent_alerts.length ? (
            <ul className="divide-y divide-line">
              {data.recent_alerts.map((a) => (
                <li key={a.id}>
                  <Link href={a.ref?.startsWith('chk_') ? `/app/checks/${a.ref}` : a.wallet_id ? `/app/wallets/${a.wallet_id}` : '/app/alerts'} className="block px-4 py-3 hover:bg-sunken/60 sm:px-5">
                    <div className="flex items-center gap-2">
                      <Pill tone={severityTone(a.severity)}>{a.severity}</Pill>
                      <span className="truncate text-[13.5px] font-medium">{a.title}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-3 text-[12.5px] text-muted"><span className="truncate">{a.body}</span><span className="shrink-0">{timeAgo(a.created_at)}</span></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No alerts yet" body="Alerts appear here and in the channels you set up in Settings." />
          )}
          <div className="border-t border-line px-4 py-3 sm:px-5">
            <Link href="/app/checks" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">See every check<ArrowRight size={13} /></Link>
          </div>
        </Card>
      </div>
    </>
  )
}
