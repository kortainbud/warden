'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useApi, send } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { Button, Card, CardHeader, CopyText, Empty, ErrorNote, Field, Input, LoadingBlock, PageHeader, Pill, Select, Tabs } from '@/components/ui'

type Tab = 'keys' | 'channels'

export default function SettingsPage() {
  return <Suspense fallback={<LoadingBlock />}><Settings /></Suspense>
}

function Settings() {
  const router = useRouter()
  const sp = useSearchParams()
  const tab = (sp.get('tab') as Tab) || 'keys'
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs<Tab> value={tab} onChange={(t) => router.replace(`/app/settings${t === 'keys' ? '' : `?tab=${t}`}`, { scroll: false })} items={[{ value: 'keys', label: 'API keys' }, { value: 'channels', label: 'Alert channels' }]} />
      <div className="mt-5">{tab === 'keys' ? <Keys /> : <Channels />}</div>
    </>
  )
}

interface Key { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

function Keys() {
  const { data, error, loading, reload } = useApi<{ data: Key[] }>('keys')
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState<string | null>(null)
  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-5">
        <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={async (e) => {
          e.preventDefault()
          const r = await send<{ key: string }>('keys', 'POST', { name })
          setFresh(r.key); setName(''); void reload()
        }}>
          <div className="flex-1"><Field label="New API key" hint="For the SDK and the /v1 API. Keys can check, freeze and read, but cannot loosen a policy or approve a hold."><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scout production" maxLength={40} /></Field></div>
          <Button type="submit" variant="primary" className="sm:mb-[22px]">Create key</Button>
        </form>
        {fresh && (
          <div className="mt-4 rounded-[8px] border border-ok/25 bg-ok-bg px-3 py-3 text-[13px]">
            <div className="mb-1 font-medium text-ok">Copy this key now. It is not shown again.</div>
            <CopyText value={fresh} />
          </div>
        )}
      </Card>
      {loading && !data ? <LoadingBlock /> : <ErrorNote error={error} onRetry={reload} />}
      {data && (data.data.length ? (
        <Card className="divide-y divide-line overflow-hidden">
          {data.data.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-medium">{k.name}{k.revoked_at && <Pill tone="bad">Revoked</Pill>}</div>
                <div className="font-mono text-[12.5px] text-muted">{k.prefix}… · created {timeAgo(k.created_at)} · {k.last_used_at ? `used ${timeAgo(k.last_used_at)}` : 'never used'}</div>
              </div>
              {!k.revoked_at && <Button size="sm" variant="ghost" onClick={async () => { await send(`keys/${k.id}`, 'DELETE'); void reload() }}>Revoke</Button>}
            </div>
          ))}
        </Card>
      ) : <Card><Empty title="No API keys" body={<>Create one, then follow the <Link href="/docs" className="underline">quickstart</Link>.</>} /></Card>)}
    </div>
  )
}

interface Channel { id: string; kind: string; label: string; config: { url?: string; chatId?: string }; min_severity: string; enabled: boolean; last_error: string | null; created_at: string }

function Channels() {
  const { data, error, loading, reload } = useApi<{ data: Channel[]; telegram_available: boolean }>('alerts/channels')
  const [kind, setKind] = useState('webhook')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [chatId, setChatId] = useState('')
  const [min, setMin] = useState('warning')
  const [msg, setMsg] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [testing, setTesting] = useState<Record<string, string>>({})
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Add a channel" sub="Alerts always appear in the dashboard. Channels push them to you." />
        <form className="grid grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5" onSubmit={async (e) => {
          e.preventDefault()
          setMsg(null); setSecret(null)
          try {
            const r = await send<{ secret: string | null }>('alerts/channels', 'POST', { kind, label, url, chatId, min_severity: min })
            setSecret(r.secret); setUrl(''); setChatId(''); setLabel(''); void reload()
          } catch (e2) { setMsg((e2 as Error).message) }
        }}>
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="webhook">Webhook (HMAC-signed)</option>
              <option value="slack">Slack incoming webhook</option>
              <option value="telegram" disabled={!data?.telegram_available}>Telegram{data?.telegram_available ? '' : ' (not configured on this server)'}</option>
              <option value="email" disabled>Email (coming soon)</option>
            </Select>
          </Field>
          <Field label="Name"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="#agent-ops" /></Field>
          {kind === 'telegram'
            ? <Field label="Telegram chat ID"><Input value={chatId} onChange={(e) => setChatId(e.target.value)} inputMode="numeric" /></Field>
            : <Field label={kind === 'slack' ? 'Slack webhook URL' : 'Endpoint URL'}><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" type="url" required /></Field>}
          <Field label="Send">
            <Select value={min} onChange={(e) => setMin(e.target.value)}><option value="critical">Critical only</option><option value="warning">Warning and critical</option><option value="info">Everything</option></Select>
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" variant="primary">Add channel</Button>{msg && <span className="text-[13px] text-bad">{msg}</span>}</div>
          {secret && (
            <div className="rounded-[8px] border border-ok/25 bg-ok-bg px-3 py-3 text-[13px] sm:col-span-2">
              <div className="mb-1 font-medium text-ok">Signing secret: copy it now.</div>
              <CopyText value={secret} />
              <p className="mt-2 text-ink-2">Verify each delivery: <span className="font-mono text-[12px]">HMAC-SHA256(secret, timestamp + &quot;.&quot; + body)</span> must equal the <span className="font-mono text-[12px]">x-warden-signature</span> header (after <span className="font-mono text-[12px]">v1=</span>).</p>
            </div>
          )}
        </form>
      </Card>
      {loading && !data ? <LoadingBlock /> : <ErrorNote error={error} onRetry={reload} />}
      {data && data.data.length > 0 && (
        <Card className="divide-y divide-line overflow-hidden">
          {data.data.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[14px] font-medium">{c.label}<Pill>{c.kind}</Pill><Pill>{c.min_severity}+</Pill></div>
                <div className="truncate text-[12.5px] text-muted">{c.config.url ?? c.config.chatId}</div>
                {(testing[c.id] || c.last_error) && <div className={`text-[12.5px] ${testing[c.id] === 'Delivered' ? 'text-ok' : 'text-bad'}`}>{testing[c.id] ?? `Last error: ${c.last_error}`}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={async () => {
                  setTesting((t) => ({ ...t, [c.id]: 'Sending…' }))
                  try { await send(`alerts/channels/${c.id}/test`, 'POST'); setTesting((t) => ({ ...t, [c.id]: 'Delivered' })) } catch (e) { setTesting((t) => ({ ...t, [c.id]: (e as Error).message })) }
                }}>Send test</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await send(`alerts/channels/${c.id}`, 'DELETE'); void reload() }}>Remove</Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
