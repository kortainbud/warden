'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, X } from '@/components/icons'
import { Mark } from '@/components/brand'

/** Announcement bar + sticky header that turns dark over sections marked data-dark. */
export default function Header() {
  const [dark, setDark] = useState(false)
  const [bar, setBar] = useState(true)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const check = () => {
      const el = document.elementFromPoint(window.innerWidth / 2, 70)
      setDark(!!el?.closest('[data-dark]'))
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [])
  return (
    <>
      {bar && (
        <div className="relative flex h-10 items-center justify-center bg-black px-10 text-[13px] font-medium text-white">
          <Link href="/docs#prepay" className="inline-flex items-center gap-1.5 truncate hover:text-white/85">x402 pre-pay checks are live<ArrowRight size={13} /></Link>
          <button onClick={() => setBar(false)} aria-label="Dismiss" className="absolute right-4 text-white/70 hover:text-white"><X size={15} /></button>
        </div>
      )}
      <header className={`sticky top-0 z-50 border-b transition-colors duration-300 ${dark ? 'border-white/10 bg-[#0e0e0e]/95 text-white' : 'border-[#ececef] bg-white/95 text-[#0e0f11]'} backdrop-blur`}>
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-10 px-4 sm:px-7">
          <Link href="/" className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.03em]">
            <Mark size={22} className={dark ? 'invert' : ''} />warden
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] lg:flex">
            {[['/#platform', 'Platform'], ['/#signals', 'Signals'], ['/#developers', 'Developers'], ['/docs', 'Docs'], ['/#changelog', 'Changelog']].map(([h, t]) => (
              <Link key={h} href={h} className={dark ? 'text-white/80 hover:text-white' : 'text-[#2c2e33] hover:text-black'}>{t}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/app" className={`hidden h-9 items-center rounded-[8px] border px-3 text-[14px] font-medium sm:inline-flex ${dark ? 'border-white/15 text-white hover:bg-white/5' : 'border-[#dcdce0] hover:bg-[#f6f6f7]'}`}>Sign in</Link>
            <Link href="/app" className={`inline-flex h-9 items-center rounded-[8px] px-3 text-[14px] font-medium ${dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-[#0e0f11] text-white hover:bg-[#2a2c30]'}`}>Start monitoring</Link>
            <button onClick={() => setOpen((o) => !o)} className="ml-1 inline-flex size-9 items-center justify-center rounded-[8px] lg:hidden" aria-label="Menu">
              <span className="space-y-1"><span className="block h-px w-4 bg-current" /><span className="block h-px w-4 bg-current" /><span className="block h-px w-4 bg-current" /></span>
            </button>
          </div>
        </div>
        {open && (
          <nav className={`border-t px-4 py-3 lg:hidden ${dark ? 'border-white/10' : 'border-[#ececef]'}`}>
            {[['/#platform', 'Platform'], ['/#signals', 'Signals'], ['/#developers', 'Developers'], ['/docs', 'Docs'], ['/#changelog', 'Changelog']].map(([h, t]) => (
              <Link key={h} href={h} onClick={() => setOpen(false)} className="block py-2 text-[15px]">{t}</Link>
            ))}
          </nav>
        )}
      </header>
    </>
  )
}
