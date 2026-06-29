'use client'
import Link from 'next/link'
import { Shield, Zap, HeadphonesIcon, Server } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { HOSTING_PLANS } from '@/lib/constants'
import { Currency } from '@/types'

export function HeroSection() {
  const { format, currency } = useCurrency()
  const plan = HOSTING_PLANS[0]
  const prices: Record<Currency, number> = { AKZ: plan.price_akz, BRL: plan.price_brl, USD: plan.price_usd }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="relative container mx-auto px-4 py-24 lg:py-36">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-500/30 rounded-full px-4 py-2 text-sm text-indigo-300 mb-8">
            <Zap size={14} className="text-indigo-400" />
            <span>99.9% Uptime Garantido • Suporte 24/7</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold leading-tight mb-6">
            Hospedagem Web{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Premium</span>{' '}
            para o seu Negócio
          </h1>
          <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Performance ultrarrápida, segurança de nível empresarial e suporte técnico especializado.
            Comece hoje a partir de <strong className="text-white">{format(prices[currency])}/mês</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-indigo-500/25">
              Começar Agora
            </Link>
            <Link href="/#planos" className="border border-white/30 hover:border-white/60 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:bg-white/10">
              Ver Planos
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Zap, label: 'NVMe SSD', sublabel: 'Ultra Rápido' },
              { icon: Shield, label: 'SSL Grátis', sublabel: 'Segurança Total' },
              { icon: HeadphonesIcon, label: 'Suporte 24/7', sublabel: 'Sempre Online' },
              { icon: Server, label: 'cPanel', sublabel: 'Fácil de Usar' },
            ].map(({ icon: Icon, label, sublabel }) => (
              <div key={label} className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center">
                <Icon className="mx-auto mb-2 text-indigo-400" size={28} />
                <div className="font-semibold text-sm">{label}</div>
                <div className="text-xs text-slate-400">{sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
