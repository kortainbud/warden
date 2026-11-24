import Link from 'next/link'

/** Warden mark: a shield cut by a gate line (block, don't hold). */
export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 2.5 4 5.5v6.2c0 4.6 3.3 8.4 8 9.8 4.7-1.4 8-5.2 8-9.8V5.5l-8-3Z" fill="#1d3a2f" />
      <path d="M8 12.2h8" stroke="#f3f6f4" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 8.2v8" stroke="#f3f6f4" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </svg>
  )
}

export function Wordmark({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[16px] font-semibold tracking-[-0.02em]">
      <Mark />
      Warden
    </Link>
  )
}
