'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { useApi, send } from '@/lib/api'
import { dateTime, timeAgo } from '@/lib/format'
import type { AlertRow } from '@/lib/types'
import { ButtonLink, Card, Empty, ErrorNote, LoadingBlock, PageHeader, Pill, Select, cx, severityTone } from '@/components/ui'

export default function AlertsPage() {
  return <Suspense fallback={<LoadingBlock />}><Alerts /></Suspense>
}

function Alerts() {
  const router = useRouter()
  const sp = useSearchParams()
  const sev = sp.get('severity') ?? ''
  const { data, error, loading, reload } = useApi<{ data: AlertRow[]; unread: number }>(`alerts?limit=100${sev ? `&severity=${sev}` : ''}`, { poll: 15_000 })
  // opening the page marks everything read (after the list has rendered with unread markers)
  useEffect(() => {
    if (!data?.unread) return
    const t = setTimeout(() => void send('alerts/read', 'POST').catch(() => {}), 1500)
    return () => clearTimeout(t)
  }, [data?.unread])
  return (
    <>
      <PageHeader title="Alerts" sub="Rule hits, anomalies, holds and blocks across your wallets." actions={<ButtonLink href="/app/settings?tab=channels">Alert channels</ButtonLink>} />
      <div className="mb-4">
        <Select value={sev} onChange={(e) => router.replace(`/app/alerts${e.target.value ? `?severity=${e.target.value}` : ''}`, { scroll: false })} className="w-auto min-w-[160px]" aria-label="Severity">
          <option value="">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="info">Info</option>
        </Select>
      </div>
      {loading && !data ? <LoadingBlock /> : <ErrorNote error={error} onRetry={reload} />}
      {data && (data.data.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {data.data.map((a) => (
            <Link key={a.id} href={a.ref?.startsWith('chk_') ? `/app/checks/${a.ref}` : a.wallet_id ? `/app/wallets/${a.wallet_id}` : '/app/alerts'}
              className={cx('block px-4 py-3.5 hover:bg-sunken/60 sm:px-5', !a.read_at && 'bg-warn-bg/30')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={severityTone(a.severity)}>{a.severity}</Pill>
                    <span className="text-[14px] font-medium">{a.title}</span>
                    {!a.read_at && <span className="size-1.5 bg-bad" aria-label="unread" />}
                  </div>
                  <p className="mt-1 text-[13.5px] text-ink-2">{a.body}</p>
                  <p className="mt-1 text-[12px] text-muted">{a.wallet_label ?? 'All wallets'}{a.delivered?.length ? ` · sent to ${a.delivered.filter((d) => d.ok).length}/${a.delivered.length} channel${a.delivered.length === 1 ? '' : 's'}` : ''}</p>
                </div>
                <span className="shrink-0 text-[12px] text-muted" title={dateTime(a.created_at)}>{timeAgo(a.created_at)}</span>
              </div>
            </Link>
          ))}
        </Card>
      ) : (
        <Card><Empty title="No alerts" body="You will see alerts here when a rule fires, a payment looks unusual, or a transaction is held or blocked." /></Card>
      ))}
    </>
  )
}
