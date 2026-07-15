'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Suspense } from 'react'

function RedirectToReset() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Forward all query params to the canonical reset-password route
    const qs = searchParams.toString()
    router.replace(`/reset-password${qs ? `?${qs}` : ''}${window.location.hash}`)
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-yellow-400" />
    </div>
  )
}

export default function LegacyResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-yellow-400" /></div>}>
      <RedirectToReset />
    </Suspense>
  )
}
