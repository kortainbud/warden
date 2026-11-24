import Header from '@/components/attio/Header'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white text-[#0e0f11]">
      <Header />
      {children}
    </div>
  )
}
