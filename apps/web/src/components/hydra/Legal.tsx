import Link from 'next/link'
import type { ReactNode } from 'react'
import { Label } from './bits'
import { Footer } from './Chrome'

export const CONTACT = 'contactharryu@gmail.com'
export const UPDATED = 'November 24, 2026'

const PAGES: [string, string][] = [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service'], ['/cookies', 'Cookie Policy']]

export function LegalPage({ path, title, intro, toc, children }: { path: string; title: string; intro: ReactNode; toc: [string, string][]; children: ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-[1440px] px-5 sm:px-16">
        <div className="grid grid-cols-[minmax(0,1fr)] border-x border-white/10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden border-r border-white/10 lg:block">
            <nav className="sticky top-24 space-y-6 px-8 py-16 text-[13.5px]">
              <div className="space-y-1.5">
                {PAGES.map(([h, t]) => (
                  <Link key={h} href={h} className={`block transition-colors ${h === path ? 'text-white' : 'text-white/45 hover:text-white'}`}>{h === path && <span className="mr-2 inline-block size-1.5 bg-[#7c5cff] align-middle" />}{t}</Link>
                ))}
              </div>
              <div className="space-y-1.5 border-t border-white/10 pt-6">
                {toc.map(([id, t]) => <a key={id} href={`#${id}`} className="block text-white/45 transition-colors hover:text-[#c8b9ff]">{t}</a>)}
              </div>
            </nav>
          </aside>
          <article className="px-6 py-16 sm:px-12 lg:py-20">
            <Label>Legal</Label>
            <h1 className="font-pixel mt-5 text-[44px] leading-[1.04] sm:text-[60px]">{title}</h1>
            <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.08em] text-white/40">Last updated {UPDATED}</p>
            <div className="mt-8 max-w-[720px] text-[16px] leading-relaxed text-white/70">{intro}</div>
            <div className="mt-6 flex flex-wrap gap-2 lg:hidden">
              {PAGES.map(([h, t]) => <Link key={h} href={h} className={`border px-3 py-1.5 text-[13px] ${h === path ? 'border-[#7c5cff] text-white' : 'border-white/15 text-white/55'}`}>{t}</Link>)}
            </div>
            <div className="mt-6 max-w-[720px]">{children}</div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  )
}

export const H = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={id} className="font-pixel mt-14 scroll-mt-24 border-t border-white/10 pt-8 text-[26px] leading-tight text-white">{children}</h2>
)
export const P = ({ children }: { children: ReactNode }) => <p className="mt-4 text-[15px] leading-relaxed text-white/70">{children}</p>
export const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-white/70">
    {items.map((it, i) => <li key={i} className="flex gap-3"><span className="mt-[9px] size-1.5 shrink-0 bg-[#7c5cff]" /><span>{it}</span></li>)}
  </ul>
)
export const B = ({ children }: { children: ReactNode }) => <strong className="font-medium text-white">{children}</strong>
export const Mail = () => <a href={`mailto:${CONTACT}`} className="text-[#c8b9ff] underline decoration-[#7c5cff] underline-offset-4">{CONTACT}</a>

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto border border-white/10">
      <table className="w-full min-w-[560px] text-left text-[13.5px]">
        <thead><tr className="bg-[#130c24]">{head.map((h) => <th key={h} className="px-4 py-3 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-[#c8b9ff]">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-white/10 align-top">{r.map((c, j) => <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-mono text-[12.5px] text-white' : 'text-white/65'}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}
