// Owner auth: Sign In With Solana for the dashboard (HMAC-signed session cookie), API keys for
// agents/SDK (Bearer wk_...), and signed owner confirmation for changes that weaken protection.

import 'server-only'
import { ed25519 } from '@noble/curves/ed25519.js'
import { parseSignInMessageText } from '@solana/wallet-standard-util'
import { base58Decode, base58Encode, isAddress } from '@warden/decoder'
import { signInMessage, confirmMessage } from '@/shared/siws'
import { sql } from './db'
import { id, isDemo, sha256Hex } from './env'
import { ensureUser } from './repo'

export const DEMO_OWNER = '8otZEsGpR2A8kKUCEB8WX7u19uxZHAm91m7cWsoSg3Wy'
const COOKIE = 'wd_session'
const SESSION_DAYS = 30
const NONCE_TTL_MS = 10 * 60_000
const enc = new TextEncoder()

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET is not configured.')
  return s
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return Buffer.from(await crypto.subtle.sign('HMAC', key, enc.encode(data))).toString('base64url')
}

export function originOf(req: Request) {
  const url = new URL(req.url)
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return { domain: host, uri: `${proto}://${host}`, secure: proto === 'https' }
}

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/** Signed-in owner address from the session cookie, or null. The demo is always signed in. */
export async function sessionOwner(req: Request): Promise<string | null> {
  if (isDemo()) return DEMO_OWNER
  try {
    const c = readCookie(req, COOKIE)
    if (!c) return null
    const [payload, sig] = c.split('.')
    if (!payload || !sig || (await hmac(payload)) !== sig) return null
    const { a, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { a: string; exp: number }
    return Date.now() < exp && isAddress(a) ? a : null
  } catch {
    return null
  }
}

async function nonceTag(rand: string, issuedAt: string, scope = 'siws') {
  return Buffer.from(await hmac(`${scope}|${rand}|${issuedAt}`), 'base64url').toString('hex').slice(0, 24)
}

export async function newNonce(scope = 'siws') {
  const rand = Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString('hex')
  const issuedAt = new Date().toISOString()
  return { nonce: `${rand}${await nonceTag(rand, issuedAt, scope)}`, issuedAt }
}

async function nonceValid(nonce: string, issuedAt: string, scope = 'siws') {
  if (!/^[0-9a-f]{40}$/.test(nonce) || (await nonceTag(nonce.slice(0, 16), issuedAt, scope)) !== nonce.slice(16)) return false
  const age = Date.now() - Date.parse(issuedAt)
  if (!(age > -60_000 && age < NONCE_TTL_MS)) return false
  const rows = await sql`INSERT INTO used_nonces (nonce) VALUES (${nonce}) ON CONFLICT DO NOTHING RETURNING nonce`
  if (Math.random() < 0.05) await sql`DELETE FROM used_nonces WHERE used_at < now() - interval '1 day'`
  return rows.length > 0
}

function verifySig(address: string, signature: string, bytes: Uint8Array) {
  try {
    return ed25519.verify(base58Decode(signature), bytes, base58Decode(address))
  } catch {
    return false
  }
}

export async function verifySignIn(req: Request, body: { address?: string; signature?: string; signedMessage?: string; nonce?: string; issuedAt?: string }) {
  const { address = '', signature = '' } = body
  if (!isAddress(address)) return { ok: false as const, reason: 'invalid address' }
  const { domain, uri } = originOf(req)
  const bytes = body.signedMessage
    ? new Uint8Array(Buffer.from(body.signedMessage, 'base64'))
    : enc.encode(signInMessage({ domain, uri, address, nonce: body.nonce ?? '', issuedAt: body.issuedAt ?? '' }))
  const p = parseSignInMessageText(new TextDecoder().decode(bytes))
  if (!p) return { ok: false as const, reason: 'unparseable message' }
  if (p.domain !== domain) return { ok: false as const, reason: 'domain mismatch' }
  if (p.address !== address) return { ok: false as const, reason: 'address mismatch' }
  if (p.chainId && !['mainnet', 'solana:mainnet'].includes(p.chainId)) return { ok: false as const, reason: 'wrong chain' }
  if (!verifySig(address, signature, bytes)) return { ok: false as const, reason: 'bad signature' }
  if (!(await nonceValid(p.nonce ?? '', p.issuedAt ?? ''))) return { ok: false as const, reason: 'expired or reused nonce' }
  await ensureUser(address)
  return { ok: true as const, address }
}

export async function sessionCookie(address: string, secure: boolean) {
  const payload = Buffer.from(JSON.stringify({ a: address, exp: Date.now() + SESSION_DAYS * 86_400_000 })).toString('base64url')
  return `${COOKIE}=${payload}.${await hmac(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${secure ? '; Secure' : ''}`
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`

// ---- API keys ----

export async function createApiKey(owner: string, name: string) {
  const raw = `wk_live_${base58Encode(crypto.getRandomValues(new Uint8Array(24)))}`
  const kid = id('key')
  await sql`INSERT INTO api_keys (id, owner, name, prefix, key_hash) VALUES (${kid}, ${owner}, ${name}, ${raw.slice(0, 12)}, ${await sha256Hex(raw)})`
  return { id: kid, key: raw }
}

/** Owner for a Bearer API key, or null. */
export async function apiKeyOwner(req: Request): Promise<string | null> {
  const h = req.headers.get('authorization') ?? ''
  const m = /^Bearer\s+(wk_(?:live|demo)_[1-9A-HJ-NP-Za-km-z]+)$/.exec(h.trim())
  if (!m) return null
  if (isDemo() && m[1]!.startsWith('wk_demo_')) return DEMO_OWNER
  const [k] = await sql<{ id: string; owner: string }>`SELECT id, owner FROM api_keys WHERE key_hash = ${await sha256Hex(m[1]!)} AND revoked_at IS NULL`
  if (!k) return null
  await sql`UPDATE api_keys SET last_used_at = now() WHERE id = ${k.id}`
  return k.owner
}

/** Session or API key. */
export async function anyOwner(req: Request) {
  return (await apiKeyOwner(req)) ?? (await sessionOwner(req))
}

// ---- owner confirmation for loosening changes ----

export interface Confirmation {
  nonce: string
  issuedAt: string
  signature: string
}

export async function confirmationChallenge(action: string, walletId: string) {
  const { nonce, issuedAt } = await newNonce('confirm')
  return { nonce, issuedAt, message: confirmMessage({ action, walletId, nonce, issuedAt }) }
}

/**
 * Policy loosening must be signed by the owner's wallet, not just a session (an API key or
 * stolen cookie alone cannot weaken protection). Skipped in the demo, which has no real wallet.
 */
export async function verifyConfirmation(owner: string, action: string, walletId: string, c: Confirmation | undefined) {
  if (isDemo()) return true
  if (!c) return false
  const bytes = enc.encode(confirmMessage({ action, walletId, nonce: c.nonce, issuedAt: c.issuedAt }))
  if (!verifySig(owner, c.signature, bytes)) return false
  return nonceValid(c.nonce, c.issuedAt, 'confirm')
}
