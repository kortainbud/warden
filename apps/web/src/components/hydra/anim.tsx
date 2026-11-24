'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// Palette: deep purple, lavender, a little blue.
export const C = { bg: '#0b0716', accent: '#7c5cff', lav: '#c8b9ff', blue: '#5b8cff', white: '#f4f1ff' }

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Run `fn` with requestAnimationFrame only while the element is on screen. */
function useVisibleLoop(ref: React.RefObject<HTMLElement | null>, fn: (t: number) => void, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0, on = false
    const loop = (t: number) => { fn(t); if (on && !reduced()) raf = requestAnimationFrame(loop) }
    const io = new IntersectionObserver(([e]) => {
      on = !!e?.isIntersecting
      cancelAnimationFrame(raf)
      if (on) raf = requestAnimationFrame(loop)
    }, { rootMargin: '100px' })
    io.observe(el)
    fn(performance.now())
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// ---------- shield geometry ----------
// Normalised shield outline: x in [-1,1], y in [-1,1] (y down). Flat top with a notch, curved sides, pointed bottom.
function insideShield(x: number, y: number) {
  if (y < -0.92 || y > 1) return false
  const half = y < 0.05 ? 0.86 : 0.86 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.05) / 0.95, 1.7)))
  return Math.abs(x) <= half
}
// The gate line: a slit down the middle of the top half, and a crossbar.
const onGate = (x: number, y: number) => (Math.abs(x) < 0.07 && y < 0.05) || (Math.abs(y - 0.12) < 0.06 && Math.abs(x) < 0.62)

interface P { x: number; y: number; z: number; nx: number; ny: number; nz: number; g: boolean }

function shieldPoints(): P[] {
  const pts: P[] = []
  const D = 0.24
  for (let y = -0.92; y <= 1; y += 0.022) for (let x = -0.9; x <= 0.9; x += 0.022) {
    if (!insideShield(x, y)) continue
    const g = onGate(x, y)
    // inset the gate so it reads as a groove
    pts.push({ x, y, z: g ? D * 0.35 : D, nx: 0, ny: 0, nz: 1, g })
    pts.push({ x, y, z: -D, nx: 0, ny: 0, nz: -1, g: false })
  }
  // side walls: walk the outline
  for (let y = -0.92; y <= 1; y += 0.012) {
    const half = y < 0.05 ? 0.86 : 0.86 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.05) / 0.95, 1.7)))
    const dy = 0.012
    const half2 = (y + dy) < 0.05 ? 0.86 : 0.86 * Math.sqrt(Math.max(0, 1 - Math.pow((y + dy - 0.05) / 0.95, 1.7)))
    const slope = (half2 - half) / dy
    for (const s of [-1, 1]) {
      const len = Math.hypot(1, slope)
      const nx = s / len, ny = -slope / len
      for (let z = -D; z <= D; z += 0.03) pts.push({ x: s * half, y, z, nx, ny, nz: 0, g: false })
    }
  }
  for (let x = -0.86; x <= 0.86; x += 0.02) for (let z = -D; z <= D; z += 0.03) pts.push({ x, y: -0.92, z, nx: 0, ny: -1, nz: 0, g: false })
  return pts
}

const RAMP = ' .,:;-=+*#%@'

/** Hero: Warden's shield, extruded and rendered in ASCII, rotating and following the pointer. */
export function AsciiShield({ className = '' }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const pts = useRef<P[]>([])
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  useEffect(() => {
    pts.current = shieldPoints()
    const on = (e: PointerEvent) => {
      const r = wrap.current?.getBoundingClientRect()
      if (!r) return
      mouse.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2
      mouse.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2
    }
    window.addEventListener('pointermove', on)
    return () => window.removeEventListener('pointermove', on)
  }, [])
  useVisibleLoop(wrap, (t) => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(2, devicePixelRatio || 1)
    const W = c.clientWidth, H = c.clientHeight
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const fs = 11, cw = fs * 0.62, chH = fs * 1.05
    const cols = Math.floor(W / cw), rows = Math.floor(H / chH)
    const m = mouse.current
    m.x += (m.tx - m.x) * 0.06; m.y += (m.ty - m.y) * 0.06
    const a = (reduced() ? 0.35 : Math.sin(t * 0.0006) * 0.55) + m.x * 0.45
    const b = -0.18 + m.y * 0.35
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b)
    const zbuf = new Float32Array(cols * rows).fill(-1e9)
    const lum = new Float32Array(cols * rows).fill(-1)
    const gate = new Uint8Array(cols * rows)
    const scale = Math.min(cols * 0.3, rows * 0.52)
    const L = [-0.35, -0.45, 0.82], ln = Math.hypot(...L)
    for (const p of pts.current) {
      // rotate Y then X
      const x1 = p.x * ca + p.z * sa, z1 = -p.x * sa + p.z * ca
      const y2 = p.y * cb - z1 * sb, z2 = p.y * sb + z1 * cb
      const nx1 = p.nx * ca + p.nz * sa, nz1 = -p.nx * sa + p.nz * ca
      const ny2 = p.ny * cb - nz1 * sb, nz2 = p.ny * sb + nz1 * cb
      const persp = 1 / (2.6 - z2)
      const sx = Math.round(cols / 2 + x1 * scale * persp * 2.6 * 1.45)
      const sy = Math.round(rows / 2 + y2 * scale * persp * 2.6)
      if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue
      const i = sy * cols + sx
      if (z2 <= zbuf[i]!) continue
      zbuf[i] = z2
      const d = (nx1 * L[0]! + ny2 * L[1]! + nz2 * L[2]!) / ln
      lum[i] = 0.28 + 0.72 * Math.max(0, d)
      gate[i] = p.g ? 1 : 0
    }
    ctx.font = `${fs}px ui-monospace, "Geist Mono", monospace`
    ctx.textBaseline = 'top'
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const v = lum[i]!
      if (v < 0) {
        // faint field behind: flickering dots
        if (((x * 7 + y * 13 + Math.floor(t / 180)) % 97) === 0) { ctx.fillStyle = 'rgba(200,185,255,0.16)'; ctx.fillText('·', x * cw, y * chH) }
        continue
      }
      const ch = RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(v * (RAMP.length - 1)))]!
      ctx.fillStyle = gate[i] ? C.blue : v > 0.93 ? C.white : v > 0.62 ? C.lav : C.accent
      ctx.fillText(ch, x * cw, y * chH)
    }
  })
  return <div ref={wrap} className={className}><canvas ref={canvas} className="h-full w-full" aria-hidden /></div>
}

/** Shared threat data: pixels assemble into a shield, then flicker into ASCII and back. */
export function PixelAsciiShield({ className = '' }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useVisibleLoop(wrap, (t) => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const cell = 10, cols = Math.floor(W / cell), rows = Math.floor(H / cell)
    const cycle = 7000, k = (t % cycle) / cycle
    const glyphs = '01#*+=@%$'
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const nx = (x - cols / 2) / (rows * 0.42), ny = (y - rows * 0.5) / (rows * 0.44)
      const inside = insideShield(nx, ny)
      const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
      const px = x * cell, py = y * cell
      if (!inside) {
        if (h > 0.985) { ctx.fillStyle = 'rgba(200,185,255,0.12)'; ctx.fillRect(px + 3, py + 3, 3, 3) }
        continue
      }
      const appear = h * 0.35
      if (k < appear) continue
      const ascii = k > 0.45 && k < 0.85 && h > 0.35
      const flagged = h > 0.93
      if (ascii) {
        ctx.font = '10px ui-monospace, monospace'; ctx.textBaseline = 'top'
        ctx.fillStyle = flagged ? C.blue : h > 0.6 ? C.lav : C.accent
        ctx.fillText(glyphs[Math.floor((h * 97 + t / 120) % glyphs.length)]!, px + 1, py)
      } else {
        ctx.fillStyle = onGate(nx, ny) ? C.blue : flagged ? C.white : h > 0.6 ? C.lav : C.accent
        ctx.globalAlpha = 0.55 + h * 0.45
        ctx.fillRect(px, py, cell - 2, cell - 2)
        ctx.globalAlpha = 1
      }
    }
  })
  return <div ref={wrap} className={className}><canvas ref={canvas} className="h-full w-full" style={{ imageRendering: 'pixelated' }} aria-hidden /></div>
}

/** Built for machine speed: segments racing across lanes. */
export function SpeedLines({ className = '' }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const segs = useRef<{ lane: number; x: number; w: number; v: number; c: string }[]>([])
  useVisibleLoop(wrap, () => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const lanes = 7, gap = H / (lanes + 1)
    for (let l = 1; l <= lanes; l++) { ctx.fillStyle = 'rgba(200,185,255,0.18)'; ctx.fillRect(0, Math.round(l * gap), W, 1) }
    if (segs.current.length < 9 && Math.random() < 0.18) {
      const cols = [C.accent, C.lav, C.blue, C.white]
      segs.current.push({ lane: 1 + Math.floor(Math.random() * lanes), x: -120, w: 30 + Math.random() * 120, v: 6 + Math.random() * 14, c: cols[Math.floor(Math.random() * cols.length)]! })
    }
    for (let i = segs.current.length - 1; i >= 0; i--) {
      const s = segs.current[i]!
      s.x += s.v
      const y = Math.round(s.lane * gap) - 2
      const g = ctx.createLinearGradient(s.x - s.w * 1.6, 0, s.x + s.w, 0)
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, s.c)
      ctx.fillStyle = g
      ctx.fillRect(s.x - s.w * 1.6, y, s.w * 2.6, 5)
      if (s.x - s.w * 1.6 > W) segs.current.splice(i, 1)
    }
  })
  return <div ref={wrap} className={className}><canvas ref={canvas} className="h-full w-full" aria-hidden /></div>
}

/** A pixel tree that grows branch by branch, then starts again. */
export function GrowingTree({ className = '' }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tree = useRef<{ x: number; y: number; d: number }[]>([])
  const start = useRef(0)
  useEffect(() => {
    // Precompute pixels with their growth order (depth along the branch).
    const px: { x: number; y: number; d: number }[] = []
    let seed = 11
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const branch = (x: number, y: number, ang: number, len: number, depth: number, d0: number) => {
      let cx = x, cy = y
      for (let i = 0; i < len; i++) {
        cx += Math.cos(ang); cy += Math.sin(ang)
        px.push({ x: Math.round(cx), y: Math.round(cy), d: d0 + i })
        if (depth < 2) px.push({ x: Math.round(cx) + 1, y: Math.round(cy), d: d0 + i })
        ang += (rnd() - 0.5) * 0.18
      }
      if (depth >= 5) return
      const n = depth < 2 ? 2 : 2 + (rnd() > 0.5 ? 1 : 0)
      for (let k = 0; k < n; k++) branch(cx, cy, ang + (k - (n - 1) / 2) * (0.55 + rnd() * 0.3), Math.max(4, len * (0.62 + rnd() * 0.2)), depth + 1, d0 + len)
    }
    branch(60, 118, -Math.PI / 2, 26, 0, 0)
    tree.current = px
  }, [])
  useVisibleLoop(wrap, (t) => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    c.width = 120; c.height = 120
    if (!start.current) start.current = t
    const maxD = Math.max(1, ...tree.current.map((p) => p.d))
    const k = reduced() ? 1 : ((t - start.current) % 6500) / 4500
    const shown = Math.min(1, k) * maxD
    for (const p of tree.current) {
      if (p.d > shown) continue
      const tip = shown - p.d < 4
      ctx.fillStyle = tip ? C.white : p.d > maxD * 0.7 ? C.blue : p.d > maxD * 0.35 ? C.lav : C.accent
      ctx.fillRect(p.x, p.y, 1, 1)
    }
  })
  return <div ref={wrap} className={className}><canvas ref={canvas} className="h-full w-full" style={{ imageRendering: 'pixelated' }} aria-hidden /></div>
}

/** Count up (with a pixel scramble on the way) when scrolled into view. */
export function CountUp({ to, decimals = 0, prefix = '', suffix = '', className = '' }: { to: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [v, setV] = useState(0)
  useEffect(() => {
    const el = ref.current!
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return
      io.disconnect()
      if (reduced()) { setV(to); return }
      const t0 = performance.now()
      const step = (t: number) => { const k = Math.min(1, (t - t0) / 1400); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step) }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [to])
  return <span ref={ref} className={className}>{prefix}{v.toFixed(decimals)}{suffix}</span>
}

/** Fade and lift children in when they scroll into view. */
export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current!
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setOn(true); io.disconnect() } }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`transition-[opacity,transform] duration-700 ease-out ${on ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/** Becomes true once the element is in view (for grow-in bars). */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setOn(true); io.disconnect() } }, { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, on] as const
}

/** Decode → Simulate → Verdict diamonds lighting up in turn. */
export function Diamonds() {
  const [i, setI] = useState(0)
  useEffect(() => { if (reduced()) return; const id = setInterval(() => setI((x) => (x + 1) % 3), 1100); return () => clearInterval(id) }, [])
  return (
    <div className="flex items-center justify-center">
      <span className="flow-line h-px w-10" /><span className="size-2 bg-[#7c5cff]" />
      <div className="border border-[#c8b9ff]/40 bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(200,185,255,0.05)_10px_11px)] px-6 py-5">
        <div className="text-center text-[13px] text-white/80">Decode -&gt; Simulate -&gt; Verdict</div>
        <div className="mt-5 flex gap-4">
          {['Decode', 'Simulate', 'Verdict'].map((t, n) => (
            <div key={t} className={`flex size-16 rotate-45 items-center justify-center border transition-colors duration-300 ${n === i ? 'border-[#7c5cff] bg-[#7c5cff]' : 'border-white/50'}`}>
              <span className="-rotate-45 text-[10px] text-white">{t}</span>
            </div>
          ))}
        </div>
      </div>
      <span className="size-2 bg-[#7c5cff]" /><span className="flow-line h-px w-10" />
    </div>
  )
}

/** Animated concentric hexagons with signals travelling inward. */
export function HexField() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useVisibleLoop(wrap, (t) => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const cx = W / 2, cy = H / 2
    const hex = (r: number) => { ctx.beginPath(); for (let k = 0; k <= 6; k++) { const a = (Math.PI / 3) * k - Math.PI / 2; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y) } ctx.stroke() }
    const phase = reduced() ? 0 : (t / 2600) % 1
    for (let k = 0; k < 18; k++) {
      const r = 60 + k * 48 - phase * 48
      if (r < 40) continue
      const wave = 0.5 + 0.5 * Math.sin(k * 0.7 - t / 500)
      ctx.strokeStyle = k % 3 === 0 ? `rgba(91,140,255,${0.25 + wave * 0.35})` : `rgba(124,92,255,${0.3 + wave * 0.45 - k * 0.012})`
      ctx.lineWidth = 1
      hex(r)
    }
    for (let k = 0; k < 12; k++) {
      const a = 0.2 + 0.6 * Math.sin(k + t / 900)
      ctx.fillStyle = `rgba(200,185,255,${0.08 + a * 0.12})`
      ctx.fillRect(k * 30, 0, 1, H); ctx.fillRect(W - k * 30, 0, 1, H)
    }
    // signals travelling inward along spokes
    for (let s = 0; s < 6; s++) {
      const a = (Math.PI / 3) * s - Math.PI / 2 + Math.PI / 6
      const p = ((t / 1800 + s * 0.17) % 1)
      const r = 900 * (1 - p) + 70 * p
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62
      ctx.fillStyle = s % 2 ? C.blue : C.lav
      ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6)
    }
  })
  return <div ref={wrap} className="absolute inset-0"><canvas ref={canvas} className="h-full w-full" aria-hidden /></div>
}

/** Footer backdrop: vertical bars with a slow purple light drifting across. */
export function FooterField() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useVisibleLoop(wrap, (t) => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    const lx = (Math.sin(t / 5200) * 0.5 + 0.5) * W
    for (let x = 0; x < W; x += 34) {
      const d = Math.abs(x - lx) / W
      const a = Math.max(0.04, 0.38 - d * 0.9)
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, `rgba(124,92,255,${a})`); g.addColorStop(1, 'rgba(124,92,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(x, 0, 1, H)
    }
  })
  return <div ref={wrap} className="pointer-events-none absolute inset-0"><canvas ref={canvas} className="h-full w-full" aria-hidden /></div>
}

/** Stacked bar whose segments grow in when scrolled into view. */
export function BudgetBar({ parts }: { parts: [string, number, string][] }) {
  const [ref, on] = useInView<HTMLDivElement>()
  const total = parts.reduce((a, p) => a + p[1], 0)
  return (
    <div ref={ref}>
      <div className="flex h-14 w-full overflow-hidden bg-white/[0.04]">
        {parts.map(([l, v, c], i) => (
          <div key={l} title={`${l}: ${v} ms`} className="h-full transition-[width] duration-700 ease-out hover:brightness-125" style={{ width: on ? `${(v / total) * 100}%` : '0%', background: c, transitionDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-white/40"><span>0</span><span>{total / 2}</span><span>{total} ms</span></div>
    </div>
  )
}

/** Thin bar that grows to full width once visible. */
export function GrowLine({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  const [ref, on] = useInView<HTMLSpanElement>()
  return <span ref={ref} className={`block h-[2px] bg-[#c8b9ff] transition-[width] duration-700 ease-out ${className}`} style={{ width: on ? '100%' : '0%', transitionDelay: `${delay}ms` }} />
}
