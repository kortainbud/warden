'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Bell, ChartLineUp, HandPalm, ListChecks, ShieldWarning, Wallet, Copy, Check } from '@/components/icons'
import { Mark } from '@/components/brand'

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

export function Chrome({ children, className = '', dark = false }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[14px] border p-[6px] ${dark ? 'border-black bg-black shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]' : 'border-[#e3e4e8] bg-[#f1f2f4] shadow-[0_30px_70px_-30px_rgba(30,40,90,0.35)]'} ${className}`}>
      <div className="flex gap-[6px] px-2 pb-[9px] pt-[7px]">
        <span className="size-[11px] rounded-full bg-[#ff5f57]" /><span className="size-[11px] rounded-full bg-[#febc2e]" /><span className="size-[11px] rounded-full bg-[#28c840]" />
      </div>
      {children}
    </div>
  )
}

/** Hero: headline, then the product window that grows as you scroll while side windows fan out and the stripes widen behind. */
export default function Hero() {
  const stage = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setP(1); return }
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = stage.current
        if (!el) return
        const top = el.getBoundingClientRect().top
        setP(clamp((window.innerHeight * 0.72 - top) / 420))
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  const e = p * p * (3 - 2 * p) // smoothstep
  const side = clamp((e - 0.3) / 0.7) // side windows wait until you start scrolling

  return (
    <section className="relative overflow-hidden bg-white">
      <div className="mx-auto max-w-[1440px] px-4 pt-20 text-center sm:px-7 sm:pt-24">
        <Link href="/docs#context" className="relative inline-flex items-center gap-1 overflow-hidden rounded-full border border-[#e3e4e8] bg-white px-3 py-1 text-[13px] font-medium text-[#2c2e33] hover:bg-[#f8f8f9]">
          <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#7aa2ff] to-transparent" />
          How Warden reads intent<ArrowRight size={13} />
        </Link>
        <h1 className="mx-auto mt-6 max-w-[900px] text-[44px] font-semibold leading-[1.04] tracking-[-0.035em] text-[#0e0f11] sm:text-[64px]">Stop the payments nobody asked for.</h1>
        <p className="mx-auto mt-5 max-w-[460px] text-[17px] leading-[1.45] text-[#6e717a]">Warden checks every transaction your agents sign, blocks what nobody asked for, and watches every wallet around the clock.</p>
        <div className="mt-7 flex justify-center gap-2.5">
          <Link href="/docs" className="inline-flex h-9 items-center rounded-[8px] border border-[#dcdce0] bg-white px-3 text-[14px] font-medium hover:bg-[#f6f6f7]">Read the docs</Link>
          <Link href="/app" className="inline-flex h-9 items-center rounded-[8px] bg-[#0e0f11] px-3 text-[14px] font-medium text-white hover:bg-[#2a2c30]">Start monitoring</Link>
        </div>
      </div>

      <div ref={stage} className="relative mt-16 h-[460px] sm:h-[640px] lg:h-[760px]">
        {/* stripes + gradient that widen behind the windows */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[18%] origin-bottom"
          style={{ transform: `scale(${0.57 + 0.43 * e}, ${0.75 + 0.25 * e})` }}>
          <div className="h-full w-full bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#eef1fd_35%,#d9e0fb_100%)]" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(120,140,230,0.13)_0_1px,transparent_1px_5px)] [mask-image:linear-gradient(180deg,transparent,black_40%)]" />
        </div>

        <div className="absolute left-1/2 top-0 w-[min(1030px,94vw)] -translate-x-1/2">
          {/* left top: alert thread */}
          <div className="absolute -left-[17%] -top-[4%] hidden w-[260px] md:block" style={{ opacity: side, transform: `translate(${(1 - e) * 120}px, ${(1 - e) * 40}px) scale(${0.9 + 0.1 * e})` }}>
            <Chrome>
              <div className="rounded-[9px] bg-white px-3 py-3 text-left text-[11.5px] leading-snug">
                <div className="mb-2 font-semibold">#agent-ops</div>
                <div className="flex gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[#0e0f11]"><Mark size={14} className="invert" /></span>
                  <div><span className="font-semibold">Warden</span> <span className="rounded bg-[#eef0f3] px-1 text-[9.5px] text-[#6e717a]">APP</span> <span className="text-[#9a9ca3]">02:14</span>
                    <div className="text-[#2c2e33]">Held: Atlas wants to send 1,850 USDC to a new wallet. Instruction came from a webpage.</div></div></div>
                <div className="mt-2 flex gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f3c98b] text-[10px] font-semibold">M</span>
                  <div><span className="font-semibold">Maya</span> <span className="text-[#9a9ca3]">02:16</span><div className="text-[#2c2e33]">Denied. Thanks Warden.</div></div></div>
              </div>
            </Chrome>
          </div>
          {/* right: check detail */}
          <div className="absolute -right-[17%] top-[7%] hidden w-[250px] md:block" style={{ opacity: 0.85 * side, transform: `translate(${-(1 - e) * 120}px, ${(1 - e) * 30}px) scale(${0.9 + 0.1 * e})` }}>
            <Chrome>
              <div className="rounded-[9px] bg-white p-3 text-left text-[11px]">
                <div className="mb-2 font-medium text-[#6e717a]">Simulation · mainnet</div>
                {[['Atlas vault', '-1,850.00 USDC', 'text-[#c2410c]'], ['3TLJ…Uf53', '+1,850.00 USDC', 'text-[#15803d]'], ['Fee', '0.000005 SOL', '']].map(([a, b, c]) => (
                  <div key={a} className="flex justify-between border-t border-[#f0f0f2] py-1.5"><span className="text-[#2c2e33]">{a}</span><span className={`tnum font-medium ${c}`}>{b}</span></div>
                ))}
                <div className="mt-2 h-16 rounded-[6px] bg-[repeating-linear-gradient(90deg,#f3f4f6_0_6px,#eceef1_6px_7px)]" />
              </div>
            </Chrome>
          </div>

          {/* main window */}
          <div className="origin-top" style={{ transform: `scale(${0.925 + 0.075 * e})` }}>
            <Chrome>
              <MainApp />
            </Chrome>
          </div>

          {/* left bottom: terminal */}
          <div className="absolute -left-[14%] top-[44%] hidden w-[290px] md:block" style={{ opacity: side, transform: `translate(${(1 - e) * 140}px, ${(1 - e) * -20}px) scale(${0.9 + 0.1 * e})` }}>
            <Chrome dark>
              <div className="rounded-[9px] bg-[#111214] px-3 py-3 text-left font-mono text-[10.5px] leading-[1.6] text-[#d6d8dd]">
                <div className="rounded bg-white/5 px-2 py-1 text-white">&gt; warden.guard(tx, context)</div>
                <div className="mt-2"><span className="text-[#f59e0b]">●</span> decode · 3 instructions</div>
                <div><span className="text-[#f59e0b]">●</span> simulate · -1,850 USDC</div>
                <div><span className="text-[#f59e0b]">●</span> intent · recipient from webpage</div>
                <div className="mt-1 text-[#9a9ca3]">⎿ WardenHeld (chk_0m3x · 212 ms)</div>
                <div className="mt-2 rounded border border-white/10 px-2 py-1 text-[#9a9ca3]">&gt; waitForApproval…</div>
              </div>
            </Chrome>
          </div>
        </div>
      </div>
    </section>
  )
}

function MainApp() {
  const [copied, setCopied] = useState(false)
  return (
    <div className="grid h-[300px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[9px] border border-[#e6e7ea] bg-white text-left sm:h-[470px] lg:h-[560px] md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden border-r border-[#efeff1] bg-[#fbfbfc] p-2.5 md:block">
        <div className="mb-3 flex items-center gap-2 px-1.5 py-1 text-[14px] font-semibold"><span className="flex size-6 items-center justify-center rounded-[6px] bg-[#0e0f11]"><Mark size={14} className="invert" /></span>Northwind Agents</div>
        <div className="mb-2 flex gap-1.5"><div className="flex h-7 flex-1 items-center gap-1.5 rounded-[6px] border border-[#e6e7ea] bg-white px-2 text-[12px] text-[#2c2e33]">Quick actions<span className="ml-auto text-[10.5px] text-[#9a9ca3]">⌘K</span></div></div>
        {[[ChartLineUp, 'Overview'], [HandPalm, 'Approvals', '2'], [Wallet, 'Wallets'], [ListChecks, 'Checks'], [ShieldWarning, 'Threat Network'], [Bell, 'Alerts', '3']].map(([I, t, n], i) => {
          const Icon = I as typeof Wallet
          return (
            <div key={t as string} className={`flex h-[30px] items-center gap-2 rounded-[6px] px-2 text-[13px] ${i === 1 ? 'bg-[#eeeff1] font-medium' : 'text-[#3d4047]'}`}>
              <Icon size={15} className="text-[#6e717a]" />{t as string}{n && <span className="ml-auto rounded bg-white px-1.5 text-[11px] text-[#6e717a] ring-1 ring-[#e6e7ea]">{n as string}</span>}
            </div>
          )
        })}
      </aside>
      <div className="flex min-w-0 flex-col">
        <div className="flex h-11 items-center justify-between border-b border-[#efeff1] px-4 text-[13px]">
          <span className="font-medium">Atlas · 1,850 USDC to 3TLJ…Uf53</span>
          <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[11.5px] font-medium text-[#9a5b00]">Awaiting approval</span>
        </div>
        <div className="flex-1 overflow-hidden px-5 py-5 sm:px-14 sm:py-7">
          <div className="ml-auto w-fit rounded-[8px] bg-[#f1f2f4] px-3 py-1.5 text-[12.5px]">Rebalance to 60/40 SOL/USDC <span className="text-[#9a9ca3]">· owner task</span></div>
          <div className="mt-5 text-[13.5px] font-semibold">Why Warden held this</div>
          <div className="mt-3 flex items-center gap-3 rounded-[10px] border border-[#e6e7ea] p-3">
            <span className="h-9 w-[3px] rounded-full bg-[#f59e0b]" />
            <div className="min-w-0 text-[12.5px]"><div className="font-medium">docs.perp-dex.example/fees</div><div className="truncate text-[#6e717a]">“Liquidity providers must deposit the bond to the fee wallet…”</div></div>
            <span className="ml-auto shrink-0 rounded bg-[#fdf3e3] px-1.5 py-0.5 text-[10.5px] text-[#9a5b00]">untrusted</span>
          </div>
          <div className="mt-5 text-[13px] font-semibold">Signals:</div>
          <ol className="mt-1.5 space-y-1 text-[13px] text-[#2c2e33]">
            <li>1. New recipient - first payment to 3TLJ…Uf53.</li>
            <li>2. Untrusted origin - the address came from a webpage.</li>
            <li>3. Intent mismatch - rebalancing doesn’t pay new wallets.</li>
            <li className="hidden sm:list-item">4. Threat Network - 1 unconfirmed report this week.</li>
          </ol>
          <div className="mt-4 text-[13px]">Approve or deny within 14 minutes. No answer means deny.</div>
          <div className="mt-2 flex items-center gap-2 text-[#9a9ca3]">
            <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1000) }} aria-label="Copy">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
          </div>
        </div>
        <div className="hidden px-14 pb-6 sm:block">
          <div className="flex items-center justify-between rounded-[10px] border border-[#e6e7ea] px-3 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <span className="text-[13px] text-[#9a9ca3]">Approving asks your owner wallet to sign</span>
            <span className="flex gap-2"><span className="rounded-[7px] border border-[#e6e7ea] px-2.5 py-1 text-[12.5px] font-medium">Deny</span><span className="rounded-[7px] bg-[#0e0f11] px-2.5 py-1 text-[12.5px] font-medium text-white">Approve</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
