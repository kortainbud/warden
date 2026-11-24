'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, use, useEffect, useState } from 'react'
import { ArrowClockwise, ArrowSquareOut, Snowflake } from '@/components/icons'
import { programName } from '@warden/decoder'
import { TEMPLATES, type Policy } from '@warden/engine'
import { useApi, send, get } from '@/lib/api'
import { dateTime, short, solscan, timeAgo, usd } from '@/lib/format'
import type { CheckRow, EventRow, WalletDetail } from '@/lib/types'
import Back from '@/components/Back'
import { Address, Button, ButtonLink, Card, CardHeader, Empty, ErrorNote, Field, Input, LoadingBlock, PageHeader, Pill, Select, Spinner, Stat, StatStrip, Tabs, Textarea, Toggle, cx } from '@/components/ui'
import { CheckLine } from '@/components/checks'
import { DailyBars } from '@/components/charts'

type Tab = 'activity' | 'checks' | 'spend' | 'policy' | 'protect'

export default function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <Suspense fallback={<LoadingBlock />}><Wallet id={id} /></Suspense>
}

function Wallet({ id }: { id: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'activity'
  const setTab = (t: Tab) => router.replace(`/app/wallets/${id}${t === 'activity' ? '' : `?tab=${t}`}`, { scroll: false })
  const { data: w, error, loading, reload } = useApi<WalletDetail>(`wallets/${id}`, { poll: 15_000 })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  if (loading && !w) return <LoadingBlock />
  if (!w) return <><Back fallback="/app/wallets" fallbackLabel="Wallets" /><ErrorNote error={error} onRetry={reload} /></>

  const freeze = async () => {
    setBusy(true)
    setNote(null)
    try {
      await send(`wallets/${w.id}/${w.frozen ? 'unfreeze' : 'freeze'}`, 'POST')
      await reload()
    } catch (e) { setNote((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader
        back={<Back fallback="/app/wallets" fallbackLabel="Wallets" />}
        title={<span className="flex flex-wrap items-center gap-2">{w.label}{w.frozen && <Pill tone="bad"><Snowflake size={11} weight="bold" />Frozen</Pill>}<Pill tone={w.policy.mode === 'enforce' ? 'ok' : 'info'}>{w.policy.mode === 'enforce' ? 'Enforce' : 'Shadow'}</Pill></span>}
        sub={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><Address value={w.address} n={8} /><a href={solscan('account', w.address)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] hover:text-ink">Solscan<ArrowSquareOut size={12} /></a></span>}
        actions={
          <Button variant={w.frozen ? 'secondary' : 'danger'} disabled={busy} onClick={freeze}>
            <Snowflake size={15} weight="bold" />{w.frozen ? 'Unfreeze' : 'Freeze'}
          </Button>
        }
      />
      {note && <div className="mb-4"><ErrorNote error={{ message: note }} /></div>}
      {w.frozen && (
        <div className="mb-6 rounded-[14px] border border-bad/25 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">
          Frozen {timeAgo(w.frozen_at)}. Every check for this wallet is blocked.
          {w.kind === 'monitor' && ' This wallet is monitor-only: transactions signed without Warden still go through, so move funds with your own key if it is compromised.'}
        </div>
      )}

      <div className="mb-6"><StatStrip>{[
          <Stat key="a" label="Out, 24h" value={usd(w.stats.outflow_usd_24h)} sub={w.policy.dailyCapUsd !== null ? `Daily cap ${usd(w.policy.dailyCapUsd)}` : 'No daily cap'} />,
          <Stat key="b" label="Out, 30d" value={usd(w.stats.outflow_usd_30d, { compact: true })} />,
          <Stat key="c" label="Transactions" value={w.stats.events.toLocaleString()} sub="Last 30 days and since" />,
          <Stat key="d" label="Recipients paid" value={w.stats.recipients} />,
        ]}</StatStrip></div>

      <Tabs<Tab> value={tab} onChange={setTab} items={[
        { value: 'activity', label: 'Activity' }, { value: 'checks', label: 'Checks' }, { value: 'spend', label: 'Spend' },
        { value: 'policy', label: 'Policy' }, { value: 'protect', label: 'Protection' },
      ]} />
      <div className="mt-5">
        {tab === 'activity' && <Activity w={w} onSynced={reload} />}
        {tab === 'checks' && <WalletChecks id={w.id} />}
        {tab === 'spend' && <Spend id={w.id} />}
        {tab === 'policy' && <PolicyEditor w={w} onSaved={reload} />}
        {tab === 'protect' && <Protect w={w} />}
      </div>
    </>
  )
}

function Activity({ w, onSynced }: { w: WalletDetail; onSynced: () => void }) {
  const { data, error, loading, reload } = useApi<{ data: EventRow[] }>(`wallets/${w.id}/events?limit=50`, { poll: 20_000 })
  const [syncing, setSyncing] = useState(false)
  const [more, setMore] = useState<EventRow[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const sync = async (quiet = false) => {
    setSyncing(true)
    try {
      const r = await send<{ added: number }>(`wallets/${w.id}/sync`, 'POST')
      if (!quiet) setMsg(r.added ? `${r.added} new transaction${r.added === 1 ? '' : 's'}` : 'Up to date')
      if (r.added) { await reload(); onSynced() }
    } catch (e) { if (!quiet) setMsg((e as Error).message) } finally { setSyncing(false) }
  }
  // Without a public webhook (local dev), keep the feed fresh by pulling while the page is open.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') void sync(true) }, 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.id])
  const rows = [...(data?.data ?? []), ...more]
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Onchain activity"
        sub={w.sync_status === 'error' ? `Last sync failed: ${w.sync_error}` : `Decoded from the chain. Synced ${timeAgo(w.last_synced_at)}.`}
        action={<Button size="sm" disabled={syncing} onClick={() => sync()}>{syncing ? <Spinner className="size-3.5" /> : <ArrowClockwise size={14} />}Sync</Button>}
      />
      {msg && <div className="border-b border-line bg-sunken px-5 py-2 text-[12.5px] text-muted">{msg}</div>}
      {loading && !data ? <LoadingBlock /> : error && <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div>}
      {data && (rows.length ? (
        <>
          <ul className="divide-y divide-line">
            {rows.map((e) => (
              <li key={e.signature} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                    <span>{e.type.replaceAll('_', ' ').toLowerCase()}</span>
                    {e.source && e.source !== 'UNKNOWN' && <span>· {e.source.replaceAll('_', ' ').toLowerCase()}</span>}
                    {e.failed && <Pill tone="bad">Failed</Pill>}
                    {!e.signed_by_wallet && <Pill>Incoming</Pill>}
                  </div>
                  <p className="mt-0.5 truncate text-[13.5px]">{e.description}</p>
                  <a href={solscan('tx', e.signature)} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-faint hover:text-ink-2">{short(e.signature, 8)}</a>
                </div>
                <div className="text-right">
                  {Number(e.outflow_usd) > 0 && <div className="tnum text-[13.5px] font-medium">-{usd(e.outflow_usd)}</div>}
                  {Number(e.inflow_usd) > 0 && <div className="tnum text-[13.5px] text-ok">+{usd(e.inflow_usd)}</div>}
                  {e.outflow_unpriced && <div className="text-[12px] text-muted">unpriced token out</div>}
                  <div className="mt-0.5 text-[12px] text-muted" title={dateTime(e.ts)}>{timeAgo(e.ts)}</div>
                </div>
              </li>
            ))}
          </ul>
          {rows.length % 50 === 0 && (
            <div className="border-t border-line p-3 text-center">
              <Button size="sm" variant="ghost" onClick={async () => {
                const r = await get<{ data: EventRow[] }>(`wallets/${w.id}/events?limit=50&before=${encodeURIComponent(rows[rows.length - 1]!.ts)}`)
                setMore((m) => [...m, ...r.data])
              }}>Load older</Button>
            </div>
          )}
        </>
      ) : (
        <Empty title={w.sync_status === 'syncing' || w.sync_status === 'pending' ? 'Backfilling history…' : 'No transactions in the last 30 days'} body="New activity appears here as it confirms." />
      ))}
    </Card>
  )
}

function WalletChecks({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<{ data: CheckRow[] }>(`checks?wallet=${id}&limit=50`, { poll: 20_000 })
  if (loading && !data) return <LoadingBlock />
  if (!data) return <ErrorNote error={error} onRetry={reload} />
  return data.data.length ? (
    <Card className="divide-y divide-line overflow-hidden">{data.data.map((c) => <CheckLine key={c.id} c={c} showWallet={false} />)}</Card>
  ) : (
    <Card><Empty title="No checks for this wallet yet" body="Send transactions through the SDK or the API, or run a test." action={<ButtonLink href={`/app/test?wallet=${id}`}>Test a transaction</ButtonLink>} /></Card>
  )
}

function Spend({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<{ days: { day: string; outflow_usd: number | null; txs: number }[]; recipients: { address: string; payments: string; outflow_usd: number | null; last_paid: string }[]; programs: { program: string; txs: string }[] }>(`wallets/${id}/spend`)
  if (loading && !data) return <LoadingBlock />
  if (!data) return <ErrorNote error={error} onRetry={reload} />
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
      <Card className="xl:col-span-2"><CardHeader title="Daily outflow" /><div className="px-4 py-4 sm:px-5"><DailyBars days={data.days} n={30} /></div></Card>
      <Card className="overflow-hidden">
        <CardHeader title="Top recipients, 30 days" />
        {data.recipients.length ? (
          <ul className="divide-y divide-line">
            {data.recipients.map((r) => (
              <li key={r.address} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px] sm:px-5">
                <Address value={r.address} n={6} />
                <span className="text-right"><span className="tnum font-medium">{usd(r.outflow_usd)}</span><span className="ml-2 text-[12.5px] text-muted">{r.payments}×</span></span>
              </li>
            ))}
          </ul>
        ) : <Empty title="No outgoing payments" />}
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Programs used, 30 days" />
        {data.programs.length ? (
          <ul className="divide-y divide-line">
            {data.programs.map((p) => (
              <li key={p.program} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px] sm:px-5">
                <span className="truncate">{programName(p.program) ?? <span className="font-mono text-[12.5px]">{short(p.program, 6)}</span>}</span>
                <span className="tnum text-muted">{p.txs} tx</span>
              </li>
            ))}
          </ul>
        ) : <Empty title="No program activity" />}
      </Card>
    </div>
  )
}

const lines = (s: string) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)

function PolicyEditor({ w, onSaved }: { w: WalletDetail; onSaved: () => void }) {
  const [p, setP] = useState<Policy>(w.policy)
  const [allow, setAllow] = useState(w.policy.allowRecipients.join('\n'))
  const [deny, setDeny] = useState(w.policy.denyRecipients.join('\n'))
  const [routes, setRoutes] = useState(w.policy.preApproved.map((r) => `${r.recipient}${r.label ? ` ${r.label}` : ''}`).join('\n'))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => setP(w.policy), [w.policy])
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Number(v)))
  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => setP((x) => ({ ...x, [k]: v }))

  const save = async (override?: Partial<Policy>, template?: string) => {
    setBusy(true)
    setMsg(null)
    try {
      const next: Policy = {
        ...p, ...override,
        allowRecipients: lines(allow), denyRecipients: lines(deny),
        preApproved: routes.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [recipient, ...rest] = l.split(/\s+/); return { recipient: recipient!, label: rest.join(' ') || undefined } }),
      }
      const r = await send<{ version: number; loosened: string[] }>(`wallets/${w.id}/policy`, 'PATCH', template ? { template } : { policy: next })
      setMsg({ ok: true, text: `Saved as version ${r.version}.${r.loosened.length ? ' Confirmed with your wallet signature.' : ''}` })
      onSaved()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold">Enforce</div>
              <p className="mt-1 text-[13px] text-muted">
                {p.mode === 'enforce' ? 'Warden blocks and holds transactions on this wallet.' : 'Shadow mode: Warden scores every check and shows what it would have blocked, but blocks nothing.'}
              </p>
            </div>
            <Toggle checked={p.mode === 'enforce'} label="Enforce mode" disabled={busy} onChange={(v) => { set('mode', v ? 'enforce' : 'shadow'); void save({ mode: v ? 'enforce' : 'shadow' }) }} />
          </div>
          {w.kind === 'monitor' && p.mode === 'enforce' && (
            <p className="mt-3 rounded-[8px] bg-warn-bg px-3 py-2 text-[12.5px] text-warn">This wallet is monitor-only. Verdicts are enforced for agents that call Warden before signing; transactions signed without Warden cannot be stopped until the wallet is protected.</p>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 text-[14px] font-semibold">Limits</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Per-transaction cap (USD)" hint="Blank for no cap"><Input inputMode="decimal" value={p.perTxCapUsd ?? ''} onChange={(e) => set('perTxCapUsd', num(e.target.value))} /></Field>
            <Field label="Daily cap (USD)" hint="Rolling 24 hours"><Input inputMode="decimal" value={p.dailyCapUsd ?? ''} onChange={(e) => set('dailyCapUsd', num(e.target.value))} /></Field>
            <Field label="Max transactions per hour"><Input inputMode="numeric" value={p.maxTxPerHour ?? ''} onChange={(e) => set('maxTxPerHour', num(e.target.value))} /></Field>
            <Field label="Hold new recipients above (USD)" hint="First payment to an address this wallet never paid"><Input inputMode="decimal" value={p.newRecipientHoldUsd} onChange={(e) => set('newRecipientHoldUsd', num(e.target.value) ?? 0)} /></Field>
            <Field label="Hold at risk score" hint="0 to 100"><Input inputMode="numeric" value={p.holdThreshold} onChange={(e) => set('holdThreshold', Math.min(100, num(e.target.value) ?? 0))} /></Field>
            <Field label="Approval timeout (minutes)" hint="No answer means deny"><Input inputMode="numeric" value={p.holdTimeoutMinutes} onChange={(e) => set('holdTimeoutMinutes', Math.max(1, num(e.target.value) ?? 15))} /></Field>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 text-[14px] font-semibold">Recipients</div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[13.5px] font-medium">Allowlist only</div>
                <div className="text-[12.5px] text-muted">Block any recipient not listed below or in pre-approved routes.</div>
              </div>
              <Toggle checked={p.allowlistOnly} label="Allowlist only" onChange={(v) => set('allowlistOnly', v)} />
            </div>
            <Field label="Allowlist" hint="One address per line"><Textarea rows={3} value={allow} onChange={(e) => setAllow(e.target.value)} className="font-mono text-[12.5px]" /></Field>
            <Field label="Denylist" hint="Always blocked"><Textarea rows={3} value={deny} onChange={(e) => setDeny(e.target.value)} className="font-mono text-[12.5px]" /></Field>
            <Field label="Pre-approved routes" hint="Address, then an optional label. Skips intent and behaviour checks; still simulated and capped."><Textarea rows={3} value={routes} onChange={(e) => setRoutes(e.target.value)} className="font-mono text-[12.5px]" placeholder="EMgN…qwrCA Exchange deposit" /></Field>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : 'Save policy'}</Button>
          {msg && <span className={cx('text-[13px]', msg.ok ? 'text-ok' : 'text-bad')}>{msg.text}</span>}
        </div>
        <p className="text-[12.5px] text-muted">Changes that weaken protection (raising caps, leaving enforce mode, adding allowlisted addresses) ask your owner wallet to sign. An API key alone cannot loosen a policy.</p>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden">
          <CardHeader title="Templates" sub="Replace limits with a starting point. Mode stays as it is." />
          <ul className="divide-y divide-line">
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <li key={k} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                <div><div className="text-[13.5px] font-medium">{t.name}{w.template === k && <span className="ml-2 text-[12px] font-normal text-muted">current</span>}</div><p className="mt-0.5 text-[12.5px] text-muted">{t.description}</p></div>
                <Button size="sm" disabled={busy} onClick={() => save(undefined, k)}>Apply</Button>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4 text-[12.5px] text-muted sm:p-5">Policy version {w.policy_version}. Every check records the version it ran against.</Card>
      </div>
    </div>
  )
}

function Protect({ w }: { w: WalletDetail }) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2"><h2 className="text-[16px] font-semibold">Protect this wallet</h2><Pill>{w.kind === 'protected' ? 'Protected' : 'Monitor only'}</Pill></div>
        <p className="mt-2 text-[14px] text-ink-2">
          Today Warden watches this address and returns verdicts to agents that check before signing. A protected wallet goes further: funds move into a Squads smart account that needs two signatures, the agent&apos;s and Warden&apos;s, with your wallet as the settings authority.
        </p>
        <ol className="mt-4 space-y-2 text-[13.5px] text-ink-2">
          <li><span className="font-medium text-ink">1.</span> Warden creates the smart account: agent + Warden as 2-of-2 signers, your wallet as admin.</li>
          <li><span className="font-medium text-ink">2.</span> You move funds in, or give the agent a fresh one.</li>
          <li><span className="font-medium text-ink">3.</span> The SDK wraps your agent&apos;s signer. Warden co-signs only what passes the firewall, and appends post-state assertions.</li>
          <li><span className="font-medium text-ink">4.</span> Warden&apos;s key can never move funds alone. Your wallet can remove Warden at any time.</li>
        </ol>
        <div className="mt-5 rounded-[8px] border border-line bg-sunken px-4 py-3 text-[13px] text-ink-2">
          Protected smart accounts are not live yet. They go to enforce only after an external audit of the smart account setup and the check service. Until then, use shadow mode here to see what Warden would block.
        </div>
      </div>
    </Card>
  )
}
