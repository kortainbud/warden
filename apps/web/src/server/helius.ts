// Helius client: RPC, Enhanced Transactions and DAS prices. Server-only (uses the API key).
// HELIUS_API_KEY_BACKUP takes over if the primary key is rejected or out of credits.

import 'server-only'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface HeliusInstruction {
  programId: string
  accounts: string[]
  data: string
  innerInstructions?: HeliusInstruction[]
}

export interface HeliusTx {
  signature: string
  slot: number
  timestamp: number
  type: string
  source: string
  description: string
  fee: number
  feePayer: string
  transactionError: unknown
  nativeTransfers: { fromUserAccount: string | null; toUserAccount: string | null; amount: number }[] | null
  tokenTransfers:
    | { fromUserAccount: string | null; toUserAccount: string | null; fromTokenAccount: string | null; toTokenAccount: string | null; tokenAmount: number; mint: string; tokenStandard?: string }[]
    | null
  accountData?: {
    account: string
    nativeBalanceChange: number
    tokenBalanceChanges: { userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }[]
  }[]
  instructions?: HeliusInstruction[]
}

class HeliusHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let active = 0
function keys(): string[] {
  const k = [process.env.HELIUS_API_KEY, process.env.HELIUS_API_KEY_BACKUP].filter((x): x is string => !!x)
  if (!k.length) throw new Error('HELIUS_API_KEY is not configured on the server.')
  return k
}

async function attempt<T>(url: string, init: RequestInit | undefined, tries: number, timeoutMs: number): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      if (res.status === 429 || res.status >= 500) {
        last = new HeliusHttpError(res.status, `Helius responded ${res.status}`)
        await sleep(500 * 2 ** i)
        continue
      }
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new HeliusHttpError(res.status, body?.error?.message || body?.error || `Helius responded ${res.status}`)
      return body as T
    } catch (e) {
      if (e instanceof HeliusHttpError && [400, 401, 403, 404].includes(e.status)) throw e
      last = e
      await sleep(300 * 2 ** i)
    }
  }
  throw last instanceof Error ? last : new Error('Helius request failed')
}

async function request<T>(urlFor: (key: string) => string, init?: RequestInit, opts: { tries?: number; timeoutMs?: number } = {}): Promise<T> {
  const ks = keys()
  for (;;) {
    try {
      return await attempt<T>(urlFor(ks[Math.min(active, ks.length - 1)]!), init, opts.tries ?? 3, opts.timeoutMs ?? 15_000)
    } catch (e) {
      const status = e instanceof HeliusHttpError ? e.status : 0
      const exhausted = status === 401 || status === 429 || (status === 403 && /credit|limit|quota|key/i.test(String((e as Error).message)))
      if (exhausted && active < ks.length - 1) {
        active++
        continue
      }
      throw e
    }
  }
}

const rpcUrl = (k: string) => `https://mainnet.helius-rpc.com/?api-key=${k}`

export async function rpc<T>(method: string, params: unknown, opts: { tries?: number; timeoutMs?: number } = {}): Promise<T> {
  const res = await request<{ result?: T; error?: { message: string; code?: number } }>(
    rpcUrl,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'warden', method, params }) },
    opts,
  )
  if (res.error) throw new Error(res.error.message)
  return res.result as T
}

/**
 * Newest-first parsed transactions until `untilSignature` (exclusive), `sinceTs` (unix s), or `max`.
 */
export async function addressTransactions(address: string, o: { untilSignature?: string | null; sinceTs?: number; max: number }) {
  const out: HeliusTx[] = []
  let before: string | undefined
  for (;;) {
    const b = before
    const page = await request<HeliusTx[]>((k) => {
      const qs = new URLSearchParams({ 'api-key': k, limit: '100' })
      if (b) qs.set('before', b)
      if (o.untilSignature) qs.set('until', o.untilSignature)
      return `https://api-mainnet.helius-rpc.com/v0/addresses/${address}/transactions?${qs}`
    })
    let stop = page.length < 100
    for (const tx of page) {
      if (o.sinceTs && tx.timestamp < o.sinceTs) {
        stop = true
        break
      }
      out.push(tx)
      if (out.length >= o.max) {
        stop = true
        break
      }
    }
    if (stop || !page.length) break
    before = page[page.length - 1]!.signature
  }
  return out
}

/** Oldest known transaction time for an address (unix s), or null if it has none. */
export async function firstSeen(address: string): Promise<number | null> {
  const page = await request<HeliusTx[]>(
    (k) => `https://api-mainnet.helius-rpc.com/v0/addresses/${address}/transactions?api-key=${k}&limit=1&sort-order=asc`,
    undefined,
    { tries: 1, timeoutMs: 1200 },
  )
  return page[0]?.timestamp ?? null
}

interface DasAsset {
  id: string
  content?: { metadata?: { symbol?: string; name?: string } }
  token_info?: { symbol?: string; decimals?: number; price_info?: { price_per_token?: number } }
}

/** Price and metadata for a batch of mints (DAS). Missing prices are null. */
export async function assetInfo(mints: string[]): Promise<Record<string, { price: number | null; symbol: string | null; decimals: number | null }>> {
  if (!mints.length) return {}
  const res = await request<{ result?: (DasAsset | null)[] }>(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'warden', method: 'getAssetBatch', params: { ids: mints, displayOptions: { showFungible: true } } }),
  }, { tries: 2, timeoutMs: 5000 })
  const out: Record<string, { price: number | null; symbol: string | null; decimals: number | null }> = {}
  for (const a of res.result ?? []) {
    if (!a) continue
    out[a.id] = {
      price: a.token_info?.price_info?.price_per_token ?? null,
      symbol: a.token_info?.symbol ?? a.content?.metadata?.symbol ?? null,
      decimals: a.token_info?.decimals ?? null,
    }
  }
  return out
}

// ---- Webhooks (real-time monitor) ----

interface HeliusWebhook {
  webhookID: string
  webhookURL: string
  accountAddresses: string[]
  webhookType: string
}

/** Point one enhanced webhook at our endpoint with the full set of watched addresses. */
export async function syncWebhook(url: string, addresses: string[], authHeader: string) {
  const list = await request<HeliusWebhook[]>((k) => `https://api-mainnet.helius-rpc.com/v0/webhooks?api-key=${k}`)
  // Same endpoint path on any Warden host: re-point it rather than leave a stale one behind.
  const mine = list.find((w) => w.webhookURL === url) ?? list.find((w) => /warden/i.test(w.webhookURL) && w.webhookURL.endsWith('/api/hooks/helius'))
  const body = JSON.stringify({
    webhookURL: url,
    transactionTypes: ['ANY'],
    accountAddresses: addresses.length ? addresses : ['11111111111111111111111111111111'],
    webhookType: 'enhanced',
    authHeader,
  })
  const init = { method: mine ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body }
  await request((k) => `https://api-mainnet.helius-rpc.com/v0/webhooks${mine ? `/${mine.webhookID}` : ''}?api-key=${k}`, init)
}
