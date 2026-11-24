export const PROGRAMS = {
  system: '11111111111111111111111111111111',
  token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  token2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  ata: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  computeBudget: 'ComputeBudget111111111111111111111111111111',
  memo: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  memoV1: 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
  stake: 'Stake11111111111111111111111111111111111111',
  jupiter: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  orcaWhirlpool: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  raydiumAmm: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  squadsSmartAccount: 'SMRTzfY6DfH5ik3TKiyLFfXexV8uSG3d2UksSCYdunG',
  squadsV4: 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf',
  lighthouse: 'L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95',
} as const

export const MINTS = {
  wsol: 'So11111111111111111111111111111111111111112',
  usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  usdt: 'Es9vMFrzaCERmJFrF4H2FYD4KCoNkY11McCe8BenwNYB',
} as const

export const STABLE_MINTS = new Set<string>([MINTS.usdc, MINTS.usdt])

const NAMES: Record<string, string> = {
  [PROGRAMS.system]: 'System Program',
  [PROGRAMS.token]: 'SPL Token',
  [PROGRAMS.token2022]: 'Token-2022',
  [PROGRAMS.ata]: 'Associated Token Account',
  [PROGRAMS.computeBudget]: 'Compute Budget',
  [PROGRAMS.memo]: 'Memo',
  [PROGRAMS.memoV1]: 'Memo (v1)',
  [PROGRAMS.stake]: 'Stake Program',
  [PROGRAMS.jupiter]: 'Jupiter',
  [PROGRAMS.orcaWhirlpool]: 'Orca Whirlpool',
  [PROGRAMS.raydiumAmm]: 'Raydium AMM',
  [PROGRAMS.squadsSmartAccount]: 'Squads Smart Account',
  [PROGRAMS.squadsV4]: 'Squads v4',
  [PROGRAMS.lighthouse]: 'Lighthouse',
}

/** Programs whose instructions we decode or whose behaviour is well understood. */
export const KNOWN_PROGRAMS = new Set(Object.keys(NAMES))

/** Programs that move no value on their own (safe to ignore when listing "programs touched"). */
export const INERT_PROGRAMS = new Set<string>([PROGRAMS.computeBudget, PROGRAMS.memo, PROGRAMS.memoV1, PROGRAMS.lighthouse])

export function programName(id: string): string | null {
  return NAMES[id] ?? null
}

export function mintSymbol(mint: string): string | null {
  if (mint === 'SOL' || mint === MINTS.wsol) return 'SOL'
  if (mint === MINTS.usdc) return 'USDC'
  if (mint === MINTS.usdt) return 'USDT'
  return null
}
