// One icon set, drawn like Global Stack's: thin line icons on a 24 grid, 1.6 stroke, round caps.
// Lucide matches that style; names below keep the call sites readable.
import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  ArrowLeft as L_ArrowLeft, ArrowRight as L_ArrowRight, ArrowUpRight as L_ArrowUpRight, Bell as L_Bell, BellRing, ChartLine, Check as L_Check,
  Clock as L_Clock, Copy as L_Copy, ExternalLink, FlaskConical, Hand, KeyRound, ListChecks as L_ListChecks, LogOut, Menu, Plus as L_Plus,
  Quote, RotateCw, Settings, ShieldAlert, Signature as L_Signature, Snowflake as L_Snowflake, Wallet as L_Wallet, X as L_X,
  ShieldCheck as L_ShieldCheck, Landmark as L_Landmark, ScanSearch as L_ScanSearch, Gauge as L_Gauge, Radar as L_Radar, Scale as L_Scale,
  FileCode as L_FileCode, Zap as L_Zap, Fingerprint as L_Fingerprint,
} from 'lucide-react'

type Props = Omit<LucideProps, 'ref'> & { weight?: 'regular' | 'bold' | 'fill' }

function wrap(I: LucideIcon) {
  const C = ({ size = 18, weight, strokeWidth, ...p }: Props) => (
    <I size={size} strokeWidth={strokeWidth ?? (weight === 'bold' ? 2.2 : weight === 'fill' ? 2 : 1.6)} {...p} />
  )
  return C
}

export const ArrowLeft = wrap(L_ArrowLeft)
export const ArrowRight = wrap(L_ArrowRight)
export const ArrowUpRight = wrap(L_ArrowUpRight)
export const ArrowSquareOut = wrap(ExternalLink)
export const ArrowClockwise = wrap(RotateCw)
export const Bell = wrap(L_Bell)
export const BellRinging = wrap(BellRing)
export const ChartLineUp = wrap(ChartLine)
export const Check = wrap(L_Check)
export const Clock = wrap(L_Clock)
export const Copy = wrap(L_Copy)
export const Flask = wrap(FlaskConical)
export const GearSix = wrap(Settings)
export const HandPalm = wrap(Hand)
export const Key = wrap(KeyRound)
export const List = wrap(Menu)
export const ListChecks = wrap(L_ListChecks)
export const Plus = wrap(L_Plus)
export const Quotes = wrap(Quote)
export const ShieldWarning = wrap(ShieldAlert)
export const ShieldCheck = wrap(L_ShieldCheck)
export const Signature = wrap(L_Signature)
export const SignOut = wrap(LogOut)
export const Snowflake = wrap(L_Snowflake)
export const Wallet = wrap(L_Wallet)
export const X = wrap(L_X)
export const Landmark = wrap(L_Landmark)
export const ScanSearch = wrap(L_ScanSearch)
export const Gauge = wrap(L_Gauge)
export const Radar = wrap(L_Radar)
export const Scale = wrap(L_Scale)
export const FileCode = wrap(L_FileCode)
export const Zap = wrap(L_Zap)
export const Fingerprint = wrap(L_Fingerprint)

/** Global Stack-style icon tile: pale blue square, blue line icon. */
export function IconTile({ icon: I, size = 36 }: { icon: (p: Props) => React.JSX.Element; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[9px] border border-accent-2 bg-accent-soft text-accent" style={{ width: size, height: size }}>
      <I size={Math.round(size * 0.5)} />
    </span>
  )
}
