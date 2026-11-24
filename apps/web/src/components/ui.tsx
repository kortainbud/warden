'use client'

import Link from 'next/link'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import { short } from '@/lib/format'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-hover border border-brand',
  secondary: 'bg-surface text-ink border border-line-strong hover:border-ink-2/40',
  ghost: 'text-ink-2 hover:bg-sunken border border-transparent',
  danger: 'bg-bad text-white border border-bad hover:bg-[#842823]',
}

export function Button({ variant = 'secondary', size = 'md', className, ...p }: ComponentProps<'button'> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[8px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-[14px]',
        BTN[variant],
        className,
      )}
    />
  )
}

export function ButtonLink({ variant = 'secondary', size = 'md', className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <Link
      {...p}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[8px] font-medium transition-colors',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-[14px]',
        BTN[variant],
        className,
      )}
    />
  )
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div {...p} className={cx('rounded-[10px] border border-line bg-surface', className)} />
}

export function CardHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[24px]">{title}</h1>
          {sub && <p className="mt-1 max-w-2xl text-[14px] text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'
const TONE: Record<Tone, string> = {
  ok: 'bg-ok-bg text-ok border-ok/20',
  warn: 'bg-warn-bg text-warn border-warn/20',
  bad: 'bg-bad-bg text-bad border-bad/20',
  info: 'bg-info-bg text-info border-info/20',
  neutral: 'bg-sunken text-ink-2 border-line',
}

export function Pill({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[12px] font-medium', TONE[tone], className)}>{children}</span>
}

export const verdictTone = (v: string): Tone => (v === 'approve' || v === 'approved' ? 'ok' : v === 'hold' || v === 'held' ? 'warn' : v === 'block' || v === 'blocked' || v === 'denied' ? 'bad' : 'neutral')
const VERDICT_LABEL: Record<string, string> = { approve: 'Approve', hold: 'Hold', block: 'Block', approved: 'Approved', held: 'Awaiting approval', blocked: 'Blocked', denied: 'Denied', expired: 'Expired' }
export const verdictLabel = (v: string) => VERDICT_LABEL[v] ?? v

export function VerdictPill({ verdict, enforced, mode }: { verdict: string; enforced?: string; mode?: string }) {
  if (mode === 'shadow' && enforced === 'approve' && verdict !== 'approve')
    return <Pill tone="info">Shadow: would {verdict}</Pill>
  return <Pill tone={verdictTone(verdict)}>{verdictLabel(verdict)}</Pill>
}

export const severityTone = (s: string): Tone => (s === 'critical' ? 'bad' : s === 'warning' ? 'warn' : 'info')

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="tnum mt-1 truncate text-[22px] font-semibold tracking-[-0.02em]">{value}</div>
      {sub && <div className="mt-0.5 text-[12.5px] text-muted">{sub}</div>}
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="text-[14px] font-medium">{title}</div>
      {body && <div className="mt-1 max-w-md text-[13.5px] text-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? <span className="mt-1 block text-[12.5px] text-bad">{error}</span> : hint && <span className="mt-1 block text-[12.5px] text-muted">{hint}</span>}
    </label>
  )
}

export const inputCls = 'h-10 w-full rounded-[8px] border border-line-strong bg-surface px-3 text-[14px] outline-none placeholder:text-faint focus:border-ink-2/50'

export function Input(p: ComponentProps<'input'>) {
  return <input {...p} className={cx(inputCls, p.className)} />
}

export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select {...p} className={cx(inputCls, 'pr-8', className)} />
}

export function Textarea(p: ComponentProps<'textarea'>) {
  return <textarea {...p} className={cx('w-full rounded-[8px] border border-line-strong bg-surface px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-ink-2/50', p.className)} />
}

export function CopyText({ value, display, mono = true }: { value: string; display?: string; mono?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200) })
      }}
      className={cx('inline-flex max-w-full items-center gap-1 text-ink-2 hover:text-ink', mono && 'font-mono text-[12.5px]')}
      title="Copy"
    >
      <span className="truncate">{display ?? value}</span>
      {done ? <Check size={12} className="shrink-0 text-ok" /> : <Copy size={12} className="shrink-0 text-faint" />}
    </button>
  )
}

export const Address = ({ value, n = 4 }: { value: string; n?: number }) => <CopyText value={value} display={short(value, n)} />

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink-2', className)} aria-label="Loading" />
}

export function LoadingBlock() {
  return <div className="flex justify-center py-16"><Spinner /></div>
}

export function ErrorNote({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  if (!error) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] border border-bad/20 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">
      <span>{error.message}</span>
      {onRetry && <button onClick={onRetry} className="font-medium underline underline-offset-2">Retry</button>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
      {items.map((i) => (
        <button
          key={i.value}
          onClick={() => onChange(i.value)}
          className={cx('relative h-10 whitespace-nowrap px-3 text-[13.5px] font-medium', value === i.value ? 'text-ink' : 'text-muted hover:text-ink-2')}
        >
          {i.label}
          {value === i.value && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-ink" />}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50', checked ? 'border-accent bg-accent' : 'border-line-strong bg-sunken')}>
      <span className={cx('inline-block size-[18px] rounded-full bg-white transition-transform', checked ? 'translate-x-[19px]' : 'translate-x-[2px]')} />
    </button>
  )
}
