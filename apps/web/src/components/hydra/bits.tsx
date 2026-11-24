'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export const ORANGE = '#7c5cff'
export const YELLOW = '#5b8cff'

/** Warden's pixel mark: a 7×7 shield split by a gate line. */
export function PixelMark({ size = 22, color = ORANGE }: { size?: number; color?: string }) {
  const rows = ['###.###', '###.###', '#######', '#######', '.#####.', '..###..', '...#...']
  return (
    <svg viewBox="0 0 7 7" width={size} height={size} shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? <rect key={`${x}${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)))}
    </svg>
  )
}

export const Label = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`font-mono text-[13px] uppercase tracking-[0.08em] text-[#7c5cff] ${className}`}>{'// '}{children}{' //'}</div>
)

export const DoubleRule = () => (
  <div aria-hidden><div className="h-px bg-[#7c5cff]" /><div className="mt-[7px] h-px bg-white/25" /></div>
)

/** Value that scrambles through pixel glyphs before settling, when scrolled into view. */
export function Scramble({ value, className = '' }: { value: string; className?: string }) {
  const [out, setOut] = useState(value.replace(/[0-9]/g, '0'))
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current!
    let id = 0
    const glyphs = '0123456789%<>~'
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return
      io.disconnect()
      let n = 0
      id = window.setInterval(() => {
        n++
        setOut(value.split('').map((c, i) => (/[0-9]/.test(c) && n < 14 + i * 2 ? glyphs[Math.floor(Math.random() * glyphs.length)] : c)).join(''))
        if (n > 14 + value.length * 2) { clearInterval(id); setOut(value) }
      }, 45)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); clearInterval(id) }
  }, [value])
  return <span ref={ref} className={className}>{out}</span>
}

/** Hero animation: a pixel graph of wallets and recipients, with checks flowing along the edges. */
export function PixelGraph({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const CELL = 6
    let w = 0, h = 0, raf = 0
    type N = { x: number; y: number; k: 'wallet' | 'recipient' | 'bad' }
    let nodes: N[] = [], edges: [number, number][] = []
    const pulses: { e: number; t: number; bad: boolean }[] = []
    const build = () => {
      const r = c.getBoundingClientRect()
      w = Math.floor(r.width / CELL); h = Math.floor(r.height / CELL)
      c.width = w * CELL; c.height = h * CELL
      let seed = 7
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
      nodes = []
      for (let i = 0; i < 4; i++) nodes.push({ x: Math.floor(w * (0.18 + rnd() * 0.2)), y: Math.floor(h * (0.15 + i * 0.22)), k: 'wallet' })
      for (let i = 0; i < 9; i++) nodes.push({ x: Math.floor(w * (0.55 + rnd() * 0.38)), y: Math.floor(h * (0.08 + rnd() * 0.84)), k: i === 2 || i === 6 ? 'bad' : 'recipient' })
      edges = []
      for (let a = 0; a < 4; a++) for (let b = 4; b < nodes.length; b++) if (rnd() > 0.55) edges.push([a, b])
    }
    const line = (x0: number, y0: number, x1: number, y1: number, color: string) => {
      ctx.fillStyle = color
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
      let err = dx + dy, x = x0, y = y0, k = 0
      for (;;) {
        if (k++ % 2 === 0) ctx.fillRect(x * CELL + 2, y * CELL + 2, 2, 2)
        if (x === x1 && y === y1) break
        const e2 = 2 * err
        if (e2 >= dy) { err += dy; x += sx }
        if (e2 <= dx) { err += dx; y += sy }
      }
    }
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      for (const [a, b] of edges) line(nodes[a]!.x, nodes[a]!.y, nodes[b]!.x, nodes[b]!.y, 'rgba(255,255,255,0.22)')
      for (const n of nodes) {
        const s = n.k === 'wallet' ? 3 : 2
        ctx.fillStyle = n.k === 'wallet' ? '#ffffff' : n.k === 'bad' ? ORANGE : 'rgba(255,255,255,0.55)'
        ctx.fillRect((n.x - 1) * CELL, (n.y - 1) * CELL, s * CELL - 1, s * CELL - 1)
      }
      if (!reduce && Math.random() < 0.06 && edges.length) {
        const e = Math.floor(Math.random() * edges.length)
        pulses.push({ e, t: 0, bad: nodes[edges[e]![1]]!.k === 'bad' })
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]!, [a, b] = edges[p.e]!
        p.t += 0.012
        const stopAt = p.bad ? 0.82 : 1
        const t = Math.min(p.t, stopAt)
        const x = Math.round(nodes[a]!.x + (nodes[b]!.x - nodes[a]!.x) * t), y = Math.round(nodes[a]!.y + (nodes[b]!.y - nodes[a]!.y) * t)
        ctx.fillStyle = p.bad ? ORANGE : YELLOW
        ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1)
        if (p.bad && p.t >= stopAt) { ctx.fillStyle = ORANGE; ctx.fillRect((x - 1) * CELL, (y - 1) * CELL, CELL * 3 - 1, CELL * 3 - 1) }
        if (p.t > stopAt + 0.25) pulses.splice(i, 1)
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    build(); draw()
    const ro = new ResizeObserver(() => { build() })
    ro.observe(c)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  return <canvas ref={ref} className={className} style={{ imageRendering: 'pixelated' }} aria-hidden />
}

/** Corner brackets used around stats. */
export const Brackets = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`group relative ${className}`}>
    {(['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'left-0 bottom-0 border-l border-b', 'right-0 bottom-0 border-r border-b'] as const).map((p) => (
      <span key={p} className={`pointer-events-none absolute size-3.5 border-[#7c5cff] transition-all duration-300 group-hover:size-5 group-hover:border-[#c8b9ff] ${p}`} />
    ))}
    {children}
  </div>
)

export function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="divide-y divide-[#120b22]/10 border-y border-[#120b22]/10">
      {items.map(([q, a], i) => (
        <div key={q} className="group">
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-3 py-3.5 text-left font-[family-name:var(--font-geist-pixel-square)] text-[17px] tracking-[-0.01em] text-[#120b22] transition-colors hover:bg-[#7c5cff]/[0.06] sm:text-[19px]" aria-expanded={open === i}>
            <span className="transition-transform duration-200 group-hover:translate-x-1">{q}</span>
            <span className={`relative size-4 shrink-0 transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`}><span className="absolute left-0 top-1/2 h-[2px] w-4 -translate-y-1/2 bg-[#120b22]" /><span className={`absolute left-1/2 top-0 h-4 w-[2px] -translate-x-1/2 bg-[#120b22] transition-transform duration-300 ${open === i ? 'scale-y-0' : ''}`} /></span>
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden"><p className="px-3 pb-5 text-[15px] leading-relaxed text-[#120b22]/65">{a}</p></div>
          </div>
        </div>
      ))}
    </div>
  )
}

const LOGOS: { n: string; src: string; w: number; word?: boolean; href: string }[] = [
  { n: 'Solana', src: '/logos/solana.svg', w: 26, href: 'https://solana.com' },
  { n: 'Squads', src: '/logos/squads.svg', w: 104, word: true, href: 'https://squads.xyz' },
  { n: 'Helius', src: '/logos/helius.svg', w: 96, word: true, href: 'https://www.helius.dev' },
  { n: 'Jupiter', src: '/logos/jupiter.svg', w: 26, href: 'https://jup.ag' },
  { n: 'TypeScript', src: '/logos/typescript.svg', w: 24, href: 'https://www.typescriptlang.org' },
]

/** Logo cells: monochrome at rest; on hover the brackets close in, the logo lifts and its role slides up. */
export function LogoGrid() {
  const roles: Record<string, string> = { Solana: 'mainnet simulation', Squads: 'smart accounts', Helius: 'RPC + streams', Jupiter: 'decoded swaps', TypeScript: '@warden/sdk' }
  return (
    <div className="mx-auto mt-6 grid max-w-[880px] grid-cols-2 gap-2.5 sm:grid-cols-5">
      {LOGOS.map((l) => (
        <a key={l.n} href={l.href} target="_blank" rel="noreferrer" className="group relative flex h-[96px] flex-col items-center justify-center overflow-hidden border border-white/10 bg-[#130c24] transition-colors duration-300 hover:border-[#7c5cff]/60 hover:bg-[#1a1033]">
          {(['left-1.5 top-1.5 border-l border-t', 'right-1.5 top-1.5 border-r border-t', 'left-1.5 bottom-1.5 border-l border-b', 'right-1.5 bottom-1.5 border-r border-b'] as const).map((p) => (
            <span key={p} className={`absolute size-2.5 border-[#c8b9ff] opacity-0 transition-all duration-300 group-hover:opacity-100 ${p} scale-150 group-hover:scale-100`} />
          ))}
          <span className="flex items-center gap-2 transition-transform duration-300 group-hover:-translate-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l.src} alt={l.n} style={{ width: l.w }} className={`opacity-85 transition-[filter,opacity] duration-300 group-hover:opacity-100 ${l.n === 'Jupiter' ? 'grayscale group-hover:grayscale-0' : ''}`} />
            {!l.word && <span className="text-[19px] font-semibold tracking-[-0.03em] text-white">{l.n}</span>}
          </span>
          <span className="absolute bottom-2 translate-y-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#c8b9ff] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">{roles[l.n]}</span>
        </a>
      ))}
    </div>
  )
}

const CASES = [
  {
    id: 'TRADING AGENTS', lead: 'Trade on your own. Wake up to a full wallet.',
    rows: ['Swaps on known venues take the fast path, with no model call.', 'Transfers out to brand-new wallets wait for you.', 'Pre-approved routes for your own exchange deposit address.'],
  },
  {
    id: 'PAYMENT AGENTS', lead: 'Pay for APIs. Never for a planted address.',
    rows: ['x402 payment requests are checked before your agent pays.', 'Price jumps on a known endpoint are held, not paid.', 'The 402 response is treated as untrusted context.'],
  },
  {
    id: 'TREASURY AGENTS', lead: 'Move funds rarely. Never by surprise.',
    rows: ['Allowlisted recipients only; everything else is blocked.', 'Every new route needs an owner signature.', 'Audit trail of every verdict, reason and approval.'],
  },
  {
    id: 'AGENT PLATFORMS', lead: 'Ship protection by default for every agent you launch.',
    rows: ['One SDK wrapper around the agent’s signer.', 'Shadow mode first, so builders trust the verdicts.', 'Shared threat data protects every agent on the platform.'],
  },
  {
    id: 'AGENT FLEETS', lead: 'Know what every agent spends. Stop anything weird.',
    rows: ['Live, decoded feed for every wallet, no code needed.', 'Drain patterns and new token approvals raise critical alerts.', 'One kill switch for one wallet or the whole fleet.'],
  },
]

export function UseCases() {
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(true)
  const [k, setK] = useState(0)
  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => setK((x) => { if (x >= 100) { setI((n) => (n + 1) % CASES.length); return 0 } return x + 2 }), 100)
    return () => clearInterval(id)
  }, [auto])
  const c = CASES[i]!
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] border-y border-white/10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="border-white/10 lg:border-r">
        {CASES.map((x, n) => (
          <button key={x.id} onClick={() => { setI(n); setAuto(false); setK(0) }}
            className={`block w-full border-b border-white/10 px-6 text-left transition-colors last:border-b-0 sm:px-8 ${n === i ? 'border-b-2 border-b-[#7c5cff] bg-[#1a1033] py-6' : 'py-5 hover:bg-white/[0.04] hover:pl-9'}`}>
            <div className={`font-mono text-[15px] tracking-[0.12em] ${n === i ? 'text-[#7c5cff]' : 'text-white/85'}`}>{String(n + 1).padStart(2, '0')} {x.id}</div>
            {n === i && <div className="mt-3 max-w-md text-[17px] leading-snug text-white">{x.lead}</div>}
            {n === i && auto && <div className="mt-4 h-px bg-white/10"><div className="h-full bg-[#c8b9ff] transition-[width] duration-100 ease-linear" style={{ width: `${k}%` }} /></div>}
          </button>
        ))}
      </div>
      <div className="border-t border-white/10 lg:border-t-0">
        <div key={c.id} className="border-b border-white/10 px-6 py-7 [animation:fadeUp_.5s_ease-out] sm:px-8">
          <h3 className="font-[family-name:var(--font-geist-pixel-square)] text-[24px] leading-[1.15] tracking-[-0.01em] text-white sm:text-[28px]">{c.lead}</h3>
        </div>
        {c.rows.map((r, n) => (
          <div key={c.id + r} className="group flex items-center gap-4 border-b border-white/10 px-6 py-5 opacity-0 last:border-b-0 [animation:fadeUp_.5s_ease-out_forwards] sm:px-8" style={{ animationDelay: `${120 + n * 110}ms` }}>
            <span className="flex size-7 shrink-0 items-center justify-center bg-white text-[#0b0716] transition-colors group-hover:bg-[#7c5cff] group-hover:text-white"><span className="font-mono text-[14px] leading-none">→</span></span>
            <span className="max-w-[300px] text-[14px] leading-snug text-white/85">{r}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Concentric hexagons for the stats moment. */
export function Hexagons() {
  const hexPath = (r: number) => Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k - Math.PI / 2; return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * 0.62).toFixed(1)}` }).join(' ')
  return (
    <svg viewBox="-720 -270 1440 540" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      {Array.from({ length: 16 }, (_, k) => 60 + k * 48).map((r, k) => <polygon key={r} points={hexPath(r)} fill="none" stroke={ORANGE} strokeOpacity={0.75 - k * 0.04} strokeWidth="1" />)}
      {Array.from({ length: 12 }, (_, k) => k).map((k) => <line key={k} x1={-720 + k * 33} y1={-270} x2={-720 + k * 33} y2={270} stroke={ORANGE} strokeOpacity={0.12 + (k % 4) * 0.05} />)}
      {Array.from({ length: 12 }, (_, k) => k).map((k) => <line key={`r${k}`} x1={720 - k * 33} y1={-270} x2={720 - k * 33} y2={270} stroke={ORANGE} strokeOpacity={0.12 + (k % 4) * 0.05} />)}
    </svg>
  )
}
