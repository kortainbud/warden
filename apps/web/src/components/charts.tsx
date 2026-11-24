'use client'

import { useState } from 'react'
import { usd } from '@/lib/format'

/** Daily outflow bars with a hover readout. Missing days render as zero-height slots. */
export function DailyBars({ days, n = 14 }: { days: { day: string; outflow_usd: number | null; txs: number | string }[]; n?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const map = new Map(days.map((d) => [d.day, d]))
  const slots = Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.now() - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10)
    const row = map.get(d)
    return { day: d, usd: Number(row?.outflow_usd ?? 0), txs: Number(row?.txs ?? 0) }
  })
  const max = Math.max(1, ...slots.map((s) => s.usd))
  const shown = hover !== null ? slots[hover]! : null
  const total = slots.reduce((a, s) => a + s.usd, 0)
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-muted">{shown ? new Date(shown.day + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : `Last ${n} days`}</span>
        <span className="tnum font-medium">{shown ? `${usd(shown.usd)} · ${shown.txs} tx` : `${usd(total, { compact: true })} out`}</span>
      </div>
      <div className="flex h-28 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {slots.map((s, i) => (
          <div key={s.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div className={`w-full rounded-[3px] ${hover === i ? 'bg-accent' : 'bg-accent/70'}`} style={{ height: `${s.usd ? Math.max(3, (s.usd / max) * 100) : 1.5}%`, opacity: s.usd ? 1 : 0.25 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function VerdictMix({ approve, hold, block }: { approve: number; hold: number; block: number }) {
  const total = approve + hold + block
  if (!total) return <div className="h-2 rounded-full bg-sunken" />
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-sunken">
        <div className="bg-ok" style={{ width: `${(approve / total) * 100}%` }} />
        <div className="bg-warn" style={{ width: `${(hold / total) * 100}%` }} />
        <div className="bg-bad" style={{ width: `${(block / total) * 100}%` }} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
        <span><span className="mr-1.5 inline-block size-2 rounded-full bg-ok" />Approve <span className="tnum text-ink">{approve}</span></span>
        <span><span className="mr-1.5 inline-block size-2 rounded-full bg-warn" />Hold <span className="tnum text-ink">{hold}</span></span>
        <span><span className="mr-1.5 inline-block size-2 rounded-full bg-bad" />Block <span className="tnum text-ink">{block}</span></span>
      </div>
    </div>
  )
}
