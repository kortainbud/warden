// Turn a Helius enhanced transaction into a monitor event from one wallet's point of view,
// using the same decoder the check service uses.

import 'server-only'
import { base58Decode, decodeInstructions, describeAction, type Action, type BalanceChange } from '@warden/decoder'
import type { HeliusTx } from './helius'
import { tokenMeta } from './prices'

export interface EventRow {
  signature: string
  slot: number
  ts: Date
  type: string
  source: string
  description: string
  actions: Action[]
  changes: BalanceChange[]
  outflowUsd: number | null
  inflowUsd: number | null
  outflowUnpriced: boolean
  counterparties: string[]
  recipients: string[]
  programs: string[]
  fee: number
  failed: boolean
  signedByWallet: boolean
}

function decodeTx(tx: HeliusTx): Action[] {
  return decodeInstructions(
    (tx.instructions ?? []).map((ix) => {
      let data: Uint8Array
      try {
        data = base58Decode(ix.data ?? '')
      } catch {
        data = new Uint8Array()
      }
      return { programId: ix.programId, accounts: ix.accounts ?? [], data }
    }),
  )
}

/** Balance changes for every account, with token changes attributed to the token account's owner. */
export function changesOf(tx: HeliusTx): BalanceChange[] {
  const out: BalanceChange[] = []
  for (const a of tx.accountData ?? []) {
    let native = BigInt(a.nativeBalanceChange ?? 0)
    if (a.account === tx.feePayer) native += BigInt(tx.fee ?? 0) // fees are not transfers
    if (native !== 0n) out.push({ account: a.account, owner: a.account, mint: 'SOL', decimals: 9, delta: native })
    for (const t of a.tokenBalanceChanges ?? []) {
      const delta = BigInt(t.rawTokenAmount.tokenAmount)
      if (delta !== 0n) out.push({ account: t.tokenAccount, owner: t.userAccount, mint: t.mint, decimals: t.rawTokenAmount.decimals, delta })
    }
  }
  return out
}

export async function toEvent(tx: HeliusTx, wallet: string): Promise<EventRow> {
  const actions = decodeTx(tx)
  const changes = changesOf(tx)
  const mine = changes.filter((c) => c.owner === wallet)
  const meta = await tokenMeta([...new Set(mine.map((c) => c.mint))])
  let out = 0, inn = 0, unpriced = false
  for (const c of mine) {
    const price = meta[c.mint]?.price ?? null
    const units = Number(c.delta) / 10 ** c.decimals
    if (c.delta < 0n) {
      if (price === null) unpriced = true
      else out += -units * price
    } else if (price !== null) inn += units * price
  }
  const counterparties = new Set<string>()
  const recipients = new Set<string>()
  for (const n of tx.nativeTransfers ?? []) {
    if (n.fromUserAccount === wallet && n.toUserAccount && n.toUserAccount !== wallet) recipients.add(n.toUserAccount)
    for (const a of [n.fromUserAccount, n.toUserAccount]) if (a && a !== wallet) counterparties.add(a)
  }
  for (const t of tx.tokenTransfers ?? []) {
    if (t.fromUserAccount === wallet && t.toUserAccount && t.toUserAccount !== wallet) recipients.add(t.toUserAccount)
    for (const a of [t.fromUserAccount, t.toUserAccount]) if (a && a !== wallet) counterparties.add(a)
  }
  const description = tx.description?.trim() || actions.filter((a) => a.kind !== 'compute_budget').map(describeAction).slice(0, 2).join('; ') || tx.type
  return {
    signature: tx.signature,
    slot: tx.slot,
    ts: new Date(tx.timestamp * 1000),
    type: tx.type ?? 'UNKNOWN',
    source: tx.source ?? 'UNKNOWN',
    description,
    actions,
    changes: mine,
    // Net value: a swap that returns value to the wallet is not spending. Counts toward caps.
    outflowUsd: Math.max(0, Math.round((out - inn) * 100) / 100),
    inflowUsd: Math.max(0, Math.round((inn - out) * 100) / 100),
    outflowUnpriced: unpriced,
    counterparties: [...counterparties],
    recipients: [...recipients],
    programs: [...new Set((tx.instructions ?? []).map((i) => i.programId))],
    fee: tx.fee ?? 0,
    failed: !!tx.transactionError,
    signedByWallet: tx.feePayer === wallet,
  }
}
