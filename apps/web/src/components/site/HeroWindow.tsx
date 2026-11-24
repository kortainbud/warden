import { ChartLineUp, HandPalm, ListChecks, ShieldWarning, Wallet, Bell, Clock } from '@/components/icons'
import { Mark } from '../brand'

/** Product window for the hero: the approvals screen, drawn with the same parts as the real dashboard. */
export default function HeroWindow() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line-strong/70 bg-sunken/80 p-1.5 shadow-[0_30px_80px_-30px_rgba(16,24,40,0.35)] backdrop-blur">
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span className="size-3 rounded-full bg-[#ff5f57]" /><span className="size-3 rounded-full bg-[#febc2e]" /><span className="size-3 rounded-full bg-[#28c840]" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[10px] border border-line bg-surface text-left md:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden border-r border-line p-3 md:block">
          <div className="mb-4 flex items-center gap-2 px-1.5 text-[14px] font-semibold"><Mark size={18} />Warden</div>
          {[
            [ChartLineUp, 'Overview', 0], [HandPalm, 'Approvals', 2], [Wallet, 'Wallets', 0], [ListChecks, 'Checks', 0], [ShieldWarning, 'Threat Network', 0], [Bell, 'Alerts', 3],
          ].map(([Icon, label, n]) => {
            const I = Icon as typeof Wallet
            const active = label === 'Approvals'
            return (
              <div key={label as string} className={`flex h-8 items-center gap-2 rounded-[7px] px-2 text-[13px] ${active ? 'bg-sunken font-medium' : 'text-ink-2'}`}>
                <I size={16} weight={active ? 'fill' : 'regular'} className={active ? '' : 'text-muted'} />
                <span className="flex-1">{label as string}</span>
                {(n as number) > 0 && <span className={`rounded-full px-1.5 text-[11px] font-semibold ${active ? 'bg-warn-bg text-warn' : 'bg-sunken text-ink-2'}`}>{n as number}</span>}
              </div>
            )
          })}
        </aside>
        <div className="min-w-0 p-4 sm:p-6">
          <div className="text-[18px] font-semibold tracking-[-0.02em]">Approvals</div>
          <div className="mt-0.5 text-[12.5px] text-muted">Transactions Warden held for a human. No answer before the timeout means deny.</div>
          <div className="mt-4 rounded-[10px] border border-warn/30">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 text-[12px]">
              <span className="flex items-center gap-2"><span className="rounded-full border border-warn/20 bg-warn-bg px-2 py-0.5 font-medium text-warn">Awaiting approval</span><span className="font-medium">Atlas</span></span>
              <span className="flex items-center gap-1 text-muted"><Clock size={12} />Denies in 14m</span>
            </div>
            <div className="px-4 py-3.5">
              <div className="text-[14.5px] font-medium leading-snug">Agent Atlas wants to send 1,850 USDC to a wallet created 5 days ago. Instruction came from a webpage.</div>
              <div className="mt-3 rounded-[8px] border border-line bg-sunken px-3 py-2 text-[12px] text-ink-2">
                <div className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wide text-muted">From web · docs.perp-dex.example/fees</div>
                Liquidity providers must deposit the bond to the fee wallet before routing orders.
              </div>
              <ul className="mt-3 space-y-1.5 text-[12.5px]">
                <li className="flex gap-2"><span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-warn" />Payment to a new recipient was triggered by a webpage.</li>
                <li className="flex gap-2"><span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-warn" />Intent check: rebalancing does not involve paying a new wallet.</li>
              </ul>
              <div className="mt-4 flex gap-2">
                <span className="inline-flex h-8 items-center rounded-[8px] bg-bad px-3 text-[13px] font-medium text-white">Deny</span>
                <span className="inline-flex h-8 items-center rounded-[8px] border border-line-strong px-3 text-[13px] font-medium">Approve</span>
              </div>
            </div>
          </div>
          <div className="mt-3 hidden rounded-[10px] border border-line px-4 py-3 sm:block">
            <div className="flex items-center gap-2 text-[12px]"><span className="rounded-full border border-bad/20 bg-bad-bg px-2 py-0.5 font-medium text-bad">Blocked</span><span className="font-medium">Scout</span><span className="ml-auto text-muted">6h ago</span></div>
            <div className="mt-1.5 text-[13px] text-ink-2">Agent Scout wants to send 4,200 USDC to a wallet created 2 hours ago. Instruction came from a social post.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
