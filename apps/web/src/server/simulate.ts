// Simulate a transaction against mainnet and compute exact balance changes for every writable
// account: SOL for system accounts, token amounts (attributed to the token account owner).

import 'server-only'
import { PROGRAMS, accountKeys, isWritable, type Action, type BalanceChange, type ParsedTransaction } from '@warden/decoder'
import { rpc } from './helius'
import { isDemo } from './env'

interface ParsedAccount {
  lamports: number
  owner: string
  data: { parsed?: { type?: string; info?: { mint?: string; owner?: string; tokenAmount?: { amount: string; decimals: number }; addresses?: string[] } } } | [string, string]
}

export type SimResult =
  | { ok: true; changes: BalanceChange[]; fee: bigint; unitsConsumed: number | null; logs: string[]; loaded: Record<string, string[]> }
  | { ok: false; error: string; unavailable?: boolean; logs: string[]; loaded: Record<string, string[]> }

const parsedInfo = (a: ParsedAccount | null) => (a && !Array.isArray(a.data) ? a.data.parsed?.info : undefined)
const isTokenProgram = (p: string) => p === PROGRAMS.token || p === PROGRAMS.token2022

export function estimateFee(tx: ParsedTransaction, actions: Action[]): bigint {
  let units = 200_000n * BigInt(Math.max(1, actions.filter((a) => a.kind !== 'compute_budget').length))
  let micro = 0n
  for (const a of actions) {
    if (a.kind === 'compute_budget' && a.units !== undefined) units = BigInt(a.units)
    if (a.kind === 'compute_budget' && a.microLamports !== undefined) micro = a.microLamports
  }
  return 5000n * BigInt(tx.message.header.requiredSignatures) + (units * micro + 999_999n) / 1_000_000n
}

/** Lookup-table contents for v0 messages. */
export async function loadLookupTables(tx: ParsedTransaction): Promise<Record<string, string[]>> {
  const tables = tx.message.lookups.map((l) => l.table)
  if (!tables.length || isDemo()) return {}
  const res = await rpc<{ value: (ParsedAccount | null)[] }>('getMultipleAccounts', [tables, { encoding: 'jsonParsed' }], { tries: 2, timeoutMs: 3000 })
  const out: Record<string, string[]> = {}
  tables.forEach((t, i) => {
    const addrs = parsedInfo(res.value[i] ?? null)?.addresses
    if (addrs) out[t] = addrs
  })
  return out
}

export async function simulate(txBase64: string, tx: ParsedTransaction, actions: Action[]): Promise<SimResult> {
  const fee = estimateFee(tx, actions)
  if (isDemo()) return { ok: true, changes: demoChanges(tx, actions, fee), fee, unitsConsumed: 4_200, logs: ['demo: simulated from decoded instructions'], loaded: {} }

  let loaded: Record<string, string[]> = {}
  try {
    loaded = await loadLookupTables(tx)
  } catch (e) {
    return { ok: false, unavailable: true, error: `Could not load address lookup tables: ${(e as Error).message}`, logs: [], loaded }
  }
  const keys = accountKeys(tx.message, loaded)
  if (keys.some((k) => k === null)) return { ok: false, error: 'An address lookup table could not be resolved.', logs: [], loaded }
  const writable = [...new Set((keys as string[]).filter((_, i) => isWritable(tx.message, i)))]

  try {
    const [pre, sim] = await Promise.all([
      rpc<{ value: (ParsedAccount | null)[] }>('getMultipleAccounts', [writable, { encoding: 'jsonParsed', commitment: 'processed' }], { tries: 2, timeoutMs: 3000 }),
      rpc<{ value: { err: unknown; logs: string[] | null; accounts: (ParsedAccount | null)[] | null; unitsConsumed?: number } }>(
        'simulateTransaction',
        [txBase64, { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true, commitment: 'processed', accounts: { encoding: 'jsonParsed', addresses: writable } }],
        { tries: 2, timeoutMs: 4000 },
      ),
    ])
    const logs = sim.value.logs ?? []
    if (sim.value.err) {
      const msg = typeof sim.value.err === 'string' ? sim.value.err : JSON.stringify(sim.value.err)
      const hint = logs.filter((l) => /error|failed|insufficient/i.test(l)).slice(-1)[0]
      return { ok: false, error: `${msg}${hint ? ` (${hint.replace(/^Program log: /, '')})` : ''}`, logs, loaded }
    }
    const payer = keys[0]!
    const changes: BalanceChange[] = []
    writable.forEach((addr, i) => {
      const before = pre.value[i] ?? null
      const after = sim.value.accounts?.[i] ?? null
      const tokenProgram = (after ?? before)?.owner
      if (tokenProgram && isTokenProgram(tokenProgram)) {
        const bi = parsedInfo(before), ai = parsedInfo(after)
        const mint = ai?.mint ?? bi?.mint
        const owner = ai?.owner ?? bi?.owner
        if (!mint || !owner) return
        const decimals = ai?.tokenAmount?.decimals ?? bi?.tokenAmount?.decimals ?? 0
        const delta = BigInt(ai?.tokenAmount?.amount ?? '0') - BigInt(bi?.tokenAmount?.amount ?? '0')
        if (delta !== 0n) changes.push({ account: addr, owner, mint, decimals, delta })
        // a closed token account returns its rent to someone; that shows on the receiver's SOL balance
        return
      }
      let delta = BigInt(after?.lamports ?? 0) - BigInt(before?.lamports ?? 0)
      if (addr === payer) delta += fee
      if (delta !== 0n) changes.push({ account: addr, owner: addr, mint: 'SOL', decimals: 9, delta })
    })
    return { ok: true, changes, fee, unitsConsumed: sim.value.unitsConsumed ?? null, logs, loaded }
  } catch (e) {
    return { ok: false, unavailable: true, error: (e as Error).message, logs: [], loaded }
  }
}

/** Demo only: derive changes from decoded transfers (no RPC). */
function demoChanges(_tx: ParsedTransaction, actions: Action[], _fee: bigint): BalanceChange[] {
  const out: BalanceChange[] = []
  for (const a of actions) {
    if (a.kind === 'sol_transfer') {
      out.push({ account: a.from, owner: a.from, mint: 'SOL', decimals: 9, delta: -a.lamports })
      out.push({ account: a.to, owner: a.to, mint: 'SOL', decimals: 9, delta: a.lamports })
    }
    if (a.kind === 'token_transfer' && a.mint && a.decimals !== undefined) {
      out.push({ account: a.source, owner: a.authority, mint: a.mint, decimals: a.decimals, delta: -a.amount })
    }
  }
  return out
}
