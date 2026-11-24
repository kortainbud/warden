export const short = (a: string | null | undefined, n = 4) => (!a ? '' : a.length > n * 2 + 2 ? `${a.slice(0, n)}…${a.slice(-n)}` : a)

export function usd(n: number | null | undefined, opts: { compact?: boolean } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const v = Number(n)
  if (opts.compact && Math.abs(v) >= 10_000) return `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: v !== 0 && Math.abs(v) < 1 ? 2 : 0, maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 })}`
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—'
  const s = (Date.now() - Date.parse(iso)) / 1000
  if (s < 0) {
    const f = -s
    if (f < 60) return `in ${Math.round(f)}s`
    if (f < 3600) return `in ${Math.round(f / 60)}m`
    return `in ${Math.round(f / 3600)}h`
  }
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`
  if (s < 86_400 * 30) return `${Math.round(s / 86_400)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export const ms = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(Number(n))} ms`)

export const isAddressLike = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim())

export const solscan = (kind: 'tx' | 'account', v: string) => `https://solscan.io/${kind}/${v}`
