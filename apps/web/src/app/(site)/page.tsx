import Link from 'next/link'
import Hero from '@/components/attio/Hero'
import Platform from '@/components/attio/Platform'
import { ContextArc, FeatureRow, Signals, Connectivity, Developers } from '@/components/attio/Dark'
import { SelfServe, Statement, Scale, Changelog, FinalCta, Footer } from '@/components/attio/Light'
import { ArrowUpRight } from '@/components/icons'

const BUILT_ON: [string, string][] = [
  ['Solana', 'Mainnet simulation'], ['Squads', 'Smart accounts'], ['Helius', 'Streams and RPC'], ['Jupiter', 'Decoded swaps'], ['Lighthouse', 'Post-state assertions'],
  ['x402', 'Pre-pay checks'], ['Webhooks', 'HMAC-signed alerts'], ['Slack', 'Alert channel'], ['Telegram', 'Alert channel'], ['TypeScript', '@warden/sdk'],
]

export default function Home() {
  return (
    <main>
      <Hero />
      <section className="border-y border-[#ececef] bg-white">
        <div className="mx-auto grid max-w-[1392px] grid-cols-2 border-x border-[#ececef] sm:grid-cols-5">
          {BUILT_ON.map(([n, d], i) => (
            <Link key={n} href="/docs" className={`group relative flex h-[96px] flex-col items-center justify-center border-[#ececef] ${i % 2 ? 'border-l' : ''} sm:border-l-0 ${i % 5 ? 'sm:border-l' : ''} ${i >= 2 ? 'border-t' : ''} ${i < 5 ? 'sm:border-t-0' : 'sm:border-t'}`}>
              <span className="text-[20px] font-semibold tracking-[-0.03em] text-[#2c2e33] transition-opacity group-hover:opacity-0">{n}</span>
              <span className="absolute text-[13px] text-[#6e717a] opacity-0 transition-opacity group-hover:opacity-100">{d}</span>
              <ArrowUpRight size={13} className="absolute right-3 top-3 text-[#c2c4ca]" />
            </Link>
          ))}
        </div>
      </section>
      <Platform />
      <SelfServe />
      <section data-dark className="bg-[#111111]">
        <div className="mx-auto max-w-[1392px] border-x border-white/10">
          <ContextArc />
          <FeatureRow />
          <Signals />
          <Connectivity />
          <Developers />
        </div>
      </section>
      <Statement />
      <Scale />
      <Changelog />
      <FinalCta />
      <Footer />
    </main>
  )
}
