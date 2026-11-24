import 'server-only'
import { templatePolicy, type Policy, type TemplateId } from '@warden/engine'
import { sql } from './db'
import { id } from './env'

export interface Wallet {
  id: string
  owner: string
  address: string
  label: string
  kind: 'monitor' | 'protected'
  smart_account: string | null
  vault: string | null
  agent_signer: string | null
  frozen: boolean
  frozen_at: string | null
  sync_status: 'pending' | 'syncing' | 'ready' | 'error'
  sync_error: string | null
  backfilled_at: string | null
  newest_signature: string | null
  last_synced_at: string | null
  created_at: string
}

export async function walletsOf(owner: string): Promise<Wallet[]> {
  return sql<Wallet>`SELECT * FROM wallets WHERE owner = ${owner} ORDER BY created_at`
}

export async function walletById(owner: string, walletId: string): Promise<Wallet | null> {
  const [w] = await sql<Wallet>`SELECT * FROM wallets WHERE id = ${walletId} AND owner = ${owner}`
  return w ?? null
}

export async function walletByIdAny(walletId: string): Promise<Wallet | null> {
  const [w] = await sql<Wallet>`SELECT * FROM wallets WHERE id = ${walletId}`
  return w ?? null
}

export async function ensureUser(address: string) {
  await sql`INSERT INTO users (address) VALUES (${address}) ON CONFLICT DO NOTHING`
}

export async function createWallet(owner: string, address: string, label: string, template: TemplateId): Promise<Wallet> {
  await ensureUser(owner)
  const wid = id('wal')
  const [w] = await sql<Wallet>`
    INSERT INTO wallets (id, owner, address, label) VALUES (${wid}, ${owner}, ${address}, ${label})
    ON CONFLICT (owner, address) DO NOTHING RETURNING *`
  if (!w) throw new Error('You are already monitoring this address.')
  await sql`INSERT INTO policies (wallet_id, version, template, policy, created_by) VALUES (${wid}, 1, ${template}, ${templatePolicy(template)}, ${owner})`
  return w
}

export async function currentPolicy(walletId: string): Promise<{ version: number; template: string | null; policy: Policy; created_at: string }> {
  const [p] = await sql<{ version: number; template: string | null; policy: Policy; created_at: string }>`
    SELECT version, template, policy, created_at FROM policies WHERE wallet_id = ${walletId} ORDER BY version DESC LIMIT 1`
  if (!p) return { version: 0, template: 'payer', policy: templatePolicy('payer'), created_at: new Date().toISOString() }
  return { ...p, policy: { ...templatePolicy('payer'), ...p.policy } }
}

export async function savePolicy(walletId: string, policy: Policy, by: string, template: string | null) {
  const cur = await currentPolicy(walletId)
  const version = cur.version + 1
  await sql`INSERT INTO policies (wallet_id, version, template, policy, created_by) VALUES (${walletId}, ${version}, ${template}, ${policy}, ${by})`
  return version
}

/** Recipients this wallet has paid before (from monitored history and approved checks). */
export async function knownRecipients(walletId: string, addresses: string[]): Promise<Set<string>> {
  if (!addresses.length) return new Set()
  const rows = await sql<{ r: string }>`
    SELECT DISTINCT unnest(recipients) AS r FROM events WHERE wallet_id = ${walletId} AND NOT failed AND recipients && ${addresses}::text[]`
  return new Set(rows.map((r) => r.r))
}

export async function outflowHistory(walletId: string) {
  const [h] = await sql<{ out24: number | null; n1h: string }>`
    SELECT
      COALESCE(SUM(outflow_usd) FILTER (WHERE ts > now() - interval '24 hours'), 0) AS out24,
      COUNT(*) FILTER (WHERE ts > now() - interval '1 hour' AND signed_by_wallet) AS n1h
    FROM events WHERE wallet_id = ${walletId} AND NOT failed`
  const [c] = await sql<{ out24: number | null; n1h: string }>`
    SELECT COALESCE(SUM(outflow_usd) FILTER (WHERE created_at > now() - interval '24 hours'), 0) AS out24,
           COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour') AS n1h
    FROM checks WHERE wallet_id = ${walletId} AND enforced = 'approve' AND status IN ('approved', 'cosigned')`
  return {
    outflowUsd24h: Number(h?.out24 ?? 0) + Number(c?.out24 ?? 0),
    txCount1h: Number(h?.n1h ?? 0) + Number(c?.n1h ?? 0),
  }
}

export async function outflowSamples(walletId: string) {
  return sql<{ ts: number; usd: number }>`
    SELECT EXTRACT(EPOCH FROM ts)::float8 AS ts, outflow_usd AS usd FROM events
    WHERE wallet_id = ${walletId} AND NOT failed AND outflow_usd > 0 AND ts > now() - interval '30 days'`
}
