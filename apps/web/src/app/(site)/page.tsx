import Link from 'next/link'
import { Brackets, DoubleRule, Faq, Label, LogoGrid, PixelMark, Scramble, UseCases } from '@/components/hydra/bits'
import { AsciiShield, BudgetBar, CountUp, Diamonds, GrowLine, GrowingTree, HexField, PixelAsciiShield, Reveal, SpeedLines } from '@/components/hydra/anim'
import { Footer } from '@/components/hydra/Chrome'

const px = 'font-[family-name:var(--font-geist-pixel-square)]'
const Wrap = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`mx-auto max-w-[1440px] px-5 sm:px-16 ${className}`}>{children}</div>
const LIGHT = 'bg-[#f5f2ff] text-[#120b22]'

const COMPARE: [string, string][] = [
  ['Caps stop big payments; a planted address under the cap still gets paid', 'Checks who asked for every payment, not just how big it is'],
  ['Allowlists can’t judge a recipient that appeared an hour ago', 'Scores every recipient from shared threat data and onchain age'],
  ['Wallet popups wait for a human to read a warning', 'Verdicts at machine speed, and a human only when it matters'],
  ['No record of why an agent paid, or who told it to', 'Every verdict logged with inputs, reasons and stage timings'],
]

const BUDGET: [string, number, string][] = [
  ['Network', 30, '#3a2f58'], ['Decode', 5, '#5b8cff'], ['Simulate', 120, '#7c5cff'], ['Rules + reputation + anomaly', 25, '#f4f1ff'], ['Assertions + sign', 40, '#c8b9ff'], ['Overhead', 30, '#6f6494'],
]

const FAQ: [string, string][] = [
  ['What Is Warden?', 'A firewall and monitor for AI agent wallets on Solana. Your agent sends the transaction it wants to sign, plus the context it was working from. Warden decodes it, simulates it against mainnet, runs your rules, scores the recipient and checks who actually asked for the payment, then approves, holds it for you, or blocks it.'],
  ['Can Warden Move My Funds?', 'No. Protected wallets need two signatures, your agent’s and Warden’s, and Warden’s key cannot move funds on its own in any configuration. Your owner wallet can remove Warden at any time.'],
  ['What Happens If Warden Is Down?', 'Protected wallets fail closed: they pause rather than sign unchecked. Your recovery key can still override. Monitoring-only wallets keep working as before.'],
  ['Will It Slow My Agent Down?', 'Routine payments take the fast path, targeting under 250 ms at p99. Only transfers to new recipients and risky checks call the intent model.'],
  ['What Context Should My Agent Send?', 'The task and who gave it (owner, system or schedule), plus whatever triggered the payment: a webpage, a tweet, tool output or a 402 response. Missing context is treated as untrusted, never as a pass.'],
  ['What Is Shadow Mode?', 'Warden scores every transaction and shows what it would have blocked, but blocks nothing. Run it for a few days, then switch to enforce when the verdicts look right.'],
  ['Which Agents Does It Work With?', 'Any agent that signs Solana transactions: one SDK wrapper around the signer, or a single REST call before signing. x402 payments get their own pre-pay check.'],
]

export default function Home() {
  return (
    <main className="bg-[#0b0716] text-white">
      {/* Hero */}
      <Wrap className="relative">
        <div className="relative grid min-h-[640px] grid-cols-[minmax(0,1fr)] items-center lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative z-10 pb-10 pt-16 lg:pb-24">
            <Reveal><Link href="/docs#prepay" className="group text-[15px] text-white/60 hover:text-white">x402 pre-pay checks now live: check every payment request before your agent pays <span className="inline-block transition-transform group-hover:translate-x-1">→</span></Link></Reveal>
            <Reveal delay={80}><h1 className={`${px} mt-6 text-[48px] leading-[1.02] tracking-[-0.01em] sm:text-[72px]`}>The Firewall Agents Sign Through.</h1></Reveal>
            <Reveal delay={160}>
              <p className="mt-10 max-w-[560px] text-[21px] leading-[1.35] text-white/60">Warden checks every transaction your AI agent tries to sign, blocks what nobody asked for, and watches every agent wallet on Solana.</p>
              <p className="mt-6 max-w-[560px] text-[21px] leading-[1.35] text-white/60">Built for trading agents, payment agents, treasuries and the platforms that launch them.</p>
            </Reveal>
            <Reveal delay={240} className="mt-8 flex">
              <Link href="/docs" className="px-btn inline-flex h-[43px] items-center bg-white px-[18px] text-[16px] text-[#0b0716]">Read the docs</Link>
              <Link href="/signup" className="px-btn inline-flex h-[43px] items-center bg-[#7c5cff] px-[18px] text-[16px] text-white">Sign Up</Link>
            </Reveal>
          </div>
          <AsciiShield className="h-[380px] w-full sm:h-[460px] lg:h-[600px]" />
        </div>
      </Wrap>
      <DoubleRule />

      {/* Built on */}
      <Wrap className="py-24 text-center">
        <Reveal><div className="text-[18px] text-white/90">Built On The Solana Agent Stack</div></Reveal>
        <Reveal delay={100}><LogoGrid /></Reveal>
        <Reveal delay={150}>
          <div className={`${px} mt-24 flex items-center justify-center gap-4 text-[26px] sm:text-[28px]`}><span className="blink size-4 bg-[#7c5cff]" />Can Block. Never Steal.<span className="blink size-4 bg-[#7c5cff] [animation-delay:1.2s]" /></div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[16px] text-white/90">
            <span>Two signatures</span><span className="h-5 w-px bg-white/25" /><span>Owner recovery key</span><span className="h-5 w-px bg-white/25" /><span>Fails closed</span><span className="h-5 w-px bg-white/25" /><span className="text-white/40">and more</span>
          </div>
        </Reveal>
      </Wrap>

      {/* Stats */}
      <div className="border-y border-white/10">
        <Wrap>
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {[['<250ms', 'Fast-path p99 target', 'left'], ['6', 'Checks before every signature', 'left'], ['30d', 'Baseline per wallet', 'right'], ['0', 'Keys that move funds alone', 'right']].map(([v, l, a], i) => (
              <Brackets key={l} className={`${i % 2 ? 'border-l' : ''} border-white/10 transition-colors hover:bg-[#130c24] lg:border-l ${i === 0 ? 'lg:border-l-0' : ''}`}>
                <div className={`px-4 py-6 ${a === 'right' ? 'text-right' : ''}`}>
                  <Scramble value={v!} className={`${px} text-[34px] leading-none`} />
                  <div className="mt-3 text-[13px] text-white/75">{l}</div>
                </div>
              </Brackets>
            ))}
          </div>
        </Wrap>
      </div>

      {/* Use cases */}
      <section id="use-cases" className="scroll-mt-16 border-b border-white/10 pt-24">
        <Wrap>
          <Reveal><Label>Use Cases</Label></Reveal>
          <Reveal delay={80}><h2 className={`${px} mt-6 max-w-[640px] text-[36px] leading-[1.1] sm:text-[46px]`}>What Teams Are Protecting With Warden</h2></Reveal>
        </Wrap>
        <Wrap className="mt-12"><Reveal><UseCases /></Reveal></Wrap>
        <div className="h-20" />
      </section>

      {/* Comparison (light) */}
      <section className={LIGHT}>
        <div className="relative">
          <span className="blink absolute left-0 top-0 size-3.5 bg-[#7c5cff]" /><span className="blink absolute right-0 top-0 size-3.5 bg-[#7c5cff] [animation-delay:1.2s]" />
          <Wrap className="grid grid-cols-[minmax(0,1fr)] gap-10 py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <Reveal className="flex flex-col justify-between">
              <h2 className={`${px} text-[38px] leading-[1.08] sm:text-[48px]`}>Limits Aren’t Always Protection.</h2>
              <div className="mt-10 max-w-[420px] space-y-4 text-[15px] leading-relaxed text-[#120b22]/55">
                <p>Spending limits check how much leaves the wallet. They can’t tell who asked for it.</p>
                <p>Warden reads the provenance of every payment: the owner’s task on one side, the tweet, webpage or tool output that triggered it on the other. Then it simulates, scores the recipient and decides.</p>
              </div>
            </Reveal>
            <div className="overflow-hidden border border-[#120b22]/10 bg-white text-[14px]">
              <div className="grid grid-cols-2">
                <div className={`${px} bg-[#120b22] px-4 py-3 text-center text-[18px] text-white`}>Without Warden</div>
                <div className={`${px} bg-[#7c5cff] px-4 py-3 text-center text-[18px] text-white`}>With Warden</div>
              </div>
              {COMPARE.map(([a, b], i) => (
                <Reveal key={a} delay={i * 90}>
                  <div className="group grid grid-cols-2 border-t border-[#120b22]/10">
                    <div className="px-5 py-5 text-center text-[#120b22]/60 transition-colors group-hover:text-[#120b22]/40 group-hover:line-through">{a}</div>
                    <div className="border-l border-[#120b22]/10 px-5 py-5 text-center transition-colors group-hover:bg-[#7c5cff]/[0.07]">{b}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Wrap>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 pt-24">
        <Wrap className="text-center"><Reveal><h2 className={`${px} mx-auto max-w-[760px] text-[40px] leading-[1.08] sm:text-[60px]`}>Everything You Need To Sign Safely</h2></Reveal></Wrap>
        <Wrap className="mt-14">
          <div className="grid grid-cols-[minmax(0,1fr)] border-y border-white/10 md:grid-cols-2">
            <div className="group border-white/10 px-6 pb-8 pt-8 md:border-r sm:px-8">
              <h3 className={`${px} text-[26px] leading-[1.1] sm:text-[28px]`}>Catches Injected<br />Payments</h3>
              <p className="mt-3 max-w-[320px] text-[13px] text-white/60">Provenance first, a small model second. An address planted in a tweet or tool output is blocked before it is signed.</p>
              <div className="stripes-move mt-8 flex h-[200px] items-center justify-center bg-[repeating-linear-gradient(90deg,#7c5cff_0_46px,#9b7dff_46px_92px,#c8b9ff_92px_138px,#9b7dff_138px_184px,#5b8cff_184px_230px,#7c5cff_230px_276px)] sm:h-[220px]">
                <div className="bg-[#7c5cff] px-8 py-4 text-center transition-transform duration-300 group-hover:scale-105"><CountUp to={6} className={`${px} text-[56px] leading-none`} /><div className="mt-1 text-[18px]">checks per signature</div></div>
              </div>
            </div>
            <div className="border-t border-white/10 px-6 pb-8 pt-8 md:border-t-0 sm:px-8">
              <h3 className={`${px} text-[26px] leading-[1.1] sm:text-[28px]`}>Simulates Before<br />Signing</h3>
              <p className="mt-3 max-w-[360px] text-[13px] text-white/60">Every transaction runs against current mainnet state first, so Warden knows the exact balance change for every account.</p>
              <div className="mt-10"><Diamonds /></div>
            </div>
            <div className="border-t border-white/10 px-6 py-8 md:border-r sm:px-8">
              <h3 className={`${px} text-[26px] leading-[1.1] sm:text-[28px]`}>Shared Threat<br />Data</h3>
              <p className="mt-3 max-w-[340px] text-[13px] text-white/60">Every blocked attack raises the score for every Warden customer. Scores ship with their reasons, so every verdict can be explained.</p>
              <PixelAsciiShield className="mt-6 h-[220px] w-full" />
            </div>
            <div className="border-t border-white/10 px-6 py-8 sm:px-8">
              <h3 className={`${px} text-[26px] leading-[1.1] sm:text-[28px]`}>Built For Machine<br />Speed</h3>
              <p className="mt-3 max-w-[380px] text-[13px] text-white/60">Built for trading agents that can’t miss a fill, so routine payments never wait on a model.</p>
              <div className={`${px} mt-2 text-[28px] text-[#c8b9ff]`}>&lt; <CountUp to={250} />ms</div>
              <SpeedLines className="mt-4 h-[170px] w-full" />
            </div>
          </div>
        </Wrap>
      </section>
      <div className="mt-24"><DoubleRule /></div>

      {/* Latency budget chart */}
      <Wrap>
        <div className="grid grid-cols-[minmax(0,1fr)] border-x border-b border-white/10 lg:grid-cols-2">
          <Reveal className="flex flex-col justify-center px-6 py-14 sm:px-12">
            <h2 className={`${px} text-[34px] leading-[1.1] sm:text-[48px]`}>Latency As A Design Constraint</h2>
            <ul className="mt-8 space-y-3 text-[13px] text-white/70">
              {['Simulation is the biggest cost, so it runs next to the check service', 'The intent model only runs on new recipients and risky checks', 'Pre-approved routes skip intent, but are still simulated and capped'].map((t) => (
                <li key={t} className="border-l border-[#7c5cff] pl-3 transition-colors hover:border-[#c8b9ff] hover:text-white">{t}</li>
              ))}
            </ul>
          </Reveal>
          <div className="border-t border-white/10 lg:border-l lg:border-t-0">
            <div className="border-b border-white/10 px-5 py-3 text-[13px]">Fast-path budget, p99 (ms)</div>
            <div className="px-6 py-10 sm:px-8">
              <BudgetBar parts={BUDGET} />
              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                {BUDGET.map(([l, v, c]) => <div key={l} className="flex items-center gap-2"><span className="size-3 shrink-0" style={{ background: c }} /><span className="text-white/80">{l}</span><span className="ml-auto font-mono text-white/50">{v}</span></div>)}
              </div>
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-[12px] text-white/45">Design targets from the engineering spec, measured per stage on every check.</div>
          </div>
        </div>
      </Wrap>

      {/* Violet block, tree, hexagons */}
      <Wrap>
        <div className="grid grid-cols-[minmax(0,1fr)] border-x border-white/10 lg:grid-cols-2">
          <div className="relative hidden min-h-[440px] lg:block"><GrowingTree className="absolute inset-[10%]" /></div>
          <Reveal className="px-6 py-20 sm:px-0">
            <h2 className={`${px} max-w-[520px] text-[34px] leading-[1.1] sm:text-[48px]`}>Provenance-Native Security For Agents</h2>
            <div className={`${px} mt-2 max-w-[560px] bg-[#7c5cff] px-4 py-3 text-[30px] leading-[1.12] sm:text-[44px]`}>Purpose-Built To Catch The Payments Nobody Asked For, And Show Why Agents Tried.</div>
          </Reveal>
        </div>
      </Wrap>
      <div className="relative h-[560px] overflow-hidden border-y border-white/10">
        <HexField />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-[pulseMark_3s_ease-in-out_infinite]"><PixelMark size={150} color="#f4f1ff" /></div>
        {[
          ['left-[8%] top-[20%] sm:left-[12%]', 'Context sources tagged', '9', 'float-a'],
          ['right-[8%] top-[23%] sm:right-[14%]', 'Policy templates', '3', 'float-b'],
          ['left-[8%] bottom-[16%] sm:left-[12%]', 'Stable reason codes', '30+', 'float-b'],
          ['right-[8%] bottom-[14%] sm:right-[14%]', 'Alert channels', 'Slack + more', 'float-a'],
        ].map(([pos, l, v, f]) => (
          <div key={l} className={`absolute ${pos} ${f}`}>
            <span className="blink absolute -left-6 top-0 size-4 bg-[#7c5cff]" />
            <div className="w-fit bg-[#7c5cff] px-3 py-1.5 text-[14px] sm:text-[17px]">{l}</div>
            <div className="w-fit bg-[#f4f1ff] px-3 py-1.5 text-[24px] font-semibold tracking-[-0.03em] text-[#0b0716] sm:text-[34px]">{v}</div>
          </div>
        ))}
        {['left-[3%] top-[12%]', 'right-[3%] top-[12%]', 'left-[3%] bottom-[12%]', 'right-[3%] bottom-[12%]'].map((p, i) => <span key={p} className={`blink absolute ${p} size-2 bg-[#f4f1ff]`} style={{ animationDelay: `${i * 0.6}s` }} />)}
      </div>
      <DoubleRule />

      {/* Architecture */}
      <section id="architecture" className="scroll-mt-16 py-24">
        <Wrap className="text-center"><Reveal><h2 className={`${px} text-[40px] sm:text-[60px]`}>Architecture Overview</h2></Reveal></Wrap>
        <Wrap className="mt-14">
          <Reveal className="mx-auto max-w-[1060px] text-[13px]">
            <div className="grid gap-4 border border-white/15 bg-[#130c24] p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <div className="font-semibold uppercase tracking-[0.02em] text-[#c8b9ff]">Orchestration Around The Check Service</div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="border border-white/30 px-6 py-2 transition-colors hover:border-[#c8b9ff]">Agent</div><span className="flow-line h-px w-12" />
                  <div className="border border-white/30 px-4 py-2 text-center transition-colors hover:border-[#c8b9ff]"><div>@warden/sdk</div><div className="text-[11px] text-white/50">wraps the signer · context envelope</div></div><span className="flow-line h-px w-12" />
                  <div className="border border-white/30 px-4 py-2 text-center transition-colors hover:border-[#c8b9ff]"><div>POST /v1/check</div><div className="text-[11px] text-white/50">verdict · reasons · signature</div></div>
                </div>
              </div>
              <div className="space-y-2">
                {[['Squads (Plugin)', 'smart account · 2-of-2 signers'], ['Lighthouse (Plugin)', 'post-state assertions'], ['KMS signer', 'one key per wallet, never exported']].map(([t, s]) => (
                  <div key={t} className="border border-dashed border-white/30 px-3 py-2 text-center transition-colors hover:border-[#c8b9ff] hover:bg-[#1a1033]"><div className="text-[15px]">{t}</div><div className="text-[11px] text-white/50">{s}</div></div>
                ))}
              </div>
            </div>
            <div className="flex justify-center py-3"><span className="flow-v h-10 w-px" /></div>
            <div className="border border-[#7c5cff] bg-[#140c26] p-5">
              <div className="font-semibold uppercase tracking-[0.02em] text-[#c8b9ff]">The Check Service Core</div>
              <div className="text-white/60">Stateless, fast path first, fails closed</div>
              <div className="mt-5 border border-white/15 p-4">
                <div className="text-center text-white/60">PIPELINE — every stage scores 0–100 and can raise a hard flag</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[['Decode + simulate', 'IDL decoding → mainnet simulation → exact balance changes'], ['Rules + reputation', 'caps, lists, programs → Threat Network → baseline'], ['Intent + verdict', 'provenance rules → small model on risky checks → approve / hold / block']].map(([t, s], i) => (
                    <div key={t} className="relative border border-white/25 px-3 py-4 text-center transition-colors hover:border-[#c8b9ff] hover:bg-[#1a1033]">
                      {i < 2 && <span className="flow-line absolute -right-3 top-1/2 hidden h-px w-3 sm:block" />}
                      <div className="text-[15px]">{t}</div><div className="mt-1 text-[11px] text-white/50">{s}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 border border-white/15 p-4">
                <div><span className="text-[15px]">Monitor pipeline</span> <span className="font-mono text-[11px] text-[#c8b9ff]">· stream · decode · detect</span></div>
                <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  {['ingest/webhooks', 'decode/actions', 'enrich/usd+reputation', 'detect/drain+approvals', 'alert/slack+webhook'].map((t, i) => (
                    <span key={t} className="flex items-center gap-2">{i > 0 && <span className="flow-line h-px w-4" />}<span className="border border-white/20 px-2 py-1 text-white/70 transition-colors hover:border-[#c8b9ff] hover:text-white">{t}</span></span>
                  ))}
                </div>
                <div className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-white/45">Tiered · state flows across stores on demand</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                  {[['Hot', 'policy + reputation cache'], ['Warm', 'postgres'], ['Cold', 'event store']].map(([t, s], i) => (
                    <div key={t} className="contents">
                      {i > 0 && <span className="flow-line hidden h-px w-6 sm:block" />}
                      <div className={`border px-3 py-2 ${i === 0 ? 'animate-[hotPulse_2.4s_ease-in-out_infinite] border-[#7c5cff] bg-[#261a4a]' : 'border-white/20'}`}><div>{t}</div><div className="font-mono text-[11px] text-[#c8b9ff]">{s}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </Wrap>
      </section>
      <DoubleRule />

      {/* Security matrix */}
      <section id="security" className="scroll-mt-16 pt-20">
        <Wrap>
          <Reveal>
            <h2 className={`${px} max-w-[560px] text-[38px] leading-[1.08] sm:text-[60px]`}>Built So A Breach Can’t Drain You</h2>
            <p className="mt-6 max-w-[560px] text-[15px] text-white/60">The design limits what even a full compromise of Warden could do: freeze your agents, never drain them. Protected wallets go live after an external audit.</p>
          </Reveal>
        </Wrap>
        <Wrap className="mt-14">
          <div className="overflow-x-auto border-y border-white/10">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead>
                <tr className={`${px} text-[18px]`}><th className="px-4 py-3 font-normal">If This Happens</th><th className="bg-[#1b1233] px-4 py-3 font-normal text-[#c8b9ff]">Warden</th><th className="px-4 py-3 font-normal">Agent Key Alone</th></tr>
              </thead>
              <tbody>
                {[
                  ['Agent key stolen', 'Attacker still needs Warden’s signature; every transaction hits the firewall', 'Wallet drained'],
                  ['Warden key stolen', 'Attacker still needs the agent’s key; owner rotates Warden out', 'Not applicable'],
                  ['Warden is down', 'Protected wallets pause; your recovery key overrides', 'No checks at all'],
                  ['API key leaked', 'Can freeze, cannot loosen a policy or approve a hold', 'Not applicable'],
                  ['Injected payment under the cap', 'Blocked: recipient came from untrusted content', 'Paid'],
                ].map(([a, b, c], i) => (
                  <tr key={a} className="group border-t border-white/10 transition-colors hover:bg-white/[0.03]">
                    <td className="px-4 py-3.5 text-white/85">{a}</td>
                    <td className="bg-[#1b1233] px-4 py-3.5"><span className="block">{b}</span><span className="mt-2 block"><GrowLine delay={i * 120} /></span></td>
                    <td className="px-4 py-3.5 text-white/45 group-hover:text-[#ff8fa3]">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Wrap>
      </section>
      <div className="mt-24"><DoubleRule /></div>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 pb-24 pt-16">
        <Wrap>
          <Reveal>
            <h2 className={`${px} text-[40px] sm:text-[60px]`}>Pricing</h2>
            <p className="mt-6 max-w-[620px] text-[15px] text-white/60">Monitoring is free to start. Protection is priced per wallet. Early-access pricing; it may change before protected wallets launch.</p>
          </Reveal>
        </Wrap>
        <Wrap className="mt-14">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Free', s: 'Solo builders watching an agent', p: '$0', unit: '/month', f: ['Monitor 1 wallet', 'Decoded activity feed', 'Alerts to webhook and Slack', '7-day history'], cta: 'Start monitoring', href: '/signup' },
              { t: 'Pro', s: 'Indie agents and trading bots', p: '$29', unit: '/wallet/month', f: ['Firewall on up to 10 wallets', 'Intent check and shadow mode', '50k checks included, then $0.002 each', '90-day history'], cta: 'Get started', href: '/signup' },
              { t: 'Teams', s: 'Agent startups, funds and DAOs', p: 'From $750', unit: '/month', f: ['Unlimited wallets', 'Roles and approval routing', 'Audit export and fund tracing', 'SLA'], cta: 'Get started', href: '/signup' },
              { t: 'Platform', s: 'Launchpads and frameworks', p: 'Custom', unit: '', f: ['Protection for every agent you launch', 'Volume pricing per active wallet', 'Revenue share'], cta: 'Talk to us', href: '/docs' },
            ].map((c, i) => (
              <div key={c.t} className="h-full [animation:fadeUp_.6s_ease-out_both]" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="group flex h-full flex-col bg-[#f5f2ff] text-[#120b22] outline outline-0 outline-[#7c5cff] transition-all duration-300 hover:-translate-y-1.5 hover:outline-2">
                  <div className="border-b border-[#120b22]/10 px-5 pb-4 pt-4"><div className={`${px} text-[30px]`}>{c.t}</div><div className="mt-1 text-[11px] text-[#120b22]/50">{c.s}</div></div>
                  <div className="border-b border-[#120b22]/10 px-5 py-5"><span className={`${px} text-[26px]`}>{c.p}</span><span className="text-[11px] text-[#120b22]/50"> {c.unit}</span></div>
                  <ul className="flex-1 space-y-2.5 px-5 py-5 text-[11.5px]">{c.f.map((f) => <li key={f} className="flex gap-2.5"><span className="mt-[3px] size-[7px] shrink-0 bg-[#7c5cff]" />{f}</li>)}</ul>
                  <Link href={c.href} className="m-2 flex h-11 items-center justify-center bg-[#120b22] text-[15px] text-white transition-colors group-hover:bg-[#7c5cff]">{c.cta}</Link>
                </div>
              </div>
            ))}
          </div>
        </Wrap>
      </section>

      {/* FAQ */}
      <section id="faq" className={`relative scroll-mt-16 ${LIGHT}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-28 lg:block" aria-hidden>
          {[[0, 0, '#7c5cff'], [1, 1, '#120b22'], [2, 0, '#c8b9ff'], [0, 2, '#ddd6fe'], [3, 1, '#5b8cff']].map(([x, y, c], i) => <span key={i} className="blink absolute size-7" style={{ left: (x as number) * 28, top: (y as number) * 28, background: c as string, animationDelay: `${i * 0.5}s` }} />)}
          {[[0, 0, '#120b22'], [1, 1, '#7c5cff'], [2, 0, '#a995ff'], [0, 2, '#ddd6fe'], [3, 2, '#5b8cff']].map(([x, y, c], i) => <span key={`r${i}`} className="blink absolute size-7" style={{ right: (x as number) * 28, top: (y as number) * 28, background: c as string, animationDelay: `${0.3 + i * 0.5}s` }} />)}
        </div>
        <Wrap>
          <div className="mx-auto max-w-[840px] border-x border-[#120b22]/10 pb-20 pt-16">
            <Reveal><h2 className={`${px} px-3 text-[36px] leading-[1.08] sm:text-[48px]`}>Frequently Asked<br />Questions</h2></Reveal>
            <div className="mt-10"><Faq items={FAQ} /></div>
          </div>
        </Wrap>
      </section>
      {/* Contact */}
      <section id="contact" className="relative scroll-mt-16 overflow-hidden border-t border-white/10">
        <HexField />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(11,7,22,0.55),#0b0716_75%)]" />
        <Wrap className="relative py-28 text-center">
          <Reveal>
            <Label>Contact</Label>
            <h2 className={`${px} mx-auto mt-6 max-w-[760px] text-[40px] leading-[1.06] sm:text-[60px]`}>Got A Question? <span className="shimmer">Talk To Us.</span></h2>
            <p className="mx-auto mt-6 max-w-[520px] text-[17px] text-white/60">Running agents with real money? Tell us what they do and we’ll help you set up monitoring and shadow mode in an afternoon.</p>
            <div className="mt-9 flex justify-center">
              <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contactharryu@gmail.com'}`} className="px-btn inline-flex h-[43px] items-center bg-white px-[18px] text-[16px] text-[#0b0716]">Contact us</a>
              <Link href="/signup" className="px-btn inline-flex h-[43px] items-center bg-[#7c5cff] px-[18px] text-[16px] text-white">Start monitoring</Link>
            </div>
          </Reveal>
        </Wrap>
      </section>
      <Footer />
    </main>
  )
}
