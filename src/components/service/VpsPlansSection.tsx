'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { ArrowDownUp, Bot, Check, Cloud, Cpu, Database, DatabaseBackup, Globe, HardDrive, Headphones, KeyRound, Layers, LayoutDashboard, Loader2, Lock, Mail, MemoryStick, Monitor, Network, RefreshCw, Server, Shield, ShieldCheck, Terminal, Zap } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'
import { impliedDiscount, selectorBadge } from '@/lib/commerce/period-pricing'
import { VPS_CYCLES, isVpsIcon, vpsSpecLines, type VpsFeature, type VpsIcon, type VpsSpecs } from '@/lib/commerce/vps-shared'

// Servidor VPS (/servidor-vps): uma faixa por plano — imagem à esquerda, nome e características ao centro, preço e
// «Comprar agora» à direita (desktop); em coluna no telemóvel, sem rolagem horizontal. Fonte: catálogo
// (/api/products?category=vps, sem subcategoria); só planos publicados. Total = valor guardado em product_prices.

export const FEATURE_ICONS: Record<VpsIcon, ComponentType<{ size?: number; className?: string }>> = {
  check: Check, shield: Shield, backup: DatabaseBackup, globe: Globe, lock: Lock, terminal: Terminal, zap: Zap, headphones: Headphones,
  panel: LayoutDashboard, cloud: Cloud, refresh: RefreshCw, bot: Bot, database: Database, mail: Mail,
}
// Ícones das especificações (VPS e servidores dedicados)
const SPEC_ICON: Record<string, ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = {
  vcpu: Cpu, cpu: Cpu, cores: Layers, ram: MemoryStick, disk: HardDrive, raid: ShieldCheck, traffic: ArrowDownUp, network: Network, os: Monitor, license: KeyRound,
}

export type VpsBandPlan = {
  slug: string; name: string; summary: string | null; badge: string | null; highlight: boolean; imageUrl: string | null
  specs: VpsSpecs; features: VpsFeature[]; base: number | null
  /** Linhas de especificação já preparadas (servidores dedicados); sem elas usa as do VPS */
  specLines?: { key: string; label: string; value: string }[]
  /** Plano «sob consulta»: sem preço; o botão pede proposta (fluxo de cotação em /comprar/<plano>) */
  onRequest?: boolean
  period: { cycle: string; months: number; label: string; total: number; renewal: number | null; discount: number } | null
}

/** Faixa de plano (VPS e servidores dedicados). tid = prefixo dos identificadores de teste. */
export function VpsPlanBand({ plan, fmt, href, preview = false, tid = 'vps' }: { plan: VpsBandPlan; fmt: (v: number) => string; href?: string; preview?: boolean; tid?: string }) {
  const pr = plan.period
  const perMonth = pr ? pr.total / pr.months : null
  const specs = plan.specLines ?? vpsSpecLines(plan.specs)
  return (
    <article data-testid={`${tid}-plan`} data-slug={plan.slug}
      className={`relative rounded-2xl bg-white border ${plan.highlight ? 'border-[#F5B700] shadow-[0_8px_32px_rgba(245,183,0,0.18)]' : 'border-[#E8E8E8] shadow-sm'} overflow-hidden ${preview ? '' : 'transition-shadow hover:shadow-md'}`}>
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {/* Imagem */}
        <div className="relative lg:w-56 shrink-0 h-40 lg:h-auto bg-gradient-to-br from-[#0A0A0A] to-[#1F2937] flex items-center justify-center">
          {plan.imageUrl
            // eslint-disable-next-line @next/next/no-img-element -- imagem do plano carregada no painel
            ? <img src={plan.imageUrl} alt={`Ilustração do plano ${plan.name}`} className="absolute inset-0 w-full h-full object-cover" data-testid={`${tid}-plan-image`} />
            : <Server size={56} className="text-[#F5B700]/80" aria-hidden />}
          {plan.badge && <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#F5B700] text-black shadow" data-testid={`${tid}-plan-badge`}>{plan.badge}</span>}
        </div>
        {/* Nome e características */}
        <div className="flex-1 min-w-0 p-5 sm:p-6">
          <h3 className="text-lg sm:text-xl font-black text-[#0A0A0A]" data-testid={`${tid}-plan-name`}>{plan.name}</h3>
          {plan.summary && <p className="text-sm text-[#666] mt-1" data-testid={`${tid}-plan-summary`}>{plan.summary}</p>}
          {specs.length > 0 && (
            <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid={`${tid}-plan-specs`}>
              {specs.map(s => { const I = SPEC_ICON[s.key] ?? Check; return (
                <li key={s.key} className="flex items-center gap-2 rounded-xl bg-[#F8F8F8] border border-[#EFEFEF] px-3 py-2 min-w-0" data-testid={`${tid}-spec-${s.key}`}>
                  <I size={16} className="text-[#B98900] shrink-0" aria-hidden />
                  <span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wide text-[#888] break-words">{s.label}</span><span className="block text-sm font-bold text-[#0A0A0A] break-words">{s.value}</span></span>
                </li>) })}
            </ul>
          )}
          {plan.features.length > 0 && (
            <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5" data-testid={`${tid}-plan-features`}>
              {plan.features.map((f, i) => { const I = f.icon && isVpsIcon(f.icon) ? FEATURE_ICONS[f.icon] : Check; return (
                <li key={`${f.text}-${i}`} className="flex items-start gap-2 text-sm text-[#444]" data-testid={`${tid}-plan-feature`} data-icon={f.icon ?? 'check'}>
                  <I size={15} className="mt-0.5 shrink-0 text-green-600" aria-hidden /><span>{f.text}</span>
                </li>) })}
            </ul>
          )}
        </div>
        {/* Preço e botão */}
        <div className="lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-[#F0F0F0] p-5 sm:p-6 flex flex-col justify-center bg-[#FCFCFC]">
          {plan.onRequest ? (
            <>
              <p className="text-lg font-black text-[#0A0A0A]" data-testid={`${tid}-plan-on-request`}>Preço sob consulta</p>
              <p className="text-xs text-[#666] mt-1">Configuração à medida: enviamos a proposta com o hardware e o período que precisa.</p>
              {href ? <Link href={href} className="mt-4 inline-flex justify-center items-center w-full py-3 rounded-xl text-sm font-black bg-[#0A0A0A] text-white hover:bg-[#222]" data-testid={`${tid}-plan-quote`}>Pedir proposta</Link>
                : <span className="mt-4 inline-flex justify-center w-full py-3 rounded-xl text-sm font-black bg-[#0A0A0A] text-white">Pedir proposta</span>}
            </>
          ) : pr && perMonth != null ? (
            <>
              <div className="flex items-center gap-2 min-h-5 flex-wrap">
                {pr.discount > 0 && plan.base != null && plan.base > perMonth && <span className="text-sm line-through text-[#999]" data-testid={`${tid}-plan-list`}>{fmt(plan.base)}</span>}
                {pr.discount > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700" data-testid={`${tid}-plan-discount`}>Poupe {pr.discount}%</span>}
              </div>
              <p className="mt-1"><span className="text-3xl font-black text-[#0A0A0A]" data-testid={`${tid}-plan-monthly`}>{fmt(perMonth)}</span><span className="text-sm text-[#888]">/mês</span></p>
              <p className="text-xs text-[#444] mt-1" data-testid={`${tid}-plan-period`}>{pr.months > 1 ? <>Total <strong data-testid={`${tid}-plan-total`}>{fmt(pr.total)}</strong> por {pr.label}, pago antecipadamente</> : <>Total <strong data-testid={`${tid}-plan-total`}>{fmt(pr.total)}</strong> por mês</>}</p>
              {pr.renewal != null && pr.renewal > 0 && <p className="text-[11px] text-[#999] mt-0.5" data-testid={`${tid}-plan-renewal`}>Renova por {fmt(pr.renewal)}{pr.months > 1 ? ` a cada ${pr.label}` : '/mês'}</p>}
              {href ? <Link href={href} className="mt-4 inline-flex justify-center items-center w-full py-3 rounded-xl text-sm font-black bg-[#F5B700] text-[#0A0A0A] hover:bg-[#E5A800]" data-testid={`${tid}-plan-cta`}>Comprar agora</Link>
                : <span className="mt-4 inline-flex justify-center w-full py-3 rounded-xl text-sm font-black bg-[#F5B700] text-[#0A0A0A]">Comprar agora</span>}
            </>
          ) : <p className="text-sm text-[#888]">Indisponível neste período</p>}
        </div>
      </div>
    </article>
  )
}

type ApiPrice = { cycle: string; months: number; price: number | string; renewal_price: number | string | null; active: number | boolean; discount_pct?: number }
type ApiPlan = {
  id: string; slug: string; name: string; description: string | null; badge: string | null; popular: boolean | number; sale_status?: string; subcategory?: string | null
  base_monthly_price?: number | string | null; plan_specs?: VpsSpecs | string | null; image_path?: string | null
  product_features?: { feature: string; included: boolean | number; position: number; icon?: string | null }[]; product_prices?: ApiPrice[]
}
const on = (v: unknown) => v === true || Number(v) === 1
const imageUrl = (p?: string | null) => p ? `/storage/v1/object/public/catalog-assets/${p.split('/').map(encodeURIComponent).join('/')}` : null

export function toVpsBand(p: ApiPlan, cycle: string): VpsBandPlan {
  const base = p.base_monthly_price != null ? Number(p.base_monthly_price) : null
  let specs: VpsSpecs = {}
  try { specs = (typeof p.plan_specs === 'string' ? JSON.parse(p.plan_specs) : p.plan_specs) ?? {} } catch { specs = {} }
  const r = (p.product_prices ?? []).find(x => x.cycle === cycle && on(x.active))
  const c = VPS_CYCLES.find(x => x.cycle === cycle)
  const months = r ? Number(r.months) : 1, total = r ? Number(r.price) : 0
  return {
    slug: p.slug, name: p.name, summary: p.description, badge: p.badge, highlight: on(p.popular), imageUrl: imageUrl(p.image_path), specs, base,
    features: [...(p.product_features ?? [])].filter(f => on(f.included)).sort((a, b) => a.position - b.position).map(f => ({ text: f.feature, icon: isVpsIcon(f.icon) ? f.icon : null })),
    period: r ? { cycle, months, label: c?.label ?? `${months} meses`, total, renewal: r.renewal_price != null ? Number(r.renewal_price) : null, discount: base != null ? impliedDiscount(total, base, months) : Number(r.discount_pct ?? 0) } : null,
  }
}

export function VpsPlansSection({ id = 'planos', title, subtitle }: { id?: string; title: ReactNode; subtitle?: string }) {
  const { formatCurrency, currency } = useLocale()
  const fmt = (v: number) => formatCurrency(convertFromAOA(v, currency))
  const [plans, setPlans] = useState<ApiPlan[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [cycle, setCycle] = useState<string>('monthly')
  useEffect(() => {
    fetch('/api/products?category=vps', { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message ?? `HTTP ${r.status}`); return j })
      .then(j => {
        // Só os planos do Servidor VPS (sem subcategoria) publicados e com pelo menos um ciclo activo
        const list = (j.data as ApiPlan[]).filter(p => !p.subcategory && p.sale_status === 'active' && (p.product_prices ?? []).some(x => on(x.active)))
        setPlans(list); setState(list.length ? 'ok' : 'empty')
      })
      .catch(() => setState('error'))
  }, [attempt])
  const cycles = useMemo(() => VPS_CYCLES.map(c => {
    const bands = plans.map(p => toVpsBand(p, c.cycle)).filter(b => b.period)
    return { ...c, available: bands.length > 0, badge: selectorBadge(bands.map(b => b.period!.discount)) }
  }).filter(c => c.available), [plans])
  const active = cycles.some(c => c.cycle === cycle) ? cycle : cycles[0]?.cycle ?? 'monthly'

  return (
    <section id={id} className="bg-[#F8F8F8] py-16 sm:py-20" data-testid="vps-plans-section">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <span className="section-tag">Servidores VPS</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title}</h2>
          {subtitle && <p className="text-[#666] max-w-2xl mx-auto text-sm md:text-base">{subtitle}</p>}
          {state === 'ok' && cycles.length > 1 && (
            <div className="flex justify-center mt-6">
              <div className="grid grid-cols-3 sm:flex gap-1 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm w-full max-w-lg sm:w-auto" role="radiogroup" aria-label="Período de contratação">
                {cycles.map(c => (
                  <button key={c.cycle} role="radio" aria-checked={active === c.cycle} onClick={() => setCycle(c.cycle)} data-testid={`vps-period-${c.cycle}`}
                    className={`flex flex-col items-center px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${active === c.cycle ? 'bg-[#F5B700] text-[#0A0A0A]' : 'text-gray-500 hover:text-[#0A0A0A]'}`}>
                    {c.label}{c.badge && <span className={`text-[10px] font-black ${active === c.cycle ? 'text-[#0A0A0A]' : 'text-green-600'}`} data-testid="vps-period-badge">{c.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {state === 'loading' && <div className="flex justify-center py-16" role="status" aria-label="A carregar planos VPS"><Loader2 size={32} className="animate-spin text-[#F5B700]" /></div>}
        {state === 'error' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-red-200 rounded-2xl p-8" role="alert" data-testid="plans-error">
            <p className="font-bold text-[#0A0A0A]">Não foi possível carregar os planos VPS.</p>
            <button onClick={() => { setState('loading'); setAttempt(a => a + 1) }} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F5B700] text-[#0A0A0A]">Tentar novamente</button>
          </div>
        )}
        {state === 'empty' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-[#E8E8E8] rounded-2xl p-8" data-testid="plans-empty">
            <p className="font-bold text-[#0A0A0A]">Ainda não há planos VPS publicados.</p>
            <Link href="/suporte/contactar" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white">Falar com a equipa</Link>
          </div>
        )}
        {state === 'ok' && (
          <div className="space-y-5 max-w-6xl mx-auto">
            {plans.map(p => { const b = toVpsBand(p, active); return <VpsPlanBand key={p.id} plan={b} fmt={fmt} href={b.period ? `/comprar/${p.slug}?ciclo=${active}` : undefined} /> })}
          </div>
        )}
        <p className="text-center text-gray-400 text-xs sm:text-sm mt-8">Escolha o plano e o período; depois a localização e o sistema operativo. Activação depois do pagamento confirmado.</p>
      </div>
    </section>
  )
}
