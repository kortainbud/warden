// Postgres access. Production uses Neon (DATABASE_URL). Without one, local dev uses an embedded
// PGlite database in .data/, and the demo uses an in-memory PGlite seeded with fixtures.

import 'server-only'
import { neon } from '@neondatabase/serverless'
import { SCHEMA } from './schema'
import { isDemo } from './env'

export type Row = Record<string, unknown>
type Query = (text: string, params: unknown[]) => Promise<Row[]>

let query: Query | null = null
let ready: Promise<void> | null = null

async function connect(): Promise<Query> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (url && !isDemo()) {
    const client = neon(url)
    return async (text, params) => (await client.query(text, params)) as Row[]
  }
  const { PGlite } = await import('@electric-sql/pglite')
  let pg
  if (isDemo()) pg = new PGlite()
  else {
    const { mkdirSync } = await import('node:fs')
    const dir = `${process.cwd()}/.data/pglite`
    mkdirSync(dir, { recursive: true })
    pg = new PGlite(dir)
  }
  await pg.waitReady
  return async (text, params) => (await pg.query<Row>(text, params)).rows
}

async function init() {
  const g = globalThis as unknown as { __wardenDb?: { query: Query; ready: Promise<void> } }
  if (g.__wardenDb) {
    query = g.__wardenDb.query
    ready = g.__wardenDb.ready
    return
  }
  const q = await connect()
  const r = (async () => {
    for (const stmt of SCHEMA) await q(stmt, [])
    if (isDemo()) {
      const { seedDemo } = await import('./demo/seed')
      await seedDemo((text, params) => q(text, params ?? []))
    }
  })()
  g.__wardenDb = { query: q, ready: r }
  query = q
  ready = r
}

let initing: Promise<void> | null = null

async function run(text: string, params: unknown[]): Promise<Row[]> {
  if (!query) {
    try {
      await (initing ??= init())
    } catch (e) {
      initing = null // let the next request retry
      throw e
    }
  }
  await ready
  return query!(text, params)
}

/** Tagged template: sql`SELECT * FROM t WHERE id = ${id}` (values become $n parameters). */
export async function sql<T = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = strings[0]!
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`
  return (await run(text, values.map(param))) as T[]
}

/** Plain parameterised query for dynamic SQL. */
export async function rawQuery<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await run(text, params.map(param))) as T[]
}

function param(v: unknown) {
  if (typeof v === 'bigint') return v.toString()
  if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) return JSON.stringify(v, jsonReplacer)
  return v
}

export function jsonReplacer(_k: string, v: unknown) {
  return typeof v === 'bigint' ? v.toString() : v
}

export const json = (v: unknown) => JSON.stringify(v, jsonReplacer)
