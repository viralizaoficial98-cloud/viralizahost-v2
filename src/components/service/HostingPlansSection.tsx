'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, X, Loader2, Globe, HardDrive, Activity, Mail, Send, Cpu, Files, Server } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'
import { PLAN_PERIODS, impliedDiscount, selectorBadge, type EmailCycle } from '@/lib/commerce/period-pricing'

// Hospedagem Premium (página /hospedagem-de-sites e página inicial). Fonte única: catálogo (/api/products).
// O total de cada período é o valor gravado em product_prices.price (o mesmo que o carrinho cobra);
// o equivalente mensal é total ÷ meses e o desconto é calculado a partir dos dados guardados.

type Limit = { unlimited: true } | { value: number }
export type HostingSpecs = {
  usageProfile?: string | null; sites?: Limit | null; storageGb?: number | null; diskType?: 'SSD' | 'NVMe' | null
  traffic?: { unlimited: true } | { value: number; unit: 'GB' | 'TB' } | null; emailAccounts?: Limit | null; sendLimitHour?: number | null
  ramGb?: number | null; inodes?: Limit | null
}
export type CardGroup = { name: string | null; features: { text: string; included: boolean }[] }
export type CardPlan = {
  slug: string; name: string; description: string | null; badge: string | null; highlight: boolean; onRequest: boolean
  specs: HostingSpecs; groups: CardGroup[]; base: number | null
  period: { cycle: string; months: number; total: number; renewal: number | null; discount: number } | null
}

const n = (v: number) => v.toLocaleString('pt-PT').replace(/\s/g, ' ')
const isUnl = (l?: Limit | null): l is { unlimited: true } => !!l && 'unlimited' in l && l.unlimited === true
/** Linhas da ficha técnica; campos vazios são omitidos. */
export function specLines(s: HostingSpecs): { key: string; icon: ReactNode; text: string }[] {
  const out: { key: string; icon: ReactNode; text: string }[] = []
  const ic = 'text-[#F5B700]'
  if (s.sites) out.push({ key: 'sites', icon: <Globe size={14} className={ic} />, text: isUnl(s.sites) ? 'Sites ilimitados' : `${n(s.sites.value)} ${s.sites.value === 1 ? 'site' : 'sites'}` })
  if (s.storageGb != null) out.push({ key: 'storage', icon: <HardDrive size={14} className={ic} />, text: `${n(s.storageGb)} GB ${s.diskType ?? 'de armazenamento'}` })
  else if (s.diskType) out.push({ key: 'storage', icon: <HardDrive size={14} className={ic} />, text: `Disco ${s.diskType}` })
  if (s.traffic) out.push({ key: 'traffic', icon: <Activity size={14} className={ic} />, text: 'unlimited' in s.traffic ? 'Tráfego ilimitado' : `${n(s.traffic.value)} ${s.traffic.unit} de tráfego/mês` })
  if (s.emailAccounts) out.push({ key: 'email', icon: <Mail size={14} className={ic} />, text: isUnl(s.emailAccounts) ? 'Caixas de e-mail ilimitadas' : `${n(s.emailAccounts.value)} ${s.emailAccounts.value === 1 ? 'caixa' : 'caixas'} de e-mail` })
  if (s.sendLimitHour != null) out.push({ key: 'send', icon: <Send size={14} className={ic} />, text: `Até ${n(s.sendLimitHour)} envios/hora` })
  if (s.ramGb != null) out.push({ key: 'ram', icon: <Cpu size={14} className={ic} />, text: `${n(s.ramGb)} GB de RAM` })
  if (s.inodes) out.push({ key: 'inodes', icon: <Files size={14} className={ic} />, text: isUnl(s.inodes) ? 'Ficheiros (inodes) ilimitados' : `${n(s.inodes.value)} ficheiros (inodes)` })
  return out
}

/** Cartão de plano (página pública, página inicial e pré-visualização do painel). */
export function HostingPlanCard({ plan, fmt, href, preview = false }: { plan: CardPlan; fmt: (v: number) => string; href?: string; preview?: boolean }) {
  const dark = plan.highlight
  const muted = dark ? 'text-gray-400' : 'text-[#777]'
  const pr = plan.period
  const perMonth = pr ? pr.total / pr.months : null
  const lines = specLines(plan.specs)
  return (
    <div data-testid="hosting-plan-card" data-slug={plan.slug}
      className={`relative rounded-2xl flex flex-col h-full transition-all duration-300 ${preview ? '' : 'hover:-translate-y-1'} ${dark ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_8px_40px_rgba(245,183,0,0.20)]' : 'bg-white border border-[#E8E8E8] shadow-sm hover:shadow-md'}`}>
      {plan.badge && (
        <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
          <span className="text-[10px] font-black px-4 py-1.5 rounded-full bg-[#F5B700] text-black uppercase" data-testid="hosting-plan-badge">{plan.badge}</span>
        </div>
      )}
      <div className="p-6 sm:p-7 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,183,0,0.12)' }}><Server size={18} className="text-[#F5B700]" /></div>
          <div className="min-w-0">
            <h3 className={`font-bold text-base leading-tight ${dark ? 'text-white' : 'text-[#0A0A0A]'}`} data-testid="hosting-plan-name">{plan.name}</h3>
            {plan.specs.usageProfile && <p className="text-[11px] font-semibold text-[#B98900]" data-testid="hosting-plan-profile">{plan.specs.usageProfile}</p>}
          </div>
        </div>
        {plan.description && <p className={`text-xs mt-2 mb-4 ${muted}`}>{plan.description}</p>}

        <div className="mb-5 min-h-[104px] mt-2">
          {plan.onRequest ? (
            <span className={`text-2xl font-black ${dark ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>Sob consulta</span>
          ) : pr && perMonth != null ? (
            <>
              <div className="flex items-center gap-2 h-5">
                {pr.discount > 0 && plan.base != null && plan.base > perMonth && <span className={`text-sm line-through ${muted}`} data-testid="hosting-plan-list">{fmt(plan.base)}</span>}
                {pr.discount > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700" data-testid="hosting-plan-discount">Poupe {pr.discount}%</span>}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1">
                <span className={`text-[28px] leading-tight font-black ${dark ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`} data-testid="hosting-plan-monthly">{fmt(perMonth)}</span>
                <span className={`text-sm ${muted}`}>/mês</span>
              </div>
              <p className={`text-xs mt-1 ${dark ? 'text-gray-300' : 'text-[#444]'}`} data-testid="hosting-plan-period">
                {pr.months > 1 ? <><strong data-testid="hosting-plan-total">{fmt(pr.total)}</strong> pagos por {pr.months} meses</> : <>Pago mensalmente · <strong data-testid="hosting-plan-total">{fmt(pr.total)}</strong>/mês</>}
              </p>
              {pr.renewal != null && pr.renewal > 0 && (
                <p className={`text-[11px] mt-0.5 ${dark ? 'text-gray-500' : 'text-[#999]'}`} data-testid="hosting-plan-renewal">Renova por {fmt(pr.renewal)}{pr.months > 1 ? ` a cada ${pr.months} meses` : '/mês'}</p>
              )}
            </>
          ) : <span className={`text-sm ${muted}`}>Indisponível neste período</span>}
        </div>

        {lines.length > 0 && (
          <ul className={`grid gap-1.5 mb-5 text-sm ${dark ? 'text-gray-200' : 'text-[#333]'}`} data-testid="hosting-plan-specs">
            {lines.map(l => <li key={l.key} className="flex items-center gap-2" data-testid={`hosting-spec-${l.key}`}>{l.icon}{l.text}</li>)}
          </ul>
        )}

        {plan.groups.map((g, gi) => (
          <div key={`${g.name ?? ''}-${gi}`} className="mb-4" data-testid="hosting-plan-group">
            {g.name && <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${dark ? 'text-[#F5B700]' : 'text-[#B98900]'}`} data-testid="hosting-plan-group-name">{g.name}</p>}
            <ul className="space-y-2">
              {g.features.map((f, i) => (
                <li key={`${f.text}-${i}`} className={`flex items-start gap-2.5 text-sm ${f.included ? '' : 'opacity-40'}`} data-testid="hosting-plan-feature">
                  {f.included ? <Check size={14} className={`mt-0.5 shrink-0 ${dark ? 'text-[#F5B700]' : 'text-green-500'}`} /> : <X size={14} className="mt-0.5 shrink-0 text-gray-400" />}
                  <span className={dark ? 'text-gray-300' : 'text-[#444]'}>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-auto pt-2">
          {href ? (
            <Link href={href} data-testid="hosting-plan-cta"
              className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-all ${dark ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#E5A800]' : 'bg-[#0A0A0A] text-white hover:bg-[#222]'}`}>
              {plan.onRequest ? 'Pedir proposta' : 'Comprar agora'}
            </Link>
          ) : <span className={`block w-full text-center py-3 rounded-xl font-bold text-sm ${dark ? 'bg-[#F5B700] text-[#0A0A0A]' : 'bg-[#0A0A0A] text-white'}`}>Comprar agora</span>}
        </div>
      </div>
    </div>
  )
}

type ApiPrice = { cycle: string; months: number; price: number | string; renewal_price: number | string | null; active: number | boolean; discount_pct?: number }
type ApiPlan = {
  id: string; slug: string; name: string; description: string | null; badge: string | null; popular: boolean | number; sale_status?: string
  base_monthly_price?: number | string | null; plan_specs?: HostingSpecs | string | null
  product_features?: { feature: string; included: boolean | number; position: number; group_name?: string | null }[]
  product_prices?: ApiPrice[]
}
const on = (v: unknown) => v === true || Number(v) === 1

export function toCardPlan(p: ApiPlan, cycle: string): CardPlan {
  const base = p.base_monthly_price != null ? Number(p.base_monthly_price) : null
  let specs: HostingSpecs = {}
  try { specs = (typeof p.plan_specs === 'string' ? JSON.parse(p.plan_specs) : p.plan_specs) ?? {} } catch { specs = {} }
  const groups: CardGroup[] = []
  for (const f of [...(p.product_features ?? [])].sort((a, b) => a.position - b.position)) {
    const name = f.group_name ?? null
    let g = groups[groups.length - 1]
    if (!g || g.name !== name) { g = { name, features: [] }; groups.push(g) }
    g.features.push({ text: f.feature, included: on(f.included) })
  }
  const r = (p.product_prices ?? []).find(x => x.cycle === cycle && on(x.active))
  const months = r ? Number(r.months) : 1, total = r ? Number(r.price) : 0
  return {
    slug: p.slug, name: p.name, description: p.description, badge: p.badge, highlight: on(p.popular), onRequest: p.sale_status === 'on_request', specs, groups, base,
    period: r ? { cycle, months, total, renewal: r.renewal_price != null ? Number(r.renewal_price) : null, discount: base != null ? impliedDiscount(total, base, months) : Number(r.discount_pct ?? 0) } : null,
  }
}

export function HostingPlansSection({ id = 'planos', tag = 'Hospedagem Premium', title, subtitle, defaultCycle = 'monthly', headingAs: Heading = 'h2', className = 'py-20' }: {
  id?: string; tag?: string; title: ReactNode; subtitle?: ReactNode; defaultCycle?: EmailCycle
  /** «h1» quando a secção abre a página (ex.: /hospedagem-de-sites sem banner) */
  headingAs?: 'h1' | 'h2'; className?: string
}) {
  const { formatCurrency, currency } = useLocale()
  const fmt = (v: number) => formatCurrency(convertFromAOA(v, currency))
  const [cycle, setCycle] = useState<EmailCycle>(defaultCycle)
  const [plans, setPlans] = useState<ApiPlan[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    fetch('/api/products?category=hosting', { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message ?? `HTTP ${r.status}`); return j })
      .then(j => {
        const list = (j.data as ApiPlan[]).filter(p => p.sale_status === 'on_request' || (p.product_prices ?? []).some(x => on(x.active)))
        setPlans(list); setState(list.length ? 'ok' : 'empty')
      })
      .catch(err => { console.error('[HostingPlansSection]', err); setState('error') })
  }, [attempt])

  // Períodos publicados em pelo menos um plano; etiqueta do selector a partir dos planos disponíveis nesse período
  const periods = useMemo(() => PLAN_PERIODS.map(per => {
    const cards = plans.filter(p => p.sale_status !== 'on_request').map(p => toCardPlan(p, per.cycle)).filter(c => c.period)
    return { ...per, available: cards.length > 0, badge: selectorBadge(cards.map(c => c.period!.discount)) }
  }).filter(p => p.available), [plans])
  const active = periods.some(p => p.cycle === cycle) ? cycle : (periods[0]?.cycle ?? cycle)

  return (
    <section id={id} className={`bg-[#F8F8F8] scroll-mt-24 ${className}`} data-testid="hosting-plans-section">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="section-tag">{tag}</span>
          <Heading className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title}</Heading>
          {subtitle && <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">{subtitle}</p>}
          {state === 'ok' && periods.length > 1 && (
            <div className="flex justify-center mt-6">
              <div className="grid grid-cols-2 sm:flex gap-1 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm w-full max-w-md sm:w-auto" role="radiogroup" aria-label="Período de contratação">
                {periods.map(per => (
                  <button key={per.cycle} role="radio" aria-checked={active === per.cycle} data-testid={`hosting-period-${per.cycle}`} onClick={() => setCycle(per.cycle)}
                    className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${active === per.cycle ? 'bg-[#F5B700] text-[#0A0A0A] shadow-sm' : 'text-gray-500 hover:text-[#0A0A0A]'}`}>
                    {per.label}
                    {per.badge && <span className={`text-[10px] font-black ${active === per.cycle ? 'text-[#0A0A0A]' : 'text-green-600'}`} data-testid="hosting-period-badge">{per.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {state === 'loading' && <div className="flex justify-center py-20" role="status" aria-label="A carregar planos de hospedagem"><Loader2 size={32} className="animate-spin text-[#F5B700]" /></div>}
        {state === 'error' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-red-200 rounded-2xl p-8" role="alert" data-testid="plans-error">
            <p className="font-bold text-[#0A0A0A]">Não foi possível carregar os planos de hospedagem.</p>
            <button onClick={() => { setState('loading'); setAttempt(a => a + 1) }} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F5B700] text-[#0A0A0A]">Tentar novamente</button>
          </div>
        )}
        {state === 'empty' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-[#E8E8E8] rounded-2xl p-8" data-testid="plans-empty">
            <p className="font-bold text-[#0A0A0A]">Ainda não há planos de hospedagem publicados.</p>
            <Link href="/suporte/contactar" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white">Falar com a equipa</Link>
          </div>
        )}
        {state === 'ok' && (
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${plans.length >= 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'} gap-6 max-w-6xl mx-auto items-stretch`}>
            {plans.map(p => {
              const card = toCardPlan(p, active)
              return <HostingPlanCard key={p.id} plan={card} fmt={fmt} href={card.onRequest ? `/comprar/${p.slug}` : card.period ? `/comprar/${p.slug}?ciclo=${active}` : undefined} />
            })}
          </div>
        )}
        <p className="text-center text-gray-400 text-xs sm:text-sm mt-10">Períodos de 1, 2 e 3 anos pagos antecipadamente · Domínio e extras escolhidos ao configurar · Activação depois do pagamento confirmado</p>
      </div>
    </section>
  )
}
