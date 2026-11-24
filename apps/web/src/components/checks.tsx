'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Clock } from '@phosphor-icons/react'
import { Button, Pill, VerdictPill, cx } from './ui'
import { send } from '@/lib/api'
import { short, timeAgo, usd } from '@/lib/format'
import type { CheckRow, Reason } from '@/lib/types'

const STAGE_LABEL: Record<string, string> = {
  control: 'Kill switch', simulation: 'Simulation', rules: 'Rules', reputation: 'Threat Network', anomaly: 'Behaviour', intent: 'Intent',
}
export const stageLabel = (s: string) => STAGE_LABEL[s] ?? s

export function ReasonList({ reasons, showInfo = true }: { reasons: Reason[]; showInfo?: boolean }) {
  const list = reasons.filter((r) => showInfo || r.severity !== 'info')
  if (!list.length) return <p className="text-[13.5px] text-muted">No risk signals.</p>
  return (
    <ul className="space-y-2">
      {list.map((r, i) => (
        <li key={i} className="flex gap-2.5 text-[13.5px]">
          <span className={cx('mt-[7px] size-1.5 shrink-0 rounded-full', r.severity === 'block' ? 'bg-bad' : r.severity === 'hold' ? 'bg-warn' : 'bg-faint')} />
          <span className="min-w-0">
            <span className="text-ink">{r.message}</span>
            <span className="ml-2 break-all font-mono text-[11.5px] text-faint">{r.code}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export function StageBars({ stages }: { stages: CheckRow['stages'] }) {
  return (
    <div className="space-y-2">
      {stages.map((s) => (
        <div key={s.stage} className="flex items-center gap-3 text-[13px]">
          <span className="w-[110px] shrink-0 text-muted">{stageLabel(s.stage)}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
            <div className={cx('h-full rounded-full', s.score >= 90 ? 'bg-bad' : s.score >= 50 ? 'bg-warn' : s.score > 0 ? 'bg-ink-2/40' : '')} style={{ width: `${Math.max(s.score, 0)}%` }} />
          </div>
          <span className="tnum w-8 text-right text-ink-2">{s.score}</span>
        </div>
      ))}
    </div>
  )
}

export function CheckStatus({ c }: { c: Pick<CheckRow, 'status' | 'verdict' | 'enforced' | 'mode'> }) {
  if (c.mode === 'shadow' && c.enforced === 'approve' && c.verdict !== 'approve') return <VerdictPill verdict={c.verdict} enforced="approve" mode="shadow" />
  return <VerdictPill verdict={c.status} />
}

export function CheckLine({ c, showWallet = true }: { c: CheckRow; showWallet?: boolean }) {
  const top = c.reasons.find((r) => r.severity === 'block') ?? c.reasons.find((r) => r.severity === 'hold') ?? c.reasons[0]
  return (
    <Link href={`/app/checks/${c.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 hover:bg-sunken/60 sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <CheckStatus c={c} />
          {c.origin === 'prepay' && <Pill>x402</Pill>}
          {c.origin === 'playground' && <Pill>Test</Pill>}
          {showWallet && <span className="text-[13px] font-medium">{c.wallet_label}</span>}
        </div>
        <p className="mt-1 truncate text-[13.5px] text-ink-2">{c.summary}</p>
        {top && top.severity !== 'info' && <p className="mt-0.5 truncate text-[12.5px] text-muted">{top.message}</p>}
      </div>
      <div className="text-right">
        <div className="tnum text-[13.5px] font-medium">{usd(c.outflow_usd)}</div>
        <div className="mt-1 text-[12px] text-muted">{timeAgo(c.created_at)}</div>
      </div>
    </Link>
  )
}

export function HoldCard({ c, onDone }: { c: CheckRow; onDone: () => void }) {
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const decide = async (decision: 'approve' | 'deny') => {
    setBusy(decision)
    setErr(null)
    try {
      await send(`checks/${c.id}/decision`, 'POST', { decision })
      onDone()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  const trigger = c.context_excerpt?.trigger
  return (
    <div className="rounded-[10px] border border-warn/30 bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2 text-[13px]">
          <Pill tone="warn">Awaiting approval</Pill>
          <span className="font-medium">{c.wallet_label}</span>
          {c.origin === 'prepay' && <Pill>x402</Pill>}
        </div>
        <span className="inline-flex items-center gap-1 text-[12.5px] text-muted"><Clock size={13} />Denies {timeAgo(c.expires_at)} if unanswered</span>
      </div>
      <div className="px-4 py-4 sm:px-5">
        <p className="text-[15px] font-medium leading-snug">{c.summary}</p>
        {trigger?.excerpt && (
          <blockquote className="mt-3 rounded-[8px] border border-line bg-sunken px-3 py-2 text-[13px] text-ink-2">
            <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-muted">From {trigger.source.replace('_', ' ')}{trigger.origin ? ` · ${trigger.origin}` : ''}</div>
            {trigger.excerpt}
          </blockquote>
        )}
        <div className="mt-3"><ReasonList reasons={c.reasons} showInfo={false} /></div>
        {c.recipients[0] && (
          <p className="mt-3 text-[12.5px] text-muted">Recipient <span className="font-mono text-ink-2">{short(c.recipients[0].address, 6)}</span>{c.recipients[0].reasons.length ? ` · ${c.recipients[0].reasons.join(' · ')}` : ''}</p>
        )}
        {err && <p className="mt-3 text-[13px] text-bad">{err}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="danger" disabled={!!busy} onClick={() => decide('deny')}>{busy === 'deny' ? 'Denying…' : 'Deny'}</Button>
          <Button disabled={!!busy} onClick={() => decide('approve')}>{busy === 'approve' ? 'Waiting for signature…' : 'Approve'}</Button>
          <Link href={`/app/checks/${c.id}`} className="ml-auto inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">Full check<ArrowRight size={13} /></Link>
        </div>
        <p className="mt-2 text-[12px] text-faint">Approving asks your owner wallet to sign. A session alone cannot approve.</p>
      </div>
    </div>
  )
}
