// Alerts: stored per owner, de-duplicated, and fanned out to the owner's channels.

import 'server-only'
import { json, sql } from './db'
import { id } from './env'

export type Severity = 'info' | 'warning' | 'critical'
const RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 }

export interface AlertInput {
  owner: string
  walletId: string | null
  severity: Severity
  type: string
  title: string
  body: string
  ref?: string
  dedupeKey?: string
}

interface Channel {
  id: string
  kind: 'webhook' | 'telegram' | 'slack' | 'email'
  label: string
  config: { url?: string; secret?: string; chatId?: string; email?: string }
  min_severity: Severity
  enabled: boolean
}

export async function raiseAlert(a: AlertInput): Promise<boolean> {
  const aid = id('alr')
  const rows = await sql`
    INSERT INTO alerts (id, owner, wallet_id, severity, type, title, body, ref, dedupe_key)
    VALUES (${aid}, ${a.owner}, ${a.walletId}, ${a.severity}, ${a.type}, ${a.title}, ${a.body}, ${a.ref ?? null}, ${a.dedupeKey ?? null})
    ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`
  if (!rows.length) return false
  const channels = await sql<Channel>`SELECT * FROM alert_channels WHERE owner = ${a.owner} AND enabled`
  const delivered: { channel: string; ok: boolean; error?: string }[] = []
  await Promise.all(
    channels
      .filter((c) => RANK[a.severity] >= RANK[c.min_severity])
      .map(async (c) => {
        try {
          await deliver(c, { id: aid, ...a })
          delivered.push({ channel: c.id, ok: true })
        } catch (e) {
          const error = (e as Error).message.slice(0, 200)
          delivered.push({ channel: c.id, ok: false, error })
          await sql`UPDATE alert_channels SET last_error = ${error} WHERE id = ${c.id}`
        }
      }),
  )
  if (delivered.length) await sql`UPDATE alerts SET delivered = ${json(delivered)} WHERE id = ${aid}`
  return true
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function deliver(c: Channel, a: AlertInput & { id: string }) {
  const icon = a.severity === 'critical' ? '[CRITICAL]' : a.severity === 'warning' ? '[Warning]' : '[Info]'
  const base = process.env.WARDEN_PUBLIC_URL ?? ''
  const link = base ? `${base}/app/alerts` : ''
  switch (c.kind) {
    case 'webhook': {
      const body = JSON.stringify({ type: 'alert', alert: { id: a.id, severity: a.severity, type: a.type, title: a.title, body: a.body, ref: a.ref ?? null, wallet_id: a.walletId }, sent_at: new Date().toISOString() })
      const ts = Math.floor(Date.now() / 1000).toString()
      const sig = await hmacHex(c.config.secret ?? '', `${ts}.${body}`)
      const res = await fetch(c.config.url!, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-warden-timestamp': ts, 'x-warden-signature': `v1=${sig}` },
        body,
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`)
      return
    }
    case 'slack': {
      const res = await fetch(c.config.url!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `${icon} *${a.title}*\n${a.body}${link ? `\n${link}` : ''}` }),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`Slack responded ${res.status}`)
      return
    }
    case 'telegram': {
      const token = process.env.TELEGRAM_BOT_TOKEN
      if (!token) throw new Error('Telegram is not configured on this server.')
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: c.config.chatId, text: `${icon} ${a.title}\n\n${a.body}${link ? `\n\n${link}` : ''}`, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`Telegram responded ${res.status}`)
      return
    }
    case 'email':
      throw new Error('Email delivery is not available yet.')
  }
}
