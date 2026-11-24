'use client'

// Warden dashboard kit, after Heliveil's: one surface, one radius, mono labels, pill buttons.
// Light only. Keep new UI on these primitives so every page stays consistent.

import Link from 'next/link'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { Check, Copy } from '@/components/icons'
import { short } from '@/lib/format'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const SURFACE = 'border border-line bg-surface'

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-lav/60',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-[#e0435f] text-white hover:bg-[#f0566f]',
}
const btnBase = (size: 'sm' | 'md') => cx('px-btn inline-flex shrink-0 items-center justify-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-9 px-4 text-[13px]')

export function Button({ variant = 'secondary', size = 'md', className, ...p }: ComponentProps<'button'> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return <button {...p} className={cx(btnBase(size), BTN[variant], className)} />
}

export function ButtonLink({ variant = 'secondary', size = 'md', className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return <Link {...p} className={cx(btnBase(size), BTN[variant], className)} />
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('eyebrow', className)}>{children}</div>
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div {...p} className={cx(SURFACE, className)} />
}

/** Card head: mono eyebrow title, optional hint and action. */
export function CardHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
      <div className="min-w-0">
        <div className="eyebrow">{title}</div>
        {sub && <p className="mt-1.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, sub, actions, back, eyebrow }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8">
      {back}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
          <h1 className="font-pixel text-[32px] leading-[1.05] tracking-[-0.01em] sm:text-[42px]">{title}</h1>
          {sub && <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral'
const TONE: Record<Tone, string> = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', info: 'text-info', neutral: 'text-muted' }

/** Status tag: mono, uppercase, a dot, no fill. */
export function Pill({ tone = 'neutral', children, className, dot = true }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.1em]', TONE[tone], className)}>
      {dot && <span className="size-1.5 shrink-0 bg-current" />}{children}
    </span>
  )
}

export const verdictTone = (v: string): Tone => (v === 'approve' || v === 'approved' ? 'ok' : v === 'hold' || v === 'held' ? 'warn' : v === 'block' || v === 'blocked' || v === 'denied' ? 'bad' : 'neutral')
const VERDICT_LABEL: Record<string, string> = { approve: 'Approve', hold: 'Hold', block: 'Block', approved: 'Approved', held: 'Awaiting approval', blocked: 'Blocked', denied: 'Denied', expired: 'Expired' }
export const verdictLabel = (v: string) => VERDICT_LABEL[v] ?? v

export function VerdictPill({ verdict, enforced, mode }: { verdict: string; enforced?: string; mode?: string }) {
  if (mode === 'shadow' && enforced === 'approve' && verdict !== 'approve') return <Pill tone="info">Shadow · would {verdict}</Pill>
  return <Pill tone={verdictTone(verdict)}>{verdictLabel(verdict)}</Pill>
}

export const severityTone = (s: string): Tone => (s === 'critical' ? 'bad' : s === 'warning' ? 'warn' : 'info')

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className="tnum font-pixel mt-2 truncate text-[28px]">{value}</div>
      {sub && <div className="mt-1 text-[12.5px] text-faint">{sub}</div>}
    </div>
  )
}

/** Stats in one card, divided like Heliveil's stat strip. */
export function StatStrip({ children }: { children: ReactNode[] }) {
  return (
    <div className={cx(SURFACE, 'grid grid-cols-2 overflow-hidden lg:grid-cols-4')}>
      {children.map((c, i) => (
        <div key={i} className={cx('px-5 py-5 sm:px-6', i % 2 ? 'border-l border-line' : '', i >= 2 ? 'border-t border-line lg:border-t-0' : '', i === 2 ? 'lg:border-l' : '')}>{c}</div>
      ))}
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="font-pixel text-[20px]">{title}</div>
      {body && <div className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">{body}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; children: ReactNode; error?: string | null }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="mt-2">{children}</div>
      {error ? <span className="mt-1.5 block text-[12.5px] text-bad">{error}</span> : hint && <span className="mt-1.5 block text-[12.5px] text-faint">{hint}</span>}
    </label>
  )
}

export const inputCls = 'h-10 w-full border border-line-strong bg-page px-3.5 text-[14px] outline-none placeholder:text-faint focus:border-ink-2/45'

export function Input(p: ComponentProps<'input'>) {
  return <input {...p} className={cx(inputCls, p.className)} />
}

export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select {...p} className={cx(inputCls, 'pr-8', className)} />
}

export function Textarea(p: ComponentProps<'textarea'>) {
  return <textarea {...p} className={cx('w-full border border-line-strong bg-page px-3.5 py-2.5 text-[14px] outline-none placeholder:text-faint focus:border-ink-2/45', p.className)} />
}

export function CopyText({ value, display, mono = true }: { value: string; display?: string; mono?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1200) })
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
  return <span className={cx('inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-lav', className)} aria-label="Loading" />
}

export function LoadingBlock() {
  return <div className="flex justify-center py-20"><Spinner /></div>
}

export function ErrorNote({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  if (!error) return null
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-bad/20 bg-bad-bg px-4 py-3 text-[13.5px] text-bad">
      <span>{error.message}</span>
      {onRetry && <button onClick={onRetry} className="font-medium underline underline-offset-2">Retry</button>}
    </div>
  )
}

/** Pill tabs. */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
      {items.map((i) => (
        <button key={i.value} onClick={() => onChange(i.value)}
          className={cx('h-9 whitespace-nowrap px-4 text-[13px] transition-colors', value === i.value ? 'bg-brand text-white' : 'text-muted hover:bg-sunken hover:text-ink')}>
          {i.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-6 w-10 shrink-0 items-center transition-colors disabled:opacity-50', checked ? 'bg-brand' : 'bg-line-strong')}>
      <span className={cx('inline-block size-[18px] bg-white transition-transform', checked ? 'translate-x-[19px]' : 'translate-x-[3px]')} />
    </button>
  )
}
