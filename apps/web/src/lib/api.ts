'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signWithOwnerWallet, useSession } from './session'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function raw<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T & { error?: { code: string; message: string; confirm?: { action: string; nonce: string; issuedAt: string; message: string } } } }> {
  const res = await fetch(`/api/v1/${path}`, { cache: 'no-store', ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

export async function get<T>(path: string): Promise<T> {
  const { status, body } = await raw<T>(path)
  if (status >= 400) throw new ApiError(status, body.error?.code ?? 'ERROR', body.error?.message ?? 'Request failed.')
  return body
}

/**
 * Mutations. If the server answers 428 (the change weakens protection), ask the owner's wallet to
 * sign the confirmation and resend once.
 */
export async function send<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown> = {}): Promise<T> {
  let { status, body } = await raw<T>(path, { method, body: JSON.stringify(payload) })
  if (status === 428 && body.error?.confirm) {
    const owner = useSession.getState().address
    if (!owner) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in again to confirm this change.')
    const c = body.error.confirm
    const signature = await signWithOwnerWallet(owner, c.message)
    ;({ status, body } = await raw<T>(path, { method, body: JSON.stringify({ ...payload, confirmation: { nonce: c.nonce, issuedAt: c.issuedAt, signature } }) }))
  }
  if (status >= 400) throw new ApiError(status, body.error?.code ?? 'ERROR', body.error?.message ?? 'Request failed.')
  return body
}

/** Fetch on mount and on demand; optional polling while the tab is visible. */
export function useApi<T>(path: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(!!path)
  const seq = useRef(0)
  const load = useCallback(async () => {
    if (!path) return
    const n = ++seq.current
    try {
      const d = await get<T>(path)
      if (n === seq.current) { setData(d); setError(null) }
    } catch (e) {
      if (n === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, 'NETWORK', 'Network error.'))
    } finally {
      if (n === seq.current) setLoading(false)
    }
  }, [path])
  useEffect(() => {
    setLoading(!!path)
    void load()
    if (!opts.poll) return
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load() }, opts.poll)
    return () => clearInterval(t)
  }, [load, opts.poll, path])
  return { data, error, loading, reload: load, setData }
}
