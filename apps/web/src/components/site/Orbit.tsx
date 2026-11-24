import { Mark } from '../brand'

const TAGS = [
  { t: 'Blocked for 3 customers', c: 'border-[#f5c2c0] bg-[#fdf0ef] text-[#b4231c]', pos: 'left-[2%] top-[22%]' },
  { t: 'Confirmed drainer', c: 'border-[#f5c2c0] bg-[#fdf0ef] text-[#b4231c]', pos: 'right-[0%] top-[14%]' },
  { t: 'First seen 2h ago', c: 'border-[#f3dca6] bg-[#fdf6e3] text-[#8a5a00]', pos: 'right-[4%] bottom-[20%]' },
  { t: 'x402 price ×40', c: 'border-accent-2 bg-accent-soft text-accent', pos: 'left-[6%] bottom-[12%]' },
  { t: 'Clean · 412 payers', c: 'border-[#bfe3cf] bg-[#eef8f2] text-[#1f7a4a]', pos: 'left-[38%] top-[2%]' },
]

/** Attio-style orbit: concentric rings around the mark, with signal tags floating on them. */
export default function Orbit() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[460px]">
      {[92, 64, 38].map((s) => (
        <div key={s} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-strong/70" style={{ width: `${s}%`, aspectRatio: '1' }} />
      ))}
      <div className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface shadow-[0_8px_30px_-10px_rgba(16,24,40,0.25)]">
        <Mark size={34} />
      </div>
      {TAGS.map((g) => (
        <span key={g.t} className={`absolute ${g.pos} whitespace-nowrap rounded-[7px] border px-2 py-1 text-[12.5px] font-medium ${g.c}`}>{g.t}</span>
      ))}
    </div>
  )
}
