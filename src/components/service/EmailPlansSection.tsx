'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Mail, HardDrive, Send } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'
import { EMAIL_PERIODS, selectorBadge, type EmailCycle } from '@/lib/commerce/period-pricing'

// Planos de E-mail Corporativo (página /email-corporativo e página inicial).
// Fonte única: catálogo (/api/products → products + product_prices). O total de cada período é o valor
// gravado pelo servidor em product_prices.price (regra de arredondamento em period-pricing.ts); o cartão
// só o divide pelos meses para mostrar o equivalente mensal. É o mesmo valor que o carrinho cobra.

type Price = { cycle: string; months: number; price: number; renewal_price: number; active: number | boolean; discount_pct?: number; renewal_discount_pct?: number }
type Plan = {
  id: string; slug: string; name: string; description: string | null; badge: string | null; popular: boolean | number
  sale_status?: 'active' | 'on_request' | 'draft'; quantity_unit?: string | null
  base_monthly_price?: number | string | null; storage_gb?: number | null; send_limit_hour?: number | null
  product_features?: { feature: string; included: boolean | number; position: number }[]
  product_prices?: Price[]
}

const on = (v: unknown) => v === true || Number(v) === 1

export function EmailPlansSection({ id = 'planos', tag = 'Planos e Preços', title, subtitle, defaultCycle = 'monthly' }: {
  id?: string; tag?: string; title: React.ReactNode; subtitle?: string; defaultCycle?: EmailCycle
}) {
  const { formatCurrency, currency } = useLocale()
  const fmt = (v: number) => formatCurrency(convertFromAOA(v, currency))
  const [cycle, setCycle] = useState<EmailCycle>(defaultCycle)
  const [plans, setPlans] = useState<Plan[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    fetch('/api/products?category=email', { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message ?? `HTTP ${r.status}`); return j })
      .then(j => {
        const list = (j.data as Plan[]).filter(p => p.sale_status === 'on_request' || (p.product_prices ?? []).some(x => on(x.active)))
        setPlans(list); setState(list.length ? 'ok' : 'empty')
      })
      .catch(err => { console.error('[EmailPlansSection]', err); setState('error') })
  }, [attempt])

  const rowOf = (p: Plan, c: string) => (p.product_prices ?? []).find(x => x.cycle === c && on(x.active)) ?? null
  // Períodos com preço em pelo menos um plano; etiqueta do selector a partir dos descontos de cada plano.
  const periods = useMemo(() => EMAIL_PERIODS.filter(per => plans.some(p => rowOf(p, per.cycle))).map(per => ({
    ...per, badge: selectorBadge(plans.map(p => rowOf(p, per.cycle)).filter(Boolean).map(r => Number(r!.discount_pct ?? 0))),
  })), [plans])
  const active = periods.some(p => p.cycle === cycle) ? cycle : (periods[0]?.cycle ?? cycle)

  return (
    <section id={id} className="bg-[#F8F8F8] py-20" data-testid="email-plans-section">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="section-tag">{tag}</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title}</h2>
          {subtitle && <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">{subtitle}</p>}

          {state === 'ok' && periods.length > 1 && (
            <div className="flex justify-center mt-6">
              <div className="grid grid-cols-2 sm:flex gap-1 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm w-full max-w-md sm:w-auto" role="radiogroup" aria-label="Período de contratação">
                {periods.map(per => (
                  <button key={per.cycle} role="radio" aria-checked={active === per.cycle} data-testid={`email-period-${per.cycle}`} onClick={() => setCycle(per.cycle)}
                    className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${active === per.cycle ? 'bg-[#F5B700] text-[#0A0A0A] shadow-sm' : 'text-gray-500 hover:text-[#0A0A0A]'}`}>
                    {per.label}
                    {per.badge && <span className={`text-[10px] font-black ${active === per.cycle ? 'text-[#0A0A0A]' : 'text-green-600'}`} data-testid="email-period-badge">{per.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {state === 'loading' && <div className="flex justify-center py-20" role="status" aria-label="A carregar planos de e-mail"><Loader2 size={32} className="animate-spin text-[#F5B700]" /></div>}
        {state === 'error' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-red-200 rounded-2xl p-8" role="alert">
            <p className="font-bold text-[#0A0A0A]">Não foi possível carregar os planos de e-mail.</p>
            <p className="text-sm text-[#666] mt-1">Verifique a ligação e tente novamente.</p>
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
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${plans.length >= 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'} gap-6 max-w-6xl mx-auto`}>
            {plans.map(plan => {
              const row = rowOf(plan, active)
              const onRequest = plan.sale_status === 'on_request'
              const dark = on(plan.popular)
              const months = row ? Number(row.months) : 1
              const total = row ? Number(row.price) : null
              const perMonth = total != null ? total / months : null
              const discount = row ? Number(row.discount_pct ?? 0) : 0
              const base = plan.base_monthly_price != null ? Number(plan.base_monthly_price) : null
              const renewalDiscount = row ? Number(row.renewal_discount_pct ?? 0) : 0
              const feats = [...(plan.product_features ?? [])].filter(f => on(f.included)).sort((a, b) => a.position - b.position)
              const muted = dark ? 'text-gray-400' : 'text-[#777]'
              return (
                <div key={plan.id} data-testid="email-plan-card" data-slug={plan.slug}
                  className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 ${dark ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_8px_40px_rgba(245,183,0,0.20)]' : 'bg-white border border-[#E8E8E8] shadow-sm hover:shadow-md'}`}>
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                      <span className="text-[10px] font-black px-4 py-1.5 rounded-full bg-[#F5B700] text-black" data-testid="email-plan-badge">{plan.badge}</span>
                    </div>
                  )}
                  <div className="p-6 sm:p-7 flex-1 flex flex-col">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,183,0,0.12)' }}><Mail size={18} className="text-[#F5B700]" /></div>
                      <h3 className={`font-bold text-base leading-tight ${dark ? 'text-white' : 'text-[#0A0A0A]'}`} data-testid="email-plan-name">{plan.name}</h3>
                    </div>
                    {plan.description && <p className={`text-xs mb-4 ${muted}`}>{plan.description}</p>}

                    <div className="mb-5 min-h-[112px]">
                      {onRequest ? (
                        <span className={`text-2xl font-black ${dark ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>Sob consulta</span>
                      ) : row && perMonth != null && total != null ? (
                        <>
                          <div className="flex items-center gap-2 h-5">
                            {discount > 0 && base != null && base > perMonth && <span className={`text-sm line-through ${muted}`} data-testid="email-plan-list">{fmt(base)}</span>}
                            {discount > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700" data-testid="email-plan-discount">Poupe {discount}%</span>}
                          </div>
                          <div className="flex flex-wrap items-baseline gap-x-1">
                            <span className={`text-3xl font-black ${dark ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`} data-testid="email-plan-monthly">{fmt(perMonth)}</span>
                            <span className={`text-sm ${muted}`}>/mês</span>
                          </div>
                          <p className={`text-xs font-semibold ${dark ? 'text-gray-300' : 'text-[#555]'}`}>por caixa de correio</p>
                          <p className={`text-xs mt-1.5 ${dark ? 'text-gray-300' : 'text-[#444]'}`}>
                            Total: <strong data-testid="email-plan-total">{fmt(total)}</strong> por caixa{months > 1 ? ` · ${months} meses pagos antecipadamente` : ' · 1 mês'}
                          </p>
                          <p className={`text-[11px] mt-0.5 ${dark ? 'text-gray-500' : 'text-[#999]'}`}>
                            Renova por {fmt(Number(row.renewal_price))} por caixa{months > 1 ? ` / ${months} meses` : '/mês'}{renewalDiscount > 0 ? ` (desconto de renovação ${renewalDiscount}%)` : ''}
                          </p>
                        </>
                      ) : <span className={`text-sm ${muted}`}>Sem preço para este período</span>}
                    </div>

                    {(plan.storage_gb != null || plan.send_limit_hour != null) && (
                      <div className={`grid gap-1.5 mb-5 text-sm ${dark ? 'text-gray-200' : 'text-[#333]'}`}>
                        {plan.storage_gb != null && <span className="flex items-center gap-2" data-testid="email-plan-storage"><HardDrive size={14} className="text-[#F5B700]" />{plan.storage_gb} GB por caixa</span>}
                        {plan.send_limit_hour != null && <span className="flex items-center gap-2" data-testid="email-plan-send"><Send size={14} className="text-[#F5B700]" />Até {Number(plan.send_limit_hour).toLocaleString('pt-PT')} envios/hora</span>}
                      </div>
                    )}

                    <ul className="space-y-2.5 mb-6">
                      {feats.map(f => (
                        <li key={f.feature} className="flex items-start gap-2.5 text-sm" data-testid="email-plan-feature">
                          <Check size={14} className={`mt-0.5 shrink-0 ${dark ? 'text-[#F5B700]' : 'text-green-500'}`} />
                          <span className={dark ? 'text-gray-300' : 'text-[#444]'}>{f.feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Link href={onRequest ? `/comprar/${plan.slug}` : `/comprar/${plan.slug}?ciclo=${active}`} data-testid="email-plan-cta"
                      className={`mt-auto block w-full text-center py-3 rounded-xl font-bold text-sm transition-all ${dark ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#E5A800]' : 'bg-[#0A0A0A] text-white hover:bg-[#222]'}`}>
                      {onRequest ? 'Pedir proposta' : 'Comprar agora'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="text-center text-gray-400 text-xs sm:text-sm mt-10">Preços por caixa de correio · Períodos de 1, 2 e 3 anos pagos antecipadamente · Activação depois do pagamento confirmado</p>
      </div>
    </section>
  )
}
