'use client'

import { useApi } from '@/lib/api'
import type { CheckRow } from '@/lib/types'
import { Card, Empty, ErrorNote, LoadingBlock, PageHeader } from '@/components/ui'
import { CheckLine, HoldCard } from '@/components/checks'

export default function ApprovalsPage() {
  const pending = useApi<{ data: CheckRow[] }>('checks?status=held&limit=50', { poll: 10_000 })
  const decided = useApi<{ data: CheckRow[] }>('checks?verdict=hold&limit=30')
  const reload = () => { void pending.reload(); void decided.reload() }
  const past = (decided.data?.data ?? []).filter((c) => c.status !== 'held')
  return (
    <>
      <PageHeader title="Approvals" sub="Transactions Warden held for a human. No answer before the timeout means deny." />
      {pending.loading && !pending.data ? <LoadingBlock /> : <ErrorNote error={pending.error} onRetry={pending.reload} />}
      {pending.data && (
        pending.data.data.length ? (
          <div className="space-y-3">{pending.data.data.map((c) => <HoldCard key={c.id} c={c} onDone={reload} />)}</div>
        ) : (
          <Card><Empty title="Nothing waiting" body="When a wallet in enforce mode hits a hold, it shows up here and in your alert channels." /></Card>
        )
      )}
      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-[14px] font-semibold">Recently decided</h2>
          <Card className="divide-y divide-line overflow-hidden">{past.map((c) => <CheckLine key={c.id} c={c} />)}</Card>
        </section>
      )}
    </>
  )
}
