// Parse a serialized Solana transaction (legacy or v0) into instructions with resolved accounts.

import { Reader, base58Encode } from './encoding.ts'
import type { RawInstruction } from './types.ts'

export interface AddressTableLookup {
  table: string
  writableIndexes: number[]
  readonlyIndexes: number[]
}

export interface ParsedMessage {
  version: 'legacy' | 0
  header: { requiredSignatures: number; readonlySigned: number; readonlyUnsigned: number }
  staticKeys: string[]
  recentBlockhash: string
  compiled: { programIndex: number; accountIndexes: number[]; data: Uint8Array }[]
  lookups: AddressTableLookup[]
}

export interface ParsedTransaction {
  signatures: string[]
  /** Which required signers have a non-empty signature. */
  signed: boolean[]
  message: ParsedMessage
  messageBytes: Uint8Array
}

export function parseMessage(bytes: Uint8Array): ParsedMessage {
  const r = new Reader(bytes)
  const first = bytes[0]!
  let version: ParsedMessage['version'] = 'legacy'
  if (first & 0x80) {
    const v = first & 0x7f
    if (v !== 0) throw new Error(`Unsupported transaction version ${v}`)
    version = 0
    r.u8()
  }
  const header = { requiredSignatures: r.u8(), readonlySigned: r.u8(), readonlyUnsigned: r.u8() }
  const keyCount = r.shortvec()
  const staticKeys = Array.from({ length: keyCount }, () => r.pubkey())
  const recentBlockhash = r.pubkey()
  const ixCount = r.shortvec()
  const compiled = Array.from({ length: ixCount }, () => {
    const programIndex = r.u8()
    const accountIndexes = Array.from({ length: r.shortvec() }, () => r.u8())
    const data = r.take(r.shortvec())
    return { programIndex, accountIndexes, data }
  })
  const lookups: AddressTableLookup[] = []
  if (version === 0 && r.remaining > 0) {
    const n = r.shortvec()
    for (let i = 0; i < n; i++) {
      const table = r.pubkey()
      const writableIndexes = Array.from({ length: r.shortvec() }, () => r.u8())
      const readonlyIndexes = Array.from({ length: r.shortvec() }, () => r.u8())
      lookups.push({ table, writableIndexes, readonlyIndexes })
    }
  }
  return { version, header, staticKeys, recentBlockhash, compiled, lookups }
}

export function parseTransaction(bytes: Uint8Array): ParsedTransaction {
  const r = new Reader(bytes)
  const n = r.shortvec()
  const sigBytes = Array.from({ length: n }, () => r.take(64))
  const messageBytes = bytes.subarray(r.offset)
  const message = parseMessage(messageBytes)
  return {
    signatures: sigBytes.map((s) => base58Encode(s)),
    signed: sigBytes.map((s) => s.some((b) => b !== 0)),
    message,
    messageBytes,
  }
}

/**
 * Accounts in message order: static keys, then lookup-table writables, then readonlys.
 * `loaded` maps a lookup table address to its full address list (fetched by the caller via RPC).
 */
export function accountKeys(msg: ParsedMessage, loaded: Record<string, string[]> = {}): (string | null)[] {
  const writable: (string | null)[] = []
  const readonly: (string | null)[] = []
  for (const l of msg.lookups) {
    const table = loaded[l.table]
    for (const i of l.writableIndexes) writable.push(table?.[i] ?? null)
    for (const i of l.readonlyIndexes) readonly.push(table?.[i] ?? null)
  }
  return [...msg.staticKeys, ...writable, ...readonly]
}

export function isWritable(msg: ParsedMessage, index: number): boolean {
  const { requiredSignatures, readonlySigned, readonlyUnsigned } = msg.header
  const n = msg.staticKeys.length
  if (index < requiredSignatures) return index < requiredSignatures - readonlySigned
  if (index < n) return index < n - readonlyUnsigned
  const writableLoaded = msg.lookups.reduce((s, l) => s + l.writableIndexes.length, 0)
  return index < n + writableLoaded
}

/** Instructions with account addresses filled in (unresolved lookup accounts become "?"). */
export function instructionsOf(msg: ParsedMessage, loaded: Record<string, string[]> = {}): RawInstruction[] {
  const keys = accountKeys(msg, loaded)
  return msg.compiled.map((c) => ({
    programId: keys[c.programIndex] ?? '?',
    accounts: c.accountIndexes.map((i) => keys[i] ?? '?'),
    data: c.data,
  }))
}

export function signers(msg: ParsedMessage): string[] {
  return msg.staticKeys.slice(0, msg.header.requiredSignatures)
}
