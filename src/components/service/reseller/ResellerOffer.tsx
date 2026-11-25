'use client'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, Clock, Loader2, Send, ShieldCheck } from 'lucide-react'
import { FamilyPlansSection, type FamilyCardPlan } from '@/components/service/FamilyPlansSection'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'
import { RESELLER_PERIODS } from '@/lib/commerce/plan-families'

// Planos + formulário de pedido da Revenda. O botão de cada plano segue o modo comercial definido no painel
// (o servidor volta a validar tudo: este componente nunca decide se a contratação é permitida).
//   closed     «Em breve» (desactivado, ou modo de teste para visitantes)
//   request    «Solicitar contratação» → formulário (pedido com aprovação; sem pagamento)
//   test       igual a «request», só para administradores (pedido marcado como teste)
//   automatic  «Contratar agora» → percurso de compra (carrinho/checkout)

export type OfferMode = 'closed' | 'request' | 'test' | 'automatic'
export interface Prefill { fullName: string; email: string; phone: string; loggedIn: boolean }
const BUSINESS = [['agencia_web', 'Agência web / design'], ['freelancer', 'Freelancer / programador'], ['empresa_ti', 'Empresa de TI'], ['consultoria', 'Consultoria / marketing'], ['revenda_existente', 'Já revendo alojamento'], ['outro', 'Outro']] as const
const field = 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/20'
const label = 'block text-xs font-semibold text-[#444] mb-1.5'

export function ResellerOffer({ plans, mode, prefill, notice }: { plans: FamilyCardPlan[]; mode: OfferMode; prefill: Prefill; notice: string | null }) {
  const { formatCurrency, currency } = useLocale()
  const fmt = (v: number) => formatCurrency(convertFromAOA(v, currency))
  const sellable = plans.filter(p => !p.onRequest && p.periods.length)
  const [sel, setSel] = useState<{ plan: string; cycle: string }>(() => ({ plan: sellable.find(p => p.highlight)?.slug ?? sellable[0]?.slug ?? '', cycle: 'monthly' }))
  const formRef = useRef<HTMLDivElement>(null)
  const choose = (slug: string, cycle: string) => {
    setSel({ plan: slug, cycle })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const btn = (dark: boolean) => `block w-full text-center py-3 rounded-xl font-bold text-sm transition-all ${dark ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#E5A800]' : 'bg-[#0A0A0A] text-white hover:bg-[#222]'}`
  const ctaFor = (p: FamilyCardPlan, cycle: string) => {
    const has = p.periods.some(x => x.cycle === cycle)
    if (mode === 'closed' || p.onRequest) return <span className={`${btn(p.highlight)} opacity-60 cursor-not-allowed`} aria-disabled="true" data-testid="fam-plan-cta" data-mode="closed">Em breve</span>
    if (!has) return <span className={`${btn(p.highlight)} opacity-40`} data-testid="fam-plan-cta" data-mode="unavailable">Indisponível neste período</span>
    if (mode === 'automatic') return <Link href={`/comprar/${p.slug}?ciclo=${cycle}`} className={btn(p.highlight)} data-testid="fam-plan-cta" data-mode="automatic">Contratar agora</Link>
    return <button type="button" onClick={() => choose(p.slug, cycle)} className={btn(p.highlight)} data-testid="fam-plan-cta" data-mode={mode}>Solicitar contratação</button>
  }

  return (
    <>
      <FamilyPlansSection plans={plans} family="reseller" testId="family-plans-reseller" ctaFor={ctaFor}
        title="Revenda de Hospedagem — Escolha o plano"
        subtitle="Comece a vender hospedagem com a infraestrutura da ViralizaHost: WHM, cPanel e SSL para os seus clientes."
        footnote={mode === 'automatic'
          ? 'Mensal, trimestral, semestral ou anual, pago antecipadamente · a renovação é indicada em cada plano'
          : 'Mensal, trimestral, semestral ou anual · contratação mediante pedido e aprovação técnica: só paga depois da aprovação'} />
      <section id="pedido" ref={formRef} className="bg-white py-20 scroll-mt-24" data-testid="reseller-request-section">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <span className="section-tag">Contratação com aprovação</span>
            <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{mode === 'automatic' ? 'Prefere falar connosco primeiro?' : 'Solicitar contratação'}</h2>
            <p className="text-[#666] max-w-2xl mx-auto text-sm md:text-base" data-testid="reseller-approval-notice">
              {notice ?? 'Cada revenda é analisada pela nossa equipa técnica antes da activação, para garantir recursos dedicados e estáveis. Não é feita nenhuma cobrança antes da aprovação: depois de aprovado, recebe a factura e, com o pagamento confirmado, activamos o seu painel WHM.'}
            </p>
          </div>
          {mode === 'closed' ? (
            <div className="rounded-2xl border border-[#E8E8E8] bg-[#F8F8F8] p-8 text-center" data-testid="reseller-closed">
              <Clock className="mx-auto text-[#F5B700]" size={28} />
              <p className="font-bold text-[#0A0A0A] mt-3">Em breve</p>
              <p className="text-sm text-[#666] mt-1">A contratação de revenda abre brevemente. Deixe-nos o seu contacto e avisamos assim que estiver disponível.</p>
              <Link href="/suporte/contactar" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white">Falar com a equipa</Link>
            </div>
          ) : (
            <RequestForm plans={sellable} sel={sel} setSel={setSel} prefill={prefill} fmt={fmt} test={mode === 'test'} />
          )}
        </div>
      </section>
    </>
  )
}

function RequestForm({ plans, sel, setSel, prefill, fmt, test }: { plans: FamilyCardPlan[]; sel: { plan: string; cycle: string }; setSel: (s: { plan: string; cycle: string }) => void; prefill: Prefill; fmt: (v: number) => string; test: boolean }) {
  const [startedAt] = useState(() => Date.now())
  const [f, setF] = useState({ fullName: prefill.fullName, company: '', email: prefill.email, phone: prefill.phone, domain: '', estimatedClients: '', businessType: '', notes: '', website: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<{ reference: string; duplicate: boolean } | null>(null)
  const plan = plans.find(p => p.slug === sel.plan) ?? null
  const periods = useMemo(() => RESELLER_PERIODS.filter(per => plan?.periods.some(x => x.cycle === per.cycle)), [plan])
  const period = plan?.periods.find(x => x.cycle === sel.cycle) ?? null
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/reseller/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, plan: sel.plan, cycle: sel.cycle, startedAt }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Não foi possível enviar o pedido.')
      setDone({ reference: j.reference, duplicate: !!j.duplicate })
    } catch (e2) { setErr((e2 as Error).message) } finally { setBusy(false) }
  }

  if (done) return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center" data-testid="reseller-request-done" role="status">
      <CheckCircle2 className="mx-auto text-green-600" size={32} />
      <p className="font-black text-lg text-[#0A0A0A] mt-3">{done.duplicate ? 'Já tínhamos o seu pedido' : 'Pedido recebido'}</p>
      <p className="text-sm text-[#444] mt-1">Referência: <strong data-testid="reseller-request-ref">{done.reference}</strong></p>
      <p className="text-sm text-[#555] mt-3 max-w-lg mx-auto">A equipa técnica vai analisar o pedido e responder por e-mail. Não é feita nenhuma cobrança antes da aprovação.{prefill.loggedIn ? ' Pode acompanhar o estado na área de cliente → Revenda.' : ''}</p>
      {prefill.loggedIn && <Link href="/revendedor" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white" data-testid="reseller-request-follow">Acompanhar o pedido</Link>}
    </div>
  )
  if (!plans.length) return <p className="text-center text-sm text-[#666]" data-testid="reseller-no-plans">Ainda não há planos de revenda publicados.</p>

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] p-5 sm:p-8 space-y-5" data-testid="reseller-request-form" noValidate>
      {test && <p className="text-xs font-bold rounded-lg bg-amber-100 text-amber-800 px-3 py-2" data-testid="reseller-test-banner">Modo de teste: este pedido fica marcado como teste (só administradores).</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="rv-plan">Plano</label>
          <select id="rv-plan" className={field} value={sel.plan} onChange={e => { const p = plans.find(x => x.slug === e.target.value); setSel({ plan: e.target.value, cycle: p?.periods.some(x => x.cycle === sel.cycle) ? sel.cycle : p?.periods[0]?.cycle ?? 'monthly' }) }} data-testid="rv-plan">
            {plans.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="rv-cycle">Ciclo de facturação</label>
          <select id="rv-cycle" className={field} value={sel.cycle} onChange={e => setSel({ ...sel, cycle: e.target.value })} data-testid="rv-cycle">
            {periods.map(p => <option key={p.cycle} value={p.cycle}>{p.label}</option>)}
          </select>
        </div>
      </div>
      {period && (
        <p className="text-sm text-[#333] bg-white border border-[#EEE] rounded-xl px-4 py-3" data-testid="rv-summary">
          Valor do período: <strong>{fmt(period.total)}</strong>{period.months > 1 ? ` (${fmt(period.total / period.months)}/mês)` : ''} · renova por {fmt(period.renewal)}. <span className="text-[#777]">Cobrado só depois da aprovação técnica.</span>
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className={label} htmlFor="rv-name">Nome completo *</label><input id="rv-name" className={field} value={f.fullName} onChange={set('fullName')} required maxLength={160} autoComplete="name" data-testid="rv-name" /></div>
        <div><label className={label} htmlFor="rv-company">Empresa (opcional)</label><input id="rv-company" className={field} value={f.company} onChange={set('company')} maxLength={160} autoComplete="organization" data-testid="rv-company" /></div>
        <div><label className={label} htmlFor="rv-email">E-mail *</label><input id="rv-email" type="email" className={`${field} ${prefill.loggedIn ? 'bg-[#F3F3F3]' : ''}`} value={f.email} onChange={set('email')} readOnly={prefill.loggedIn} required maxLength={191} autoComplete="email" data-testid="rv-email" /></div>
        <div><label className={label} htmlFor="rv-phone">Telefone / WhatsApp *</label><input id="rv-phone" type="tel" className={field} value={f.phone} onChange={set('phone')} required maxLength={20} placeholder="+244 9XX XXX XXX" autoComplete="tel" data-testid="rv-phone" /></div>
        <div><label className={label} htmlFor="rv-domain">Domínio pretendido para a revenda *</label><input id="rv-domain" className={field} value={f.domain} onChange={set('domain')} required maxLength={191} placeholder="aminhaempresa.ao" data-testid="rv-domain" /></div>
        <div><label className={label} htmlFor="rv-clients">N.º estimado de clientes</label><input id="rv-clients" type="number" min={0} max={100000} className={field} value={f.estimatedClients} onChange={set('estimatedClients')} data-testid="rv-clients" /></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="rv-business">Tipo de negócio</label>
          <select id="rv-business" className={field} value={f.businessType} onChange={set('businessType')} data-testid="rv-business">
            <option value="">Seleccionar…</option>{BUSINESS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className={label} htmlFor="rv-notes">Observações</label><textarea id="rv-notes" className={`${field} min-h-[96px]`} value={f.notes} onChange={set('notes')} maxLength={2000} data-testid="rv-notes" placeholder="Conte-nos sobre os seus clientes, migrações previstas ou necessidades especiais." /></div>
      </div>
      {/* Isco anti-spam: invisível para pessoas */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} name="website" /></label></div>
      <p className="flex items-start gap-2 text-xs text-[#666]"><ShieldCheck size={15} className="text-[#F5B700] shrink-0 mt-0.5" />Nunca lhe pedimos senhas nem dados de pagamento neste formulário. Os dados são usados só para analisar o pedido.</p>
      {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert" data-testid="rv-error">{err}</p>}
      <button type="submit" disabled={busy} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-[#F5B700] text-[#0A0A0A] hover:bg-[#E5A800] disabled:opacity-60" data-testid="rv-submit">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar pedido de contratação
      </button>
    </form>
  )
}
