'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { useApi, send } from '@/lib/api'
import { ms, usd } from '@/lib/format'
import type { WalletRow } from '@/lib/types'
import { Button, ButtonLink, Card, CardHeader, Empty, Field, Input, LoadingBlock, PageHeader, Pill, Select, Spinner, Textarea } from '@/components/ui'
import { ReasonList } from '@/components/checks'

const SOURCES = [
  ['owner', 'The owner'], ['schedule', 'A schedule'], ['system', 'System prompt'], ['agent', 'The agent itself'],
  ['web', 'A webpage'], ['social', 'A social post'], ['tool_output', 'Tool output'], ['payment_request', 'A payment request'], ['onchain', 'Onchain data'],
] as const

interface Result {
  id: string; verdict: string; enforced: string; mode: string; status: string; score: number; summary: string
  reasons: { code: string; stage: string; severity: 'block' | 'hold' | 'info'; message: string }[]
  simulated: { ok: boolean; error?: string; vault_delta: { symbol: string; amount: string; usd: number | null }[] }
  latency_ms: number; stage_ms: Record<string, number>
}

export default function TestPage() {
  return <Suspense fallback={<LoadingBlock />}><Test /></Suspense>
}

function Test() {
  const sp = useSearchParams()
  const wallets = useApi<{ data: WalletRow[] }>('wallets')
  const [wallet, setWallet] = useState(sp.get('wallet') ?? '')
  const [to, setTo] = useState('')
  const [asset, setAsset] = useState<'SOL' | 'USDC'>('USDC')
  const [amount, setAmount] = useState('5')
  const [task, setTask] = useState('Buy the weather dataset for the daily report')
  const [taskSource, setTaskSource] = useState('owner')
  const [trigSource, setTrigSource] = useState('')
  const [trigOrigin, setTrigOrigin] = useState('')
  const [trigText, setTrigText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [res, setRes] = useState<Result | null>(null)

  useEffect(() => { if (!wallet && wallets.data?.data[0]) setWallet(wallets.data.data[0].id) }, [wallet, wallets.data])

  if (wallets.loading && !wallets.data) return <LoadingBlock />
  if (wallets.data && !wallets.data.data.length)
    return (<><PageHeader title="Test a transaction" /><Card><Empty title="Add a wallet first" body="Tests build a real transaction from one of your wallets and run the full check, simulation included." action={<ButtonLink href="/app/wallets?add=1" variant="primary">Add a wallet</ButtonLink>} /></Card></>)

  const run = async () => {
    setBusy(true)
    setErr(null)
    setRes(null)
    try {
      const context = task.trim() || trigSource ? {
        ...(task.trim() ? { task: { text: task.trim(), source: taskSource } } : {}),
        ...(trigSource ? { trigger: { source: trigSource, origin: trigOrigin.trim() || undefined, excerpt: trigText.trim() || undefined } } : {}),
      } : null
      setRes(await send<Result>('playground', 'POST', { wallet, to: to.trim(), asset, amount: Number(amount), context, agent_name: wallets.data?.data.find((w) => w.id === wallet)?.label }))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Test a transaction" sub="Build a real transfer from one of your wallets and run it through the firewall: decode, simulation against mainnet, rules, Threat Network and intent. Nothing is signed or sent." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run() }}>
            <Field label="From wallet">
              <Select value={wallet} onChange={(e) => setWallet(e.target.value)}>{wallets.data?.data.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}</Select>
            </Field>
            <Field label="Recipient address"><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Solana address" spellCheck={false} className="font-mono text-[13px]" required /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount"><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
              <Field label="Asset"><Select value={asset} onChange={(e) => setAsset(e.target.value as 'SOL' | 'USDC')}><option>USDC</option><option>SOL</option></Select></Field>
            </div>
            <div className="border-t border-line pt-4">
              <div className="mb-3 text-[13.5px] font-semibold">Context the agent would send</div>
              <div className="space-y-3">
                <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-3">
                  <Field label="Task"><Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="What the agent was asked to do" /></Field>
                  <Field label="Asked by"><Select value={taskSource} onChange={(e) => setTaskSource(e.target.value)}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
                </div>
                <Field label="What triggered the payment">
                  <Select value={trigSource} onChange={(e) => setTrigSource(e.target.value)}>
                    <option value="">The task itself</option>
                    {SOURCES.filter(([v]) => !['owner', 'schedule', 'system'].includes(v)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </Field>
                {trigSource && (
                  <>
                    <Field label="Origin"><Input value={trigOrigin} onChange={(e) => setTrigOrigin(e.target.value)} placeholder="https://… or @handle" /></Field>
                    <Field label="Excerpt" hint="Paste the text the agent read. Try putting the recipient address in it."><Textarea rows={3} value={trigText} onChange={(e) => setTrigText(e.target.value)} /></Field>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={busy || !wallet}>{busy ? <><Spinner className="size-3.5 border-white/40 border-t-white" />Checking…</> : 'Run check'}</Button>
              {err && <span className="text-[13px] text-bad">{err}</span>}
            </div>
          </form>
        </Card>

        <div>
          {res ? (
            <Card>
              <CardHeader title={<span className="flex flex-wrap items-center gap-2">Result <Pill tone={res.verdict === 'approve' ? 'ok' : res.verdict === 'hold' ? 'warn' : 'bad'}>{res.verdict}</Pill>{res.mode === 'shadow' && res.verdict !== 'approve' && <Pill tone="info">Shadow: let through</Pill>}</span>} sub={`Score ${res.score} · ${ms(res.latency_ms)}`} action={<Link href={`/app/checks/${res.id}`} className="text-[13px] text-muted hover:text-ink">Open check</Link>} />
              <div className="space-y-4 px-4 py-4 sm:px-5">
                <p className="text-[15px] font-medium">{res.summary}</p>
                {!res.simulated.ok && <p className=" bg-bad-bg px-3 py-2 text-[13px] text-bad">Simulation: {res.simulated.error}</p>}
                {res.simulated.vault_delta.length > 0 && (
                  <div className="text-[13.5px]">{res.simulated.vault_delta.map((d, i) => <div key={i} className="tnum">{d.amount} {d.symbol} <span className="text-muted">{usd(d.usd)}</span></div>)}</div>
                )}
                <ReasonList reasons={res.reasons} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-4 text-[12.5px] text-muted">
                  {Object.entries(res.stage_ms).map(([k, v]) => <div key={k} className="flex justify-between"><span>{k.replaceAll('_', ' ')}</span><span className="tnum text-ink-2">{v} ms</span></div>)}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-5 text-[13.5px] text-muted">
              <div className="font-medium text-ink">Things to try</div>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Send to an address this wallet has paid before, then to a brand new one.</li>
                <li>Set the trigger to a social post and paste the recipient address into the excerpt.</li>
                <li>Hide the address in base64 inside tool output.</li>
                <li>Go above the wallet&apos;s per-transaction cap.</li>
                <li>Try more than the wallet holds: simulation fails and Warden blocks.</li>
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
