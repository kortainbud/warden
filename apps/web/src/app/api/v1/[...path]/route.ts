import { handle } from '@/server/api'

type Ctx = { params: Promise<{ path: string[] }> }
const go = async (req: Request, ctx: Ctx) => handle(req, (await ctx.params).path)

export const GET = go
export const POST = go
export const PATCH = go
export const DELETE = go
export const maxDuration = 60
