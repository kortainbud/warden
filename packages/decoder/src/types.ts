export interface RawInstruction {
  programId: string
  accounts: string[]
  data: Uint8Array
}

/** A decoded instruction. Amounts are raw base units (lamports, token base units). */
export type Action =
  | { kind: 'sol_transfer'; from: string; to: string; lamports: bigint }
  | { kind: 'create_account'; from: string; newAccount: string; lamports: bigint; owner: string }
  | { kind: 'assign'; account: string; owner: string }
  | {
      kind: 'token_transfer'
      program: string
      source: string
      destination: string
      authority: string
      amount: bigint
      mint?: string
      decimals?: number
    }
  | { kind: 'token_approve'; program: string; source: string; delegate: string; owner: string; amount: bigint; mint?: string }
  | { kind: 'token_revoke'; program: string; source: string; owner: string }
  | { kind: 'token_set_authority'; program: string; account: string; authorityType: number; newAuthority: string | null }
  | { kind: 'token_close'; program: string; account: string; destination: string; owner: string }
  | { kind: 'token_mint'; program: string; mint: string; destination: string; amount: bigint }
  | { kind: 'token_burn'; program: string; account: string; mint: string; amount: bigint }
  | { kind: 'token_account_init'; program: string; account: string; mint: string; owner?: string }
  | { kind: 'token_other'; program: string; op: number }
  | { kind: 'ata_create'; payer: string; account: string; owner: string; mint: string }
  | { kind: 'compute_budget'; units?: number; microLamports?: bigint }
  | { kind: 'memo'; text: string }
  | { kind: 'swap'; program: string; venue: string; route?: string }
  | { kind: 'smart_account'; program: string; op: SmartAccountOp; name?: string; settings: string | null }
  | { kind: 'assertion'; program: string }
  | { kind: 'stake'; op: number }
  | { kind: 'unknown'; programId: string; accounts: number; dataLength: number }

export type SmartAccountOp = 'execute' | 'spending_limit_use' | 'settings_change' | 'create' | 'other'

export type ActionKind = Action['kind']

/** Balance change for one account from simulation or a confirmed transaction. */
export interface BalanceChange {
  account: string
  /** The wallet that owns the balance (for token accounts, the token account owner). */
  owner: string
  /** "SOL" for native lamports, otherwise the mint address. */
  mint: string
  decimals: number
  /** Raw base units; negative is an outflow. */
  delta: bigint
}
