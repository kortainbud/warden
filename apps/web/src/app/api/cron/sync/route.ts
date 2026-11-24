// Catch-up job (Vercel Cron): expire holds, re-sync wallets that have not synced recently, refresh the webhook.
import { sql } from '@/server/db'
import { expireHolds } from '@/server/check'
import { syncWallet } from '@/server/monitor'
import { refreshWebhook } from '@/server/webhook'
import type { Wallet } from '@/server/repo'

export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 })
  await expireHolds()
  const stale = await sql<Wallet>`SELECT * FROM wallets WHERE last_synced_at IS NULL OR last_synced_at < now() - interval '10 minutes' ORDER BY last_synced_at NULLS FIRST LIMIT 40`
  let synced = 0, failed = 0
  for (const w of stale) {
    try { await syncWallet(w); synced++ } catch { failed++ }
  }
  const webhook = await refreshWebhook().catch(() => false)
  return Response.json({ synced, failed, webhook })
}
