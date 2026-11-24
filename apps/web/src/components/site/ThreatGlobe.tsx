'use client'

import { useEffect, useRef } from 'react'

/**
 * Dotted sphere for the Threat Network: points on a Fibonacci sphere, slowly rotating, with a
 * handful of flagged nodes. Canvas only; static frame when reduced motion is preferred.
 */
export default function ThreatGlobe({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const N = 2600
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const t = i * Math.PI * (3 - Math.sqrt(5))
      // thin out by a pseudo "landmass" noise so it reads as a globe, not a ball
      const n = Math.sin(t * 1.7) * Math.cos(y * 5.1) + Math.sin(y * 9 + t * 0.6)
      return { x: Math.cos(t) * r, y, z: Math.sin(t) * r, keep: n > -0.35, flag: i % 211 === 0 }
    }).filter((p) => p.keep)
    let raf = 0, a = 0.6
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = canvas.clientWidth, h = canvas.clientHeight
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const R = Math.min(w, h) * 0.46, cx = w / 2, cy = h / 2
      const ca = Math.cos(a), sa = Math.sin(a), tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt)
      for (const p of pts) {
        const x = p.x * ca - p.z * sa
        const z0 = p.x * sa + p.z * ca
        const y = p.y * ct - z0 * st
        const z = p.y * st + z0 * ct
        const front = z > 0
        const sx = cx + x * R, sy = cy - y * R
        if (p.flag && front) {
          ctx.fillStyle = 'rgba(220,38,38,0.18)'
          ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#dc2626'
          ctx.beginPath(); ctx.arc(sx, sy, 2.6, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.fillStyle = front ? `rgba(37,99,235,${0.35 + z * 0.6})` : 'rgba(37,99,235,0.07)'
          ctx.fillRect(sx, sy, front ? 1.6 : 1.1, front ? 1.6 : 1.1)
        }
      }
      if (!reduce) { a += 0.0016; raf = requestAnimationFrame(draw) }
    }
    draw()
    const onResize = () => { if (reduce) draw() }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={ref} className={className} aria-hidden />
}
