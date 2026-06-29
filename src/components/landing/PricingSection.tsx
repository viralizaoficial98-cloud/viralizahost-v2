'use client'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { HOSTING_PLANS } from '@/lib/constants'
import { Currency } from '@/types'

export function PricingSection() {
  const { format, currency } = useCurrency()
  const getPrice = (plan: typeof HOSTING_PLANS[0]) => {
    const prices: Record<Currency, number> = { AKZ: plan.price_akz, BRL: plan.price_brl, USD: plan.price_usd }
    return prices[currency]
  }
  return (
    <section id="planos" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Planos de Hospedagem</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">Escolha o plano ideal para o seu negócio. Todos incluem SSL grátis, backups e suporte 24/7.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {HOSTING_PLANS.map((plan) => (
            <div key={plan.id} className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all hover:scale-105 ${plan.is_popular ? 'border-indigo-500 shadow-indigo-100' : 'border-slate-200'}`}>
              {plan.is_popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-sm font-semibold px-4 py-1 rounded-full">Mais Popular</span>
                </div>
              )}
              <div className={`p-8 rounded-t-2xl ${plan.is_popular ? 'bg-indigo-600 text-white' : 'bg-white'}`}>
                <h3 className="text-2xl font-bold mb-1">{plan.name}</h3>
                <p className={`text-sm mb-6 ${plan.is_popular ? 'text-indigo-200' : 'text-slate-500'}`}>{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{format(getPrice(plan))}</span>
                  <span className={`text-sm ${plan.is_popular ? 'text-indigo-200' : 'text-slate-500'}`}>/mês</span>
                </div>
              </div>
              <div className="p-8 space-y-4">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check size={18} className="text-indigo-600 flex-shrink-0" />
                    <span className="text-slate-700 text-sm">{f}</span>
                  </div>
                ))}
                <Link href={`/register?plan=${plan.id}`} className={`block w-full text-center py-3 rounded-xl font-semibold mt-6 transition-colors ${
                  plan.is_popular ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-800'
                }`}>
                  Começar Agora
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
