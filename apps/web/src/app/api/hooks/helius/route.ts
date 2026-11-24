import { ingestWebhook } from '@/server/monitor'
import type { HeliusTx } from '@/server/helius'

export const maxDuration = 60

export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret || req.headers.get('authorization') !== secret) return new Response('unauthorized', { status: 401 })
  const txs = (await req.json().catch(() => [])) as HeliusTx[]
  if (!Array.isArray(txs)) return Response.json({ ok: false }, { status: 400 })
  const added = await ingestWebhook(txs)
  return Response.json({ ok: true, added })
}
