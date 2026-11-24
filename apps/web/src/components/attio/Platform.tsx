'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BaselineOrbit, ChartsStage, DrainList, FlowStage, HoldsBoard, KillSwitch, LookupStage, NetworkOrbit, PasteAddress, Provenance, Reasons,
  RecipientCard, SignPrompt, StageTimings, WalletsStage,
} from './mocks'

export const Badge = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
  <span className={`inline-flex rounded-[5px] px-1.5 py-[2px] text-[12px] font-medium ${dark ? 'bg-[#1b2a4a] text-[#8fb3ff]' : 'bg-[#e8f0fe] text-[#2563eb]'}`}>{children}</span>
)

interface Topic { id: string; nav: string; lead: string; rest: string; stage: ReactNode; cells: [string, string, ReactNode][] }

const TOPICS: Topic[] = [
  {
    id: 'monitor', nav: 'Monitor wallets', lead: 'Every wallet, watched.', rest: 'Paste any agent wallet. Warden decodes 30 days of history, learns what normal looks like, and tells you the moment something isn’t.',
    stage: <WalletsStage />,
    cells: [
      ['No code to start.', 'Paste an address. Backfill, baseline and alerts in under two minutes.', <PasteAddress key="a" />],
      ['It learns normal.', 'Amounts, recipients, hours and velocity, from the wallet’s own last 30 days.', <BaselineOrbit key="b" />],
    ],
  },
  {
    id: 'check', nav: 'Check transactions', lead: 'One check before every signature.', rest: 'Decode, simulate, rules, reputation and intent, in about the time it takes to sign.',
    stage: <div className="px-4 py-10 sm:px-8"><FlowStage /></div>,
    cells: [
      ['Fast path for routine payments.', 'Only new recipients and risky checks pay for the intent model.', <StageTimings key="a" />],
      ['Context is evidence.', 'Tweets, webpages and tool output never count as authority to pay.', <Provenance key="b" />],
    ],
  },
  {
    id: 'hold', nav: 'Hold for a human', lead: 'The decision stays yours.', rest: 'Risky payments wait for you with a plain-language summary. No answer before the timeout means deny.',
    stage: <HoldsBoard />,
    cells: [
      ['Know who you’re paying.', 'Age, history, reports and blocks for every recipient, before you decide.', <RecipientCard key="a" />],
      ['Approve with a signature.', 'A session alone can’t approve money out. Your owner wallet has to sign.', <SignPrompt key="b" />],
    ],
  },
  {
    id: 'score', nav: 'Score recipients', lead: 'For the people who own the risk.', rest: 'Look up any address, program or x402 endpoint and see its score with the reasons behind it.',
    stage: <LookupStage />,
    cells: [
      ['Blocked once, blocked everywhere.', 'Every blocked attack raises the score for every Warden customer.', <NetworkOrbit key="a" />],
      ['Reasons, not black boxes.', 'Every verdict ships with stable reason codes your agents can act on.', <Reasons key="b" />],
    ],
  },
  {
    id: 'respond', nav: 'Stop the drain', lead: 'Keep more. Lose nothing.', rest: 'Drain detection, a one-tap kill switch, and owner-only loosening for the worst day.',
    stage: <ChartsStage />,
    cells: [
      ['Spot the drain early.', 'Bursts of outflows, new token approvals and settings changes raise critical alerts.', <DrainList key="a" />],
      ['One tap to freeze.', 'Freeze a wallet or every wallet. Checks stop at once; your recovery key still works.', <KillSwitch key="b" />],
    ],
  },
]

export default function Platform() {
  const [active, setActive] = useState(TOPICS[0]!.id)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.id!)
    }, { rootMargin: '-40% 0px -55% 0px' })
    Object.values(refs.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])
  return (
    <section id="platform" className="scroll-mt-14 bg-[#fafafb]">
      <div className="mx-auto max-w-[1392px] border-x border-[#ececef]">
        <div className="px-6 pb-16 pt-24 sm:px-10 lg:pt-32">
          <Badge>Platform</Badge>
          <h2 className="mt-5 max-w-[640px] text-[28px] font-medium leading-[1.15] tracking-[-0.025em] text-[#0e0f11] sm:text-[34px]">
            The firewall that never sleeps. <span className="text-[#8a8d95]">Checks payments at 2am. Catches the injected one before it lands. Hands you the decision when it matters.</span>
          </h2>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] border-t border-[#ececef] lg:grid-cols-[348px_minmax(0,1fr)]">
          <div className="hidden border-r border-[#ececef] lg:block">
            <ul className="sticky top-[150px] space-y-2.5 py-16 pl-10 text-[17px]">
              {TOPICS.map((t) => (
                <li key={t.id} className="relative">
                  {active === t.id && <span className="absolute -left-10 top-0 h-full w-px bg-[#2563eb]" />}
                  <button onClick={() => refs.current[t.id]?.scrollIntoView({ behavior: 'smooth' })} className={`transition-colors ${active === t.id ? 'text-[#0e0f11]' : 'text-[#c2c4ca] hover:text-[#8a8d95]'}`}>{t.nav}</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            {TOPICS.map((t) => (
              <div key={t.id} data-id={t.id} ref={(el) => { refs.current[t.id] = el }} className="border-b border-[#ececef] last:border-0">
                <div className="px-6 py-16 sm:px-12 lg:py-24">
                  <div className="mb-3 text-[13px] font-medium text-[#2563eb] lg:hidden">{t.nav}</div>
                  <p className="max-w-[460px] text-[19px] font-medium leading-[1.3] tracking-[-0.015em] text-[#0e0f11]">{t.lead} <span className="text-[#8a8d95]">{t.rest}</span></p>
                </div>
                <div className="overflow-hidden border-t border-[#ececef] bg-[#f3f3f5] [background-image:radial-gradient(#dcdde1_0.8px,transparent_0.8px)] [background-size:14px_14px]">{t.stage}</div>
                <div className="grid grid-cols-1 border-t border-[#ececef] md:grid-cols-2">
                  {t.cells.map(([h, d, v], i) => (
                    <div key={h} className={`flex min-h-[340px] flex-col bg-white px-6 pb-10 pt-8 sm:px-8 ${i ? 'border-t border-[#ececef] md:border-l md:border-t-0' : ''}`}>
                      <div className="text-[15px] font-medium text-[#0e0f11]">{h}</div>
                      <div className="mt-1 max-w-[340px] text-[14px] leading-snug text-[#8a8d95]">{d}</div>
                      <div className="flex flex-1 items-center justify-center pt-8">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
