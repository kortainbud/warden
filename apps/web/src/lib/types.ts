import type { Policy } from '@warden/engine'

export interface Reason { code: string; stage: string; severity: 'block' | 'hold' | 'info'; message: string }
export interface StageResult { stage: string; score: number; reasons: Reason[] }

export interface CheckRow {
  id: string
  wallet_id: string
  wallet_label: string
  created_at: string
  origin: 'api' | 'playground' | 'prepay'
  endpoint: string | null
  summary: string
  outflows: { mint: string; symbol: string; amount: string; usd: number | null }[]
  outflow_usd: number | null
  recipients: { address: string; isNew: boolean; score: number; reasons: string[] }[]
  programs: string[]
  stages: StageResult[]
  reasons: Reason[]
  score: number
  verdict: 'approve' | 'hold' | 'block'
  enforced: 'approve' | 'hold' | 'block'
  mode: 'shadow' | 'enforce'
  model_used: boolean
  context_excerpt: {
    task?: { source: string; text: string } | null
    trigger?: { source: string; origin?: string | null; excerpt?: string | null } | null
    inputs?: { source: string; origin?: string | null; excerpt?: string | null }[]
    resource?: string
    description?: string | null
  } | null
  latency_ms: number
  stage_ms: Record<string, number>
  status: 'approved' | 'held' | 'blocked' | 'denied' | 'expired'
  expires_at: string | null
  decision: string | null
  decided_by: string | null
  decided_at: string | null
}

export interface WalletRow {
  id: string
  address: string
  label: string
  kind: 'monitor' | 'protected'
  frozen: boolean
  frozen_at: string | null
  sync_status: 'pending' | 'syncing' | 'ready' | 'error'
  sync_error: string | null
  backfilled_at: string | null
  last_synced_at: string | null
  created_at: string
  mode: 'shadow' | 'enforce'
  template: string | null
  events: number
  outflow_usd_24h: number
  last_activity: string | null
  daily_cap_usd: number | null
}

export interface WalletDetail extends Omit<WalletRow, 'events' | 'outflow_usd_24h' | 'last_activity' | 'mode' | 'daily_cap_usd'> {
  policy: Policy
  policy_version: number
  stats: { events: number; outflow_usd_24h: number; outflow_usd_30d: number; recipients: number }
}

export interface EventRow {
  signature: string
  ts: string
  type: string
  source: string
  description: string
  outflow_usd: number | null
  inflow_usd: number | null
  outflow_unpriced: boolean
  recipients: string[]
  counterparties: string[]
  programs: string[]
  failed: boolean
  signed_by_wallet: boolean
}

export interface AlertRow {
  id: string
  wallet_id: string | null
  wallet_label: string | null
  created_at: string
  severity: 'info' | 'warning' | 'critical'
  type: string
  title: string
  body: string
  ref: string | null
  read_at: string | null
  delivered: { channel: string; ok: boolean; error?: string }[]
}
