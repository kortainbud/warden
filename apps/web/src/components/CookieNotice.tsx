'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const KEY = 'warden.cookies'

/** Informational notice: Warden only sets an essential session cookie, so there is nothing to opt into. */
export default function CookieNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true) } catch { /* storage blocked: stay hidden */ }
  }, [])
  if (!show) return null
  const ok = () => { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } setShow(false) }
  return (
    <div role="region" aria-label="Cookie notice" className="fixed bottom-4 left-4 right-4 z-[100] max-w-[420px] border border-[#3a2f58] bg-[#120b22]/95 p-4 text-[13.5px] text-[#d9d1f5] backdrop-blur [animation:fadeUp_.4s_ease-out] sm:right-auto">
      <div className="flex items-start gap-3">
        <span className="mt-1 grid shrink-0 grid-cols-2 gap-[2px]" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={`size-1.5 ${i === 1 ? 'bg-[#5b8cff]' : 'bg-[#7c5cff]'}`} />)}</span>
        <p className="leading-relaxed">We use one essential cookie to keep you signed in. No ads, no analytics, no tracking. <Link href="/cookies" className="text-[#c8b9ff] underline decoration-[#7c5cff] underline-offset-4">Cookie Policy</Link></p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Link href="/privacy" className="px-3 py-1.5 text-[13px] text-[#a59cc4] hover:text-white">Privacy</Link>
        <button onClick={ok} className="px-btn bg-[#7c5cff] px-3 py-1.5 text-[13px] font-medium text-white">Got it</button>
      </div>
    </div>
  )
}
