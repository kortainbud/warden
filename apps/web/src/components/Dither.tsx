'use client'

import { useEffect, useRef } from 'react'
import { BAYER } from './pixel'

// Light, Global Stack-blue take on Heliveil's dithered sky: low-res canvas, Bayer dithering
// between palette steps, slow cloud drift. Fades to white toward `fadeFrom` so text stays clean.

const PALETTE = ['#0b0716', '#110a22', '#180f30', '#22163f', '#2e1d55', '#3f2878', '#5636a6', '#7c5cff', '#a48cff', '#c8b9ff']
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const

function hash(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s) }
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm(x: number, y: number) { let v = 0, a = 0.5; for (let i = 0; i < 4; i++) { v += a * noise(x, y); x *= 2.03; y *= 2.03; a *= 0.5 } return v }

export default function Dither({ className = '', cell = 4, intensity = 1 }: { className?: string; cell?: number; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const pal = PALETTE.map(hex)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, img: ImageData | null = null, raf = 0, t0 = performance.now()
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = Math.max(1, Math.ceil(r.width / cell)); h = Math.max(1, Math.ceil(r.height / cell))
      canvas.width = w; canvas.height = h
      img = ctx.createImageData(w, h)
    }
    const paint = (t: number) => {
      if (!img) return
      const d = img.data, drift = (t - t0) * 0.00002
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const fx = x / w, fy = y / h
        // brighter toward the right and bottom; clouds drift
        let v = (Math.pow(fx, 1.6) * 0.55 + fy * 0.22 + (fbm(fx * 3.2 + drift * 3, fy * 2.6 + drift) - 0.45) * 0.7) * intensity
        // a small "sun" glow in the upper right
        const dx = (fx - 0.82) * (w / h), dy = fy - 0.28, sd = Math.sqrt(dx * dx + dy * dy)
        v += Math.max(0, 0.32 - sd * 0.9)
        v = Math.max(0, Math.min(0.999, v))
        const p = v * (pal.length - 1), lo = p | 0
        const idx = p - lo > BAYER[(y & 3) * 4 + (x & 3)]! && lo < pal.length - 1 ? lo + 1 : lo
        const c = pal[idx]!, o = (y * w + x) * 4
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }
    let last = 0
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      if (t - last < 80) return // ~12 fps is plenty for slow clouds
      last = t; paint(t)
    }
    resize(); paint(performance.now())
    if (!reduce) raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(() => { resize(); paint(performance.now()) })
    ro.observe(canvas)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [cell, intensity])
  return <canvas ref={ref} className={className} style={{ imageRendering: 'pixelated' }} aria-hidden />
}
