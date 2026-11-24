import 'server-only'
import { MINTS, STABLE_MINTS, mintSymbol } from '@warden/decoder'
import { assetInfo } from './helius'
import { isDemo } from './env'

export interface TokenMeta {
  price: number | null
  symbol: string
  decimals: number | null
}

const TTL = 60_000
const cache = new Map<string, { at: number; meta: TokenMeta }>()

const DEMO_PRICES: Record<string, number> = { [MINTS.wsol]: 142.5, [MINTS.usdc]: 1, [MINTS.usdt]: 1 }

/** USD prices and symbols. "SOL" is priced as wrapped SOL. Unknown prices stay null (never guessed). */
export async function tokenMeta(mints: string[]): Promise<Record<string, TokenMeta>> {
  const ids = [...new Set(mints.map((m) => (m === 'SOL' ? MINTS.wsol : m)))]
  const now = Date.now()
  const missing = ids.filter((m) => {
    const c = cache.get(m)
    return !c || now - c.at > TTL
  })
  if (missing.length) {
    let fetched: Awaited<ReturnType<typeof assetInfo>> = {}
    if (isDemo()) {
      fetched = Object.fromEntries(missing.map((m) => [m, { price: DEMO_PRICES[m] ?? null, symbol: null, decimals: null }]))
    } else {
      try {
        for (let i = 0; i < missing.length; i += 100) Object.assign(fetched, await assetInfo(missing.slice(i, i + 100)))
      } catch {
        /* prices unavailable: leave null */
      }
    }
    for (const m of missing) {
      const f = fetched[m]
      let price = f?.price ?? null
      if (price === null && STABLE_MINTS.has(m)) price = 1
      cache.set(m, { at: now, meta: { price, symbol: mintSymbol(m) ?? f?.symbol ?? `${m.slice(0, 4)}…`, decimals: f?.decimals ?? null } })
    }
  }
  const out: Record<string, TokenMeta> = {}
  for (const m of mints) out[m] = cache.get(m === 'SOL' ? MINTS.wsol : m)?.meta ?? { price: null, symbol: m.slice(0, 4), decimals: null }
  return out
}
