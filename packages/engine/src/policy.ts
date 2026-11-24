export type Mode = 'shadow' | 'enforce'

export interface PreApprovedRoute {
  recipient: string
  /** Optional: only when the transaction uses this program. */
  program?: string
  label?: string
}

export interface Policy {
  mode: Mode
  /** USD caps. null = no cap. */
  perTxCapUsd: number | null
  dailyCapUsd: number | null
  maxTxPerHour: number | null
  /** Recipients the owner trusts. With allowlistOnly, anything else is blocked. */
  allowRecipients: string[]
  allowlistOnly: boolean
  denyRecipients: string[]
  /** Programs the agent may call. null = any program Warden can decode. */
  allowedPrograms: string[] | null
  /** Value sent to a recipient the wallet has never paid, above which the transfer is held. */
  newRecipientHoldUsd: number
  /** Combined risk score (0–100) at or above which a transaction is held for a human. */
  holdThreshold: number
  /** Combined risk score at or above which a transaction is blocked outright. */
  blockThreshold: number
  preApproved: PreApprovedRoute[]
  /** UTC hours [start, end) the agent normally works. null = any time. */
  activeHoursUtc: [number, number] | null
  holdTimeoutMinutes: number
}

export type TemplateId = 'trader' | 'payer' | 'treasury'

export const TEMPLATES: Record<TemplateId, { name: string; description: string; policy: Policy }> = {
  trader: {
    name: 'Trader',
    description: 'Swaps on known venues all day. Large caps, strict on transfers out to new wallets.',
    policy: {
      mode: 'shadow',
      perTxCapUsd: 25_000,
      dailyCapUsd: 250_000,
      maxTxPerHour: 600,
      allowRecipients: [],
      allowlistOnly: false,
      denyRecipients: [],
      allowedPrograms: null,
      newRecipientHoldUsd: 100,
      holdThreshold: 60,
      blockThreshold: 90,
      preApproved: [],
      activeHoursUtc: null,
      holdTimeoutMinutes: 15,
    },
  },
  payer: {
    name: 'Payer',
    description: 'Pays for APIs, data and compute. Small payments, many payees, tight daily cap.',
    policy: {
      mode: 'shadow',
      perTxCapUsd: 50,
      dailyCapUsd: 500,
      maxTxPerHour: 120,
      allowRecipients: [],
      allowlistOnly: false,
      denyRecipients: [],
      allowedPrograms: null,
      newRecipientHoldUsd: 20,
      holdThreshold: 55,
      blockThreshold: 90,
      preApproved: [],
      activeHoursUtc: null,
      holdTimeoutMinutes: 10,
    },
  },
  treasury: {
    name: 'Treasury',
    description: 'Moves funds rarely. Allowlisted recipients only, every new route needs a human.',
    policy: {
      mode: 'shadow',
      perTxCapUsd: 10_000,
      dailyCapUsd: 25_000,
      maxTxPerHour: 10,
      allowRecipients: [],
      allowlistOnly: true,
      denyRecipients: [],
      allowedPrograms: null,
      newRecipientHoldUsd: 0,
      holdThreshold: 40,
      blockThreshold: 85,
      preApproved: [],
      activeHoursUtc: null,
      holdTimeoutMinutes: 60,
    },
  },
}

export function templatePolicy(id: TemplateId): Policy {
  return structuredClone(TEMPLATES[id].policy)
}

/** Changes that weaken protection. The PRD requires owner confirmation (wallet signature) for these. */
export function loosens(prev: Policy, next: Policy): string[] {
  const out: string[] = []
  const capUp = (a: number | null, b: number | null) => (a !== null && (b === null || b > a))
  if (prev.mode === 'enforce' && next.mode === 'shadow') out.push('Switch from enforce to shadow mode')
  if (capUp(prev.perTxCapUsd, next.perTxCapUsd)) out.push('Raise the per-transaction cap')
  if (capUp(prev.dailyCapUsd, next.dailyCapUsd)) out.push('Raise the daily cap')
  if (capUp(prev.maxTxPerHour, next.maxTxPerHour)) out.push('Raise the hourly rate limit')
  if (prev.allowlistOnly && !next.allowlistOnly) out.push('Allow recipients outside the allowlist')
  if (next.allowRecipients.some((r) => !prev.allowRecipients.includes(r))) out.push('Add allowlisted recipients')
  if (prev.denyRecipients.some((r) => !next.denyRecipients.includes(r))) out.push('Remove denylisted recipients')
  if (prev.allowedPrograms !== null && (next.allowedPrograms === null || next.allowedPrograms.some((p) => !prev.allowedPrograms!.includes(p))))
    out.push('Allow more programs')
  if (next.newRecipientHoldUsd > prev.newRecipientHoldUsd) out.push('Raise the new-recipient hold amount')
  if (next.holdThreshold > prev.holdThreshold || next.blockThreshold > prev.blockThreshold) out.push('Raise risk thresholds')
  if (next.preApproved.some((r) => !prev.preApproved.some((p) => p.recipient === r.recipient && p.program === r.program)))
    out.push('Add pre-approved routes')
  return out
}
