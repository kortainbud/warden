import { mintSymbol, programName } from './programs.ts'
import type { Action, BalanceChange } from './types.ts'

export const short = (a: string) => (a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a)

export function formatUnits(raw: bigint, decimals: number): string {
  const neg = raw < 0n
  const v = neg ? -raw : raw
  const base = 10n ** BigInt(decimals)
  const whole = v / base
  let frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  if (frac.length > 6) frac = frac.slice(0, 6)
  return `${neg ? '-' : ''}${whole.toLocaleString('en-US')}${frac ? `.${frac}` : ''}`
}

export function tokenLabel(mint: string): string {
  return mintSymbol(mint) ?? short(mint)
}

/** One line, plain language. */
export function describeAction(a: Action): string {
  switch (a.kind) {
    case 'sol_transfer':
      return `Send ${formatUnits(a.lamports, 9)} SOL to ${short(a.to)}`
    case 'create_account':
      return `Create account ${short(a.newAccount)} (${formatUnits(a.lamports, 9)} SOL rent)`
    case 'assign':
      return `Reassign ${short(a.account)} to ${programName(a.owner) ?? short(a.owner)}`
    case 'token_transfer':
      return a.decimals !== undefined && a.mint
        ? `Send ${formatUnits(a.amount, a.decimals)} ${tokenLabel(a.mint)} to token account ${short(a.destination)}`
        : `Send ${a.amount.toString()} token units to token account ${short(a.destination)}`
    case 'token_approve':
      return `Allow ${short(a.delegate)} to spend tokens from ${short(a.source)}`
    case 'token_revoke':
      return `Revoke spending approval on ${short(a.source)}`
    case 'token_set_authority':
      return `Change authority on ${short(a.account)} to ${a.newAuthority ? short(a.newAuthority) : 'none'}`
    case 'token_close':
      return `Close token account ${short(a.account)}`
    case 'token_mint':
      return `Mint tokens of ${tokenLabel(a.mint)}`
    case 'token_burn':
      return `Burn tokens of ${tokenLabel(a.mint)}`
    case 'token_account_init':
      return `Open a ${tokenLabel(a.mint)} token account`
    case 'token_other':
      return `Token instruction #${a.op}`
    case 'ata_create':
      return `Open ${tokenLabel(a.mint)} account for ${short(a.owner)}`
    case 'compute_budget':
      return 'Set compute budget'
    case 'memo':
      return `Memo: "${a.text.slice(0, 80)}"`
    case 'swap':
      return `Swap on ${a.venue}`
    case 'smart_account':
      return a.op === 'execute'
        ? 'Execute from smart account vault'
        : a.op === 'settings_change'
          ? `Smart account settings change${a.name ? ` (${a.name})` : ''}`
          : `Smart account: ${a.name ?? 'instruction'}`
    case 'assertion':
      return 'Post-state assertion'
    case 'stake':
      return 'Stake instruction'
    case 'unknown':
      return `Unknown program ${programName(a.programId) ?? short(a.programId)}`
  }
}

export function describeChange(c: BalanceChange): string {
  return `${c.delta > 0n ? '+' : ''}${formatUnits(c.delta, c.decimals)} ${tokenLabel(c.mint)}`
}
