'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from '@/components/icons'

const LABELS: [RegExp, string][] = [
  [/^\/app\/approvals/, 'Approvals'],
  [/^\/app\/wallets\/[^/?]+/, 'wallet'],
  [/^\/app\/wallets/, 'Wallets'],
  [/^\/app\/checks/, 'Checks'],
  [/^\/app\/alerts/, 'Alerts'],
  [/^\/app\/threats/, 'Threat Network'],
  [/^\/app\/test/, 'Test a transaction'],
  [/^\/app\/settings/, 'Settings'],
  [/^\/app$/, 'Overview'],
]

/** Origin-aware back: returns to the exact page the user came from (with its query), else a fallback. */
export default function Back({ fallback, fallbackLabel }: { fallback: string; fallbackLabel: string }) {
  const router = useRouter()
  const [prev, setPrev] = useState<string | null>(null)
  useEffect(() => {
    try {
      const stack: string[] = JSON.parse(sessionStorage.getItem('warden.nav') ?? '[]')
      const here = window.location.pathname + window.location.search
      const i = stack.lastIndexOf(here)
      const p = i > 0 ? stack[i - 1] : stack.length >= 2 && stack[stack.length - 1] !== here ? stack[stack.length - 1] : null
      setPrev(p && p !== here ? p : null)
    } catch { /* ignore */ }
  }, [])
  const label = prev ? LABELS.find(([re]) => re.test(prev.split('?')[0]!))?.[1] ?? 'previous page' : fallbackLabel
  return (
    <Link
      href={prev ?? fallback}
      onClick={(e) => {
        if (prev) {
          e.preventDefault()
          router.back()
        }
      }}
      className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
    >
      <ArrowLeft size={14} />Back to {label === 'wallet' ? 'wallet' : label}
    </Link>
  )
}
