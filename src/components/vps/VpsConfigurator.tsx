'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Boxes, Bot, Briefcase, Check, Code2, Cpu, Database, HardDrive, KeyRound, LayoutPanelLeft, Loader2, MemoryStick, Package, Search, Server, ShieldCheck, Workflow } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'
import { useCart } from '@/store/cartStore'
import { CountryFlag } from '@/components/ui/CountryFlag'

// Configurador Cloud VPS (/servidor-vps/configurar): plano → instalação → centro de dados → hostname → período
// → extras (backups, licenças, suporte) → chave SSH → resumo. Dados reais (MariaDB + opções publicadas no painel);
// o preço vem SEMPRE do servidor (/api/vps/quote). O botão final segue o modo comercial definido no painel.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CfgPlan { slug: string; name: string; specs: { vcpu?: number | null; ramGb?: number | null; diskGb?: number | null; trafficValue?: number | null; trafficUnit?: string | null }; cycles: { cycle: string; months: number; price: number; renewal: number }[] }
export interface CfgAddon { id: string; label: string; kind: string; monthlyKz: number; description: string | null }
type Mode = 'disabled' | 'test' | 'request_only' | 'automatic'
const GROUPS: [string, string, any][] = [['linux', 'Linux', Server], ['panels', 'Painéis', LayoutPanelLeft], ['automation', 'Automação', Workflow], ['ai', 'IA', Bot], ['business', 'Empresariais', Briefcase], ['databases', 'Bases de dados', Database], ['dev', 'Desenvolvimento', Code2], ['containers', 'Containers', Boxes], ['other', 'Outros', Package]]
const CYCLE_LABEL: Record<string, string> = { monthly: '1 mês', '1year': '1 ano', '2years': '2 anos' }
const box = 'bg-white border border-[#E8E8E8] rounded-2xl p-5'
const step = (n: number, t: string) => <h2 className="font-black text-[#0A0A0A] text-lg flex items-center gap-2"><span className="w-7 h-7 rounded-full bg-[#F5B700] text-black text-sm flex items-center justify-center">{n}</span>{t}</h2>

export function VpsConfigurator({ plans, addons, mode, isAdmin, loggedIn, initial }: { plans: CfgPlan[]; addons: CfgAddon[]; mode: Mode; isAdmin: boolean; loggedIn: boolean; initial: { plan?: string; cycle?: string; app?: string; upgrade?: string } }) {
  const router = useRouter()
  const setPurchase = useCart(s => s.setPurchase)
  const { formatCurrency, currency } = useLocale()
  const fmt = (v: number) => formatCurrency(convertFromAOA(v, currency))
  const [plan, setPlan] = useState(() => plans.find(p => p.slug === initial.plan)?.slug ?? plans[0]?.slug ?? '')
  const p = plans.find(x => x.slug === plan)
  const [cycle, setCycle] = useState(() => p?.cycles.some(c => c.cycle === initial.cycle) ? initial.cycle! : p?.cycles[0]?.cycle ?? 'monthly')
  const [opts, setOpts] = useState<{ locations: { id: string; label: string; country?: string | null }[]; images: any[] } | null>(null)
  const [image, setImage] = useState(''), [location, setLocation] = useState(''), [hostname, setHostname] = useState(''), [sshKey, setSshKey] = useState(''), [chosen, setChosen] = useState<string[]>([])
  const [q, setQ] = useState(''), [group, setGroup] = useState(''), [notes, setNotes] = useState('')
  const [quote, setQuote] = useState<any>(null), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState<{ reference: string } | null>(null)
  const appMissing = useMemo(() => {
    if (!initial.app || !opts) return false
    const k = initial.app.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (k === 'ai') return !opts.images.some(i => i.group === 'ai')
    return !opts.images.some(i => `${i.name} ${i.label}`.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k))
  }, [initial.app, opts])

  // Opções publicadas e compatíveis com o plano (sem preços no navegador: a licença vem do servidor na cotação)
  useEffect(() => {
    if (!plan) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento/sincronização com o servidor
    setOpts(null)
    fetch(`/api/catalog/vps-options?plano=${encodeURIComponent(plan)}`, { cache: 'no-store' }).then(r => r.json()).then(j => {
      const o = { locations: j.locations ?? [], images: j.images ?? [] }
      setOpts(o)
      const k = (initial.app ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
      // «ai» (Viraliza AI Cloud): filtra a categoria Inteligência artificial; as restantes procuram o template pelo nome
      const pre = k && k !== 'ai' ? o.images.find((i: any) => `${i.name} ${i.label}`.toLowerCase().replace(/[^a-z0-9]/g, '').includes(k)) : null
      if (k === 'ai') setGroup('ai')
      setImage(cur => (o.images.some((i: any) => i.id === cur) ? cur : pre?.id ?? ''))
      setLocation(cur => (o.locations.some((l: any) => l.id === cur) ? cur : o.locations[0]?.id ?? ''))
      if (pre?.group) setGroup(pre.group)
    }).catch(() => setOpts({ locations: [], images: [] }))
  }, [plan, initial.app])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento/sincronização com o servidor
  useEffect(() => { if (p && !p.cycles.some(c => c.cycle === cycle)) setCycle(p.cycles[0]?.cycle ?? 'monthly') }, [p, cycle])
  const img = opts?.images.find(i => i.id === image)
  const locs = (opts?.locations ?? []).filter(l => !img?.locations?.length || img.locations.includes(l.id))
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento/sincronização com o servidor
  useEffect(() => { if (location && !locs.some(l => l.id === location)) setLocation(locs[0]?.id ?? '') }, [image]) // eslint-disable-line react-hooks/exhaustive-deps

  // Preço actualizado (servidor)
  const payload = useMemo(() => ({ plan, cycle, options: { location, image, hostname: hostname.trim() || undefined, sshKey: sshKey.trim() || undefined, addons: chosen } }), [plan, cycle, location, image, hostname, sshKey, chosen])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento/sincronização com o servidor
    if (!plan || !image || !location) { setQuote(null); return }
    const t = setTimeout(() => {
      fetch('/api/vps/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()).then(setQuote).catch(() => setQuote(null))
    }, 250)
    return () => clearTimeout(t)
  }, [payload, plan, image, location])

  const images = (opts?.images ?? []).filter(i => (!group || i.group === group) && (!q || `${i.label} ${i.name}`.toLowerCase().includes(q.toLowerCase())))
  const groupsPresent = GROUPS.filter(([g]) => (opts?.images ?? []).some(i => i.group === g))
  const lineErr = quote?.line?.error?.message as string | undefined
  const ready = !!(quote?.line && !quote.line.error)
  const closed = mode === 'disabled' || (mode === 'test' && !isAdmin)
  // Só os grupos de extras que existem (numeração dos passos sem saltos)
  const addonGroups = ([['backup', 'Backups adicionais'], ['license', 'Licenças adicionais'], ['support', 'Serviços de suporte'], ['other', 'Outros extras']] as const).filter(([k]) => addons.some(a => a.kind === k))

  async function submit() {
    setErr(''); setBusy(true)
    try {
      if (mode === 'automatic' && !initial.upgrade) {
        setPurchase(`vps-cfg-${plan}`, [{ type: 'product', slug: plan, cycle: cycle as never, quantity: 1, options: payload.options }])
        router.push('/carrinho'); return
      }
      const r = await fetch('/api/vps/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, notes, upgradeServiceId: initial.upgrade || undefined }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'Não foi possível enviar o pedido.')
      setDone({ reference: j.reference })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (!plans.length) return <div className={`${box} text-center`} data-testid="cfg-no-plans"><p className="font-bold">Ainda não há planos VPS publicados.</p><Link href="/suporte/contactar" className="inline-block mt-3 underline">Falar com a equipa</Link></div>
  if (done) return (
    <div className={`${box} text-center`} data-testid="cfg-done" role="status">
      <Check className="mx-auto text-green-600" size={30} />
      <p className="font-black text-lg mt-2">Pedido de VPS recebido</p>
      <p className="text-sm mt-1">Referência: <strong data-testid="cfg-ref">{done.reference}</strong></p>
      <p className="text-sm text-[#555] mt-2 max-w-lg mx-auto">A equipa verifica preço, disponibilidade e localização. Depois da aprovação recebe a factura; com o pagamento confirmado, a aquisição é autorizada e o VPS preparado. Acompanhe em «Os meus VPS».</p>
      <Link href="/vps" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white" data-testid="cfg-follow">Os meus VPS</Link>
    </div>
  )
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start" data-testid="vps-configurator">
      <div className="space-y-4">
        <section className={box}>{step(1, 'Plano')}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">{plans.map(x => {
            const c = x.cycles.find(y => y.cycle === cycle) ?? x.cycles[0]
            return (
              <button key={x.slug} type="button" onClick={() => setPlan(x.slug)} data-testid="cfg-plan" data-slug={x.slug} aria-pressed={plan === x.slug}
                className={`text-left rounded-xl border-2 p-4 transition-all ${plan === x.slug ? 'border-[#F5B700] bg-[#FFFBEA]' : 'border-[#EEE] hover:border-[#DDD]'}`}>
                <p className="font-black">{x.name}</p>
                <p className="text-xs text-[#555] mt-1 flex flex-wrap gap-x-3">{x.specs.vcpu != null && <span className="inline-flex items-center gap-1"><Cpu size={12} />{x.specs.vcpu} vCPU</span>}{x.specs.ramGb != null && <span className="inline-flex items-center gap-1"><MemoryStick size={12} />{x.specs.ramGb} GB RAM</span>}{x.specs.diskGb != null && <span className="inline-flex items-center gap-1"><HardDrive size={12} />{x.specs.diskGb} GB</span>}</p>
                {c && <p className="text-sm font-bold mt-2">{fmt(c.price / c.months)}<span className="text-xs font-normal text-[#777]">/mês</span></p>}
              </button>
            )
          })}</div>
        </section>
        <section className={box}>{step(2, 'Sistema operativo ou aplicação')}
          {initial.app && appMissing && <p className="mt-3 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2" data-testid="cfg-app-missing">A aplicação «{initial.app}» não está disponível como template oficial publicado neste plano. Escolha outra opção ou <Link href="/suporte/contactar" className="underline">fale com a equipa</Link>.</p>}
          {!opts ? <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#F5B700]" /></div> : opts.images.length === 0 ? <p className="mt-3 text-sm text-[#666]" data-testid="cfg-no-images">Nenhuma instalação publicada para este plano.</p> : <>
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999]" /><input className="pl-8 pr-3 py-2 rounded-xl border border-[#E5E7EB] text-sm w-48" placeholder="Pesquisar" value={q} onChange={e => setQ(e.target.value)} data-testid="cfg-img-search" /></div>
              <button type="button" onClick={() => setGroup('')} className={`px-3 py-2 rounded-xl text-xs font-bold border ${!group ? 'bg-[#0A0A0A] text-white' : 'border-[#E5E7EB]'}`}>Todos</button>
              {groupsPresent.map(([g, l, I]) => <button key={g} type="button" onClick={() => setGroup(g)} data-testid={`cfg-group-${g}`} className={`px-3 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1 ${group === g ? 'bg-[#0A0A0A] text-white' : 'border-[#E5E7EB]'}`}><I size={13} />{l}</button>)}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-3 max-h-[360px] overflow-auto pr-1">{images.map(i => {
              const I = GROUPS.find(([g]) => g === i.group)?.[2] ?? Package
              return (
                <button key={i.id} type="button" onClick={() => setImage(i.id)} data-testid="cfg-image" data-id={i.id} aria-pressed={image === i.id}
                  className={`text-left rounded-xl border-2 p-3 flex gap-3 ${image === i.id ? 'border-[#F5B700] bg-[#FFFBEA]' : 'border-[#EEE]'}`}>
                  <I size={18} className="text-[#D9A300] shrink-0 mt-0.5" />
                  <span><span className="font-bold text-sm block">{i.name ?? i.label}{i.version ? ` ${i.version}` : ''}</span>
                    <span className="text-xs text-[#666]">{i.includedOs ? `inclui ${i.includedOs}` : i.description ?? ''}</span>
                    {i.license?.type === 'paid' && <span className="block text-xs font-bold text-amber-700">Licença: {fmt(i.license.monthlyKz)}/mês</span>}</span>
                </button>
              )
            })}{images.length === 0 && <p className="text-sm text-[#666]">Nada encontrado com estes filtros.</p>}</div>
          </>}
        </section>
        <section className={box}>{step(3, 'Centro de dados')}
          <div className="flex flex-wrap gap-2 mt-4">{locs.map(l => <button key={l.id} type="button" onClick={() => setLocation(l.id)} data-testid="cfg-location" data-id={l.id} aria-pressed={location === l.id}
            className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold inline-flex items-center gap-1.5 ${location === l.id ? 'border-[#F5B700] bg-[#FFFBEA]' : 'border-[#EEE]'}`}><CountryFlag code={l.country} />{l.label}</button>)}
            {opts && !locs.length && <p className="text-sm text-[#666]">Sem centros de dados disponíveis para esta instalação.</p>}</div>
        </section>
        <section className={box}>{step(4, 'Hostname (opcional)')}
          <input className="mt-4 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm" placeholder="servidor.aminhaempresa.ao" value={hostname} onChange={e => setHostname(e.target.value)} data-testid="cfg-hostname" maxLength={191} />
        </section>
        <section className={box}>{step(5, 'Período de facturação')}
          <div className="flex flex-wrap gap-2 mt-4">{p?.cycles.map(c => <button key={c.cycle} type="button" onClick={() => setCycle(c.cycle)} data-testid={`cfg-cycle-${c.cycle}`} aria-pressed={cycle === c.cycle}
            className={`px-4 py-2.5 rounded-xl border-2 text-sm font-semibold ${cycle === c.cycle ? 'border-[#F5B700] bg-[#FFFBEA]' : 'border-[#EEE]'}`}>{CYCLE_LABEL[c.cycle] ?? c.cycle}<span className="block text-xs font-normal text-[#666]">{fmt(c.price)} · renova {fmt(c.renewal)}</span></button>)}</div>
        </section>
        {addonGroups.map(([kind, title], i) => {
          const list = addons.filter(a => a.kind === kind)
          return (
            <section key={kind} className={box} data-testid={`cfg-addons-${kind}`}>{step(6 + i, title)}
              <div className="space-y-2 mt-4">{list.map(a => <label key={a.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={chosen.includes(a.id)} onChange={e => setChosen(e.target.checked ? [...chosen, a.id] : chosen.filter(x => x !== a.id))} data-testid="cfg-addon" data-id={a.id} className="mt-1" />
                <span><strong>{a.label}</strong> — {fmt(a.monthlyKz)}/mês{a.description ? <span className="block text-xs text-[#666]">{a.description}</span> : null}</span></label>)}</div>
            </section>
          )
        })}
        <section className={box}>{step(6 + addonGroups.length, 'Chave pública SSH (opcional)')}
          <p className="text-xs text-[#666] mt-2 flex items-start gap-1.5"><KeyRound size={14} className="shrink-0 mt-0.5" />Cole a chave <strong>pública</strong> (ex.: «ssh-ed25519 AAAA… nome»). Sem chave, define a senha root na Área do Cliente antes do primeiro acesso — nunca enviamos senhas por e-mail.</p>
          <textarea className="mt-3 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-xs font-mono min-h-[70px]" value={sshKey} onChange={e => setSshKey(e.target.value)} data-testid="cfg-ssh" />
          {mode !== 'automatic' && <textarea className="mt-2 w-full rounded-xl border border-[#E5E7EB] px-3.5 py-2.5 text-sm min-h-[60px]" placeholder="Observações para a equipa (opcional)" value={notes} onChange={e => setNotes(e.target.value)} data-testid="cfg-notes" maxLength={2000} />}
        </section>
      </div>
      <aside className={`${box} lg:sticky lg:top-24 space-y-3`} data-testid="cfg-summary">
        <p className="font-black text-lg">Resumo</p>
        <ul className="text-sm space-y-1 text-[#333]">
          <li>Plano: <strong>{p?.name ?? '—'}</strong></li>
          <li>Instalação: <strong>{img ? `${img.name ?? img.label}${img.version ? ` ${img.version}` : ''}` : '—'}</strong></li>
          <li>Centro de dados: <strong>{locs.find(l => l.id === location)?.label ?? '—'}</strong></li>
          <li>Período: <strong>{CYCLE_LABEL[cycle] ?? cycle}</strong></li>
          {hostname && <li>Hostname: <strong>{hostname}</strong></li>}
          {chosen.length > 0 && <li>Extras: <strong>{addons.filter(a => chosen.includes(a.id)).map(a => a.label).join(', ')}</strong></li>}
          <li>Acesso: <strong>{sshKey.trim() ? 'chave SSH' : 'senha definida por si no portal'}</strong></li>
        </ul>
        {quote?.line && !quote.line.error ? <div className="border-t border-[#EEE] pt-3 text-sm" data-testid="cfg-price">
          {quote.line.listTotal != null && quote.line.listTotal > quote.line.lineTotal && <p className="text-xs line-through text-[#999]">{fmt(quote.line.listTotal)}</p>}
          <p>Desembolso inicial: <strong className="text-xl" data-testid="cfg-total">{fmt(quote.total)}</strong>{quote.tax > 0 && <span className="text-xs text-[#777]"> (inclui {quote.taxLabel})</span>}</p>
          <p className="text-xs text-[#555]">Equivalente mensal: {fmt(quote.line.lineTotal / (quote.line.months || 1))} · custo total do ciclo {fmt(quote.line.lineTotal)}</p>
          <p className="text-xs text-[#555]" data-testid="cfg-renewal">Renova por {fmt(quote.line.renewalPrice)} a cada {CYCLE_LABEL[cycle] ?? cycle}</p>
        </div> : lineErr ? <p className="text-sm text-red-700" role="alert" data-testid="cfg-error">{lineErr}</p> : <p className="text-xs text-[#777]">Escolha a instalação e o centro de dados para ver o preço.</p>}
        {err && <p className="text-sm text-red-700" role="alert" data-testid="cfg-submit-error">{err}</p>}
        {closed ? <p className="text-center py-3 rounded-xl bg-[#F3F3F3] font-bold text-sm" data-testid="cfg-closed">Em breve</p>
          : mode !== 'automatic' && !loggedIn ? <Link href={`/login?redirect=${encodeURIComponent(`/servidor-vps/configurar?plano=${plan}&ciclo=${cycle}`)}`} className="block text-center py-3 rounded-xl font-bold text-sm bg-[#0A0A0A] text-white" data-testid="cfg-login">Entrar para solicitar</Link>
          : <button type="button" disabled={!ready || busy} onClick={submit} className="w-full py-3 rounded-xl font-bold text-sm bg-[#F5B700] text-black disabled:opacity-50 inline-flex items-center justify-center gap-2" data-testid="cfg-submit" data-mode={mode}>
            {busy && <Loader2 size={15} className="animate-spin" />}{mode === 'automatic' && !initial.upgrade ? 'Adicionar ao carrinho' : initial.upgrade ? 'Solicitar upgrade' : 'Solicitar VPS'}</button>}
        {initial.upgrade && <p className="text-xs font-bold text-[#0A0A0A]" data-testid="cfg-upgrade">Pedido de upgrade do seu VPS actual: a equipa confirma a mudança e a diferença de preço.</p>}
        {mode !== 'automatic' && !closed && <p className="text-xs text-[#666] flex items-start gap-1.5" data-testid="cfg-approval-note"><ShieldCheck size={14} className="shrink-0 mt-0.5 text-[#D9A300]" />Contratação mediante aprovação: a equipa confirma preço e disponibilidade antes da factura. Nada é cobrado ao enviar o pedido.</p>}
        {mode === 'test' && isAdmin && <p className="text-xs font-bold text-amber-700" data-testid="cfg-test">Modo de teste (só administradores).</p>}
      </aside>
    </div>
  )
}
