'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowRightLeft, ChevronLeft, ChevronRight, Clock, Loader2, Server, ShieldCheck, XCircle } from 'lucide-react'
import { useCart, type Cycle } from '@/store/cartStore'
import { flushCart } from '@/store/cartSync'
import { validateNameservers, MAX_NAMESERVERS } from '@/lib/commerce/nameservers'
import { PurchaseSteps, btnGhost, btnPrimary, card, input, kz, label, useCartHydrated, yearsLabel, CYCLE_LABEL } from '@/components/checkout/shared'

// Configuração do domínio avulso: período de registo da extensão, preço agora e de renovação,
// nameservers (padrão da ViralizaHost ou próprios) e alojamento opcional. «Continuar» valida no
// servidor, guarda no carrinho (sem duplicar) e abre o carrinho. Ao voltar para editar, recupera
// a configuração guardada no carrinho.

interface HostingOption { slug: string; name: string; category: string; prices: { cycle: Cycle; months: number; price: number; renewal: number }[] }
interface Info {
  domain: string; extension: string; availability: 'available' | 'unavailable' | 'confirm' | 'on_request'
  register: number | null; renew: number | null; maxYears: number; periods: { years: number; total: number }[]
  defaultNameservers: string[]; hosting: HostingOption[]
}

export function DomainConfig() {
  const params = useSearchParams()
  const hydrated = useCartHydrated()
  const domainParam = (params.get('dominio') ?? '').trim().toLowerCase()
  const [info, setInfo] = useState<Info | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!domainParam) return
    let alive = true
    fetch(`/api/domains/config?dominio=${encodeURIComponent(domainParam)}`, { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Falha ao carregar.'); if (alive) setInfo(j) })
      .catch(e => { if (alive) setLoadError((e as Error).message === 'Failed to fetch' ? 'Sem ligação. Verifique a internet e tente novamente.' : (e as Error).message) })
    return () => { alive = false }
  }, [domainParam, attempt])
  const retry = () => { setLoadError(''); setInfo(null); setAttempt(a => a + 1) }

  if (!domainParam) {
    return <div className={card}><p className="text-sm text-[#555]">Nenhum domínio indicado. <Link href="/dominios/pesquisar" className="underline font-bold">Pesquisar um domínio</Link></p></div>
  }
  if (loadError) {
    return (
      <div className={card} role="alert">
        <p className="text-sm text-red-700 flex flex-wrap gap-2"><AlertCircle size={16} /> {loadError} <button className="underline font-bold" onClick={retry}>Tentar novamente</button></p>
        <Link href="/dominios/pesquisar" className="inline-flex mt-3 text-sm underline">Voltar à pesquisa</Link>
      </div>
    )
  }
  if (!info || !hydrated) return <div className="flex items-center justify-center min-h-[30vh]" role="status"><Loader2 className="animate-spin text-[#F5B700]" /><span className="sr-only">A carregar…</span></div>
  return <ConfigForm key={info.domain} info={info} />
}

function ConfigForm({ info }: { info: Info }) {
  const router = useRouter()
  const saveDomainConfig = useCart(s => s.saveDomainConfig)
  // Edição a partir do carrinho: o formulário começa com a configuração guardada
  const [initial] = useState(() => {
    const lines = useCart.getState().lines
    const d = lines.find(l => l.type === 'domain' && l.domain === info.domain && l.operation === 'register')
    const h = lines.find(l => l.type === 'product' && l.domain === info.domain && l.domainMode === 'register')
    const custom = d?.type === 'domain' && d.nameservers && !d.nameservers.useDefault ? d.nameservers.ns : null
    const host = h?.type === 'product' && info.hosting.some(x => x.slug === h.slug) ? { slug: h.slug, cycle: h.cycle } : null
    return { editing: !!d, years: d?.type === 'domain' ? Math.min(d.years ?? 1, info.maxYears) : 1, custom, host }
  })
  const existing = initial.editing
  const [years, setYears] = useState(initial.years)
  const [useDefault, setUseDefault] = useState(!initial.custom)
  const [ns, setNs] = useState<string[]>([...(initial.custom ?? []), '', '', '', ''].slice(0, MAX_NAMESERVERS))
  const [nsError, setNsError] = useState<{ message: string; field?: number } | null>(null)
  const [withHosting, setWithHosting] = useState(!!initial.host)
  const [plan, setPlan] = useState(initial.host?.slug ?? '')
  const [cycle, setCycle] = useState<Cycle | ''>(initial.host?.cycle ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const hostingPlan = info.hosting.find(h => h.slug === plan) ?? null
  const hostingPrice = withHosting && hostingPlan ? hostingPlan.prices.find(p => p.cycle === cycle) ?? null : null
  const period = info.periods.find(p => p.years === years) ?? info.periods[0] ?? null
  const total = (period?.total ?? 0) + (hostingPrice?.price ?? 0)

  const continueToCart = async () => {
    if (!period) return
    setSaveError(''); setNsError(null)
    const choice = useDefault ? { useDefault: true } : { useDefault: false, ns }
    const local = validateNameservers(choice, info.domain)
    if (!local.ok) { setNsError({ message: local.message, field: local.field }); return }
    if (withHosting && (!hostingPlan || !hostingPrice)) { setSaveError('Escolha o plano e a duração do alojamento, ou desmarque «Adicionar hospedagem».'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/domains/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: info.domain, years: period.years, nameservers: choice }) })
      const j = await r.json()
      if (!r.ok) {
        if (j.field === 'nameservers') setNsError({ message: j.error, field: j.index ?? undefined })
        else setSaveError(j.error ?? 'Não foi possível guardar a configuração.')
        return
      }
      saveDomainConfig({ domain: j.line.domain, years: j.line.years, nameservers: j.line.nameservers }, withHosting && hostingPlan && hostingPrice ? { slug: hostingPlan.slug, cycle: hostingPrice.cycle } : null)
      await flushCart()
      router.push('/carrinho')
    } catch {
      setSaveError('Sem ligação. Verifique a internet e tente novamente.')
    } finally { setSaving(false) }
  }

  const back = `/dominios/pesquisar?q=${encodeURIComponent(info.domain)}`
  if (info.availability === 'unavailable' || info.availability === 'on_request') {
    return (
      <div className={card} data-testid="domain-config-blocked">
        <h1 className="text-2xl font-black text-[#0A0A0A] mb-2 break-all">{info.domain}</h1>
        {info.availability === 'unavailable' ? (
          <>
            <p className="text-sm text-red-700 flex gap-1.5 mb-4"><XCircle size={16} className="shrink-0 mt-0.5" /> Este domínio já está registado e não pode ser registado agora.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={back} className={btnPrimary}>Ver alternativas</Link>
              <Link href="/dominios/transferir" className={btnGhost}><ArrowRightLeft size={15} /> É meu — transferir</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[#555] mb-4">A extensão {info.extension} está sob consulta: não tem preço publicado.</p>
            <Link href={`/suporte/contactar?assunto=${encodeURIComponent('Domínio ' + info.domain)}`} className={btnPrimary}>Pedir preço</Link>
          </>
        )}
      </div>
    )
  }

  const renewYears = info.renew ?? info.register ?? 0
  return (
    <div>
      <PurchaseSteps current="Configuração" />
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full space-y-5">
          <section className={card} aria-labelledby="cfg-title">
            <h1 id="cfg-title" className="text-2xl sm:text-3xl font-black text-[#0A0A0A] mb-1">Configuração do domínio</h1>
            <p className="text-sm text-[#666] mb-5">{existing ? 'Está a editar um domínio que já está no carrinho.' : 'Escolha o período de registo e os nameservers.'}</p>
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <p className="text-xl font-black text-[#0A0A0A] break-all" data-testid="config-domain">{info.domain}</p>
              {info.availability === 'available'
                ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">Disponível</span>
                : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">A confirmar pela equipa</span>}
            </div>
            {info.availability === 'confirm' && (
              <p className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex gap-2" data-testid="config-confirm-note">
                <Clock size={16} className="shrink-0 mt-0.5" /> A extensão {info.extension} não tem consulta automática. A encomenda fica registada e a equipa confirma a disponibilidade; o pagamento só é pedido depois dessa confirmação.
              </p>
            )}
            <div className="grid sm:grid-cols-3 gap-4">
              <label className={label} htmlFor="cfg-years">Período de registo
                {info.periods.length > 1 ? (
                  <select id="cfg-years" className={`${input} mt-1`} value={years} onChange={e => setYears(Number(e.target.value))} data-testid="config-years">
                    {info.periods.map(p => <option key={p.years} value={p.years}>{yearsLabel(p.years)} — {kz(p.total)}</option>)}
                  </select>
                ) : <span className="block mt-1 px-3.5 py-3 rounded-xl bg-[#F8F8F8] text-sm" data-testid="config-years-fixed">1 ano</span>}
              </label>
              <div>
                <p className={label}>A pagar agora</p>
                <p className="mt-1 text-2xl font-black text-[#0A0A0A]" data-testid="config-price-now">{kz(period?.total ?? 0)}</p>
                {years > 1 && <p className="text-xs text-[#888]">{kz(info.register ?? 0)} no 1.º ano + {kz(renewYears)} × {years - 1}</p>}
              </div>
              <div>
                <p className={label}>Renovação</p>
                <p className="mt-1 text-lg font-bold text-[#0A0A0A]" data-testid="config-renewal">{kz(renewYears)}<span className="text-sm font-normal text-[#888]">/ano</span></p>
                <p className="text-xs text-[#888]">depois de {yearsLabel(years)}</p>
              </div>
            </div>
          </section>

          <section className={card} aria-labelledby="ns-title">
            <h2 id="ns-title" className="text-lg font-black text-[#0A0A0A] mb-1 flex items-center gap-2"><Server size={18} className="text-[#D9A300]" /> Nameservers</h2>
            <p className="text-sm text-[#666] mb-4">Indicam onde o DNS do domínio é gerido. Pode alterá-los mais tarde.</p>
            <div role="radiogroup" aria-label="Nameservers" className="grid gap-3">
              <button type="button" role="radio" aria-checked={useDefault} onClick={() => { setUseDefault(true); setNsError(null) }} data-testid="ns-default"
                className={`text-left p-4 rounded-xl border-2 transition-colors ${useDefault ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE] hover:border-[#F5B700]/50'}`}>
                <span className="font-bold text-[#0A0A0A] flex items-center gap-2"><ShieldCheck size={16} className="text-green-600" /> Usar os nameservers da ViralizaHost <span className="text-[11px] font-bold text-[#888]">(recomendado)</span></span>
                <span className="block font-mono text-xs text-[#555] mt-1.5" data-testid="ns-default-list">{info.defaultNameservers.join(' · ')}</span>
              </button>
              <button type="button" role="radio" aria-checked={!useDefault} onClick={() => setUseDefault(false)} data-testid="ns-custom"
                className={`text-left p-4 rounded-xl border-2 transition-colors ${!useDefault ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE] hover:border-[#F5B700]/50'}`}>
                <span className="font-bold text-[#0A0A0A]">Usar nameservers próprios</span>
                <span className="block text-xs text-[#666] mt-1">Para gerir o DNS noutro fornecedor (Cloudflare, outro alojamento…).</span>
              </button>
            </div>
            {!useDefault && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {ns.map((v, i) => (
                  <label key={i} className={label}>Nameserver {i + 1}{i < 2 ? ' *' : ' (opcional)'}
                    <input className={`${input} mt-1 font-mono ${nsError?.field === i ? 'border-red-400' : ''}`} value={v} placeholder={`ns${i + 1}.fornecedor.com`} autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="url"
                      aria-invalid={nsError?.field === i} onChange={e => { const n = [...ns]; n[i] = e.target.value; setNs(n); setNsError(null) }} data-testid={`ns-input-${i + 1}`} />
                  </label>
                ))}
              </div>
            )}
            {nsError && <p className="mt-3 text-sm text-red-700 flex gap-1.5" role="alert" data-testid="ns-error"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {nsError.message}</p>}
          </section>

          {info.hosting.length > 0 && (
            <section className={card} aria-labelledby="host-title">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-1 w-4 h-4 accent-[#F5B700]" checked={withHosting} onChange={e => { setWithHosting(e.target.checked); setSaveError('') }} data-testid="add-hosting" />
                <span>
                  <span id="host-title" className="font-black text-[#0A0A0A]">Adicionar hospedagem <span className="text-sm font-normal text-[#888]">(opcional)</span></span>
                  <span className="block text-sm text-[#666]">O site fica alojado em {info.domain}. Pode também comprar só o domínio.</span>
                </span>
              </label>
              {withHosting && (
                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  <label className={label}>Plano
                    <select className={`${input} mt-1`} value={plan} onChange={e => { setPlan(e.target.value); const p = info.hosting.find(h => h.slug === e.target.value); setCycle(p?.prices.find(x => x.cycle === cycle)?.cycle ?? p?.prices[0]?.cycle ?? '') }} data-testid="hosting-plan">
                      <option value="">Escolher plano…</option>
                      {info.hosting.map(h => <option key={h.slug} value={h.slug}>{h.name}</option>)}
                    </select>
                  </label>
                  <label className={label}>Duração
                    <select className={`${input} mt-1`} value={cycle} onChange={e => setCycle(e.target.value as Cycle)} disabled={!hostingPlan} data-testid="hosting-cycle">
                      {!hostingPlan && <option value="">—</option>}
                      {hostingPlan?.prices.map(p => <option key={p.cycle} value={p.cycle}>{CYCLE_LABEL[p.cycle]} — {kz(p.price)}</option>)}
                    </select>
                  </label>
                  {hostingPrice && <p className="sm:col-span-2 text-xs text-[#666]">A pagar agora {kz(hostingPrice.price)} · renova por {kz(hostingPrice.renewal)}. <Link href={`/comprar/${hostingPlan!.slug}`} className="underline" target="_blank">Ver o plano</Link></p>}
                </div>
              )}
            </section>
          )}
        </div>

        <aside className={`w-full lg:w-80 shrink-0 ${card} lg:sticky lg:top-24`} aria-label="Resumo da configuração">
          <p className="text-xs font-black text-[#999] uppercase tracking-widest mb-3">Resumo</p>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between gap-3"><span className="min-w-0 [overflow-wrap:anywhere]">Registo {info.domain}<span className="block text-xs text-[#999]">{yearsLabel(years)} · renova por {kz(renewYears)}/ano</span></span><strong className="whitespace-nowrap">{kz(period?.total ?? 0)}</strong></li>
            {hostingPlan && hostingPrice && <li className="flex justify-between gap-3"><span>{hostingPlan.name}<span className="block text-xs text-[#999]">{CYCLE_LABEL[hostingPrice.cycle]} · renova por {kz(hostingPrice.renewal)}</span></span><strong className="whitespace-nowrap">{kz(hostingPrice.price)}</strong></li>}
          </ul>
          <div className="border-t border-[#F0F0F0] mt-4 pt-3 flex justify-between font-black"><span>Total agora</span><span data-testid="config-total">{kz(total)}</span></div>
          <p className="text-[11px] text-[#999] mt-1">Sem impostos nem descontos aplicados aqui; o carrinho mostra o total final calculado no servidor.</p>
          {saveError && <p className="mt-3 text-sm text-red-700 flex gap-1.5" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {saveError}</p>}
          <div className="flex flex-col gap-2 mt-4">
            <button className={btnPrimary} onClick={continueToCart} disabled={saving} data-testid="config-continue">{saving ? <Loader2 size={16} className="animate-spin" /> : null} Continuar <ChevronRight size={16} /></button>
            <Link href={existing ? '/carrinho' : back} className={btnGhost}><ChevronLeft size={16} /> {existing ? 'Voltar ao carrinho' : 'Voltar à pesquisa'}</Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
