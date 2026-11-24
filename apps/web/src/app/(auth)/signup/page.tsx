import type { Metadata } from 'next'
import { Suspense } from 'react'
import AuthScreen from '@/components/AuthScreen'

export const metadata: Metadata = { title: 'Sign up' }

export default function Page() {
  return <Suspense fallback={<div className="min-h-dvh bg-page" />}><AuthScreen mode="signup" /></Suspense>
}
