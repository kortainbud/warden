import { GeistPixelSquare } from 'geist/font/pixel'
import { Header } from '@/components/hydra/Chrome'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${GeistPixelSquare.variable} min-h-dvh bg-black text-white`}>
      <Header />
      {children}
    </div>
  )
}
