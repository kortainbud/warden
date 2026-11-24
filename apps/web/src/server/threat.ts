// Threat Network v1: transparent weighted rules with reasons. Signals come from confirmed
// reports, blocks across all customers, and live onchain facts (account age).

import 'server-only'
import type { Reputation } from '@warden/engine'
import { json, sql } from './db'
import { firstSeen } from './helius'
import { isDemo } from './env'

interface EntityRow {
  kind: string
  key: string
  score: number
  reasons: string[]
  signals: { firstSeen?: number | null; firstSeenCheckedAt?: number; confirmed?: string }
  updated_at: string
}

const DAY = 86_400

async function ageSignal(row: EntityRow | undefined, address: string): Promise<{ firstSeen: number | null; fresh: boolean }> {
  const s = row?.signals
  const now = Date.now() / 1000
  // An address's first transaction never changes once known; "no history" is re-checked hourly.
  if (s?.firstSeen) return { firstSeen: s.firstSeen, fresh: false }
  if (s && s.firstSeenCheckedAt && now - s.firstSeenCheckedAt < 3600) return { firstSeen: null, fresh: false }
  if (isDemo()) return { firstSeen: null, fresh: false }
  try {
    return { firstSeen: await firstSeen(address), fresh: true }
  } catch {
    return { firstSeen: s?.firstSeen ?? null, fresh: false }
  }
}

export async function addressReputation(address: string, opts: { live?: boolean } = { live: true }): Promise<Reputation & { signals: Record<string, unknown> }> {
  const [row] = await sql<EntityRow>`SELECT * FROM entities WHERE kind = 'address' AND key = ${address}`
  const reasons: string[] = []
  let score = 0

  if (row?.signals?.confirmed) {
    return { score: 100, denylisted: true, reasons: [`Confirmed ${row.signals.confirmed}`, ...(row.reasons ?? [])], ageDays: null, signals: row.signals }
  }

  const [blocks] = await sql<{ owners: string; n: string }>`
    SELECT COUNT(DISTINCT w.owner) AS owners, COUNT(*) AS n
    FROM checks c JOIN wallets w ON w.id = c.wallet_id
    WHERE c.verdict = 'block' AND c.created_at > now() - interval '7 days'
      AND c.recipients @> ${JSON.stringify([{ address }])}::jsonb`
  const owners = Number(blocks?.owners ?? 0)
  if (owners > 0) {
    score += Math.min(60, owners * 25)
    reasons.push(`Blocked for ${owners} customer${owners > 1 ? 's' : ''} this week`)
  }

  const [rep] = await sql<{ n: string }>`SELECT COUNT(*) AS n FROM reports WHERE kind = 'address' AND key = ${address} AND status = 'pending'`
  const pending = Number(rep?.n ?? 0)
  if (pending) {
    score += Math.min(30, pending * 10)
    reasons.push(`${pending} unconfirmed report${pending > 1 ? 's' : ''}`)
  }

  let ageDays: number | null = null
  let noHistory = false
  if (opts.live !== false) {
    const age = await ageSignal(row, address)
    const now = Date.now() / 1000
    if (age.firstSeen) {
      ageDays = (now - age.firstSeen) / DAY
      if (ageDays < 1) {
        score += 25
        reasons.push(`First seen onchain ${Math.max(1, Math.round(ageDays * 24))} hours ago`)
      } else if (ageDays < 7) {
        score += 10
        reasons.push(`First seen onchain ${Math.round(ageDays)} days ago`)
      }
    } else if (age.fresh || row?.signals?.firstSeenCheckedAt) {
      ageDays = null
      noHistory = true
      score += 15
      reasons.push('No onchain history')
    }
    if (age.fresh) {
      const signals = { ...(row?.signals ?? {}), firstSeen: age.firstSeen, firstSeenCheckedAt: Math.floor(now) }
      await sql`
        INSERT INTO entities (kind, key, score, reasons, signals) VALUES ('address', ${address}, ${Math.min(100, score)}, ${json(reasons)}, ${signals})
        ON CONFLICT (kind, key) DO UPDATE SET score = EXCLUDED.score, reasons = EXCLUDED.reasons, signals = EXCLUDED.signals, updated_at = now()`
    }
  }

  for (const r of row?.reasons ?? []) if (!reasons.includes(r) && !/^First seen|^No onchain|^Blocked for|unconfirmed report/.test(r)) reasons.push(r)
  return { score: Math.min(100, score), reasons, ageDays, noHistory, signals: row?.signals ?? {} }
}

export const REPORT_CATEGORIES = ['drainer', 'phishing', 'prompt injection payee', 'fake x402 endpoint', 'impersonation', 'other'] as const

export async function confirmReport(kind: string, key: string, category: string) {
  await sql`
    INSERT INTO entities (kind, key, score, reasons, signals) VALUES (${kind}, ${key}, 100, ${json([`Reported as ${category}`])}, ${{ confirmed: category }})
    ON CONFLICT (kind, key) DO UPDATE SET score = 100, signals = entities.signals || ${{ confirmed: category }}::jsonb, updated_at = now()`
}
