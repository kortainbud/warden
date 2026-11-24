import Link from 'next/link'
import { Wordmark } from '@/components/brand'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-page/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-1 text-[14px]">
            <Link href="/#how" className="hidden rounded-full px-3 py-1.5 text-ink-2 hover:bg-sunken sm:inline-block">How it works</Link>
            <Link href="/#security" className="hidden rounded-full px-3 py-1.5 text-ink-2 hover:bg-sunken sm:inline-block">Security</Link>
            <Link href="/docs" className="rounded-full px-3 py-1.5 text-ink-2 hover:bg-sunken">Docs</Link>
            <Link href="/app" className="ml-1 inline-flex h-9 items-center rounded-full bg-brand px-4 font-medium text-brand-ink hover:bg-[#16302a]">Open app</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark />
          <span>Warden can block a transaction. It can never move your funds.</span>
          <div className="flex gap-4"><Link href="/docs" className="hover:text-ink">Docs</Link><Link href="/app" className="hover:text-ink">Dashboard</Link></div>
        </div>
      </footer>
    </div>
  )
}
