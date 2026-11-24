import Link from 'next/link'
import { ArrowUpRight } from '@/components/icons'
import { DoubleRule, PixelMark } from './bits'

const NAV: [string, string][] = [['/#architecture', 'Architecture'], ['/#use-cases', 'Use Cases'], ['/#security', 'Security'], ['/#pricing', 'Pricing'], ['/docs', 'Documentation']]

export function Header() {
  return (
    <>
      <div className="flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-white/10 bg-[#0f0f10] px-4 py-1.5 text-[13px] text-white">
        <span className="bg-[#ff571a] px-2 py-[1px] font-mono text-[10.5px] uppercase tracking-[0.06em] text-black">Announcement</span>
        <span>x402 pre-pay checks are live.</span>
        <Link href="/docs#prepay" className="inline-flex items-center gap-1 text-white/60 underline decoration-[#ff571a] underline-offset-4 hover:text-white">Read the docs<ArrowUpRight size={12} /></Link>
      </div>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1440px] items-center gap-6 px-5 sm:px-16">
          <Link href="/" className="flex items-center gap-2 text-[23px] font-medium tracking-[-0.03em] text-white"><PixelMark size={24} />Warden</Link>
          <nav className="mx-auto hidden items-center gap-5 text-[15px] text-white/60 lg:flex">
            {NAV.map(([h, t]) => <Link key={h} href={h} className="hover:text-white">{t}</Link>)}
          </nav>
          <div className="ml-auto flex lg:ml-0">
            <Link href="/app" className="hidden h-8 items-center bg-[#2a2a2c] px-4 text-[15px] text-white hover:bg-[#3a3a3d] sm:inline-flex">Log In</Link>
            <Link href="/app" className="inline-flex h-8 items-center bg-white px-4 text-[15px] text-black hover:bg-white/85">Sign Up</Link>
          </div>
        </div>
      </header>
    </>
  )
}

export function Footer() {
  const cols: [string, [string, string][]][] = [
    ['Home', [['/#use-cases', 'Why Warden'], ['/#features', 'Features'], ['/#architecture', 'Architecture'], ['/#pricing', 'Pricing'], ['/#faq', 'FAQs']]],
    ['Use Cases', [['/#use-cases', 'Trading agents'], ['/#use-cases', 'Payment agents'], ['/#use-cases', 'Treasury agents'], ['/#use-cases', 'Agent platforms']]],
    ['Developers', [['/docs#quickstart', 'Quickstart'], ['/docs#check', 'Check API'], ['/docs#sdk', 'TypeScript SDK'], ['/docs#codes', 'Reason codes']]],
    ['Security', [['/#security', 'Security model'], ['/docs#holds', 'Holds and approvals'], ['/docs#status', 'What is live']]],
  ]
  return (
    <footer className="bg-black text-white">
      <DoubleRule />
      <div className="mx-auto max-w-[1440px] px-5 sm:px-16">
        <div className="grid grid-cols-[minmax(0,1fr)] border-x border-white/10 lg:grid-cols-[1.6fr_1fr]">
          <div className="px-6 py-10 sm:px-8">
            <Link href="/" className="flex items-center gap-2 text-[26px] font-medium tracking-[-0.03em]"><PixelMark size={26} />Warden</Link>
            <p className="mt-2 text-[16px] text-white/85">The firewall agents sign through.</p>
            <div className="mt-10 grid grid-cols-2 gap-8 text-[13px] sm:grid-cols-4">
              {cols.map(([t, links]) => (
                <div key={t}>
                  <div className="text-white">{t}</div>
                  <ul className="mt-2.5 space-y-1.5 text-white/55">{links.map(([h, l]) => <li key={l}><Link href={h} className="hover:text-white">{l}</Link></li>)}</ul>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between border-t border-white/10 px-6 py-10 text-[13px] text-white/55 sm:px-8 lg:border-l lg:border-t-0">
            <div className="flex flex-wrap gap-6"><Link href="/docs" className="hover:text-white">Documentation ↗</Link><Link href="/app" className="hover:text-white">Dashboard ↗</Link></div>
            <div className="mt-10">Warden can block a transaction. It can never move your funds.<br />© 2026 Warden</div>
          </div>
        </div>
      </div>
    </footer>
  )
}
