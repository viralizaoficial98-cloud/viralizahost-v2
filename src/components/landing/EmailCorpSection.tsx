'use client'
import Link from 'next/link'
import { Check, Mail, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'

// Planos de e-mail da página inicial. Fonte: catálogo (/api/products → product_prices),
// a mesma do painel, do carrinho e do checkout. Preço por caixa de correio.
type Price = { cycle: string; months: number; price: number; renewal_price: number; active: number | boolean }
type Plan = {
  id: string; slug: string; name: string; description: string | null; badge: string | null; popular: boolean
  sale_status?: 'active' | 'on_request' | 'draft'; quantity_unit?: string | null
  product_features?: { feature: string; included: boolean | number; position: number }[]
  product_prices?: Price[]
}
const ACCENTS = ['#3B82F6', '#F5B700', '#8B5CF6', '#10B981']

export function EmailCorpSection() {
  const { formatCurrency, currency, t } = useLocale()
  const fmt = (v: number) => formatCurrency(convertFromAOA(v, currency))
  const [billing, setBilling] = useState<'monthly' | '1year'>('monthly')
  const [plans, setPlans] = useState<Plan[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    fetch('/api/products?category=email', { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message ?? `HTTP ${r.status}`); return j })
      .then(j => {
        const list = (j.data as Plan[]).filter(p => p.sale_status !== 'on_request' && (p.product_prices ?? []).some(x => Number(x.active) === 1))
        setPlans(list); setState(list.length ? 'ok' : 'empty')
      })
      .catch(err => { console.error('[EmailCorpSection]', err); setState('error') })
  }, [attempt])

  const priceFor = (p: Plan) => {
    const row = (p.product_prices ?? []).find(x => x.cycle === billing && Number(x.active) === 1)
    return row ? { perMonth: Number(row.price) / Number(row.months), total: Number(row.price), months: Number(row.months), renewal: Number(row.renewal_price) } : null
  }
  const hasAnnual = plans.some(p => (p.product_prices ?? []).some(x => x.cycle === '1year' && Number(x.active) === 1))

  return (
    <section id="email-plans" className="py-24 bg-[#F8F8F8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />
      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">Comunicação Profissional</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            E-mails Corporativos <span className="gradient-text">Premium</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto mb-8">E-mail no seu domínio, com preço por caixa de correio.</p>

          {state === 'ok' && hasAnnual && (
            <div className="inline-flex items-center gap-2 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm" role="radiogroup" aria-label="Período de facturação">
              {(['monthly', '1year'] as const).map(c => (
                <button key={c} role="radio" aria-checked={billing === c} onClick={() => setBilling(c)}
                  className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${billing === c ? (c === 'monthly' ? 'bg-[#0A0A0A] text-white shadow-sm' : 'bg-[#F5B700] text-[#0A0A0A] shadow-sm') : 'text-gray-500 hover:text-[#0A0A0A]'}`}>
                  {c === 'monthly' ? t('billing.monthly') : t('billing.1year')}
                </button>
              ))}
            </div>
          )}
        </div>

        {state === 'loading' && <div className="flex justify-center py-20" role="status" aria-label="A carregar planos de e-mail"><Loader2 size={32} className="animate-spin text-[#F5B700]" /></div>}
        {state === 'error' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-red-200 rounded-2xl p-8" role="alert">
            <p className="font-bold text-[#0A0A0A]">Não foi possível carregar os planos de e-mail.</p>
            <button onClick={() => { setState('loading'); setAttempt(a => a + 1) }} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F5B700] text-[#0A0A0A]">Tentar novamente</button>
          </div>
        )}
        {state === 'empty' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-[#E8E8E8] rounded-2xl p-8">
            <p className="font-bold text-[#0A0A0A]">Ainda não há planos de e-mail publicados.</p>
            <Link href="/suporte/contactar" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white">Falar com a equipa</Link>
          </div>
        )}

        {state === 'ok' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {plans.map((plan, i) => {
              const pr = priceFor(plan)
              const color = ACCENTS[i % ACCENTS.length]
              const unit = plan.quantity_unit ?? 'caixa'
              const feats = [...(plan.product_features ?? [])].filter(f => Number(f.included) === 1 || f.included === true).sort((a, b) => a.position - b.position)
              return (
                <div key={plan.id} data-testid="email-plan-card"
                  className={`relative rounded-3xl overflow-hidden transition-all duration-300 hover-lift ${plan.popular ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_20px_60px_rgba(0,0,0,0.15)]' : 'bg-white border border-[#E8E8E8] shadow-sm hover:border-[#F5B700]/40'}`}>
                  {plan.badge && <div className={`text-center py-2.5 text-xs font-black tracking-widest ${plan.popular ? 'bg-[#F5B700] text-[#0A0A0A]' : 'text-white text-[10px]'}`} style={!plan.popular ? { background: color } : {}}>★ {plan.badge}</div>}
                  <div className="p-7">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: `${color}15`, border: `1px solid ${color}30` }}><Mail size={20} style={{ color }} /></div>
                      <h3 className={`font-bold text-base leading-tight ${plan.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>{plan.name}</h3>
                    </div>
                    {plan.description && <p className={`text-sm mb-6 ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>{plan.description}</p>}
                    <div className="mb-6">
                      {pr ? (
                        <>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className={`text-3xl font-black ${plan.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>{fmt(pr.perMonth)}</span>
                            <span className={`text-sm ${plan.popular ? 'text-gray-500' : 'text-gray-400'}`}>/mês por {unit}</span>
                          </div>
                          {pr.months > 1 && <p className={`text-xs ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>Cobrado {fmt(pr.total)} por {unit} a cada {pr.months} meses</p>}
                          <p className={`text-[11px] ${plan.popular ? 'text-gray-500' : 'text-gray-400'}`}>Renova por {fmt(pr.renewal)} por {unit}</p>
                        </>
                      ) : <span className={`text-sm ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>Sem preço para este período</span>}
                    </div>
                    <Link href={`/comprar/${plan.slug}?ciclo=${billing}`}
                      className={`btn-shimmer block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all mb-7 ${plan.popular ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#D9A300]' : 'bg-[#0A0A0A] text-white hover:bg-[#222]'}`}>
                      Escolher plano
                    </Link>
                    <div className={`mb-6 h-px ${plan.popular ? 'bg-white/10' : 'bg-[#F0F0F0]'}`} />
                    <ul className="space-y-3">
                      {feats.map(f => <li key={f.feature} className={`flex items-center gap-3 text-sm ${plan.popular ? 'text-gray-300' : 'text-gray-700'}`}><Check size={15} className="text-green-500 flex-shrink-0" />{f.feature}</li>)}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-center text-gray-400 text-sm mt-10">✓ Preço por caixa de correio &nbsp;•&nbsp; ✓ Renovação indicada em cada plano &nbsp;•&nbsp; ✓ Activação depois do pagamento confirmado</p>
      </div>
    </section>
  )
}
