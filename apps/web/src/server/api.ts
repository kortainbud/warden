// The /v1 API (served at /v1/* and /api/v1/*). One router keeps auth, errors and shapes consistent.

import 'server-only'
import { after } from 'next/server'
import { isAddress, short } from '@warden/decoder'
import { loosens, templatePolicy, TEMPLATES, type ContextEnvelope, type Policy, type TemplateId } from '@warden/engine'
import { sql, rawQuery } from './db'
import { id, isDemo, hasModel, hasTelegram } from './env'
import { anyOwner, apiKeyOwner, confirmationChallenge, createApiKey, sessionOwner, verifyConfirmation, type Confirmation } from './auth'
import { body, fail, HttpError, ownedWallet, reply } from './http'
import { CheckError, decideHold, expireHolds, runCheck } from './check'
import { runPrepay, type PaymentRequest } from './prepay'
import { createWallet, currentPolicy, savePolicy, walletsOf, type Wallet } from './repo'
import { syncWallet } from './monitor'
import { addressReputation, confirmReport, REPORT_CATEGORIES } from './threat'
import { deliver, raiseAlert } from './alerts'
import { buildTestTransaction } from './playground'
import { refreshWebhook } from './webhook'

type Ctx = { req: Request; owner: string; params: string[]; viaKey: boolean }
type H = (c: Ctx) => Promise<Response>
interface R { method: string; path: string; auth: 'any' | 'session'; h: H }

const routes: R[] = []
const on = (method: string, path: string, auth: R['auth'], h: H) => routes.push({ method, path, auth, h })

function match(pattern: string, parts: string[]): string[] | null {
  const p = pattern.split('/').filter(Boolean)
  if (p.length !== parts.length) return null
  const params: string[] = []
  for (let i = 0; i < p.length; i++) {
    if (p[i]!.startsWith(':')) params.push(decodeURIComponent(parts[i]!))
    else if (p[i] !== parts[i]) return null
  }
  return params
}

export async function handle(req: Request, parts: string[]): Promise<Response> {
  const method = req.method.toUpperCase()
  const candidates = routes.filter((r) => match(r.path, parts))
  const r = candidates.find((x) => x.method === method)
  if (!r) return candidates.length ? fail(405, 'METHOD_NOT_ALLOWED', `Use ${candidates.map((c) => c.method).join(', ')}.`) : fail(404, 'NOT_FOUND', 'Unknown endpoint.')
  try {
    const keyOwner = r.auth === 'any' ? await apiKeyOwner(req) : null
    const owner = keyOwner ?? (await sessionOwner(req))
    if (!owner) return fail(401, 'UNAUTHORIZED', r.auth === 'session' ? 'Sign in with your wallet first.' : 'Send "Authorization: Bearer wk_live_..." or sign in.')
    return await r.h({ req, owner, params: match(r.path, parts)!, viaKey: !!keyOwner })
  } catch (e) {
    if (e instanceof CheckError || e instanceof HttpError) return fail(e.status, e.code, e.message)
    console.error(e)
    return fail(500, 'INTERNAL', (e as Error).message || 'Something went wrong.')
  }
}

const qs = (req: Request) => new URL(req.url).searchParams
const clampLimit = (v: string | null, d = 50, max = 200) => Math.min(max, Math.max(1, Number(v) || d))

function walletView(w: Wallet) {
  const { owner: _o, ...rest } = w
  void _o
  return rest
}

/** 428 with a message to sign, unless a valid owner signature for this action came with the request. */
async function requireConfirmation(owner: string, action: string, walletId: string, c: Confirmation | undefined) {
  if (await verifyConfirmation(owner, action, walletId, c)) return null
  const challenge = await confirmationChallenge(action, walletId)
  return reply(428, { error: { code: 'CONFIRMATION_REQUIRED', message: 'This change weakens protection. Sign the message with your owner wallet to confirm.', confirm: { action, ...challenge } } })
}

// ---------- status ----------

on('GET', 'status', 'any', async ({ owner }) =>
  reply(200, { owner, demo: isDemo(), intent_model: hasModel(), telegram: hasTelegram(), realtime: !!process.env.WARDEN_PUBLIC_URL && !isDemo() }))

// ---------- checks ----------

on('POST', 'check', 'any', async ({ req, owner }) => {
  const b = await body<{ wallet?: string; transaction?: string; context?: ContextEnvelope; agent_name?: string; origin?: string }>(req)
  if (!b.wallet) throw new HttpError(400, 'MISSING_WALLET', 'wallet (id or address) is required.')
  if (!b.transaction) throw new HttpError(400, 'MISSING_TRANSACTION', 'transaction (base64) is required.')
  const w = await ownedWallet(owner, b.wallet)
  return reply(200, await runCheck(w, { transaction: b.transaction, context: b.context ?? null, agent_name: b.agent_name, origin: 'api' }))
})

on('POST', 'prepay', 'any', async ({ req, owner }) => {
  const b = await body<{ wallet?: string; payment_request?: PaymentRequest; context?: ContextEnvelope; agent_name?: string }>(req)
  if (!b.wallet) throw new HttpError(400, 'MISSING_WALLET', 'wallet (id or address) is required.')
  const w = await ownedWallet(owner, b.wallet)
  return reply(200, await runPrepay(w, b.payment_request!, b.context ?? null, b.agent_name))
})

const CHECK_COLS = `c.id, c.wallet_id, w.label AS wallet_label, c.created_at, c.origin, c.endpoint, c.summary, c.actions, c.outflows, c.outflow_usd,
  c.recipients, c.programs, c.stages, c.reasons, c.score, c.verdict, c.enforced, c.mode, c.model_used, c.context_excerpt, c.latency_ms, c.stage_ms, c.status,
  h.expires_at, h.decision, h.decided_by, h.decided_at`

on('GET', 'checks', 'any', async ({ req, owner }) => {
  await expireHolds()
  const q = qs(req)
  const where = ['w.owner = $1']
  const params: unknown[] = [owner]
  const add = (sqlFrag: string, v: unknown) => { params.push(v); where.push(sqlFrag.replace('?', `$${params.length}`)) }
  if (q.get('wallet')) add('c.wallet_id = ?', q.get('wallet'))
  if (q.get('verdict')) add('c.verdict = ?', q.get('verdict'))
  if (q.get('status')) add('c.status = ?', q.get('status'))
  if (q.get('before')) add('c.created_at < ?', q.get('before'))
  params.push(clampLimit(q.get('limit')))
  const rows = await rawQuery(
    `SELECT ${CHECK_COLS} FROM checks c JOIN wallets w ON w.id = c.wallet_id LEFT JOIN holds h ON h.check_id = c.id
     WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC LIMIT $${params.length}`, params)
  return reply(200, { data: rows })
})

on('GET', 'checks/:id', 'any', async ({ owner, params: [cid] }) => {
  await expireHolds()
  const [row] = await rawQuery(
    `SELECT ${CHECK_COLS} FROM checks c JOIN wallets w ON w.id = c.wallet_id LEFT JOIN holds h ON h.check_id = c.id WHERE c.id = $1 AND w.owner = $2`, [cid, owner])
  if (!row) throw new HttpError(404, 'CHECK_NOT_FOUND', 'No such check.')
  return reply(200, row)
})

on('POST', 'checks/:id/decision', 'session', async ({ req, owner, params: [cid] }) => {
  const b = await body<{ decision?: 'approve' | 'deny'; confirmation?: Confirmation }>(req)
  if (b.decision !== 'approve' && b.decision !== 'deny') throw new HttpError(400, 'INVALID_DECISION', 'decision must be "approve" or "deny".')
  const [c] = await sql<{ wallet_id: string }>`SELECT c.wallet_id FROM checks c JOIN wallets w ON w.id = c.wallet_id WHERE c.id = ${cid} AND w.owner = ${owner}`
  if (!c) throw new HttpError(404, 'CHECK_NOT_FOUND', 'No such check.')
  // Approving money out needs a signed owner action, not just a session (security model).
  if (b.decision === 'approve') {
    const need = await requireConfirmation(owner, `Approve held transaction ${cid}`, c.wallet_id, b.confirmation)
    if (need) return need
  }
  const w = await ownedWallet(owner, c.wallet_id)
  await decideHold(w, cid!, b.decision === 'approve' ? 'approved' : 'denied', owner)
  return reply(200, { id: cid, status: b.decision === 'approve' ? 'approved' : 'denied' })
})

on('POST', 'checks/:id/feedback', 'session', async ({ req, owner, params: [cid] }) => {
  const b = await body<{ label?: 'false_positive' | 'true_positive' }>(req)
  if (b.label !== 'false_positive' && b.label !== 'true_positive') throw new HttpError(400, 'INVALID_LABEL', 'label must be false_positive or true_positive.')
  const [c] = await sql`SELECT c.id FROM checks c JOIN wallets w ON w.id = c.wallet_id WHERE c.id = ${cid} AND w.owner = ${owner}`
  if (!c) throw new HttpError(404, 'CHECK_NOT_FOUND', 'No such check.')
  await sql`INSERT INTO overrides (check_id, owner, action, label) VALUES (${cid}, ${owner}, 'feedback', ${b.label})
    ON CONFLICT (check_id, action) DO UPDATE SET label = EXCLUDED.label, created_at = now()`
  return reply(200, { ok: true })
})

// ---------- wallets ----------

on('GET', 'wallets', 'any', async ({ owner }) => {
  const ws = await walletsOf(owner)
  const stats = await sql<{ wallet_id: string; events: string; out24: number | null; last_ts: string | null }>`
    SELECT wallet_id, COUNT(*) AS events, SUM(outflow_usd) FILTER (WHERE ts > now() - interval '24 hours') AS out24, MAX(ts) AS last_ts
    FROM events WHERE wallet_id = ANY(${ws.map((w) => w.id)}::text[]) GROUP BY wallet_id`
  const pols = await Promise.all(ws.map((w) => currentPolicy(w.id)))
  return reply(200, {
    data: ws.map((w, i) => {
      const s = stats.find((x) => x.wallet_id === w.id)
      return { ...walletView(w), mode: pols[i]!.policy.mode, template: pols[i]!.template, daily_cap_usd: pols[i]!.policy.dailyCapUsd, events: Number(s?.events ?? 0), outflow_usd_24h: Number(s?.out24 ?? 0), last_activity: s?.last_ts ?? null }
    }),
  })
})

on('POST', 'wallets', 'any', async ({ req, owner }) => {
  const b = await body<{ address?: string; label?: string; template?: TemplateId }>(req)
  const address = b.address?.trim() ?? ''
  if (!isAddress(address)) throw new HttpError(400, 'INVALID_ADDRESS', 'Enter a valid Solana address.')
  const template: TemplateId = b.template && b.template in TEMPLATES ? b.template : 'payer'
  const [count] = await sql<{ n: string }>`SELECT COUNT(*) AS n FROM wallets WHERE owner = ${owner}`
  if (Number(count?.n ?? 0) >= 25) throw new HttpError(403, 'WALLET_LIMIT', 'This workspace can monitor up to 25 wallets during early access.')
  let w: Wallet
  try {
    w = await createWallet(owner, address, (b.label?.trim() || `Agent ${short(address)}`).slice(0, 40), template)
  } catch (e) {
    throw new HttpError(409, 'ALREADY_MONITORED', (e as Error).message)
  }
  // Backfill 30 days after responding (busy wallets take a while), then update the webhook's address list.
  // Watch it in real time first (fast), then backfill 30 days (can take a while on busy wallets).
  after(async () => {
    await refreshWebhook().catch((e) => console.error('webhook refresh failed', (e as Error).message))
    await syncWallet(w).catch((e) => console.error('backfill failed', w.id, (e as Error).message))
  })
  return reply(201, walletView(w))
})

on('GET', 'wallets/:id', 'any', async ({ owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const p = await currentPolicy(w.id)
  const [s] = await sql<{ events: string; out24: number | null; out30: number | null; recipients: string }>`
    SELECT COUNT(*) AS events,
      SUM(outflow_usd) FILTER (WHERE ts > now() - interval '24 hours') AS out24,
      SUM(outflow_usd) AS out30,
      (SELECT COUNT(DISTINCT r) FROM events e2, unnest(e2.recipients) r WHERE e2.wallet_id = ${w.id}) AS recipients
    FROM events WHERE wallet_id = ${w.id} AND NOT failed`
  return reply(200, { ...walletView(w), policy: p.policy, policy_version: p.version, template: p.template,
    stats: { events: Number(s?.events ?? 0), outflow_usd_24h: Number(s?.out24 ?? 0), outflow_usd_30d: Number(s?.out30 ?? 0), recipients: Number(s?.recipients ?? 0) } })
})

on('PATCH', 'wallets/:id', 'session', async ({ req, owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const b = await body<{ label?: string }>(req)
  if (b.label?.trim()) await sql`UPDATE wallets SET label = ${b.label.trim().slice(0, 40)} WHERE id = ${w.id}`
  return reply(200, { ok: true })
})

on('DELETE', 'wallets/:id', 'session', async ({ req, owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const b = await req.json().catch(() => ({})) as { confirmation?: Confirmation }
  const need = await requireConfirmation(owner, `Stop monitoring ${w.address}`, w.id, b.confirmation)
  if (need) return need
  await sql`DELETE FROM wallets WHERE id = ${w.id}`
  await refreshWebhook().catch(() => {})
  return reply(200, { ok: true })
})

on('GET', 'wallets/:id/policy', 'any', async ({ owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const versions = await sql`SELECT version, template, policy, created_by, created_at FROM policies WHERE wallet_id = ${w.id} ORDER BY version DESC LIMIT 20`
  return reply(200, { current: await currentPolicy(w.id), versions, templates: TEMPLATES })
})

on('PATCH', 'wallets/:id/policy', 'any', async ({ req, owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const b = await body<{ policy?: Partial<Policy>; template?: TemplateId; confirmation?: Confirmation }>(req)
  const cur = await currentPolicy(w.id)
  let next: Policy = b.template && b.template in TEMPLATES ? { ...templatePolicy(b.template), mode: cur.policy.mode } : { ...cur.policy }
  if (b.policy) next = { ...next, ...sanitizePolicy(b.policy) }
  const weaker = loosens(cur.policy, next)
  if (weaker.length) {
    const need = await requireConfirmation(owner, `Policy change on ${w.label}: ${weaker.join('; ')}`, w.id, b.confirmation)
    if (need) return need
  }
  const version = await savePolicy(w.id, next, owner, b.template ?? cur.template)
  if (next.mode !== cur.policy.mode)
    await raiseAlert({ owner, walletId: w.id, severity: 'info', type: 'mode_change', dedupeKey: `${w.id}:mode:${version}`,
      title: `${w.label} switched to ${next.mode} mode`, body: next.mode === 'enforce' ? 'Warden now blocks and holds transactions on this wallet.' : 'Warden scores transactions but no longer blocks them.' })
  return reply(200, { version, policy: next, loosened: weaker })
})

function sanitizePolicy(p: Partial<Policy>): Partial<Policy> {
  const out: Partial<Policy> = {}
  const num = (v: unknown, min = 0, max = 1e12) => (v === null ? null : typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined)
  const addrs = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(String).map((s) => s.trim()).filter(isAddress))].slice(0, 500) : undefined)
  if (p.mode === 'shadow' || p.mode === 'enforce') out.mode = p.mode
  for (const k of ['perTxCapUsd', 'dailyCapUsd', 'maxTxPerHour'] as const) {
    const v = num(p[k])
    if (v !== undefined) out[k] = v
  }
  for (const k of ['newRecipientHoldUsd', 'holdThreshold', 'blockThreshold', 'holdTimeoutMinutes'] as const) {
    const v = num(p[k], k === 'holdTimeoutMinutes' ? 1 : 0, k.endsWith('Threshold') ? 100 : k === 'holdTimeoutMinutes' ? 1440 : 1e12)
    if (typeof v === 'number') out[k] = v
  }
  for (const k of ['allowRecipients', 'denyRecipients'] as const) {
    const v = addrs(p[k])
    if (v) out[k] = v
  }
  if (p.allowedPrograms === null) out.allowedPrograms = null
  else { const v = addrs(p.allowedPrograms); if (v) out.allowedPrograms = v }
  if (typeof p.allowlistOnly === 'boolean') out.allowlistOnly = p.allowlistOnly
  if (Array.isArray(p.preApproved))
    out.preApproved = p.preApproved.filter((r) => r && isAddress(r.recipient) && (!r.program || isAddress(r.program))).slice(0, 100)
      .map((r) => ({ recipient: r.recipient, ...(r.program ? { program: r.program } : {}), ...(r.label ? { label: String(r.label).slice(0, 40) } : {}) }))
  if (p.activeHoursUtc === null) out.activeHoursUtc = null
  else if (Array.isArray(p.activeHoursUtc) && p.activeHoursUtc.length === 2 && p.activeHoursUtc.every((h) => Number.isInteger(h) && h >= 0 && h <= 24))
    out.activeHoursUtc = [p.activeHoursUtc[0]!, p.activeHoursUtc[1]!]
  return out
}

on('POST', 'wallets/:id/freeze', 'any', async ({ owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  await sql`UPDATE wallets SET frozen = true, frozen_at = now() WHERE id = ${w.id}`
  await raiseAlert({ owner, walletId: w.id, severity: 'warning', type: 'freeze', dedupeKey: `${w.id}:freeze:${Date.now()}`,
    title: `${w.label} frozen`, body: w.kind === 'protected' ? 'Warden stopped co-signing for this wallet.' : 'Every check for this wallet is now blocked. This wallet is monitor-only, so Warden cannot stop transactions signed outside the firewall: move funds with your own key if needed.' })
  return reply(200, { id: w.id, frozen: true })
})

on('POST', 'wallets/:id/unfreeze', 'session', async ({ req, owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const b = await req.json().catch(() => ({})) as { confirmation?: Confirmation }
  const need = await requireConfirmation(owner, `Unfreeze ${w.label}`, w.id, b.confirmation)
  if (need) return need
  await sql`UPDATE wallets SET frozen = false, frozen_at = NULL WHERE id = ${w.id}`
  return reply(200, { id: w.id, frozen: false })
})

on('POST', 'freeze-all', 'any', async ({ owner }) => {
  const rows = await sql<{ id: string }>`UPDATE wallets SET frozen = true, frozen_at = now() WHERE owner = ${owner} AND NOT frozen RETURNING id`
  await raiseAlert({ owner, walletId: null, severity: 'critical', type: 'freeze_all', dedupeKey: `${owner}:freezeall:${Date.now()}`,
    title: 'Global kill switch on', body: `${rows.length} wallet${rows.length === 1 ? '' : 's'} frozen. Every check is blocked until you unfreeze.` })
  return reply(200, { frozen: rows.length })
})

on('POST', 'unfreeze-all', 'session', async ({ req, owner }) => {
  const b = await req.json().catch(() => ({})) as { confirmation?: Confirmation }
  const need = await requireConfirmation(owner, 'Unfreeze every wallet', 'all', b.confirmation)
  if (need) return need
  const rows = await sql`UPDATE wallets SET frozen = false, frozen_at = NULL WHERE owner = ${owner} AND frozen RETURNING id`
  return reply(200, { unfrozen: rows.length })
})

on('GET', 'wallets/:id/events', 'any', async ({ req, owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const q = qs(req)
  const before = q.get('before')
  const limit = clampLimit(q.get('limit'))
  const rows = before
    ? await sql`SELECT * FROM events WHERE wallet_id = ${w.id} AND ts < ${before} ORDER BY ts DESC LIMIT ${limit}`
    : await sql`SELECT * FROM events WHERE wallet_id = ${w.id} ORDER BY ts DESC LIMIT ${limit}`
  return reply(200, { data: rows })
})

on('POST', 'wallets/:id/sync', 'any', async ({ owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const r = await syncWallet(w)
  return reply(200, r)
})

on('GET', 'wallets/:id/spend', 'any', async ({ owner, params: [ref] }) => {
  const w = await ownedWallet(owner, ref!)
  const days = await sql`
    SELECT to_char(date_trunc('day', ts), 'YYYY-MM-DD') AS day, SUM(outflow_usd) AS outflow_usd, SUM(inflow_usd) AS inflow_usd, COUNT(*) AS txs
    FROM events WHERE wallet_id = ${w.id} AND NOT failed AND ts > now() - interval '30 days' GROUP BY 1 ORDER BY 1`
  const recipients = await sql`
    SELECT r AS address, COUNT(*) AS payments, SUM(outflow_usd) AS outflow_usd, MAX(ts) AS last_paid
    FROM events, unnest(recipients) r WHERE wallet_id = ${w.id} AND NOT failed AND ts > now() - interval '30 days'
    GROUP BY r ORDER BY SUM(outflow_usd) DESC NULLS LAST LIMIT 15`
  const programs = await sql`
    SELECT p AS program, COUNT(*) AS txs FROM events, unnest(programs) p WHERE wallet_id = ${w.id} AND ts > now() - interval '30 days'
    GROUP BY p ORDER BY COUNT(*) DESC LIMIT 12`
  return reply(200, { days, recipients, programs })
})

// ---------- overview ----------

on('GET', 'overview', 'session', async ({ owner }) => {
  await expireHolds()
  const [w] = await sql<{ total: string; frozen: string; enforce: string }>`
    SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE frozen) AS frozen, 0 AS enforce FROM wallets WHERE owner = ${owner}`
  const [ch] = await sql<{ n: string; approve: string; hold: string; block: string; p50: number | null; p99: number | null; would_block: string }>`
    SELECT COUNT(*) AS n,
      COUNT(*) FILTER (WHERE verdict = 'approve') AS approve, COUNT(*) FILTER (WHERE verdict = 'hold') AS hold, COUNT(*) FILTER (WHERE verdict = 'block') AS block,
      COUNT(*) FILTER (WHERE verdict <> 'approve' AND mode = 'shadow') AS would_block,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE NOT model_used) AS p50,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE NOT model_used) AS p99
    FROM checks c JOIN wallets w ON w.id = c.wallet_id WHERE w.owner = ${owner} AND c.created_at > now() - interval '7 days'`
  const [ev] = await sql<{ n: string; out: number | null }>`
    SELECT COUNT(*) AS n, SUM(outflow_usd) AS out FROM events e JOIN wallets w ON w.id = e.wallet_id
    WHERE w.owner = ${owner} AND e.ts > now() - interval '24 hours' AND NOT e.failed`
  const pending = await rawQuery(
    `SELECT ${CHECK_COLS} FROM checks c JOIN wallets w ON w.id = c.wallet_id JOIN holds h ON h.check_id = c.id
     WHERE w.owner = $1 AND h.decision IS NULL ORDER BY c.created_at DESC LIMIT 10`, [owner])
  const alerts = await sql`SELECT a.*, w.label AS wallet_label FROM alerts a LEFT JOIN wallets w ON w.id = a.wallet_id WHERE a.owner = ${owner} ORDER BY a.created_at DESC LIMIT 8`
  const days = await sql`
    SELECT to_char(date_trunc('day', e.ts), 'YYYY-MM-DD') AS day, SUM(e.outflow_usd) AS outflow_usd, COUNT(*) AS txs
    FROM events e JOIN wallets w ON w.id = e.wallet_id WHERE w.owner = ${owner} AND NOT e.failed AND e.ts > now() - interval '14 days' GROUP BY 1 ORDER BY 1`
  const modes = await Promise.all((await walletsOf(owner)).map((x) => currentPolicy(x.id)))
  const [fb] = await sql<{ fp: string; labelled: string }>`
    SELECT COUNT(*) FILTER (WHERE o.label = 'false_positive' OR o.action = 'approve_hold') AS fp, COUNT(*) AS labelled
    FROM overrides o JOIN checks c ON c.id = o.check_id JOIN wallets w ON w.id = c.wallet_id WHERE w.owner = ${owner}`
  return reply(200, {
    wallets: { total: Number(w?.total ?? 0), frozen: Number(w?.frozen ?? 0), enforce: modes.filter((m) => m.policy.mode === 'enforce').length },
    checks_7d: { total: Number(ch?.n ?? 0), approve: Number(ch?.approve ?? 0), hold: Number(ch?.hold ?? 0), block: Number(ch?.block ?? 0), would_block_shadow: Number(ch?.would_block ?? 0),
      fast_path_p50_ms: ch?.p50 ?? null, fast_path_p99_ms: ch?.p99 ?? null },
    activity_24h: { transactions: Number(ev?.n ?? 0), outflow_usd: Number(ev?.out ?? 0) },
    overrides: { owner_overrides: Number(fb?.fp ?? 0), labelled: Number(fb?.labelled ?? 0) },
    pending_holds: pending,
    recent_alerts: alerts,
    days,
  })
})

// ---------- alerts ----------

on('GET', 'alerts', 'any', async ({ req, owner }) => {
  const q = qs(req)
  const limit = clampLimit(q.get('limit'), 100)
  const sev = q.get('severity')
  const rows = sev
    ? await sql`SELECT a.*, w.label AS wallet_label FROM alerts a LEFT JOIN wallets w ON w.id = a.wallet_id WHERE a.owner = ${owner} AND a.severity = ${sev} ORDER BY a.created_at DESC LIMIT ${limit}`
    : await sql`SELECT a.*, w.label AS wallet_label FROM alerts a LEFT JOIN wallets w ON w.id = a.wallet_id WHERE a.owner = ${owner} ORDER BY a.created_at DESC LIMIT ${limit}`
  const [u] = await sql<{ n: string }>`SELECT COUNT(*) AS n FROM alerts WHERE owner = ${owner} AND read_at IS NULL`
  return reply(200, { data: rows, unread: Number(u?.n ?? 0) })
})

on('POST', 'alerts/read', 'session', async ({ owner }) => {
  await sql`UPDATE alerts SET read_at = now() WHERE owner = ${owner} AND read_at IS NULL`
  return reply(200, { ok: true })
})

on('GET', 'alerts/channels', 'any', async ({ owner }) => {
  const rows = await sql<{ config: Record<string, string> }>`SELECT id, kind, label, config, min_severity, enabled, created_at, last_error FROM alert_channels WHERE owner = ${owner} ORDER BY created_at`
  return reply(200, { data: rows.map((r) => ({ ...r, config: { ...r.config, secret: r.config.secret ? `${r.config.secret.slice(0, 6)}…` : undefined } })), telegram_available: hasTelegram() })
})

on('POST', 'alerts/channels', 'session', async ({ req, owner }) => {
  const b = await body<{ kind?: string; label?: string; url?: string; chatId?: string; min_severity?: string }>(req)
  const min = ['info', 'warning', 'critical'].includes(b.min_severity ?? '') ? b.min_severity! : 'warning'
  let config: Record<string, string>
  if (b.kind === 'webhook' || b.kind === 'slack') {
    let u: URL
    try { u = new URL(b.url ?? '') } catch { throw new HttpError(400, 'INVALID_URL', 'Enter a full https:// URL.') }
    if (u.protocol !== 'https:') throw new HttpError(400, 'INVALID_URL', 'Webhook URLs must use https.')
    if (b.kind === 'slack' && u.hostname !== 'hooks.slack.com') throw new HttpError(400, 'INVALID_URL', 'Use a Slack incoming-webhook URL (hooks.slack.com).')
    config = { url: u.toString() }
    if (b.kind === 'webhook') config.secret = `whsec_${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex')}`
  } else if (b.kind === 'telegram') {
    if (!hasTelegram()) throw new HttpError(400, 'TELEGRAM_UNAVAILABLE', 'Telegram alerts are not configured on this server yet.')
    if (!/^-?\d{4,20}$/.test(b.chatId ?? '')) throw new HttpError(400, 'INVALID_CHAT', 'Enter your numeric Telegram chat ID.')
    config = { chatId: b.chatId! }
  } else throw new HttpError(400, 'INVALID_KIND', 'kind must be webhook, slack or telegram.')
  const cid = id('chn')
  await sql`INSERT INTO alert_channels (id, owner, kind, label, config, min_severity) VALUES (${cid}, ${owner}, ${b.kind}, ${(b.label?.trim() || b.kind).slice(0, 40)}, ${config}, ${min})`
  // the signing secret is shown once, at creation
  return reply(201, { id: cid, kind: b.kind, secret: config.secret ?? null })
})

on('DELETE', 'alerts/channels/:id', 'session', async ({ owner, params: [cid] }) => {
  await sql`DELETE FROM alert_channels WHERE id = ${cid} AND owner = ${owner}`
  return reply(200, { ok: true })
})

on('POST', 'alerts/channels/:id/test', 'session', async ({ owner, params: [cid] }) => {
  const [c] = await sql<Parameters<typeof deliver>[0]>`SELECT * FROM alert_channels WHERE id = ${cid} AND owner = ${owner}`
  if (!c) throw new HttpError(404, 'CHANNEL_NOT_FOUND', 'No such channel.')
  try {
    await deliver(c, { id: 'alr_test', owner, walletId: null, severity: 'info', type: 'test', title: 'Warden test alert', body: 'If you can read this, alerts reach this channel.' })
    await sql`UPDATE alert_channels SET last_error = NULL WHERE id = ${cid}`
    return reply(200, { ok: true })
  } catch (e) {
    await sql`UPDATE alert_channels SET last_error = ${(e as Error).message} WHERE id = ${cid}`
    return fail(502, 'DELIVERY_FAILED', (e as Error).message)
  }
})

// ---------- threat network ----------

on('GET', 'reputation/:entity', 'any', async ({ params: [entity] }) => {
  if (!isAddress(entity!)) throw new HttpError(400, 'INVALID_ENTITY', 'Pass a Solana address.')
  const r = await addressReputation(entity!)
  return reply(200, { entity, kind: 'address', score: r.score, reasons: r.reasons, denylisted: !!r.denylisted, age_days: r.ageDays ?? null })
})

on('GET', 'threats', 'session', async ({ owner }) => {
  const entities = await sql`SELECT kind, key, score, reasons, signals, updated_at FROM entities WHERE score >= 25 ORDER BY score DESC, updated_at DESC LIMIT 100`
  const blocked = await sql`
    SELECT r->>'address' AS address, COUNT(*) AS blocks, COUNT(DISTINCT w.owner) AS customers, MAX(c.created_at) AS last_seen
    FROM checks c JOIN wallets w ON w.id = c.wallet_id, jsonb_array_elements(c.recipients) r
    WHERE c.verdict = 'block' AND c.created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 50`
  const reports = await sql`SELECT id, kind, key, category, note, status, created_at FROM reports WHERE reporter = ${owner} ORDER BY created_at DESC LIMIT 50`
  const [n] = await sql<{ checks: string; customers: string }>`SELECT COUNT(*) AS checks, COUNT(DISTINCT w.owner) AS customers FROM checks c JOIN wallets w ON w.id = c.wallet_id`
  return reply(200, { entities, blocked, reports, network: { checks: Number(n?.checks ?? 0), customers: Number(n?.customers ?? 0) }, categories: REPORT_CATEGORIES })
})

on('POST', 'reports', 'any', async ({ req, owner }) => {
  const b = await body<{ address?: string; category?: string; note?: string }>(req)
  if (!isAddress(b.address ?? '')) throw new HttpError(400, 'INVALID_ADDRESS', 'Enter a valid Solana address.')
  const category = (REPORT_CATEGORIES as readonly string[]).includes(b.category ?? '') ? b.category! : 'other'
  const rid = id('rpt')
  await sql`INSERT INTO reports (id, reporter, kind, key, category, note) VALUES (${rid}, ${owner}, 'address', ${b.address}, ${category}, ${b.note?.slice(0, 500) ?? null})`
  return reply(201, { id: rid, status: 'pending' })
})

// Reviewer confirmation. Restricted to WARDEN_REVIEWERS (comma-separated owner addresses).
on('POST', 'reports/:id/review', 'session', async ({ req, owner, params: [rid] }) => {
  const reviewers = (process.env.WARDEN_REVIEWERS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!reviewers.includes(owner) && !isDemo()) throw new HttpError(403, 'NOT_REVIEWER', 'Only Threat Network reviewers can confirm reports.')
  const b = await body<{ decision?: 'confirm' | 'reject' }>(req)
  const [r] = await sql<{ kind: string; key: string; category: string }>`
    UPDATE reports SET status = ${b.decision === 'confirm' ? 'confirmed' : 'rejected'} WHERE id = ${rid} RETURNING kind, key, category`
  if (!r) throw new HttpError(404, 'REPORT_NOT_FOUND', 'No such report.')
  if (b.decision === 'confirm') await confirmReport(r.kind, r.key, r.category)
  return reply(200, { ok: true })
})

// ---------- API keys ----------

on('GET', 'keys', 'session', async ({ owner }) =>
  reply(200, { data: await sql`SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE owner = ${owner} ORDER BY created_at DESC` }))

on('POST', 'keys', 'session', async ({ req, owner }) => {
  const b = await body<{ name?: string }>(req)
  const k = await createApiKey(owner, (b.name?.trim() || 'Agent key').slice(0, 40))
  return reply(201, k)
})

on('DELETE', 'keys/:id', 'session', async ({ owner, params: [kid] }) => {
  await sql`UPDATE api_keys SET revoked_at = now() WHERE id = ${kid} AND owner = ${owner}`
  return reply(200, { ok: true })
})

// ---------- playground ----------

on('POST', 'playground', 'session', async ({ req, owner }) => {
  const b = await body<{ wallet?: string; to?: string; asset?: 'SOL' | 'USDC'; amount?: number; context?: ContextEnvelope; agent_name?: string }>(req)
  const w = await ownedWallet(owner, b.wallet ?? '')
  const tx = await buildTestTransaction(w.address, b.to ?? '', b.asset === 'USDC' ? 'USDC' : 'SOL', Number(b.amount))
  return reply(200, await runCheck(w, { transaction: tx, context: b.context ?? null, agent_name: b.agent_name, origin: 'playground' }))
})

export { anyOwner }
