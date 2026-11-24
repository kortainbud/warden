import type { Baseline } from './evaluate.ts'

export interface OutflowSample {
  /** Unix seconds. */
  ts: number
  usd: number
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))
  return sorted[i]!
}

/** Rolling baseline from a wallet's priced outflows (callers pass the last 30 days). */
export function buildBaseline(samples: OutflowSample[]): Baseline {
  const amounts = samples.map((s) => s.usd).filter((n) => n > 0).sort((a, b) => a - b)
  const perHour = new Map<number, number>()
  const hours = new Set<number>()
  for (const s of samples) {
    const h = Math.floor(s.ts / 3600)
    perHour.set(h, (perHour.get(h) ?? 0) + 1)
    hours.add(new Date(s.ts * 1000).getUTCHours())
  }
  const counts = [...perHour.values()].sort((a, b) => a - b)
  return {
    samples: amounts.length,
    medianOutflowUsd: quantile(amounts, 0.5),
    p95OutflowUsd: quantile(amounts, 0.95),
    p95TxPerHour: quantile(counts, 0.95),
    activeHours: [...hours].sort((a, b) => a - b),
  }
}
