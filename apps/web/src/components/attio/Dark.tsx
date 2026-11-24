'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileCode, Fingerprint, Gauge, ListChecks, Radar, ShieldCheck, Key, Zap, Wallet, Bell, Landmark, ScanSearch, Scale, Snowflake, Signature, GearSix } from '@/components/icons'
import { Badge } from './Platform'

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

function useProgress(ref: React.RefObject<HTMLElement | null>, span = 0.8) {
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        setP(clamp((window.innerHeight - r.top) / (window.innerHeight * span)))
      })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [ref, span])
  return p
}

const stripes = 'bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.028)_0_1px,transparent_1px_7px)]'

/** "The only ... with ..." moment: giant word over a rainbow horizon that rises as you scroll. */
export function ContextArc() {
  const ref = useRef<HTMLDivElement>(null)
  const p = useProgress(ref, 1)
  const rise = 1 - p
  return (
    <div ref={ref} className={`relative h-[560px] overflow-hidden sm:h-[720px] ${stripes}`}>
      <div className="relative z-10 pt-[150px] text-center sm:pt-[230px]">
        <div className="text-[15px] font-medium text-[#8a8d95]">Every check runs on</div>
        <div className="mt-2 text-[56px] font-semibold leading-none tracking-[-0.04em] text-white sm:text-[96px]">Provenance</div>
      </div>
      <div className="absolute left-1/2 aspect-square w-[175%] -translate-x-1/2 sm:w-[130%]" style={{ top: `${58 + rise * 30}%` }}>
        <div className="absolute -inset-[34px] rounded-full opacity-45 blur-[12px] [background:linear-gradient(90deg,#ff4d12_0%,#ff9a1f_18%,#f3d24a_32%,#d8ef9b_46%,#9ff0d9_58%,#5cc8ff_74%,#4c6dff_90%,#3b3fff_100%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-36px),rgba(0,0,0,0.85)_calc(100%-33px),transparent_100%)]" />
        <div className="absolute inset-0 rounded-full [background:linear-gradient(90deg,#ff4d12_0%,#ff9a1f_18%,#f3d24a_32%,#eaf7c8_46%,#c6f5e8_58%,#7fd4ff_74%,#5a7bff_90%,#4a4dff_100%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))]" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(farthest-side,transparent_calc(100%-90px),rgba(255,255,255,0.05)_100%)]" />
        <div className="absolute inset-[2px] rounded-full bg-[#111111]" />
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: ListChecks, t: 'It logs itself.', d: 'Every check, verdict, reason and override, recorded.' },
  { icon: Fingerprint, t: 'Reads provenance.', d: 'Owner, schedule, tweet, webpage, tool output: tagged.' },
  { icon: Zap, t: 'Simulates first.', d: 'Exact balance changes before anything is signed.' },
  { icon: Gauge, t: 'Learns from you.', d: 'Each approval or denial becomes a label for tuning.' },
  { icon: ShieldCheck, t: 'Fails closed.', d: 'If Warden can’t check it, it doesn’t get signed.' },
]

export function FeatureRow() {
  return (
    <div className="grid grid-cols-1 border-y border-white/10 sm:grid-cols-2 lg:grid-cols-5">
      {FEATURES.map(({ icon: I, t, d }, i) => (
        <div key={t} className={`flex min-h-[180px] flex-col justify-between px-7 py-6 ${i ? 'border-t border-white/10 lg:border-l lg:border-t-0' : ''} ${i % 2 ? 'sm:border-l' : ''}`}>
          <I size={18} className="text-[#8a8d95]" />
          <div className="mt-10">
            <div className="text-[15px] font-medium text-white">{t}</div>
            <div className="mt-1 max-w-[200px] text-[14px] leading-snug text-[#8a8d95]">{d}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Perspective funnel of rings with signals streaming toward the center. */
function Vortex() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dots = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2 + 0.3, t: Math.random(), v: 0.0018 + Math.random() * 0.0018 }))
    let raf = 0
    const ring = (t: number) => ({ rx: 30 + t * 330, ry: 12 + t * 120, dy: (1 - t) * 70 })
    const draw = () => {
      const dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const s = Math.min(w / 760, h / 560), cx = w / 2, cy = h * 0.5
      ctx.lineWidth = 1
      for (const t of [0.12, 0.25, 0.42, 0.64, 0.9, 1.25]) {
        const { rx, ry, dy } = ring(t)
        ctx.strokeStyle = `rgba(255,255,255,${0.09 + 0.08 * Math.min(1, t)})`
        ctx.beginPath(); ctx.ellipse(cx, cy + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        ctx.beginPath()
        for (let k = 0; k <= 20; k++) {
          const t = 0.08 + (k / 20) * 1.4
          const { rx, ry, dy } = ring(t)
          const x = cx + Math.cos(a) * rx * s, y = cy + dy * s + Math.sin(a) * ry * s
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
        }
        ctx.stroke()
      }
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke()
      for (const d of dots) {
        if (!reduce) { d.t -= d.v; d.a += 0.004; if (d.t < 0.1) { d.t = 1.4; d.a = Math.random() * Math.PI * 2 } }
        const pos = (t: number) => { const { rx, ry, dy } = ring(t); return [cx + Math.cos(d.a - (1.4 - t) * 0.3) * rx * s, cy + dy * s + Math.sin(d.a - (1.4 - t) * 0.3) * ry * s] as const }
        const [x, y] = pos(d.t)
        const grad = ctx.createLinearGradient(...pos(d.t + 0.18), x, y)
        grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(255,255,255,0.8)')
        ctx.strokeStyle = grad; ctx.lineWidth = 1.2
        ctx.beginPath()
        for (let k = 0; k <= 8; k++) { const [px, py] = pos(d.t + 0.18 * (1 - k / 8)); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py) }
        ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill()
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="h-full w-full" aria-hidden />
}

const TABS = [
  { t: 'Context', d: 'Task, trigger and inputs, tagged by source and decoded. Hidden text included.' },
  { t: 'Simulation', d: 'Exact balance changes for every account, against mainnet, before signing.' },
  { t: 'Threat Network', d: 'Shared reputation from every check across Warden. Live.' },
]

export function Signals() {
  const [i, setI] = useState(0)
  const [k, setK] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setK((x) => { if (x >= 100) { setI((n) => (n + 1) % TABS.length); return 0 } return x + 1 }), 60)
    return () => clearInterval(id)
  }, [])
  return (
    <div id="signals" className="grid scroll-mt-14 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
      <div className="flex flex-col justify-between px-7 py-20 sm:px-14 lg:min-h-[760px]">
        <div className="lg:pt-24">
          <Badge dark>Signals</Badge>
          <h2 className="mt-5 max-w-[460px] text-[34px] font-medium leading-[1.12] tracking-[-0.025em] text-white sm:text-[40px]">All of the signals, none of the noise. <span className="text-[#8a8d95]">Ready to block.</span></h2>
          <Link href="/docs#context" className="mt-7 inline-flex h-8 items-center gap-1 rounded-[7px] border border-white/15 px-2.5 text-[13px] text-white hover:bg-white/5">See how<ArrowRight size={13} /></Link>
        </div>
        <div className="mt-16 max-w-[580px] space-y-5">
          {TABS.map((tab, n) => (
            <button key={tab.t} onClick={() => { setI(n); setK(0) }} className="block w-full text-left">
              <div className={`text-[17px] ${n === i ? 'text-white' : 'text-[#8a8d95]'}`}>{tab.t}</div>
              {n === i && <>
                <div className="mt-1 max-w-[300px] text-[15px] leading-snug text-[#8a8d95]">{tab.d}</div>
                <div className="mt-4 h-px w-full bg-white/10"><div className="h-full bg-white/70" style={{ width: `${k}%` }} /></div>
              </>}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[420px] border-t border-white/10 sm:h-[560px] lg:h-auto lg:border-l lg:border-t-0"><Vortex /></div>
    </div>
  )
}

const TILE_ICONS = [Wallet, Key, Bell, Radar, FileCode, Landmark, ScanSearch, Scale, Snowflake, Signature, GearSix, ShieldCheck]

export function Connectivity() {
  return (
    <div className="border-t border-white/10 py-24 text-center sm:py-32">
      <Badge dark>Connectivity</Badge>
      <h2 className="mx-auto mt-5 max-w-[640px] px-6 text-[34px] font-medium leading-[1.12] tracking-[-0.025em] text-white sm:text-[40px]">Fits your whole agent stack.</h2>
      <p className="mx-auto mt-3 max-w-[420px] px-6 text-[15px] leading-snug text-[#8a8d95]">Any agent that signs on Solana: one SDK call, one REST request, or a webhook into Slack and your own systems.</p>
      <Link href="/docs#sdk" className="mt-7 inline-flex h-8 items-center gap-1 rounded-[7px] border border-white/15 px-2.5 text-[13px] text-white hover:bg-white/5">Explore the SDK<ArrowRight size={13} /></Link>
      <div className="relative mt-16 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-4">
          {[...TILE_ICONS, ...TILE_ICONS].map((I, n) => (
            <div key={n} className="flex size-[88px] shrink-0 items-center justify-center rounded-[18px] border border-white/[0.06] bg-[#1b1b1d] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <I size={34} strokeWidth={1.8} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Developers() {
  return (
    <div id="developers" className="scroll-mt-14 border-t border-white/10 px-4 py-12 sm:px-8 sm:py-16">
      <div className="relative grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[2px] border border-white/10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <svg className="pointer-events-none absolute right-[4%] top-1/2 hidden h-[120%] -translate-y-1/2 opacity-70 lg:block" viewBox="0 0 24 24" fill="none" aria-hidden>
          <defs><pattern id="hatch" width="0.45" height="0.45" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.45" stroke="rgba(255,255,255,0.09)" strokeWidth="0.06" /></pattern></defs>
          <path d="M12 2.5 4 5.5v6.2c0 4.6 3.3 8.4 8 9.8 4.7-1.4 8-5.2 8-9.8V5.5l-8-3Z" fill="url(#hatch)" stroke="rgba(255,255,255,0.14)" strokeWidth="0.05" />
          <path d="M8 12.2h8M12 8.2v8" stroke="rgba(255,255,255,0.14)" strokeWidth="0.05" />
          {[[12, 2.5], [4, 5.5], [20, 5.5], [4, 11.7], [20, 11.7], [12, 21.5], [8, 12.2], [16, 12.2], [12, 8.2], [12, 16.2]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.18" fill="rgba(255,255,255,0.35)" />)}
        </svg>
        <div className="relative flex flex-col justify-center px-8 py-14 sm:px-12">
          <h2 className="text-[34px] font-medium leading-[1.12] tracking-[-0.025em] text-white sm:text-[40px]">SDK. API. Webhooks.<br /><span className="text-[#8a8d95]">Build anything on Warden.</span></h2>
          <Link href="/docs" className="mt-7 inline-flex h-8 w-fit items-center gap-1 rounded-[7px] border border-white/15 px-2.5 text-[13px] text-white hover:bg-white/5">View docs<ArrowRight size={13} /></Link>
        </div>
        <div className="relative border-t border-white/10 p-4 sm:p-8 lg:border-l lg:border-t-0">
          <div className="overflow-hidden rounded-[10px] border border-white/10 bg-[#0b0b0c]">
            <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3">
              <span className="size-[11px] rounded-full bg-[#ff5f57]" /><span className="size-[11px] rounded-full bg-[#febc2e]" /><span className="size-[11px] rounded-full bg-[#28c840]" />
              <span className="ml-3 font-mono text-[12px] text-white/40">agent.ts</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.75] text-[#c9cdd4]">
<span className="text-[#c792ea]">import</span> {'{ Warden, WardenHeld, WardenBlocked }'} <span className="text-[#c792ea]">from</span> <span className="text-[#c3e88d]">&quot;@warden/sdk&quot;</span>;{'\n\n'}
<span className="text-[#c792ea]">const</span> warden = <span className="text-[#c792ea]">new</span> <span className="text-[#ffcb6b]">Warden</span>({'{ apiKey, baseUrl, wallet: AGENT_WALLET }'});{'\n\n'}
<span className="text-[#c792ea]">try</span> {'{'}{'\n'}
{'  '}<span className="text-[#c792ea]">await</span> warden.<span className="text-[#82aaff]">guard</span>(tx, {'{'}{'\n'}
{'    '}task:    {'{ text: '}<span className="text-[#c3e88d]">&quot;Buy the weather dataset&quot;</span>, source: <span className="text-[#c3e88d]">&quot;owner&quot;</span> {'},'}{'\n'}
{'    '}trigger: {'{ source: '}<span className="text-[#c3e88d]">&quot;web&quot;</span>, origin: docsUrl, excerpt {'},'}{'\n'}
{'  '}{'});'}{'\n'}
{'  '}<span className="text-[#c792ea]">await</span> connection.<span className="text-[#82aaff]">sendTransaction</span>(sign(tx));{'\n'}
{'}'} <span className="text-[#c792ea]">catch</span> (e) {'{'}{'\n'}
{'  '}<span className="text-[#c792ea]">if</span> (e <span className="text-[#c792ea]">instanceof</span> <span className="text-[#ffcb6b]">WardenHeld</span>) <span className="text-[#c792ea]">await</span> warden.<span className="text-[#82aaff]">waitForApproval</span>(e.check.id);{'\n'}
{'  '}<span className="text-[#c792ea]">else if</span> (e <span className="text-[#c792ea]">instanceof</span> <span className="text-[#ffcb6b]">WardenBlocked</span>) log(e.check.reasons);{'\n'}
{'}'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
