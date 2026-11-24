import { clearCookie, newNonce, originOf, sessionCookie, sessionOwner, verifySignIn } from '@/server/auth'
import { reply } from '@/server/http'
import { isDemo } from '@/server/env'

type Ctx = { params: Promise<{ op: string }> }

export async function GET(req: Request, ctx: Ctx) {
  const { op } = await ctx.params
  try {
    if (op === 'me') return reply(200, { address: await sessionOwner(req), demo: isDemo() })
    if (op === 'nonce') {
      const { domain, uri } = originOf(req)
      return reply(200, { ...(await newNonce()), domain, uri })
    }
  } catch {
    return reply(503, { error: 'Sign-in is not configured on this server yet.' })
  }
  return reply(404, { error: 'Unknown auth operation.' })
}

export async function POST(req: Request, ctx: Ctx) {
  const { op } = await ctx.params
  if (op === 'logout') return reply(200, { address: null }, { 'set-cookie': clearCookie })
  if (op === 'verify') {
    try {
      const r = await verifySignIn(req, await req.json())
      if (!r.ok) return reply(401, { error: 'Signature could not be verified.', reason: r.reason })
      return reply(200, { address: r.address }, { 'set-cookie': await sessionCookie(r.address, originOf(req).secure) })
    } catch (e) {
      console.error(e)
      return reply(500, { error: 'Sign-in failed.' })
    }
  }
  return reply(404, { error: 'Unknown auth operation.' })
}
