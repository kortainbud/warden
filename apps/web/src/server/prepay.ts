// x402 / pay.sh pre-pay hook: check a payment request (payee, price vs history, provenance)
// before the agent signs it from its spend wallet.

import 'server-only'
import { PROGRAMS, formatUnits, isAddress } from '@warden/decoder'
import { buildBaseline, evaluate, type ContextEnvelope, type Reputation } from '@warden/engine'
import { json, sql } from './db'
import { id, sha256Hex } from './env'
import { tokenMeta } from './prices'
import { addressReputation } from './threat'
import { judgeIntent } from './intent-model'
import { raiseAlert } from './alerts'
import { currentPolicy, knownRecipients, outflowHistory, outflowSamples, type Wallet } from './repo'
import { HttpError } from './http'

export interface PaymentRequest {
  payTo: string
  /** Atomic units of `asset`. */
  maxAmountRequired: string
  asset: string
  resource: string
  description?: string
  network?: string
}

export async function runPrepay(w: Wallet, pr: PaymentRequest, context: ContextEnvelope | null, agentName?: string) {
  const t0 = performance.now()
  if (!pr || !isAddress(pr.payTo ?? '')) throw new HttpError(400, 'INVALID_PAYMENT_REQUEST', 'payment_request.payTo must be a Solana address.')
  if (!isAddress(pr.asset ?? '')) throw new HttpError(400, 'INVALID_PAYMENT_REQUEST', 'payment_request.asset must be a token mint address.')
  if (!/^\d+$/.test(pr.maxAmountRequired ?? '')) throw new HttpError(400, 'INVALID_PAYMENT_REQUEST', 'payment_request.maxAmountRequired must be an integer string in atomic units.')
  if (pr.network && !/solana/i.test(pr.network)) throw new HttpError(400, 'UNSUPPORTED_NETWORK', 'Warden checks Solana payments only.')
  let url: URL
  try {
    url = new URL(pr.resource)
  } catch {
    throw new HttpError(400, 'INVALID_PAYMENT_REQUEST', 'payment_request.resource must be the URL being paid for.')
  }
  const endpointKey = `${url.host}${url.pathname}|${pr.payTo}`
  const meta = (await tokenMeta([pr.asset]))[pr.asset]!
  const decimals = meta.decimals ?? 6
  const raw = BigInt(pr.maxAmountRequired)
  const usd = meta.price !== null ? Math.round((Number(raw) / 10 ** decimals) * meta.price * 10_000) / 10_000 : null

  const [prior] = await sql<{ n: string; median: number | null }>`
    SELECT COUNT(*) AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY outflow_usd) AS median
    FROM checks WHERE wallet_id = ${w.id} AND endpoint = ${endpointKey} AND status = 'approved'`
  const [known, rep, policyRow, hist, samples] = await Promise.all([
    knownRecipients(w.id, [pr.payTo]),
    addressReputation(pr.payTo).catch((): Reputation => ({ score: 0, reasons: [], ageDays: null })),
    currentPolicy(w.id),
    outflowHistory(w.id),
    outflowSamples(w.id),
  ])
  const priorPayments = Number(prior?.n ?? 0)
  // The 402 response is itself untrusted content: record it as the trigger when the agent did not.
  const ctx: ContextEnvelope = {
    ...(context ?? {}),
    trigger: context?.trigger ?? { source: 'payment_request', origin: pr.resource, excerpt: `${pr.description ?? ''} payTo ${pr.payTo}`.trim() },
  }
  const amount = formatUnits(raw, decimals)
  const facts = {
    agentName,
    self: [w.address, w.agent_signer].filter((x): x is string => !!x),
    frozen: w.frozen,
    actions: [{ kind: 'token_transfer' as const, program: PROGRAMS.token, source: w.address, destination: pr.payTo, authority: w.address, amount: raw, mint: pr.asset, decimals }],
    programs: [PROGRAMS.token],
    simulation: { ok: true as const },
    outflows: [{ mint: pr.asset, symbol: meta.symbol, amount, usd }],
    recipients: [{ address: pr.payTo, isNew: !known.has(pr.payTo) && priorPayments === 0, reputation: rep }],
    history: { ...hist, baseline: buildBaseline(samples) },
    context: context ? ctx : null,
    now: new Date(),
    endpoint: { key: `${url.host}${url.pathname}`, priorPayments, medianPriceUsd: prior?.median ?? null },
  }
  let ev = evaluate(policyRow.policy, facts)
  let modelUsed = false
  if (ev.needsModel) {
    const j = await judgeIntent(ev.summary, [`Pay ${amount} ${meta.symbol} to ${pr.payTo} for ${pr.resource}`], ctx)
    ev = evaluate(policyRow.policy, { ...facts, model: j })
    modelUsed = j !== 'unavailable'
  }
  const cid = id('chk')
  const status = ev.enforced === 'approve' ? 'approved' : ev.enforced === 'hold' ? 'held' : 'blocked'
  const latency = Math.round(performance.now() - t0)
  await sql`
    INSERT INTO checks (id, wallet_id, origin, endpoint, message_hash, summary, actions, outflows, outflow_usd, recipients, programs, stages, reasons,
      score, verdict, enforced, mode, policy_version, model_used, context_hash, context_excerpt, latency_ms, status)
    VALUES (${cid}, ${w.id}, 'prepay', ${endpointKey}, ${await sha256Hex(JSON.stringify(pr))}, ${ev.summary}, ${json(facts.actions)}, ${facts.outflows}, ${ev.outflowUsd},
      ${json([{ address: pr.payTo, isNew: facts.recipients[0]!.isNew, score: rep.score, reasons: rep.reasons }])}, ${facts.programs}, ${ev.stages}, ${ev.reasons},
      ${ev.score}, ${ev.verdict}, ${ev.enforced}, ${policyRow.policy.mode}, ${policyRow.version}, ${modelUsed},
      ${context ? await sha256Hex(JSON.stringify(context)) : null}, ${{ resource: pr.resource, description: pr.description?.slice(0, 300) ?? null }}, ${latency}, ${status})`
  let expiresAt: string | null = null
  if (status === 'held') {
    expiresAt = new Date(Date.now() + policyRow.policy.holdTimeoutMinutes * 60_000).toISOString()
    await sql`INSERT INTO holds (check_id, wallet_id, expires_at) VALUES (${cid}, ${w.id}, ${expiresAt})`
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'critical', type: 'hold', ref: cid, dedupeKey: `hold:${cid}`,
      title: `Approval needed: ${w.label} wants to pay ${url.host}`, body: `${ev.summary} ${ev.reasons.filter((r) => r.severity !== 'info').map((r) => r.message).join(' ')}` })
  } else if (status === 'blocked') {
    await raiseAlert({ owner: w.owner, walletId: w.id, severity: 'warning', type: 'block', ref: cid, dedupeKey: `block:${cid}`,
      title: `Blocked an x402 payment from ${w.label}`, body: `${ev.summary} ${ev.reasons.find((r) => r.severity === 'block')?.message ?? ''}` })
  }
  return {
    id: cid, verdict: ev.verdict, enforced: ev.enforced, status, score: ev.score, summary: ev.summary, mode: policyRow.policy.mode,
    reasons: ev.reasons.map(({ code, stage, severity, message }) => ({ code, stage, severity, message })),
    payment: { payTo: pr.payTo, amount, symbol: meta.symbol, usd, endpoint: `${url.host}${url.pathname}`, prior_payments: priorPayments },
    latency_ms: latency, expires_at: expiresAt,
  }
}
