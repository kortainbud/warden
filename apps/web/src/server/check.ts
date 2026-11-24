// The check pipeline: decode → simulate → rules → reputation → anomaly → (intent) → verdict.
// Every check is logged with its inputs, stage scores, reasons and timings.

import 'server-only'
import {
  base64Decode, decodeInstructions, describeAction, formatUnits, instructionsOf, parseTransaction, programsOf, recipientsOf, signers,
  type Action,
} from '@warden/decoder'
import { buildBaseline, evaluate, type CheckFacts, type ContextEnvelope, type Evaluation, type Outflow, type Reputation } from '@warden/engine'
import { json, sql } from './db'
import { id, sha256Hex } from './env'
import { simulate } from './simulate'
import { tokenMeta } from './prices'
import { addressReputation } from './threat'
import { judgeIntent } from './intent-model'
import { raiseAlert } from './alerts'
import { currentPolicy, knownRecipients, outflowHistory, outflowSamples, type Wallet } from './repo'

export class CheckError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface CheckRequest {
  transaction: string
  context?: ContextEnvelope | null
  agent_name?: string
  origin?: 'api' | 'playground' | 'prepay'
}

export interface CheckResponse {
  id: string
  wallet_id: string
  verdict: Evaluation['verdict']
  enforced: Evaluation['enforced']
  mode: 'shadow' | 'enforce'
  status: 'approved' | 'held' | 'blocked'
  score: number
  summary: string
  reasons: { code: string; stage: string; severity: string; message: string }[]
  simulated: { ok: boolean; error?: string; vault_delta: { mint: string; symbol: string; amount: string; usd: number | null }[] }
  transaction: string | null
  cosign: 'not_protected' | 'pending_setup'
  latency_ms: number
  stage_ms: Record<string, number>
  expires_at: string | null
  created_at: string
}

const now = () => performance.now()

export async function runCheck(w: Wallet, req: CheckRequest): Promise<CheckResponse> {
  const t0 = now()
  const stageMs: Record<string, number> = {}
  const mark = (k: string, from: number) => (stageMs[k] = Math.round(now() - from))

  // decode
  let t = now()
  let bytes: Uint8Array
  try {
    bytes = base64Decode(req.transaction)
  } catch {
    throw new CheckError(400, 'INVALID_TRANSACTION', 'transaction must be a base64-encoded serialized Solana transaction.')
  }
  let tx
  try {
    tx = parseTransaction(bytes)
  } catch (e) {
    throw new CheckError(400, 'INVALID_TRANSACTION', `Could not parse the transaction: ${(e as Error).message}`)
  }
  const self = [w.address, w.vault, w.smart_account, w.agent_signer].filter((x): x is string => !!x)
  const selfSet = new Set(self)
  if (!signers(tx.message).some((s) => selfSet.has(s)))
    throw new CheckError(422, 'WALLET_NOT_SIGNER', `This transaction is not signed by ${w.label} (${w.address}). Check the wallet you sent it to.`)
  let actions: Action[] = decodeInstructions(instructionsOf(tx.message))
  mark('decode', t)

  // simulate (also resolves lookup tables, after which we decode again with full accounts).
  // Reputation for recipients visible from decode alone runs at the same time.
  t = now()
  const repCache = new Map<string, Promise<Reputation>>()
  const reputationOf = (a: string) => {
    if (!repCache.has(a)) repCache.set(a, addressReputation(a).catch((): Reputation => ({ score: 0, reasons: [], ageDays: null })))
    return repCache.get(a)!
  }
  for (const a of recipientsOf(actions, [], selfSet)) void reputationOf(a)
  const sim = await simulate(req.transaction, tx, actions)
  if (Object.keys(sim.loaded).length) actions = decodeInstructions(instructionsOf(tx.message, sim.loaded))
  const ixs = instructionsOf(tx.message, sim.loaded)
  mark('simulate', t)

  // outflows from the wallet, priced
  t = now()
  const changes = sim.ok ? sim.changes : []
  const outByMint = new Map<string, { raw: bigint; decimals: number }>()
  for (const c of changes) {
    if (!selfSet.has(c.owner) || c.delta >= 0n) continue
    const cur = outByMint.get(c.mint) ?? { raw: 0n, decimals: c.decimals }
    cur.raw += -c.delta
    outByMint.set(c.mint, cur)
  }
  const meta = await tokenMeta([...outByMint.keys()])
  const outflows: Outflow[] = [...outByMint.entries()].map(([mint, v]) => {
    const m = meta[mint]
    const units = Number(v.raw) / 10 ** v.decimals
    return { mint, symbol: m?.symbol ?? mint.slice(0, 4), amount: formatUnits(v.raw, v.decimals), usd: m?.price != null ? Math.round(units * m.price * 100) / 100 : null }
  })

  const recipientAddrs = recipientsOf(actions, changes, selfSet)
  const [known, reps, policyRow, hist, samples] = await Promise.all([
    knownRecipients(w.id, recipientAddrs),
    Promise.all(recipientAddrs.map(reputationOf)),
    currentPolicy(w.id),
    outflowHistory(w.id),
    outflowSamples(w.id),
  ])
  const approvedBefore = recipientAddrs.length
    ? await sql<{ a: string }>`
        SELECT DISTINCT r->>'address' AS a FROM checks c, jsonb_array_elements(c.recipients) r
        WHERE c.wallet_id = ${w.id} AND c.status = 'approved' AND c.enforced = 'approve' AND r->>'address' = ANY(${recipientAddrs}::text[])`
    : []
  for (const r of approvedBefore) known.add(r.a)
  const recipients = recipientAddrs.map((address, i) => ({ address, isNew: !known.has(address), reputation: reps[i]! }))
  mark('rules_reputation_anomaly', t)

  const policy = policyRow.policy
  const facts: CheckFacts = {
    agentName: req.agent_name?.slice(0, 40),
    self,
    frozen: w.frozen,
    actions,
    programs: programsOf(ixs),
    simulation: sim.ok ? { ok: true } : { ok: false, error: sim.error, unavailable: sim.unavailable },
    outflows,
    recipients,
    history: { ...hist, baseline: buildBaseline(samples) },
    context: req.context ?? null,
    now: new Date(),
  }
  let ev = evaluate(policy, facts)
  let modelUsed = false
  if (ev.needsModel) {
    t = now()
    const judgement = await judgeIntent(ev.summary, actions.map(describeAction), facts.context)
    ev = evaluate(policy, { ...facts, model: judgement })
    modelUsed = judgement !== 'unavailable'
    mark('intent', t)
  }

  // persist
  const cid = id('chk')
  const status: CheckResponse['status'] = ev.enforced === 'approve' ? 'approved' : ev.enforced === 'hold' ? 'held' : 'blocked'
  const ctx = req.context ?? null
  const contextHash = ctx ? await sha256Hex(JSON.stringify(ctx)) : null
  const excerpt = ctx
    ? {
        task: ctx.task ? { source: ctx.task.source, text: ctx.task.text.slice(0, 500) } : null,
        trigger: ctx.trigger ? { source: ctx.trigger.source, origin: ctx.trigger.origin?.slice(0, 200) ?? null, excerpt: ctx.trigger.excerpt?.slice(0, 500) ?? null } : null,
        inputs: (ctx.recent_inputs ?? []).slice(0, 5).map((i) => ({ source: i.source, origin: i.origin?.slice(0, 200) ?? null, excerpt: i.excerpt?.slice(0, 500) ?? null })),
      }
    : null
  const latency = Math.round(now() - t0)
  const messageHash = await sha256Hex(tx.messageBytes)
  const [row] = await sql<{ created_at: string }>`
    INSERT INTO checks (id, wallet_id, origin, message_hash, summary, actions, outflows, outflow_usd, recipients, programs, stages, reasons,
      score, verdict, enforced, mode, policy_version, model_used, context_hash, context_excerpt, latency_ms, stage_ms, status)
    VALUES (${cid}, ${w.id}, ${req.origin ?? 'api'}, ${messageHash}, ${ev.summary}, ${json(actions)}, ${outflows}, ${ev.outflowUsd},
      ${json(recipients.map((r) => ({ address: r.address, isNew: r.isNew, score: r.reputation.score, reasons: r.reputation.reasons })))},
      ${facts.programs}, ${ev.stages}, ${ev.reasons}, ${ev.score}, ${ev.verdict}, ${ev.enforced}, ${policy.mode}, ${policyRow.version},
      ${modelUsed}, ${contextHash}, ${excerpt}, ${latency}, ${stageMs}, ${status})
    RETURNING created_at`

  let expiresAt: string | null = null
  if (status === 'held') {
    expiresAt = new Date(Date.now() + policy.holdTimeoutMinutes * 60_000).toISOString()
    await sql`INSERT INTO holds (check_id, wallet_id, expires_at) VALUES (${cid}, ${w.id}, ${expiresAt})`
  }

  // alerts
  if (status === 'held')
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'critical', type: 'hold', ref: cid, dedupeKey: `hold:${cid}`,
      title: `Approval needed: ${w.label}`, body: `${ev.summary} ${ev.reasons.filter((r) => r.severity !== 'info').map((r) => r.message).join(' ')} Approve or deny within ${policy.holdTimeoutMinutes} minutes; no answer means deny.` })
  else if (status === 'blocked')
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'warning', type: 'block', ref: cid, dedupeKey: `block:${cid}`,
      title: `Blocked a transaction from ${w.label}`, body: `${ev.summary} ${ev.reasons.find((r) => r.severity === 'block')?.message ?? ''}` })
  else if (ev.verdict !== 'approve' && policy.mode === 'shadow')
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'info', type: 'shadow', ref: cid, dedupeKey: `shadow:${cid}`,
      title: `Shadow mode: would have ${ev.verdict === 'block' ? 'blocked' : 'held'} a transaction`, body: ev.summary })

  return {
    id: cid,
    wallet_id: w.id,
    verdict: ev.verdict,
    enforced: ev.enforced,
    mode: policy.mode,
    status,
    score: ev.score,
    summary: ev.summary,
    reasons: ev.reasons.map(({ code, stage, severity, message }) => ({ code, stage, severity, message })),
    simulated: { ok: sim.ok, error: sim.ok ? undefined : sim.error, vault_delta: outflows.map((o) => ({ ...o, amount: `-${o.amount}` })) },
    // Co-signing activates once the wallet is a protected smart account (2-of-2 with Warden).
    transaction: null,
    cosign: w.kind === 'protected' ? 'pending_setup' : 'not_protected',
    latency_ms: latency,
    stage_ms: stageMs,
    expires_at: expiresAt,
    created_at: new Date(row!.created_at).toISOString(),
  }
}

/** Expire holds that passed their deadline (no answer = deny). */
export async function expireHolds() {
  const rows = await sql<{ check_id: string }>`
    UPDATE holds SET decision = 'expired', decided_at = now() WHERE decision IS NULL AND expires_at < now() RETURNING check_id`
  if (rows.length) await sql`UPDATE checks SET status = 'expired' WHERE id = ANY(${rows.map((r) => r.check_id)}::text[])`
}

export async function decideHold(w: Wallet, checkId: string, decision: 'approved' | 'denied', by: string) {
  await expireHolds()
  const rows = await sql<{ check_id: string }>`
    UPDATE holds SET decision = ${decision}, decided_by = ${by}, decided_at = now()
    WHERE check_id = ${checkId} AND wallet_id = ${w.id} AND decision IS NULL RETURNING check_id`
  if (!rows.length) throw new CheckError(409, 'HOLD_NOT_PENDING', 'This hold has already been decided or has expired.')
  await sql`UPDATE checks SET status = ${decision} WHERE id = ${checkId}`
  // every owner decision is a labelled example for tuning
  await sql`INSERT INTO overrides (check_id, owner, action, label) VALUES (${checkId}, ${by}, ${decision === 'approved' ? 'approve_hold' : 'deny_hold'}, ${decision}) ON CONFLICT DO NOTHING`
}
