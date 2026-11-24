// Pixel icons and meters (Heliveil's dashboard kit, light version).
// Icons are 9×9 bitmaps drawn as crisp SVG squares.

export const ICONS = {
  overview: ['.........', '.###.###.', '.###.###.', '.###.###.', '.........', '.###.###.', '.###.###.', '.###.###.', '.........'],
  approvals: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.........', '.#######.', '.#.....#.', '.#######.'],
  wallets: ['.........', '.#######.', '#........', '#######.#', '#....####', '#....##.#', '#.......#', '.#######.', '.........'],
  checks: ['.........', '##.......', '##.#####.', '.........', '##.......', '##.#####.', '.........', '##.......', '##.#####.'],
  test: ['..#####..', '...#.#...', '...#.#...', '...#.#...', '..#...#..', '.#.....#.', '#..###..#', '#.#####.#', '.#######.'],
  shield: ['.#######.', '.#######.', '.##...##.', '.##.#.##.', '.##.#.##.', '.##...##.', '..##.##..', '...###...', '....#....'],
  alerts: ['....#....', '..#####..', '.##...##.', '.#.....#.', '.#.....#.', '.#.....#.', '#########', '.........', '...###...'],
  settings: ['...#.#...', '.#.###.#.', '..#...#..', '##.#.#.##', '#..###..#', '##.#.#.##', '..#...#..', '.#.###.#.', '...#.#...'],
  spark: ['....#....', '....#....', '...###...', '..#####..', '#########', '..#####..', '...###...', '....#....', '....#....'],
  lock: ['...###...', '..#...#..', '..#...#..', '.#######.', '.#######.', '.###.###.', '.###.###.', '.#######.', '.........'],
  snow: ['....#....', '.#..#..#.', '..#.#.#..', '...###...', '#########', '...###...', '..#.#.#..', '.#..#..#.', '....#....'],
  radar: ['...###...', '.##...##.', '.#..#..#.', '#..#.#..#', '#.#.#.#.#', '#..#.#..#', '.#..#..#.', '.##...##.', '...###...'],
  search: ['.........', '..####...', '.#....#..', '.#....#..', '.#....#..', '..####...', '......##.', '.......##', '.........'],
} as const

export type PixelName = keyof typeof ICONS

export function PixelIcon({ name, size = 16, color = 'currentColor', className = '' }: { name: PixelName; size?: number; color?: string; className?: string }) {
  const rows = ICONS[name]
  return (
    <svg viewBox="0 0 9 9" width={size} height={size} className={className} aria-hidden shapeRendering="crispEdges">
      {rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)))}
    </svg>
  )
}

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

/** Strip of square cells; the edge of the fill is dithered. */
export function PixelMeter({ value, cols = 48, rows = 2, cell = 6, gap = 2, color = '#7c5cff', empty = '#231a3d', className = '', label }: {
  value: number; cols?: number; rows?: number; cell?: number; gap?: number; color?: string; empty?: string; className?: string; label?: string
}) {
  const v = Math.max(0, Math.min(100, value)) / 100
  const W = cols * (cell + gap) - gap
  const H = rows * (cell + gap) - gap
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} style={{ width: '100%', height: 'auto' }} shapeRendering="crispEdges" role="img" aria-label={label ?? `${Math.round(value)} of 100`}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const x = i % cols, y = Math.floor(i / cols)
        const pos = (x + 0.5) / cols
        const t = (v - pos) / 0.1 + 0.5
        const on = v > 0 && (t >= 1 || (t > 0 && t > BAYER[(y & 3) * 4 + (x & 3)]!))
        return <rect key={i} x={x * (cell + gap)} y={y * (cell + gap)} width={cell} height={cell} rx={1} fill={on ? color : empty} />
      })}
    </svg>
  )
}

/** Tone for a 0–100 usage/risk value. */
export const meterColor = (v: number) => (v >= 90 ? '#ff6b8b' : v >= 60 ? '#ffc566' : '#7c5cff')
