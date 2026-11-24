'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useApi, get } from '@/lib/api'
import type { CheckRow, WalletRow } from '@/lib/types'
import { Button, ButtonLink, Card, Empty, ErrorNote, LoadingBlock, PageHeader, Select } from '@/components/ui'
import { CheckLine } from '@/components/checks'

export default function ChecksPage() {
  return <Suspense fallback={<LoadingBlock />}><Checks /></Suspense>
}

function Checks() {
  const router = useRouter()
  const sp = useSearchParams()
  const wallet = sp.get('wallet') ?? ''
  const verdict = sp.get('verdict') ?? ''
  const set = (k: string, v: string) => {
    const q = new URLSearchParams(sp.toString())
    if (v) q.set(k, v); else q.delete(k)
    router.replace(`/app/checks${q.toString() ? `?${q}` : ''}`, { scroll: false })
  }
  const qs = new URLSearchParams({ limit: '50', ...(wallet ? { wallet } : {}), ...(verdict ? { verdict } : {}) })
  const { data, error, loading, reload } = useApi<{ data: CheckRow[] }>(`checks?${qs}`, { poll: 20_000 })
  const wallets = useApi<{ data: WalletRow[] }>('wallets')
  const [more, setMore] = useState<CheckRow[]>([])
  const [busy, setBusy] = useState(false)
  const rows = [...(data?.data ?? []), ...more.filter((m) => !data?.data.some((d) => d.id === m.id))]

  return (
    <>
      <PageHeader title="Checks" sub="Every transaction your agents sent to Warden, with the verdict, the reasons and the timings." actions={<ButtonLink href="/app/test" variant="primary">Test a transaction</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={wallet} onChange={(e) => { setMore([]); set('wallet', e.target.value) }} className="w-auto min-w-[160px]" aria-label="Wallet">
          <option value="">All wallets</option>
          {wallets.data?.data.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
        </Select>
        <Select value={verdict} onChange={(e) => { setMore([]); set('verdict', e.target.value) }} className="w-auto min-w-[140px]" aria-label="Verdict">
          <option value="">All verdicts</option>
          <option value="approve">Approve</option>
          <option value="hold">Hold</option>
          <option value="block">Block</option>
        </Select>
      </div>
      {loading && !data ? <LoadingBlock /> : <ErrorNote error={error} onRetry={reload} />}
      {data && (rows.length ? (
        <>
          <Card className="divide-y divide-line overflow-hidden">{rows.map((c) => <CheckLine key={c.id} c={c} />)}</Card>
          {rows.length >= 50 && rows.length % 50 === 0 && (
            <div className="mt-4 flex justify-center">
              <Button disabled={busy} onClick={async () => {
                setBusy(true)
                try {
                  const last = rows[rows.length - 1]!
                  const r = await get<{ data: CheckRow[] }>(`checks?${qs}&before=${encodeURIComponent(last.created_at)}`)
                  setMore((m) => [...m, ...r.data])
                } finally { setBusy(false) }
              }}>{busy ? 'Loading…' : 'Load more'}</Button>
            </div>
          )}
        </>
      ) : (
        <Card><Empty title="No checks yet" body="Checks appear when an agent calls the API or the SDK, or when you run a test transaction." action={<ButtonLink href="/app/test">Run a test</ButtonLink>} /></Card>
      ))}
    </>
  )
}
