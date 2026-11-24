import Link from 'next/link'
import { ArrowUpRight } from '@/components/icons'
import { DoubleRule, PixelMark } from './bits'
import { DataField, FooterField } from './anim'

const NAV: [string, string][] = [['/#architecture', 'Architecture'], ['/#use-cases', 'Use Cases'], ['/#security', 'Security'], ['/#pricing', 'Pricing'], ['/docs', 'Documentation']]

export function Header() {
  return (
    <>
      <div className="flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-white/10 bg-[#0e0919] px-4 py-1.5 text-[13px] text-white">
        <span className="bg-[#7c5cff] px-2 py-[1px] font-mono text-[10.5px] uppercase tracking-[0.06em] text-white">Announcement</span>
        <span className="shimmer">x402 pre-pay checks are live.</span>
        <Link href="/docs#prepay" className="inline-flex items-center gap-1 text-white/60 underline decoration-[#7c5cff] underline-offset-4 hover:text-white">Read the docs<ArrowUpRight size={12} /></Link>
      </div>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0716]/90 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1440px] items-center gap-6 px-5 sm:px-16">
          <Link href="/" className="flex items-center gap-2 text-[23px] font-medium tracking-[-0.03em] text-white"><PixelMark size={24} />Warden</Link>
          <nav className="mx-auto hidden items-center gap-5 text-[15px] text-white/60 lg:flex">
            {NAV.map(([h, t]) => <Link key={h} href={h} className="group relative hover:text-white">{t}<span className="absolute -bottom-1 left-0 h-px w-0 bg-[#c8b9ff] transition-all duration-300 group-hover:w-full" /></Link>)}
          </nav>
          <div className="ml-auto flex lg:ml-0">
            <Link href="/login" className="px-btn hidden h-8 items-center bg-[#2a2142] px-4 text-[15px] text-white hover:bg-[#3a2f58] sm:inline-flex">Log In</Link>
            <Link href="/signup" className="px-btn inline-flex h-8 items-center bg-white px-4 text-[15px] text-[#0b0716]">Sign Up</Link>
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
    ['Legal', [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/cookies', 'Cookie Policy']]],
  ]
  return (
    <footer className="relative overflow-hidden bg-[#0b0716] text-white">
      <DoubleRule />
      <FooterField />
      <div className="relative mx-auto max-w-[1440px] px-5 py-14 sm:px-16">
        <div className="grid grid-cols-[minmax(0,1fr)] border border-white/10 bg-[#0b0716]/80 backdrop-blur-sm lg:grid-cols-[1.6fr_1fr]">
          <div className="px-6 py-10 sm:px-8">
            <Link href="/" className="flex items-center gap-2 text-[26px] font-medium tracking-[-0.03em]"><PixelMark size={26} />Warden</Link>
            <p className="mt-2 text-[16px] text-white/85">The firewall agents sign through.</p>
            <div className="mt-10 grid grid-cols-2 gap-8 text-[13px] sm:grid-cols-5">
              {cols.map(([t, links]) => (
                <div key={t}>
                  <div className="text-white">{t}</div>
                  <ul className="mt-2.5 space-y-1.5 text-white/55">{links.map(([h, l]) => <li key={l}><Link href={h} className="inline-block transition-transform hover:translate-x-1 hover:text-[#c8b9ff]">{l}</Link></li>)}</ul>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col border-t border-white/10 text-[13px] text-white/55 lg:border-l lg:border-t-0">
            <div className="flex flex-wrap gap-6 border-b border-white/10 px-6 py-5 sm:px-8"><Link href="/docs" className="hover:text-white">Documentation ↗</Link><Link href="/app" className="hover:text-white">Dashboard ↗</Link><a href="mailto:contactharryu@gmail.com" className="hover:text-white">Contact ↗</a></div>
            <DataField className="min-h-[200px] flex-1" />
            <div className="border-t border-white/10 px-6 py-5 sm:px-8">Warden can block a transaction. It can never move your funds.<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1"><span>© 2026 Warden</span><Link href="/privacy" className="hover:text-white">Privacy</Link><Link href="/terms" className="hover:text-white">Terms</Link><Link href="/cookies" className="hover:text-white">Cookies</Link></div></div>
          </div>
        </div>
      </div>
    </footer>
  )
}
