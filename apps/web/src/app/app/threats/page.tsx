'use client'

import { useState } from 'react'
import { useApi, send, get } from '@/lib/api'
import { isAddressLike, timeAgo } from '@/lib/format'
import { Address, Button, Card, CardHeader, Empty, ErrorNote, Field, Input, LoadingBlock, PageHeader, Pill, Select, Stat, Textarea } from '@/components/ui'

interface Threats {
  entities: { kind: string; key: string; score: number; reasons: string[]; updated_at: string; signals: { confirmed?: string } }[]
  blocked: { address: string; blocks: string; customers: string; last_seen: string }[]
  reports: { id: string; key: string; category: string; note: string | null; status: string; created_at: string }[]
  network: { checks: number; customers: number }
  categories: string[]
}

export default function ThreatsPage() {
  const { data, error, loading, reload } = useApi<Threats>('threats')
  return (
    <>
      <PageHeader title="Threat Network" sub="Shared reputation built from every check across Warden, confirmed reports and live onchain signals. Each blocked attack protects every customer." />
      <Lookup />
      {loading && !data ? <LoadingBlock /> : <ErrorNote error={error} onRetry={reload} />}
      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line lg:grid-cols-3">
            <div className="bg-surface px-4 py-4 sm:px-5"><Stat label="Checks scored" value={data.network.checks.toLocaleString()} /></div>
            <div className="bg-surface px-4 py-4 sm:px-5"><Stat label="Flagged entities" value={data.entities.length} /></div>
            <div className="col-span-2 bg-surface px-4 py-4 sm:px-5 lg:col-span-1"><Stat label="Addresses blocked, 30d" value={data.blocked.length} /></div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader title="Flagged addresses" sub="Score 0 (clean) to 100 (known bad), with the reasons behind it" />
              {data.entities.length ? (
                <ul className="divide-y divide-line">
                  {data.entities.map((e) => (
                    <li key={`${e.kind}:${e.key}`} className="px-4 py-3 sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <Address value={e.key} n={6} />
                        <span className="flex items-center gap-2">{e.signals?.confirmed && <Pill tone="bad">Confirmed {e.signals.confirmed}</Pill>}<Pill tone={e.score >= 90 ? 'bad' : e.score >= 50 ? 'warn' : 'neutral'}>{e.score}</Pill></span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-muted">{e.reasons.join(' · ')}</p>
                    </li>
                  ))}
                </ul>
              ) : <Empty title="Nothing flagged yet" body="Entities appear as checks are blocked, reports are confirmed and fresh addresses are seen." />}
            </Card>
            <div className="space-y-6">
              <Card className="overflow-hidden">
                <CardHeader title="Most blocked, 30 days" sub="Across all customers. Your context is never shared, only entity-level signals." />
                {data.blocked.length ? (
                  <ul className="divide-y divide-line">
                    {data.blocked.map((b) => (
                      <li key={b.address} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] sm:px-5">
                        <Address value={b.address} n={6} />
                        <span className="text-muted"><span className="tnum text-ink">{b.blocks}</span> blocks · {b.customers} customer{b.customers === '1' ? '' : 's'} · {timeAgo(b.last_seen)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <Empty title="No blocks yet" />}
              </Card>
              <Report categories={data.categories} reports={data.reports} onDone={reload} />
            </div>
          </div>
          <p className="mt-6 text-[12.5px] text-muted">Sources today: blocks across Warden, user reports (confirmed by reviewers) and account age from the chain. Public scam lists and funding-graph signals are next.</p>
        </>
      )}
    </>
  )
}

function Lookup() {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<{ entity: string; score: number; reasons: string[]; denylisted: boolean; age_days: number | null } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  return (
    <Card className="mb-6 p-4 sm:p-5">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
        e.preventDefault()
        if (!isAddressLike(q)) { setErr('Enter a valid Solana address.'); return }
        setBusy(true); setErr(null); setRes(null)
        try { setRes(await get(`reputation/${q.trim()}`)) } catch (e2) { setErr((e2 as Error).message) } finally { setBusy(false) }
      }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Look up any Solana address" className="font-mono text-[13px]" spellCheck={false} />
        <Button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Check reputation'}</Button>
      </form>
      {err && <p className="mt-2 text-[13px] text-bad">{err}</p>}
      {res && (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-line pt-4">
          <div>
            <Address value={res.entity} n={8} />
            <p className="mt-1 text-[13px] text-muted">{res.reasons.length ? res.reasons.join(' · ') : 'No risk signals.'}{res.age_days !== null && res.age_days > 0 ? ` · First seen ${Math.round(res.age_days)} days ago` : ''}</p>
          </div>
          <Pill tone={res.denylisted || res.score >= 90 ? 'bad' : res.score >= 30 ? 'warn' : 'ok'}>Score {res.score}</Pill>
        </div>
      )}
    </Card>
  )
}

function Report({ categories, reports, onDone }: { categories: string[]; reports: Threats['reports']; onDone: () => void }) {
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState(categories[0] ?? 'other')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader title="Report an address" sub="Reports are reviewed before they block anyone. Unconfirmed reports only raise the score." />
      <form className="space-y-3 px-4 py-4 sm:px-5" onSubmit={async (e) => {
        e.preventDefault()
        try { await send('reports', 'POST', { address: address.trim(), category, note }); setAddress(''); setNote(''); setMsg('Thanks. The report is pending review.'); onDone() } catch (e2) { setMsg((e2 as Error).message) }
      }}>
        <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} className="font-mono text-[13px]" spellCheck={false} required /></Field>
        <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="What happened"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        <div className="flex items-center gap-3"><Button type="submit">Submit report</Button>{msg && <span className="text-[13px] text-muted">{msg}</span>}</div>
      </form>
      {reports.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] sm:px-5">
              <span className="min-w-0"><Address value={r.key} /> <span className="text-muted">· {r.category}</span></span>
              <Pill tone={r.status === 'confirmed' ? 'bad' : r.status === 'rejected' ? 'neutral' : 'warn'}>{r.status}</Pill>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
