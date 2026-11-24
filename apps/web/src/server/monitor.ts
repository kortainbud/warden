// Monitor: backfill 30 days, pull new activity, store decoded events, run detectors, raise alerts.
// Real-time delivery comes from the Helius webhook (/api/hooks/helius); `syncWallet` is the
// catch-up path used on add, from the dashboard, and if a webhook is missed.

import 'server-only'
import { short, type Action } from '@warden/decoder'
import { buildBaseline, type Policy } from '@warden/engine'
import { json, rawQuery, sql } from './db'
import { addressTransactions, type HeliusTx } from './helius'
import { changesOf, toEvent, type EventRow } from './normalize'
import { tokenMeta } from './prices'
import { raiseAlert } from './alerts'
import { addressReputation } from './threat'
import { currentPolicy, knownRecipients, outflowSamples, type Wallet } from './repo'
import { isDemo } from './env'

const BACKFILL_DAYS = 30
const BACKFILL_MAX = 1000

const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 })}`

async function insertEvent(walletId: string, e: EventRow): Promise<boolean> {
  const rows = await sql`
    INSERT INTO events (wallet_id, signature, slot, ts, type, source, description, actions, changes, outflow_usd, inflow_usd,
      outflow_unpriced, counterparties, recipients, programs, fee, failed, signed_by_wallet)
    VALUES (${walletId}, ${e.signature}, ${e.slot}, ${e.ts.toISOString()}, ${e.type}, ${e.source}, ${e.description}, ${json(e.actions)}, ${json(e.changes)},
      ${e.outflowUsd}, ${e.inflowUsd}, ${e.outflowUnpriced}, ${e.counterparties}, ${e.recipients}, ${e.programs}, ${e.fee}, ${e.failed}, ${e.signedByWallet})
    ON CONFLICT (wallet_id, signature) DO NOTHING RETURNING signature`
  return rows.length > 0
}

const EVENT_COLS = 18

async function insertMany(walletId: string, rows: EventRow[]): Promise<EventRow[]> {
  const params: unknown[] = []
  const values = rows.map((e, i) => {
    params.push(walletId, e.signature, e.slot, e.ts.toISOString(), e.type, e.source, e.description, json(e.actions), json(e.changes),
      e.outflowUsd, e.inflowUsd, e.outflowUnpriced, e.counterparties, e.recipients, e.programs, e.fee, e.failed, e.signedByWallet)
    const b = i * EVENT_COLS
    return `(${Array.from({ length: EVENT_COLS }, (_, k) => `$${b + k + 1}`).join(',')})`
  })
  const inserted = await rawQuery<{ signature: string }>(
    `INSERT INTO events (wallet_id, signature, slot, ts, type, source, description, actions, changes, outflow_usd, inflow_usd,
      outflow_unpriced, counterparties, recipients, programs, fee, failed, signed_by_wallet)
     VALUES ${values.join(',')} ON CONFLICT (wallet_id, signature) DO NOTHING RETURNING signature`, params)
  const ok = new Set(inserted.map((r) => r.signature))
  return rows.filter((r) => ok.has(r.signature))
}

export async function syncWallet(w: Wallet): Promise<{ added: number }> {
  if (isDemo()) {
    await sql`UPDATE wallets SET last_synced_at = now() WHERE id = ${w.id}`
    return { added: 0 }
  }
  const first = !w.backfilled_at
  await sql`UPDATE wallets SET sync_status = 'syncing', sync_error = NULL WHERE id = ${w.id}`
  try {
    const txs = await addressTransactions(w.address, first
      ? { sinceTs: Math.floor(Date.now() / 1000) - BACKFILL_DAYS * 86_400, max: BACKFILL_MAX }
      : { untilSignature: w.newest_signature, max: 500 })
    const added = await ingest(w, txs, { alert: !first })
    const newest = txs[0]?.signature ?? w.newest_signature
    await sql`
      UPDATE wallets SET sync_status = 'ready', newest_signature = ${newest}, last_synced_at = now(),
        backfilled_at = COALESCE(backfilled_at, now()) WHERE id = ${w.id}`
    return { added }
  } catch (e) {
    await sql`UPDATE wallets SET sync_status = 'error', sync_error = ${(e as Error).message.slice(0, 300)} WHERE id = ${w.id}`
    throw e
  }
}

/** Store transactions (newest-first) for a wallet and, for live activity, run detectors. */
export async function ingest(w: Wallet, txs: HeliusTx[], opts: { alert: boolean }): Promise<number> {
  if (!txs.length) return 0
  // Price every mint in the batch with one lookup, then decode (oldest first).
  const mints = new Set<string>()
  for (const tx of txs) for (const c of changesOf(tx)) if (c.owner === w.address) mints.add(c.mint)
  await tokenMeta([...mints])
  const events: EventRow[] = []
  for (const tx of [...txs].reverse()) events.push(await toEvent(tx, w.address))
  // Single inserts for live activity (to know exactly which rows are new); bulk for backfill.
  const fresh: EventRow[] = []
  if (opts.alert) {
    for (const e of events) if (await insertEvent(w.id, e)) fresh.push(e)
  } else {
    for (let i = 0; i < events.length; i += 100) fresh.push(...(await insertMany(w.id, events.slice(i, i + 100))))
  }
  const added = fresh.length
  if (opts.alert && fresh.length) {
    const { policy } = await currentPolicy(w.id)
    for (const e of fresh) await detect(w, policy, e)
    await detectDrain(w, policy)
  }
  return added
}

async function detect(w: Wallet, policy: Policy, e: EventRow) {
  if (e.failed) return
  const ref = e.signature
  const key = (t: string) => `${w.id}:${t}:${e.signature}`
  const out = e.outflowUsd ?? 0

  if (w.kind === 'protected' && e.outflowUsd && e.outflowUsd > 0 && !e.signedByWallet)
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'critical', type: 'outflow_not_cosigned', ref, dedupeKey: key('nocosign'),
      title: `Funds left ${w.label} without Warden`, body: `${fmtUsd(out)} left the protected wallet in a transaction Warden did not co-sign. ${e.description}` })

  for (const a of e.actions as Action[]) {
    if (a.kind === 'token_approve' && a.owner === w.address)
      await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'critical', type: 'token_approval', ref, dedupeKey: key('approve'),
        title: `${w.label} approved a token spender`, body: `${short(a.delegate)} can now spend tokens from ${short(a.source)}. Revoke it if you did not intend this.` })
    if (a.kind === 'smart_account' && a.op === 'settings_change')
      await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'critical', type: 'settings_change', ref, dedupeKey: key('settings'),
        title: `Smart account settings changed on ${w.label}`, body: `${a.name ?? 'A settings instruction'} ran on the smart account. If this was not you, rotate the owner key now.` })
  }

  if (policy.perTxCapUsd !== null && out > policy.perTxCapUsd)
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'warning', type: 'cap_exceeded', ref, dedupeKey: key('cap'),
      title: `${w.label} sent ${fmtUsd(out)}`, body: `Above the ${fmtUsd(policy.perTxCapUsd)} per-transaction cap. ${e.description}` })

  if (e.recipients.length && out > 0) {
    const known = await knownRecipients(w.id, e.recipients)
    // the event itself is already stored, so "known" means paid in a different transaction
    const [prior] = await sql<{ n: string }>`
      SELECT COUNT(*) AS n FROM events WHERE wallet_id = ${w.id} AND signature <> ${e.signature} AND recipients && ${e.recipients}::text[]`
    const isNew = known.size === 0 || Number(prior?.n ?? 0) === 0
    for (const r of e.recipients) {
      const rep = await addressReputation(r)
      if (rep.denylisted || rep.score >= 90)
        await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'critical', type: 'risky_recipient', ref, dedupeKey: key(`risk:${r}`),
          title: `${w.label} paid a flagged address`, body: `${fmtUsd(out)} to ${short(r)}: ${rep.reasons[0] ?? 'flagged by the Threat Network'}.` })
      else if (isNew && out > policy.newRecipientHoldUsd)
        await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'warning', type: 'new_recipient', ref, dedupeKey: key(`new:${r}`),
          title: `${w.label} paid a new recipient`, body: `First payment to ${short(r)}: ${fmtUsd(out)}.${rep.reasons.length ? ` ${rep.reasons.join('. ')}.` : ''}` })
    }
  }

  const samples = await outflowSamples(w.id)
  const b = buildBaseline(samples)
  if (b.samples >= 10 && out > Math.max(b.p95OutflowUsd * 3, 50))
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'warning', type: 'amount_anomaly', ref, dedupeKey: key('anomaly'),
      title: `Unusually large payment from ${w.label}`, body: `${fmtUsd(out)}, against a usual ${fmtUsd(b.medianOutflowUsd)} (95th percentile ${fmtUsd(b.p95OutflowUsd)}).` })
}

async function detectDrain(w: Wallet, policy: Policy) {
  const [r] = await sql<{ n: string; usd: number | null }>`
    SELECT COUNT(*) AS n, SUM(outflow_usd) AS usd FROM events
    WHERE wallet_id = ${w.id} AND NOT failed AND outflow_usd > 0 AND ts > now() - interval '10 minutes'`
  const n = Number(r?.n ?? 0), usd = Number(r?.usd ?? 0)
  const bucket = Math.floor(Date.now() / 600_000)
  if (n >= 5 && usd > 20)
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'critical', type: 'drain_pattern', dedupeKey: `${w.id}:drain:${bucket}`,
      title: `Possible drain on ${w.label}`, body: `${n} outflows totalling ${fmtUsd(usd)} in the last 10 minutes.${w.kind === 'protected' ? '' : ' This wallet is monitor-only: Warden cannot stop it. Move funds with your own key.'}` })
  const [d] = await sql<{ usd: number | null }>`
    SELECT SUM(outflow_usd) AS usd FROM events WHERE wallet_id = ${w.id} AND NOT failed AND ts > now() - interval '24 hours'`
  const day = Number(d?.usd ?? 0)
  if (policy.dailyCapUsd !== null && day > policy.dailyCapUsd)
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'warning', type: 'daily_cap', dedupeKey: `${w.id}:daily:${new Date().toISOString().slice(0, 10)}`,
      title: `${w.label} passed its daily cap`, body: `${fmtUsd(day)} out in 24 hours, above the ${fmtUsd(policy.dailyCapUsd)} cap.` })
}

/** Webhook path: route each transaction to every wallet that watches an address it touches. */
export async function ingestWebhook(txs: HeliusTx[]) {
  let added = 0
  for (const tx of txs) {
    const touched = new Set<string>([tx.feePayer, ...(tx.accountData ?? []).map((a) => a.account)])
    for (const t of tx.tokenTransfers ?? []) for (const a of [t.fromUserAccount, t.toUserAccount]) if (a) touched.add(a)
    for (const n of tx.nativeTransfers ?? []) for (const a of [n.fromUserAccount, n.toUserAccount]) if (a) touched.add(a)
    const wallets = await sql<Wallet>`SELECT * FROM wallets WHERE address = ANY(${[...touched]}::text[]) AND backfilled_at IS NOT NULL`
    for (const w of wallets) {
      added += await ingest(w, [tx], { alert: true })
      await sql`UPDATE wallets SET last_synced_at = now() WHERE id = ${w.id}`
    }
  }
  return added
}
