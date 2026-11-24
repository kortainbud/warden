// @warden/sdk — check agent transactions with Warden before signing.
// Zero dependencies; works anywhere `fetch` exists (Node 18+, Bun, Deno, edge runtimes).

export type ContextSource = 'owner' | 'system' | 'schedule' | 'agent' | 'tool_output' | 'web' | 'social' | 'onchain' | 'payment_request'

export interface ContextItem { source: ContextSource; origin?: string; excerpt?: string; hash?: string }

export interface Context {
  task?: { text: string; source: ContextSource; ts?: string }
  trigger?: ContextItem
  recent_inputs?: ContextItem[]
  agent_reasoning?: string
}

export interface Reason { code: string; stage: string; severity: 'block' | 'hold' | 'info'; message: string }

export interface CheckResult {
  id: string
  wallet_id: string
  verdict: 'approve' | 'hold' | 'block'
  enforced: 'approve' | 'hold' | 'block'
  status: 'approved' | 'held' | 'blocked'
  mode: 'shadow' | 'enforce'
  score: number
  summary: string
  reasons: Reason[]
  simulated: { ok: boolean; error?: string; vault_delta: { mint: string; symbol: string; amount: string; usd: number | null }[] }
  /** Warden-co-signed transaction (base64) for protected wallets; null otherwise. */
  transaction: string | null
  latency_ms: number
  expires_at: string | null
}

export interface PaymentRequest { payTo: string; maxAmountRequired: string; asset: string; resource: string; description?: string; network?: string }

/** Anything with a `serialize()` (web3.js Transaction or VersionedTransaction), raw bytes, or base64. */
export type TransactionLike = string | Uint8Array | { serialize(config?: { requireAllSignatures?: boolean; verifySignatures?: boolean }): Uint8Array }

export class WardenError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'WardenError'
    this.status = status
    this.code = code
  }
}

export class WardenBlocked extends Error {
  readonly check: CheckResult
  constructor(check: CheckResult) {
    super(`Warden blocked this transaction: ${check.reasons.find((r) => r.severity === 'block')?.message ?? check.summary}`)
    this.name = 'WardenBlocked'
    this.check = check
  }
}

export class WardenHeld extends Error {
  readonly check: CheckResult
  constructor(check: CheckResult) {
    super(`Warden is holding this transaction for owner approval (${check.id}).`)
    this.name = 'WardenHeld'
    this.check = check
  }
}

export interface WardenOptions {
  apiKey: string
  /** Warden id or address of the wallet this agent signs with. */
  wallet: string
  /** Your Warden deployment, e.g. https://warden.example.com */
  baseUrl: string
  agentName?: string
  /** Request timeout in ms (default 5000). */
  timeoutMs?: number
  fetch?: typeof fetch
}

function toBase64(tx: TransactionLike): string {
  if (typeof tx === 'string') return tx
  const bytes = tx instanceof Uint8Array ? tx : tx.serialize({ requireAllSignatures: false, verifySignatures: false })
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

export class Warden {
  private readonly opts: Required<Omit<WardenOptions, 'agentName' | 'fetch'>> & Pick<WardenOptions, 'agentName'>
  private readonly f: typeof fetch

  constructor(opts: WardenOptions) {
    if (!opts.apiKey) throw new Error('Warden: apiKey is required')
    if (!opts.wallet) throw new Error('Warden: wallet is required')
    if (!opts.baseUrl) throw new Error('Warden: baseUrl is required')
    this.opts = { timeoutMs: 5000, ...opts, baseUrl: opts.baseUrl.replace(/\/$/, '') }
    this.f = opts.fetch ?? globalThis.fetch.bind(globalThis)
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response
    try {
      res = await this.f(`${this.opts.baseUrl}/v1/${path}`, {
        method,
        headers: { authorization: `Bearer ${this.opts.apiKey}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      })
    } catch (e) {
      // Fail closed: an unreachable firewall is never treated as approval.
      throw new WardenError(0, 'UNREACHABLE', `Warden is unreachable: ${(e as Error).message}`)
    }
    const json = (await res.json().catch(() => ({}))) as T & { error?: { code: string; message: string } }
    if (!res.ok) throw new WardenError(res.status, json.error?.code ?? 'ERROR', json.error?.message ?? `Warden responded ${res.status}`)
    return json
  }

  /** Check a transaction. Returns the verdict; does not throw on block or hold. */
  check(tx: TransactionLike, context?: Context | null): Promise<CheckResult> {
    return this.call('POST', 'check', { wallet: this.opts.wallet, transaction: toBase64(tx), context: context ?? null, agent_name: this.opts.agentName })
  }

  /** Check and throw `WardenBlocked` / `WardenHeld` unless the transaction is approved. */
  async guard(tx: TransactionLike, context?: Context | null): Promise<CheckResult> {
    const r = await this.check(tx, context)
    if (r.status === 'blocked') throw new WardenBlocked(r)
    if (r.status === 'held') throw new WardenHeld(r)
    return r
  }

  /** x402 / pay.sh: check a payment request before paying it. */
  async prepay(paymentRequest: PaymentRequest, context?: Context | null) {
    return this.call<{ id: string; status: 'approved' | 'held' | 'blocked'; verdict: string; summary: string; reasons: Reason[] }>(
      'POST', 'prepay', { wallet: this.opts.wallet, payment_request: paymentRequest, context: context ?? null, agent_name: this.opts.agentName })
  }

  getCheck(id: string) {
    return this.call<CheckResult & { decision: string | null }>('GET', `checks/${encodeURIComponent(id)}`)
  }

  /** Resolve when the owner approves a held check; throw WardenBlocked if denied or expired. */
  async waitForApproval(id: string, { pollMs = 3000, timeoutMs = 60 * 60_000 }: { pollMs?: number; timeoutMs?: number } = {}): Promise<CheckResult> {
    const end = Date.now() + timeoutMs
    for (;;) {
      const c = await this.getCheck(id)
      if (c.status === 'approved') return c
      if ((c.status as string) !== 'held') throw new WardenBlocked(c)
      if (Date.now() > end) throw new WardenError(408, 'APPROVAL_TIMEOUT', 'Gave up waiting for owner approval.')
      await new Promise((r) => setTimeout(r, pollMs))
    }
  }

  /** Kill switch for this wallet. Unfreezing needs the owner's wallet signature in the dashboard. */
  freeze() {
    return this.call<{ id: string; frozen: boolean }>('POST', `wallets/${encodeURIComponent(this.opts.wallet)}/freeze`)
  }
}
