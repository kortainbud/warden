'use client'

import Link from 'next/link'
import { use, useState } from 'react'
import { programName } from '@warden/decoder'
import { useApi, send } from '@/lib/api'
import { dateTime, ms, short, timeAgo, usd } from '@/lib/format'
import type { CheckRow } from '@/lib/types'
import Back from '@/components/Back'
import { Address, Button, Card, CardHeader, ErrorNote, LoadingBlock, PageHeader, Pill } from '@/components/ui'
import { CheckStatus, HoldCard, ReasonList, StageBars, stageLabel } from '@/components/checks'

export default function CheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: c, error, loading, reload } = useApi<CheckRow>(`checks/${id}`)
  const [fb, setFb] = useState<string | null>(null)

  if (loading && !c) return <LoadingBlock />
  if (!c) return <><Back fallback="/app/checks" fallbackLabel="Checks" /><ErrorNote error={error} onRetry={reload} /></>

  const ctx = c.context_excerpt
  return (
    <>
      <PageHeader
        back={<Back fallback="/app/checks" fallbackLabel="Checks" />}
        title={<span className="flex flex-wrap items-center gap-2">Check <span className="font-mono text-[15px] font-normal text-muted">{c.id}</span></span>}
        sub={<>{c.wallet_label} · {dateTime(c.created_at)} · {c.origin === 'prepay' ? 'x402 pre-pay check' : c.origin === 'playground' ? 'Test transaction from the dashboard' : 'Sent by agent via API'}</>}
      />

      {c.status === 'held' && <div className="mb-6"><HoldCard c={c} onDone={reload} /></div>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <div className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <CheckStatus c={c} />
                <Pill>Score {c.score}</Pill>
                <Pill>{c.mode === 'shadow' ? 'Shadow mode' : 'Enforce mode'}</Pill>
                {c.model_used && <Pill tone="info">Intent model used</Pill>}
              </div>
              <p className="mt-3 text-[16px] font-medium leading-snug">{c.summary}</p>
              {c.mode === 'shadow' && c.verdict !== 'approve' && (
                <p className="mt-2 text-[13px] text-info">Shadow mode: Warden would have {c.verdict === 'block' ? 'blocked' : 'held'} this, but let it through.</p>
              )}
              {c.decision && <p className="mt-2 text-[13px] text-muted">Hold {c.decision}{c.decided_at ? ` ${timeAgo(c.decided_at)}` : ''}{c.decided_by ? ` by ${short(c.decided_by)}` : ''}.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Why" sub="Hard flags block. Holds need a human. Other signals add to the score." />
            <div className="px-4 py-4 sm:px-5"><ReasonList reasons={c.reasons} /></div>
          </Card>

          {ctx && (
            <Card>
              <CardHeader title="Context the agent sent" sub="Stored as short excerpts and a hash. Untrusted content is evidence, never instruction." />
              <dl className="divide-y divide-line text-[13.5px]">
                {ctx.task && <Ctx label={`Task · ${ctx.task.source}`} text={ctx.task.text} trusted={['owner', 'system', 'schedule'].includes(ctx.task.source)} />}
                {ctx.trigger && <Ctx label={`Trigger · ${ctx.trigger.source.replace('_', ' ')}`} origin={ctx.trigger.origin} text={ctx.trigger.excerpt ?? ''} trusted={['owner', 'system', 'schedule'].includes(ctx.trigger.source)} />}
                {ctx.inputs?.map((i, k) => <Ctx key={k} label={`Input · ${i.source.replace('_', ' ')}`} origin={i.origin} text={i.excerpt ?? ''} trusted={false} />)}
                {ctx.resource && <Ctx label="Paid resource" text={ctx.resource} trusted={false} />}
              </dl>
            </Card>
          )}
          {!ctx && c.origin !== 'prepay' && (
            <Card className="px-4 py-4 text-[13.5px] text-muted sm:px-5">No context was sent with this check, so Warden treated it as untrusted.</Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Money out" sub="From simulation against current chain state" />
            <div className="px-4 py-4 sm:px-5">
              {c.outflows.length ? (
                <ul className="space-y-1.5 text-[14px]">
                  {c.outflows.map((o, i) => (
                    <li key={i} className="flex justify-between gap-3"><span className="tnum font-medium">-{o.amount} {o.symbol}</span><span className="tnum text-muted">{usd(o.usd)}</span></li>
                  ))}
                </ul>
              ) : <p className="text-[13.5px] text-muted">No value leaves the wallet.</p>}
              {c.recipients.length > 0 && (
                <div className="mt-4 space-y-3 border-t border-line pt-4">
                  {c.recipients.map((r) => (
                    <div key={r.address} className="text-[13px]">
                      <div className="flex items-center justify-between gap-2"><Address value={r.address} n={6} />{r.isNew ? <Pill tone="warn">New recipient</Pill> : <Pill>Paid before</Pill>}</div>
                      <div className="mt-1 text-muted">Threat score {r.score}{r.reasons.length ? ` · ${r.reasons.join(' · ')}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
              {c.programs.length > 0 && (
                <div className="mt-4 border-t border-line pt-4 text-[13px]">
                  <div className="mb-1.5 text-muted">Programs</div>
                  <div className="flex flex-wrap gap-1.5">{c.programs.map((p) => <Pill key={p}>{programName(p) ?? short(p)}</Pill>)}</div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Stages" sub={`${ms(c.latency_ms)} end to end`} />
            <div className="px-4 py-4 sm:px-5">
              <StageBars stages={c.stages} />
              {Object.keys(c.stage_ms ?? {}).length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-[12.5px] text-muted">
                  {Object.entries(c.stage_ms).map(([k, v]) => <div key={k} className="flex justify-between"><span>{k === 'rules_reputation_anomaly' ? 'Rules + reputation' : stageLabel(k)}</span><span className="tnum text-ink-2">{v} ms</span></div>)}
                </div>
              )}
            </div>
          </Card>

          <Card className="px-4 py-4 sm:px-5">
            <div className="text-[13.5px] font-medium">Was this verdict right?</div>
            <p className="mt-1 text-[12.5px] text-muted">Labels feed back into tuning the weights and the intent check.</p>
            <div className="mt-3 flex gap-2">
              {(['true_positive', 'false_positive'] as const).map((l) => (
                <Button key={l} size="sm" variant={fb === l ? 'primary' : 'secondary'} onClick={async () => { await send(`checks/${c.id}/feedback`, 'POST', { label: l }); setFb(l) }}>
                  {l === 'true_positive' ? 'Correct' : 'Wrong call'}
                </Button>
              ))}
            </div>
          </Card>
          <Link href={`/app/wallets/${c.wallet_id}`} className="block text-[13px] text-muted hover:text-ink">Open {c.wallet_label} →</Link>
        </div>
      </div>
    </>
  )
}

function Ctx({ label, text, origin, trusted }: { label: string; text: string; origin?: string | null; trusted: boolean }) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <dt className="flex items-center gap-2 text-[12.5px] text-muted">{label}{trusted ? <Pill tone="ok">trusted</Pill> : <Pill tone="warn">untrusted</Pill>}</dt>
      {origin && <dd className="mt-1 break-all font-mono text-[12px] text-muted">{origin}</dd>}
      <dd className="mt-1 whitespace-pre-wrap break-words text-ink-2">{text || <span className="text-faint">(empty)</span>}</dd>
    </div>
  )
}
