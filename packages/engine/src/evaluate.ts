// The verdict engine. Pure and synchronous: callers gather facts (decode, simulation, reputation,
// history) and, when asked, a model judgement; this turns them into approve / hold / block.

import { INERT_PROGRAMS, KNOWN_PROGRAMS, PROGRAMS, programName, short, type Action } from '@warden/decoder'
import { SOURCE_LABEL, addressesIn, isUntrusted, normalize, type ContentFlag, type ContextEnvelope } from './content.ts'
import type { Policy } from './policy.ts'

export type Verdict = 'approve' | 'hold' | 'block'
export type Stage = 'control' | 'simulation' | 'rules' | 'reputation' | 'anomaly' | 'intent'

export type ReasonCode =
  | 'WALLET_FROZEN'
  | 'SIMULATION_FAILED'
  | 'SIMULATION_UNAVAILABLE'
  | 'RECIPIENT_DENYLISTED'
  | 'NOT_ON_ALLOWLIST'
  | 'CAP_EXCEEDED'
  | 'DAILY_CAP_EXCEEDED'
  | 'RATE_LIMITED'
  | 'PROGRAM_NOT_ALLOWED'
  | 'UNKNOWN_PROGRAM_OUTFLOW'
  | 'UNKNOWN_PROGRAM'
  | 'SETTINGS_CHANGE_BY_AGENT'
  | 'TOKEN_APPROVAL'
  | 'AUTHORITY_CHANGE'
  | 'UNPRICED_OUTFLOW'
  | 'NEW_RECIPIENT'
  | 'OUTSIDE_ACTIVE_HOURS'
  | 'RECIPIENT_HIGH_RISK'
  | 'RECIPIENT_RISK'
  | 'PROGRAM_RISK'
  | 'AMOUNT_ANOMALY'
  | 'VELOCITY_ANOMALY'
  | 'PRICE_ANOMALY'
  | 'NEW_ENDPOINT'
  | 'ADDRESS_FROM_UNTRUSTED_CONTENT'
  | 'UNTRUSTED_ORIGIN_NEW_RECIPIENT'
  | 'MISSING_CONTEXT'
  | 'ENCODED_CONTENT'
  | 'INTENT_INCONSISTENT'
  | 'INTENT_UNCLEAR'
  | 'INTENT_MODEL_UNAVAILABLE'
  | 'PRE_APPROVED_ROUTE'

export interface Reason {
  code: ReasonCode
  stage: Stage
  /** block = hard flag; hold = forces a human; info = explains score only. */
  severity: 'block' | 'hold' | 'info'
  message: string
}

export interface Reputation {
  /** 0 (clean) – 100 (known bad). */
  score: number
  reasons: string[]
  denylisted?: boolean
  /** Account age in days, when known. */
  ageDays?: number | null
  /** The address has never transacted. */
  noHistory?: boolean
}

export interface Outflow {
  mint: string
  symbol: string
  /** Decimal string, positive. */
  amount: string
  usd: number | null
}

export interface Baseline {
  samples: number
  medianOutflowUsd: number
  p95OutflowUsd: number
  /** Typical hourly tx count (p95). */
  p95TxPerHour: number
  /** UTC hours with activity. */
  activeHours: number[]
}

export interface ModelJudgement {
  verdict: 'consistent' | 'inconsistent' | 'unclear'
  reason: string
}

export interface CheckFacts {
  agentName?: string
  /** Addresses that are the wallet itself (vault, settings account, agent signer, spend wallet). */
  self: string[]
  frozen: boolean
  actions: Action[]
  programs: string[]
  simulation: { ok: true } | { ok: false; error: string; unavailable?: boolean }
  outflows: Outflow[]
  recipients: { address: string; isNew: boolean; reputation: Reputation }[]
  programReputation?: Record<string, Reputation>
  history: { outflowUsd24h: number; txCount1h: number; baseline: Baseline | null }
  context: ContextEnvelope | null
  now: Date
  /** x402 / pay.sh: the endpoint being paid and what it charged before. */
  endpoint?: { key: string; priorPayments: number; medianPriceUsd: number | null }
  /** Result of the intent model, if it was run. 'unavailable' = timed out, errored or not configured. */
  model?: ModelJudgement | 'unavailable'
}

export interface StageResult {
  stage: Stage
  score: number
  reasons: Reason[]
}

export interface Evaluation {
  verdict: Verdict
  /** What the transaction gets in practice: shadow mode never blocks or holds (except a frozen wallet). */
  enforced: Verdict
  score: number
  reasons: Reason[]
  stages: StageResult[]
  /** True when the intent model should be consulted before this verdict is final. */
  needsModel: boolean
  outflowUsd: number | null
  summary: string
}

const WEIGHTS: Record<Stage, number> = { control: 1, simulation: 1, rules: 0.8, reputation: 1, anomaly: 0.6, intent: 0.9 }

const fmtUsd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 })}`

function stage(name: Stage): StageResult & { add: (r: Omit<Reason, 'stage'>, score?: number) => void } {
  const s: StageResult = { stage: name, score: 0, reasons: [] }
  return Object.assign(s, {
    add(r: Omit<Reason, 'stage'>, score = 0) {
      s.reasons.push({ ...r, stage: name })
      s.score = Math.max(s.score, score)
    },
  })
}

function totalOutflowUsd(f: CheckFacts): { usd: number; unpriced: boolean } {
  let usd = 0, unpriced = false
  for (const o of f.outflows) {
    if (o.usd === null) unpriced = true
    else usd += o.usd
  }
  return { usd, unpriced }
}

function preApprovedFor(policy: Policy, f: CheckFacts): boolean {
  if (!f.recipients.length) return false
  return f.recipients.every((r) =>
    policy.preApproved.some((p) => p.recipient === r.address && (!p.program || f.programs.includes(p.program))),
  )
}

export function evaluate(policy: Policy, f: CheckFacts): Evaluation {
  const self = new Set(f.self)
  const { usd: outUsd, unpriced } = totalOutflowUsd(f)
  const hasOutflow = f.outflows.length > 0
  const preApproved = preApprovedFor(policy, f)
  const allow = new Set(policy.allowRecipients)
  const deny = new Set(policy.denyRecipients)

  // control
  const control = stage('control')
  if (f.frozen) control.add({ code: 'WALLET_FROZEN', severity: 'block', message: 'This wallet is frozen by the kill switch.' }, 100)

  // simulation
  const sim = stage('simulation')
  if (!f.simulation.ok) {
    sim.add(
      f.simulation.unavailable
        ? { code: 'SIMULATION_UNAVAILABLE', severity: 'block', message: 'The transaction could not be simulated, so Warden fails closed.' }
        : { code: 'SIMULATION_FAILED', severity: 'block', message: `Simulation failed: ${f.simulation.error}` },
      100,
    )
  }

  // rules
  const rules = stage('rules')
  for (const r of f.recipients) {
    if (deny.has(r.address)) rules.add({ code: 'RECIPIENT_DENYLISTED', severity: 'block', message: `${short(r.address)} is on this wallet's denylist.` }, 100)
    else if (policy.allowlistOnly && !allow.has(r.address) && !policy.preApproved.some((p) => p.recipient === r.address))
      rules.add({ code: 'NOT_ON_ALLOWLIST', severity: 'block', message: `${short(r.address)} is not on the allowlist, and this wallet only pays allowlisted recipients.` }, 100)
  }
  if (policy.perTxCapUsd !== null && outUsd > policy.perTxCapUsd)
    rules.add({ code: 'CAP_EXCEEDED', severity: 'block', message: `Sends ${fmtUsd(outUsd)}, above the ${fmtUsd(policy.perTxCapUsd)} per-transaction cap.` }, 100)
  if (policy.dailyCapUsd !== null && f.history.outflowUsd24h + outUsd > policy.dailyCapUsd)
    rules.add({
      code: 'DAILY_CAP_EXCEEDED', severity: 'block',
      message: `Would bring 24-hour outflow to ${fmtUsd(f.history.outflowUsd24h + outUsd)}, above the ${fmtUsd(policy.dailyCapUsd)} daily cap.`,
    }, 100)
  if (policy.maxTxPerHour !== null && f.history.txCount1h >= policy.maxTxPerHour)
    rules.add({ code: 'RATE_LIMITED', severity: 'block', message: `${f.history.txCount1h} transactions in the last hour (limit ${policy.maxTxPerHour}).` }, 100)
  if (unpriced && (policy.perTxCapUsd !== null || policy.dailyCapUsd !== null))
    rules.add({ code: 'UNPRICED_OUTFLOW', severity: 'hold', message: 'Sends a token Warden cannot price, so caps cannot be checked.' }, 60)

  const meaningful = f.programs.filter((p) => !INERT_PROGRAMS.has(p))
  for (const p of meaningful) {
    if (policy.allowedPrograms && !policy.allowedPrograms.includes(p) && p !== PROGRAMS.system && p !== PROGRAMS.computeBudget)
      rules.add({ code: 'PROGRAM_NOT_ALLOWED', severity: 'block', message: `${programName(p) ?? short(p)} is not an allowed program for this wallet.` }, 100)
    else if (!KNOWN_PROGRAMS.has(p)) {
      if (hasOutflow) rules.add({ code: 'UNKNOWN_PROGRAM_OUTFLOW', severity: 'block', message: `Unknown program ${short(p)} moves funds out of the wallet.` }, 100)
      else rules.add({ code: 'UNKNOWN_PROGRAM', severity: 'info', message: `Calls unknown program ${short(p)}.` }, 40)
    }
  }
  for (const a of f.actions) {
    if (a.kind === 'smart_account' && a.op === 'settings_change')
      rules.add({ code: 'SETTINGS_CHANGE_BY_AGENT', severity: 'block', message: 'The agent tried to change smart account settings. Only the owner can do that.' }, 100)
    if (a.kind === 'token_approve' && !self.has(a.delegate))
      rules.add({ code: 'TOKEN_APPROVAL', severity: 'hold', message: `Gives ${short(a.delegate)} permission to spend tokens from this wallet.` }, 75)
    if (a.kind === 'token_set_authority' && (!a.newAuthority || !self.has(a.newAuthority)))
      rules.add({ code: 'AUTHORITY_CHANGE', severity: 'hold', message: `Hands control of ${short(a.account)} to ${a.newAuthority ? short(a.newAuthority) : 'nobody'}.` }, 80)
  }
  const newRecipients = f.recipients.filter((r) => r.isNew && !allow.has(r.address))
  if (!preApproved && newRecipients.length && hasOutflow) {
    const over = unpriced || outUsd > policy.newRecipientHoldUsd
    rules.add({
      code: 'NEW_RECIPIENT', severity: over ? 'hold' : 'info',
      message: `First payment to ${newRecipients.map((r) => short(r.address)).join(', ')}${over ? ` above the ${fmtUsd(policy.newRecipientHoldUsd)} new-recipient limit` : ''}.`,
    }, over ? 55 : 25)
  }
  if (policy.activeHoursUtc && hasOutflow) {
    const [s, e] = policy.activeHoursUtc, h = f.now.getUTCHours()
    const inside = s <= e ? h >= s && h < e : h >= s || h < e
    if (!inside) rules.add({ code: 'OUTSIDE_ACTIVE_HOURS', severity: 'info', message: `Outside the wallet's active hours (${s}:00–${e}:00 UTC).` }, 35)
  }

  // reputation
  const rep = stage('reputation')
  for (const r of f.recipients) {
    const { score, reasons, denylisted } = r.reputation
    if (denylisted || score >= 90)
      rep.add({ code: 'RECIPIENT_HIGH_RISK', severity: 'block', message: `${short(r.address)} is flagged by the Threat Network: ${reasons[0] ?? 'known bad'}.` }, 100)
    else if (score >= 30)
      rep.add({ code: 'RECIPIENT_RISK', severity: 'info', message: `${short(r.address)}: ${reasons.slice(0, 2).join('; ') || 'elevated risk'}.` }, score)
  }
  for (const [p, r] of Object.entries(f.programReputation ?? {})) {
    if (r.score >= 90) rep.add({ code: 'PROGRAM_RISK', severity: 'block', message: `Program ${short(p)} is flagged: ${r.reasons[0] ?? 'known bad'}.` }, 100)
    else if (r.score >= 30) rep.add({ code: 'PROGRAM_RISK', severity: 'info', message: `Program ${short(p)}: ${r.reasons[0] ?? 'elevated risk'}.` }, r.score)
  }

  // anomaly (skipped for pre-approved routes)
  const anomaly = stage('anomaly')
  const b = f.history.baseline
  if (!preApproved && b && b.samples >= 10 && hasOutflow && !unpriced) {
    if (outUsd > Math.max(b.p95OutflowUsd * 3, 50))
      anomaly.add({ code: 'AMOUNT_ANOMALY', severity: 'info', message: `${fmtUsd(outUsd)} is far above this wallet's usual ${fmtUsd(b.medianOutflowUsd)} (95th percentile ${fmtUsd(b.p95OutflowUsd)}).` }, 65)
    else if (outUsd > Math.max(b.p95OutflowUsd, 20))
      anomaly.add({ code: 'AMOUNT_ANOMALY', severity: 'info', message: `${fmtUsd(outUsd)} is larger than 95% of this wallet's payments.` }, 30)
  }
  if (!preApproved && b && b.samples >= 10 && f.history.txCount1h > Math.max(b.p95TxPerHour * 3, 10))
    anomaly.add({ code: 'VELOCITY_ANOMALY', severity: 'info', message: `${f.history.txCount1h} transactions this hour, well above the usual ${b.p95TxPerHour}.` }, 55)

  if (f.endpoint && hasOutflow && !unpriced) {
    const { priorPayments, medianPriceUsd, key } = f.endpoint
    if (priorPayments === 0)
      anomaly.add({ code: 'NEW_ENDPOINT', severity: 'info', message: `First payment to ${key}.` }, 30)
    else if (medianPriceUsd !== null && outUsd > Math.max(medianPriceUsd * 3, medianPriceUsd + 1))
      anomaly.add({ code: 'PRICE_ANOMALY', severity: 'hold', message: `Asks ${fmtUsd(outUsd)}; this endpoint usually charges ${fmtUsd(medianPriceUsd)}.` }, 70)
  }

  // intent (provenance first, model second)
  const intent = stage('intent')
  const ctx = f.context
  let needsModel = false
  if (preApproved) {
    intent.add({ code: 'PRE_APPROVED_ROUTE', severity: 'info', message: 'Pre-approved route: intent check skipped.' }, 0)
  } else if (hasOutflow) {
    const untrustedItems = [ctx?.trigger, ...(ctx?.recent_inputs ?? [])].filter((i) => i && isUntrusted(i.source))
    const trustedText = [ctx?.task && !isUntrusted(ctx.task.source) ? ctx.task.text : ''].join(' ')
    const trustedAddrs = new Set(addressesIn(normalize(trustedText)))
    const untrustedAddrs = new Set<string>()
    const flags = new Set<ContentFlag>()
    for (const i of untrustedItems) {
      const n = normalize(i!.excerpt ?? '')
      n.flags.forEach((x) => flags.add(x))
      addressesIn(n).forEach((a) => untrustedAddrs.add(a))
    }
    if (ctx?.task && isUntrusted(ctx.task.source)) {
      const n = normalize(ctx.task.text)
      n.flags.forEach((x) => flags.add(x))
      addressesIn(n).forEach((a) => untrustedAddrs.add(a))
    }

    if (!ctx) intent.add({ code: 'MISSING_CONTEXT', severity: 'info', message: 'No context was sent with this transaction, so it is treated as untrusted.' }, 45)
    if (flags.size) intent.add({ code: 'ENCODED_CONTENT', severity: 'info', message: `Untrusted input contains hidden or encoded text (${[...flags].join(', ').replaceAll('_', ' ')}).` }, 50)

    for (const r of f.recipients) {
      if (untrustedAddrs.has(r.address) && !trustedAddrs.has(r.address) && !allow.has(r.address))
        intent.add({ code: 'ADDRESS_FROM_UNTRUSTED_CONTENT', severity: 'block', message: `The recipient ${short(r.address)} appears in untrusted content but not in the owner's request.` }, 100)
    }
    const trigger = ctx?.trigger
    if (newRecipients.length && (!ctx || (trigger && isUntrusted(trigger.source)) || (ctx.task && isUntrusted(ctx.task.source)))) {
      const src = trigger?.source ?? ctx?.task?.source
      intent.add({
        code: 'UNTRUSTED_ORIGIN_NEW_RECIPIENT', severity: 'hold',
        message: src ? `Payment to a new recipient was triggered by ${SOURCE_LABEL[src]}${trigger?.origin ? ` (${trigger.origin})` : ''}.` : 'Payment to a new recipient with no record of who asked for it.',
      }, 70)
    }
  }

  const preliminary = [control, sim, rules, rep, anomaly, intent]
  const prelimScore = combine(preliminary)
  if (!preApproved && hasOutflow && (prelimScore >= policy.holdThreshold || newRecipients.length > 0)) needsModel = true

  if (needsModel && f.model) {
    if (f.model === 'unavailable')
      intent.add({ code: 'INTENT_MODEL_UNAVAILABLE', severity: 'hold', message: 'The intent check could not run, so Warden holds instead of guessing.' }, 60)
    else if (f.model.verdict === 'inconsistent')
      intent.add({ code: 'INTENT_INCONSISTENT', severity: 'hold', message: `Intent check: ${f.model.reason}` }, 85)
    else if (f.model.verdict === 'unclear')
      intent.add({ code: 'INTENT_UNCLEAR', severity: 'info', message: `Intent check: ${f.model.reason}` }, 50)
    // 'consistent' never lowers risk: the model can only add.
  }

  const stages = preliminary.map(({ stage, score, reasons }) => ({ stage, score, reasons }))
  const reasons = stages.flatMap((s) => s.reasons)
  const score = combine(stages)
  let verdict: Verdict = 'approve'
  if (reasons.some((r) => r.severity === 'block') || score >= policy.blockThreshold) verdict = 'block'
  else if (reasons.some((r) => r.severity === 'hold') || score >= policy.holdThreshold) verdict = 'hold'

  const enforced: Verdict = f.frozen ? 'block' : policy.mode === 'shadow' ? 'approve' : verdict

  return {
    verdict, enforced, score, reasons, stages,
    needsModel: needsModel && !f.model,
    outflowUsd: unpriced ? null : outUsd,
    summary: summarize(f, outUsd, unpriced),
  }
}

/** Noisy-OR of weighted stage scores: any one strong signal dominates, weak signals add up. */
function combine(stages: StageResult[]): number {
  const p = stages.reduce((acc, s) => acc * (1 - (WEIGHTS[s.stage] * Math.min(100, s.score)) / 100), 1)
  return Math.round((1 - p) * 100)
}

function summarize(f: CheckFacts, outUsd: number, unpriced: boolean): string {
  const who = f.agentName ? `Agent ${f.agentName}` : 'The agent'
  const what = f.outflows.length
    ? f.outflows.map((o) => `${o.amount} ${o.symbol}`).join(' + ') + (unpriced || f.outflows.length === 1 ? '' : ` (${fmtUsd(outUsd)})`)
    : null
  const r = f.recipients[0]
  const age = r?.reputation.ageDays
  const to = r
    ? r.reputation.noHistory
      ? 'a wallet with no onchain history'
      : age === null || age === undefined
      ? `${short(r.address)}`
      : age < 1
        ? (() => { const h = Math.max(1, Math.round(age * 24)); return `a wallet created ${h} hour${h === 1 ? '' : 's'} ago` })()
        : age < 30 ? `a wallet created ${Math.round(age)} days ago` : short(r.address)
    : null
  const swap = f.actions.find((a) => a.kind === 'swap')
  let line = what ? `${who} wants to send ${what}${to ? ` to ${to}` : ''}.` : swap && swap.kind === 'swap' ? `${who} wants to swap on ${swap.venue}.` : `${who} wants to run a transaction with no outflow.`
  const trig = f.context?.trigger
  if (trig && isUntrusted(trig.source)) line += ` Instruction came from ${SOURCE_LABEL[trig.source]}.`
  else if (!f.context) line += ' No context was provided.'
  return line
}
