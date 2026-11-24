import { Header } from '@/components/hydra/Chrome'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`min-h-dvh bg-[#0b0716] text-white`}>
      <Header />
      {children}
    </div>
  )
}
