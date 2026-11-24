'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, Clock, Copy, Snowflake, Wallet, ShieldWarning, ListChecks, Gauge } from '@/components/icons'
import { Mark } from '@/components/brand'
import { Badge } from './Platform'

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        setP(clamp((window.innerHeight - el.getBoundingClientRect().top) / (window.innerHeight * 0.9)))
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [ref])
  return p
}

export function SelfServe() {
  const ref = useRef<HTMLDivElement>(null)
  const p = useInView(ref)
  return (
    <section className="bg-[#fafafb]">
      <div className="mx-auto max-w-[1392px] border-x border-t border-[#ececef]">
        <div className="px-6 pt-24 text-center sm:pt-32">
          <Badge>Self-serve</Badge>
          <h2 className="mx-auto mt-5 max-w-[760px] text-[30px] font-medium leading-[1.15] tracking-[-0.025em] text-[#0e0f11] sm:text-[38px]">Live in two minutes. <span className="text-[#8a8d95]">Paste an address. Warden backfills 30 days and learns what normal looks like, before your agent signs its next payment.</span></h2>
          <Link href="/app" className="mt-7 inline-flex h-8 items-center rounded-[7px] border border-[#dcdce0] bg-white px-2.5 text-[13px] font-medium hover:bg-[#f6f6f7]">Start monitoring</Link>
        </div>
        <div ref={ref} className="relative mt-16 h-[420px] overflow-hidden sm:h-[560px]">
          <div className="absolute inset-x-0 bottom-0 top-[25%] bg-[repeating-linear-gradient(90deg,rgba(14,15,17,0.07)_0_1px,transparent_1px_6px)] [mask-image:linear-gradient(180deg,transparent,black_60%)]" />
          <div className="absolute left-1/2 w-[min(1020px,94%)] -translate-x-1/2 rounded-t-[12px] border border-b-0 border-[#e6e7ea] bg-white shadow-[0_-10px_50px_-20px_rgba(16,24,40,0.2)]" style={{ top: `${40 + (1 - p) * 220}px` }}>
            <WalletRecord />
          </div>
        </div>
      </div>
    </section>
  )
}

function WalletRecord() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] text-[12.5px] md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="border-b border-[#efeff1] p-5 md:border-b-0 md:border-r">
        <div className="flex size-10 items-center justify-center rounded-full bg-[#0e0f11]"><Mark size={20} className="invert" /></div>
        <div className="mt-3 text-[16px] font-semibold">Atlas</div>
        <div className="flex items-center gap-1 font-mono text-[11.5px] text-[#9a9ca3]">HCaP…7CQC <Copy size={11} /></div>
        <div className="mt-3 flex gap-1.5"><span className="inline-flex items-center gap-1 rounded-[6px] border border-[#e6e7ea] px-2 py-1"><Snowflake size={12} />Freeze</span><span className="rounded-[6px] border border-[#e6e7ea] px-2 py-1">Policy</span></div>
        <div className="mt-5 text-[11.5px] font-medium text-[#6e717a]">Details</div>
        {[['Mode', 'Enforce'], ['Template', 'Trader'], ['Daily cap', '$250,000'], ['Owner', '8otZ…g3Wy'], ['Backfilled', '30 days · 406 tx'], ['Last activity', '6 minutes ago']].map(([a, b]) => (
          <div key={a} className="mt-2 grid grid-cols-[100px_1fr] gap-2"><span className="text-[#9a9ca3]">{a}</span><span>{b}</span></div>
        ))}
      </div>
      <div className="p-5">
        <div className="mb-3 flex items-center gap-1.5 text-[12px] font-medium"><Gauge size={13} />Highlights</div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="rounded-[9px] border border-[#e6e7ea] p-3 sm:col-span-2"><div className="text-[11px] text-[#9a9ca3]">Summary</div><p className="mt-1 text-[#2c2e33]">Atlas swaps on Jupiter about 30 times a day and moves profits weekly to one exchange deposit address. Nothing unusual in the last 24 hours.</p></div>
          <div className="rounded-[9px] border border-[#e6e7ea] p-3"><div className="text-[11px] text-[#9a9ca3]">Pre-approved route</div><p className="mt-1 font-medium">Exchange deposit</p><p className="font-mono text-[11px] text-[#9a9ca3]">EMgN…wrCA</p></div>
          <div className="rounded-[9px] border border-[#e6e7ea] p-3"><div className="flex justify-between text-[11px] text-[#9a9ca3]">Pending hold<Clock size={11} /></div><p className="mt-1 font-medium">1,850 USDC</p><p className="text-[#9a9ca3]">Denies in 14m</p></div>
          <div className="rounded-[9px] border border-[#e6e7ea] p-3"><div className="text-[11px] text-[#9a9ca3]">Out, 24h</div><p className="tnum mt-1 font-medium">$5,357</p><div className="mt-2 h-1 rounded-full bg-[#f1f2f4]"><div className="h-full w-[2%] rounded-full bg-[#22c55e]" /></div></div>
          <div className="rounded-[9px] border border-[#e6e7ea] p-3"><div className="text-[11px] text-[#9a9ca3]">Checks, 7d</div><p className="tnum mt-1 font-medium">46 · 1 hold · 1 block</p></div>
        </div>
        <div className="mb-2 mt-5 flex items-center gap-1.5 text-[12px] font-medium"><ListChecks size={13} />Activity</div>
        {[[ShieldWarning, 'Warden held a payment to a new wallet', '6 minutes ago'], [Wallet, 'Swapped 2,383.55 USDC from SOL on Jupiter', '1 hour ago'], [Bell, 'Alert sent to #agent-ops', '12 hours ago']].map(([I, t, d]) => {
          const Icon = I as typeof Wallet
          return <div key={t as string} className="flex items-center gap-2 border-t border-[#f3f3f5] py-2"><Icon size={13} className="text-[#9a9ca3]" /><span className="flex-1 text-[#2c2e33]">{t as string}</span><span className="text-[11.5px] text-[#9a9ca3]">{d as string}</span></div>
        })}
      </div>
    </div>
  )
}

export function Statement() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1392px] border-x border-[#ececef] bg-[radial-gradient(#e4e5e9_0.8px,transparent_0.8px)] [background-size:12px_12px] px-6 py-32 text-center sm:py-44">
        <p className="mx-auto max-w-[760px] font-[family-name:var(--font-serif)] text-[32px] leading-[1.2] tracking-[-0.01em] text-[#0e0f11] sm:text-[44px]">
          “Solana’s policies set the limits. <span className="text-[#9a9ca3]">Warden catches the attacks that stay inside them.”</span>
        </p>
        <div className="mt-8 text-[13px] font-medium text-[#0e0f11]">The idea behind Warden</div>
        <div className="text-[13px] text-[#6e717a]">Firewall and monitor for agent wallets</div>
      </div>
    </section>
  )
}

export function Scale() {
  const ref = useRef<HTMLDivElement>(null)
  const p = useInView(ref)
  const stats = [['< 250 ms', 'fast-path p99 target'], ['6 checks', 'before every signature'], ['30 days', 'of history per wallet'], ['0 keys', 'that can move funds alone']]
  return (
    <section className="bg-white">
      <div ref={ref} className="relative mx-auto max-w-[1392px] overflow-hidden border-x border-t border-[#ececef]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1392 620" preserveAspectRatio="none" aria-hidden>
          <defs>
            <pattern id="vstripes" width="6" height="10" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="10" stroke="rgba(14,15,17,0.08)" /></pattern>
            <clipPath id="under"><path d="M0 560 C500 560 900 470 1392 0 V620 H0 Z" /></clipPath>
          </defs>
          <rect width="1392" height="620" fill="url(#vstripes)" clipPath="url(#under)" opacity={0.9} />
          <path d="M0 560 C500 560 900 470 1392 0" fill="none" stroke="#d6d7dc" strokeWidth="1.4" />
          <path d="M0 560 C500 560 900 470 1392 0" fill="none" stroke="#2563eb" strokeWidth="1.8" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - Math.min(1, p * 0.75)} />
        </svg>
        <div className="relative px-6 pb-40 pt-24 sm:px-10 sm:pb-56">
          <Badge>Built for machine speed</Badge>
          <h2 className="mt-5 max-w-[460px] text-[30px] font-medium leading-[1.15] tracking-[-0.025em] text-[#0e0f11] sm:text-[38px]">Fast enough for trading agents. <span className="text-[#8a8d95]">Safe enough for treasuries.</span></h2>
          <div className="mt-12 grid max-w-[460px] grid-cols-2 gap-x-10 gap-y-8">
            {stats.map(([a, b]) => (
              <div key={a} className="border-l-2 border-[#2563eb] pl-3"><div className="tnum text-[26px] font-medium tracking-[-0.02em] text-[#0e0f11]">{a}</div><div className="text-[13px] text-[#6e717a]">{b}</div></div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function Changelog() {
  const items = [
    ['x402 pre-pay checks', 'Check a payment request before your agent pays it.'],
    ['Threat Network reports', 'Report a scam address. Reviewed reports block for everyone.'],
    ['Shadow mode', 'See what Warden would block, before it blocks anything.'],
    ['Owner-signed approvals', 'Approving money out needs your wallet’s signature.'],
  ]
  return (
    <section id="changelog" className="scroll-mt-14 bg-white">
      <div className="mx-auto max-w-[1392px] border-x border-t border-[#ececef]">
        <div className="px-6 pt-24 sm:px-10">
          <Badge>Changelog</Badge>
          <h2 className="mt-5 max-w-[520px] text-[30px] font-medium leading-[1.15] tracking-[-0.025em] text-[#0e0f11] sm:text-[38px]">Better every week. <span className="text-[#8a8d95]">New protection as agents find new ways to pay.</span></h2>
          <Link href="/docs#status" className="mt-7 inline-flex h-8 items-center gap-1 rounded-[7px] border border-[#dcdce0] px-2.5 text-[13px] font-medium hover:bg-[#f6f6f7]">What’s live<ArrowRight size={13} /></Link>
        </div>
        <div className="mt-16 grid grid-cols-1 px-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
          {items.map(([t, d], i) => (
            <div key={t} className={`min-h-[220px] border-[#ececef] pb-10 pr-6 pt-2 ${i ? 'sm:border-l sm:pl-6' : ''}`}>
              <div className="text-[12px] text-[#9a9ca3]">November 24, 2026</div>
              <div className="mt-3 text-[15px] font-medium">{t}</div>
              <div className="mt-1 max-w-[200px] text-[14px] leading-snug text-[#8a8d95]">{d}</div>
            </div>
          ))}
        </div>
        <div className="h-10 border-t border-[#ececef] bg-[repeating-linear-gradient(90deg,rgba(14,15,17,0.12)_0_1px,transparent_1px_12px)] [mask-image:linear-gradient(0deg,black,transparent)]" />
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section data-dark className="bg-[#111111] text-white">
      <div className="mx-auto max-w-[1392px] border-x border-white/10 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_7px)] px-6 py-32 text-center">
        <h2 className="mx-auto max-w-[560px] text-[36px] font-medium leading-[1.1] tracking-[-0.03em] sm:text-[48px]">Agent payments run safer on Warden.</h2>
        <div className="mt-8 flex justify-center gap-2.5">
          <Link href="/docs" className="inline-flex h-9 items-center rounded-[8px] border border-white/15 px-3 text-[14px] font-medium hover:bg-white/5">Read the docs</Link>
          <Link href="/app" className="inline-flex h-9 items-center rounded-[8px] bg-white/10 px-3 text-[14px] font-medium hover:bg-white/15">Start monitoring</Link>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  const cols: [string, [string, string][]][] = [
    ['Platform', [['/#platform', 'Monitor'], ['/#platform', 'Firewall'], ['/#signals', 'Threat Network'], ['/app', 'Dashboard']]],
    ['Developers', [['/docs#quickstart', 'Quickstart'], ['/docs#check', 'Check API'], ['/docs#sdk', 'TypeScript SDK'], ['/docs#prepay', 'x402 pre-pay']]],
    ['Security', [['/docs#holds', 'Holds and approvals'], ['/docs#codes', 'Reason codes'], ['/docs#webhooks', 'Alert webhooks']]],
    ['Company', [['/#changelog', 'Changelog'], ['/docs#status', 'What is live']]],
  ]
  return (
    <footer data-dark className="border-t border-white/10 bg-[#111111] text-white">
      <div className="mx-auto grid max-w-[1392px] grid-cols-2 gap-10 px-6 py-16 sm:px-10 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
        <Link href="/" className="col-span-2 flex items-center gap-2 text-[22px] font-semibold tracking-[-0.03em] lg:col-span-1"><Mark size={24} className="invert" />warden</Link>
        {cols.map(([t, links]) => (
          <div key={t}>
            <div className="text-[13px] text-[#6e717a]">{t}</div>
            <ul className="mt-3 space-y-2 text-[13.5px] text-white/85">{links.map(([h, l]) => <li key={l}><Link href={h} className="hover:text-white">{l}</Link></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1392px] flex-col gap-2 border-t border-white/10 px-6 py-6 text-[12px] text-[#6e717a] sm:flex-row sm:justify-between sm:px-10">
        <span>Warden can block a transaction. It can never move your funds.</span>
        <span>© 2026 Warden</span>
      </div>
    </footer>
  )
}
