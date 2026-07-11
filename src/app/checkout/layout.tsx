import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { CheckoutLogo } from './CheckoutLogo'

export const metadata: Metadata = { title: 'Checkout — ViralizaHost' }

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Minimal header */}
      <header className="bg-white border-b border-[#EBEBEB]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <CheckoutLogo />
          <div className="flex items-center gap-1.5 text-[#64748B] text-xs sm:text-sm">
            <ShieldCheck size={14} className="text-green-500 shrink-0" />
            <span className="hidden xs:inline">Checkout 100% seguro</span>
            <span className="xs:hidden">Seguro</span>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
