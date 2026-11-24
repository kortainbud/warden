import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { Wordmark } from '@/components/brand'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-page">
      <Link href="/docs#prepay" className="flex h-10 items-center justify-center gap-1.5 bg-ink px-4 text-center text-[13px] font-medium text-white hover:text-white/85">
        <span className="truncate">x402 pre-pay checks are live: check every payment request before your agent pays</span>
        <ArrowRight size={13} weight="bold" className="shrink-0" />
      </Link>
      <header className="sticky top-0 z-40 border-b border-line bg-page/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-8 px-4 sm:px-6">
          <Wordmark />
          <nav className="hidden items-center gap-1 text-[15px] md:flex">
            {[['/#how', 'How it works'], ['/#threat-network', 'Threat Network'], ['/#security', 'Security'], ['/docs', 'Developers']].map(([h, t]) => (
              <Link key={h} href={h} className="rounded-[8px] px-3 py-1.5 text-ink-2 hover:bg-sunken hover:text-ink">{t}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/app" className="hidden h-9 items-center rounded-[8px] border border-line-strong bg-surface px-3.5 text-[14px] font-medium hover:border-ink-2/40 sm:inline-flex">Sign in</Link>
            <Link href="/app" className="inline-flex h-9 items-center rounded-[8px] bg-ink px-3.5 text-[14px] font-medium text-white hover:bg-brand-hover">Start monitoring</Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-8 px-4 py-12 text-[14px] sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Wordmark />
            <p className="mt-3 max-w-xs text-muted">Firewall and monitor for AI agent wallets on Solana. Warden can block a transaction. It can never move your funds.</p>
          </div>
          {[
            ['Product', [['/#how', 'How it works'], ['/#threat-network', 'Threat Network'], ['/#security', 'Security model'], ['/app', 'Dashboard']]],
            ['Developers', [['/docs#quickstart', 'Quickstart'], ['/docs#check', 'Check API'], ['/docs#sdk', 'TypeScript SDK'], ['/docs#prepay', 'x402 pre-pay']]],
            ['More', [['/docs#codes', 'Reason codes'], ['/docs#webhooks', 'Alert webhooks'], ['/docs#status', 'What is live']]],
          ].map(([title, links]) => (
            <div key={title as string}>
              <div className="font-medium">{title as string}</div>
              <ul className="mt-3 space-y-2 text-muted">
                {(links as string[][]).map(([h, t]) => <li key={h}><Link href={h!} className="hover:text-ink">{t}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </div>
  )
}
