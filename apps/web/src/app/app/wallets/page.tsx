'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Plus, Snowflake } from '@/components/icons'
import { useApi, send } from '@/lib/api'
import { isAddressLike, short, timeAgo, usd } from '@/lib/format'
import type { WalletRow } from '@/lib/types'
import { Button, Card, Empty, ErrorNote, Field, Input, LoadingBlock, PageHeader, Pill, Select, Spinner } from '@/components/ui'

export default function WalletsPage() {
  return <Suspense fallback={<LoadingBlock />}><Wallets /></Suspense>
}

function Wallets() {
  const router = useRouter()
  const sp = useSearchParams()
  const adding = sp.get('add') === '1'
  const setAdding = (v: boolean) => router.replace(v ? '/app/wallets?add=1' : '/app/wallets', { scroll: false })
  const { data, error, loading, reload } = useApi<{ data: WalletRow[] }>('wallets', { poll: 30_000 })

  return (
    <>
      <PageHeader
        title="Wallets"
        sub="Every agent wallet Warden watches. Monitoring works on any address with no code."
        actions={!adding && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} weight="bold" />Add wallet</Button>}
      />
      {adding && <AddWallet onCancel={() => setAdding(false)} onAdded={(id) => router.push(`/app/wallets/${id}`)} />}
      {loading && !data ? <LoadingBlock /> : <ErrorNote error={error} onRetry={reload} />}
      {data && (data.data.length ? (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] gap-4 border-b border-line px-5 py-2.5 text-[12.5px] text-muted md:grid">
            <span>Wallet</span><span>Mode</span><span className="text-right">Out, 24h</span><span className="text-right">Transactions</span><span className="text-right">Last activity</span>
          </div>
          <ul className="divide-y divide-line">
            {data.data.map((w) => (
              <li key={w.id}>
                <Link href={`/app/wallets/${w.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-sunken/60 sm:px-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] md:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[14px] font-medium">{w.label}{w.frozen && <Pill tone="bad"><Snowflake size={11} weight="bold" />Frozen</Pill>}</div>
                    <div className="truncate font-mono text-[12.5px] text-muted">{short(w.address, 6)}</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 md:justify-start">
                    <Pill tone={w.mode === 'enforce' ? 'ok' : 'info'}>{w.mode === 'enforce' ? 'Enforce' : 'Shadow'}</Pill>
                    <Pill>{w.kind === 'protected' ? 'Protected' : 'Monitor'}</Pill>
                    {w.sync_status === 'syncing' && <Spinner className="size-3.5" />}
                    {w.sync_status === 'error' && <Pill tone="bad">Sync error</Pill>}
                  </div>
                  <div className="tnum text-[13.5px] text-muted md:text-right md:text-ink">{usd(w.outflow_usd_24h)}<span className="md:hidden"> out today</span></div>
                  <div className="tnum hidden text-right text-[13.5px] md:block">{w.events.toLocaleString()}</div>
                  <div className="text-right text-[13px] text-muted">{timeAgo(w.last_activity)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : !adding && (
        <Card><Empty title="No wallets yet" body="Add the address your agent signs with. Warden backfills 30 days and starts watching." action={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={15} weight="bold" />Add wallet</Button>} /></Card>
      ))}
    </>
  )
}

function AddWallet({ onCancel, onAdded }: { onCancel: () => void; onAdded: (id: string) => void }) {
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [template, setTemplate] = useState('payer')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const valid = isAddressLike(address)
  return (
    <Card className="mb-6 p-4 sm:p-5">
      <form
        className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valid) { setErr('Enter a valid Solana address.'); return }
          setBusy(true)
          setErr(null)
          try {
            const w = await send<{ id: string }>('wallets', 'POST', { address: address.trim(), label, template })
            onAdded(w.id)
          } catch (e2) {
            setErr((e2 as Error).message)
            setBusy(false)
          }
        }}
      >
        <Field label="Agent wallet address" error={err} hint="The public address only. Warden never asks for keys.">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 7xKX…gAsU" autoFocus spellCheck={false} className="font-mono text-[13px]" />
        </Field>
        <Field label="Name">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Scout" maxLength={40} />
        </Field>
        <Field label="Policy template" hint="You can change it later.">
          <Select value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="payer">Payer: pays for APIs and compute</option>
            <option value="trader">Trader: swaps all day</option>
            <option value="treasury">Treasury: rare, allowlisted moves</option>
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-2 md:col-span-3">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? <><Spinner className="size-3.5 border-white/40 border-t-white" />Adding…</> : "Start monitoring"}</Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <span className="text-[12.5px] text-muted">New wallets start in shadow mode: Warden scores everything and blocks nothing.</span>
        </div>
      </form>
    </Card>
  )
}
