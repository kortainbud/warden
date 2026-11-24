import { Reader } from './encoding.ts'
import { PROGRAMS, programName } from './programs.ts'
import type { Action, BalanceChange, RawInstruction, SmartAccountOp } from './types.ts'

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')

// Anchor discriminators: sha256("global:<name>")[0..8]
const SMART_ACCOUNT_IX: Record<string, { op: SmartAccountOp; name: string }> = {
  '2b66f859e7616886': { op: 'execute', name: 'execute_transaction_sync' },
  '5a51bb512746804e': { op: 'execute', name: 'execute_transaction_sync_v2' },
  e7ad315beb184413: { op: 'execute', name: 'execute_transaction' },
  e3c135ef377e7069: { op: 'other', name: 'create_transaction' },
  c566fde74d543211: { op: 'create', name: 'create_smart_account' },
  '29b34605c293ef9e': { op: 'spending_limit_use', name: 'use_spending_limit' },
  '50c6e49a07ea6338': { op: 'settings_change', name: 'add_signer_as_authority' },
  '3a139510b5107d94': { op: 'settings_change', name: 'remove_signer_as_authority' },
  '338d4e85462f5f7c': { op: 'settings_change', name: 'change_threshold_as_authority' },
  dd7085e5923a5a38: { op: 'settings_change', name: 'set_new_settings_authority_as_authority' },
  '02ea5d5d285c1fea': { op: 'settings_change', name: 'set_time_lock_as_authority' },
  a9bd54361ef4dfd4: { op: 'settings_change', name: 'add_spending_limit_as_authority' },
  '5e20447ffb2c9107': { op: 'settings_change', name: 'remove_spending_limit_as_authority' },
}

const JUPITER_IX: Record<string, string> = {
  e517cb977ae3ad2a: 'route',
  c1209b3341d69c81: 'shared_accounts_route',
  d033ef977b2bed5c: 'exact_out_route',
  b0d169a89a7d453e: 'shared_accounts_exact_out_route',
  '96564774a75d0e68': 'route_with_token_ledger',
}

function decodeSystem(ix: RawInstruction): Action {
  const r = new Reader(ix.data)
  const tag = r.u32()
  const a = ix.accounts
  switch (tag) {
    case 0: {
      const lamports = r.u64()
      r.u64() // space
      return { kind: 'create_account', from: a[0]!, newAccount: a[1]!, lamports, owner: r.pubkey() }
    }
    case 1:
      return { kind: 'assign', account: a[0]!, owner: r.pubkey() }
    case 2:
      return { kind: 'sol_transfer', from: a[0]!, to: a[1]!, lamports: r.u64() }
    case 11: // TransferWithSeed: [from, base, to]
      return { kind: 'sol_transfer', from: a[0]!, to: a[2]!, lamports: r.u64() }
    default:
      return { kind: 'unknown', programId: ix.programId, accounts: a.length, dataLength: ix.data.length }
  }
}

function decodeToken(ix: RawInstruction): Action {
  const program = ix.programId
  const r = new Reader(ix.data)
  const op = r.u8()
  const a = ix.accounts
  switch (op) {
    case 1:
      return { kind: 'token_account_init', program, account: a[0]!, mint: a[1]!, owner: a[2] }
    case 16:
    case 18: {
      const account = a[0]!, mint = a[1]!
      return { kind: 'token_account_init', program, account, mint, owner: r.remaining >= 32 ? r.pubkey() : undefined }
    }
    case 3:
      return { kind: 'token_transfer', program, source: a[0]!, destination: a[1]!, authority: a[2]!, amount: r.u64() }
    case 12: {
      const amount = r.u64()
      return { kind: 'token_transfer', program, source: a[0]!, mint: a[1]!, destination: a[2]!, authority: a[3]!, amount, decimals: r.u8() }
    }
    case 4:
      return { kind: 'token_approve', program, source: a[0]!, delegate: a[1]!, owner: a[2]!, amount: r.u64() }
    case 13:
      return { kind: 'token_approve', program, source: a[0]!, mint: a[1]!, delegate: a[2]!, owner: a[3]!, amount: r.u64() }
    case 5:
      return { kind: 'token_revoke', program, source: a[0]!, owner: a[1]! }
    case 6: {
      const authorityType = r.u8()
      const has = r.u8() === 1
      return { kind: 'token_set_authority', program, account: a[0]!, authorityType, newAuthority: has ? r.pubkey() : null }
    }
    case 7:
    case 14:
      return { kind: 'token_mint', program, mint: a[0]!, destination: a[1]!, amount: r.u64() }
    case 8:
    case 15:
      return { kind: 'token_burn', program, account: a[0]!, mint: a[1]!, amount: r.u64() }
    case 9:
      return { kind: 'token_close', program, account: a[0]!, destination: a[1]!, owner: a[2]! }
    default:
      return { kind: 'token_other', program, op }
  }
}

function decodeComputeBudget(ix: RawInstruction): Action {
  const r = new Reader(ix.data)
  const op = r.u8()
  if (op === 2) return { kind: 'compute_budget', units: r.u32() }
  if (op === 3) return { kind: 'compute_budget', microLamports: r.u64() }
  return { kind: 'compute_budget' }
}

/** Decode one instruction. Never throws: malformed data becomes an `unknown` action. */
export function decodeInstruction(ix: RawInstruction): Action {
  const unknown: Action = { kind: 'unknown', programId: ix.programId, accounts: ix.accounts.length, dataLength: ix.data.length }
  try {
    switch (ix.programId) {
      case PROGRAMS.system:
        return decodeSystem(ix)
      case PROGRAMS.token:
      case PROGRAMS.token2022:
        return decodeToken(ix)
      case PROGRAMS.ata:
        return { kind: 'ata_create', payer: ix.accounts[0]!, account: ix.accounts[1]!, owner: ix.accounts[2]!, mint: ix.accounts[3]! }
      case PROGRAMS.computeBudget:
        return decodeComputeBudget(ix)
      case PROGRAMS.memo:
      case PROGRAMS.memoV1:
        return { kind: 'memo', text: new TextDecoder().decode(ix.data).slice(0, 566) }
      case PROGRAMS.stake:
        return { kind: 'stake', op: ix.data.length >= 4 ? new Reader(ix.data).u32() : -1 }
      case PROGRAMS.jupiter:
        return { kind: 'swap', program: ix.programId, venue: 'Jupiter', route: JUPITER_IX[hex(ix.data.subarray(0, 8))] }
      case PROGRAMS.orcaWhirlpool:
      case PROGRAMS.raydiumAmm:
        return { kind: 'swap', program: ix.programId, venue: programName(ix.programId)! }
      case PROGRAMS.squadsSmartAccount:
      case PROGRAMS.squadsV4: {
        const hit = SMART_ACCOUNT_IX[hex(ix.data.subarray(0, 8))]
        return { kind: 'smart_account', program: ix.programId, op: hit?.op ?? 'other', name: hit?.name, settings: ix.accounts[0] ?? null }
      }
      case PROGRAMS.lighthouse:
        return { kind: 'assertion', program: ix.programId }
      default:
        return unknown
    }
  } catch {
    return unknown
  }
}

export function decodeInstructions(ixs: RawInstruction[]): Action[] {
  return ixs.map(decodeInstruction)
}

/** Program IDs invoked by the actions (top level). */
export function programsOf(ixs: RawInstruction[]): string[] {
  return [...new Set(ixs.map((i) => i.programId))]
}

/** Addresses that receive value: SOL transfer targets and owners of credited token accounts. */
export function recipientsOf(actions: Action[], changes: BalanceChange[], self: Set<string>): string[] {
  const out = new Set<string>()
  for (const a of actions) {
    if (a.kind === 'sol_transfer' && !self.has(a.to)) out.add(a.to)
    if (a.kind === 'create_account' && a.lamports > 0n && !self.has(a.newAccount) && a.owner === PROGRAMS.system) out.add(a.newAccount)
    if (a.kind === 'token_approve' && !self.has(a.delegate)) out.add(a.delegate)
  }
  for (const c of changes) if (c.delta > 0n && !self.has(c.owner)) out.add(c.owner)
  return [...out]
}
