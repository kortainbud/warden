import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Warden, WardenBlocked, WardenError, WardenHeld } from '../src/index.ts'

const result = (status: string) => ({ id: 'chk_1', wallet_id: 'w', verdict: 'block', enforced: 'block', status, mode: 'enforce', score: 100, summary: 's', reasons: [{ code: 'CAP_EXCEEDED', stage: 'rules', severity: 'block', message: 'too much' }], simulated: { ok: true, vault_delta: [] }, transaction: null, latency_ms: 10, expires_at: null })

function fake(status: number, body: unknown, seen: { url?: string; init?: RequestInit } = {}) {
  return (async (url: string, init: RequestInit) => { seen.url = url; seen.init = init; return new Response(JSON.stringify(body), { status }) }) as unknown as typeof fetch
}

test('check sends base64, auth and context', async () => {
  const seen: { url?: string; init?: RequestInit } = {}
  const w = new Warden({ apiKey: 'wk_live_x', wallet: 'W', baseUrl: 'https://w.example/', fetch: fake(200, result('approved'), seen) })
  const r = await w.check(new Uint8Array([1, 2, 3]), { task: { text: 't', source: 'owner' } })
  assert.equal(r.status, 'approved')
  assert.equal(seen.url, 'https://w.example/v1/check')
  const body = JSON.parse(String(seen.init!.body))
  assert.equal(body.transaction, 'AQID')
  assert.equal((seen.init!.headers as Record<string, string>).authorization, 'Bearer wk_live_x')
})

test('guard throws typed errors', async () => {
  const blocked = new Warden({ apiKey: 'k', wallet: 'W', baseUrl: 'https://w', fetch: fake(200, result('blocked')) })
  await assert.rejects(blocked.guard('AA=='), WardenBlocked)
  const held = new Warden({ apiKey: 'k', wallet: 'W', baseUrl: 'https://w', fetch: fake(200, result('held')) })
  await assert.rejects(held.guard('AA=='), WardenHeld)
})

test('API errors and unreachable firewall fail closed', async () => {
  const w = new Warden({ apiKey: 'k', wallet: 'W', baseUrl: 'https://w', fetch: fake(401, { error: { code: 'UNAUTHORIZED', message: 'bad key' } }) })
  await assert.rejects(w.check('AA=='), (e: unknown) => e instanceof WardenError && e.code === 'UNAUTHORIZED')
  const down = new Warden({ apiKey: 'k', wallet: 'W', baseUrl: 'https://w', fetch: (async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch })
  await assert.rejects(down.guard('AA=='), (e: unknown) => e instanceof WardenError && e.code === 'UNREACHABLE')
})
