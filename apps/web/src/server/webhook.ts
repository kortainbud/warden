// Keeps one Helius enhanced webhook pointed at /api/hooks/helius with every watched address.
// Needs WARDEN_PUBLIC_URL (a public https origin); local dev falls back to polling from the dashboard.

import 'server-only'
import { sql } from './db'
import { syncWebhook } from './helius'
import { isDemo } from './env'

export async function refreshWebhook() {
  const base = process.env.WARDEN_PUBLIC_URL
  const secret = process.env.WEBHOOK_SECRET
  if (isDemo() || !base || !secret || !base.startsWith('https://')) return false
  const rows = await sql<{ address: string }>`SELECT DISTINCT address FROM wallets`
  await syncWebhook(`${base.replace(/\/$/, '')}/api/hooks/helius`, rows.map((r) => r.address), secret)
  return true
}
