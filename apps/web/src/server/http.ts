import 'server-only'
import { jsonReplacer } from './db'
import { CheckError } from './check'
import { anyOwner, sessionOwner } from './auth'
import { walletById, type Wallet } from './repo'
import { sql } from './db'

export function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, jsonReplacer), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  })
}

export const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  reply(status, { error: { code, message, ...extra } })

type Handler = (req: Request, owner: string) => Promise<Response>

/** Wrap a handler with auth and error handling. `session` = dashboard only; `any` = session or API key. */
export function route(auth: 'session' | 'any', h: Handler) {
  return async (req: Request): Promise<Response> => {
    try {
      const owner = auth === 'session' ? await sessionOwner(req) : await anyOwner(req)
      if (!owner) return fail(401, 'UNAUTHORIZED', auth === 'session' ? 'Sign in with your wallet first.' : 'Send a valid API key as "Authorization: Bearer wk_live_..." or sign in.')
      return await h(req, owner)
    } catch (e) {
      if (e instanceof CheckError) return fail(e.status, e.code, e.message)
      if (e instanceof HttpError) return fail(e.status, e.code, e.message)
      console.error(e)
      return fail(500, 'INTERNAL', (e as Error).message || 'Something went wrong.')
    }
  }
}

export class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be JSON.')
  }
}

/** Wallet by id or address, owned by `owner`. */
export async function ownedWallet(owner: string, ref: string): Promise<Wallet> {
  let w = await walletById(owner, ref)
  if (!w) {
    const [x] = await sql<Wallet>`SELECT * FROM wallets WHERE owner = ${owner} AND (address = ${ref} OR vault = ${ref} OR smart_account = ${ref})`
    w = x ?? null
  }
  if (!w) throw new HttpError(404, 'WALLET_NOT_FOUND', 'No wallet with that id or address in your workspace.')
  return w
}

export const segment = (req: Request, index: number) => decodeURIComponent(new URL(req.url).pathname.split('/').filter(Boolean)[index] ?? '')
