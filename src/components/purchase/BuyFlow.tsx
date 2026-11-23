'use client'
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Check, ChevronLeft, ChevronRight, Globe, Loader2, Search, ArrowRightLeft, Link2, AlertCircle, ShoppingCart, Minus, Plus, Clock, XCircle } from 'lucide-react'
import { kz as kzFmt } from '@/lib/commerce/status'
import { useCart, type Cycle, type NewCartLine } from '@/store/cartStore'

// Percurso de compra: Plano → Escolher domínio → Escolher duração → Carrinho.
// As escolhas ficam guardadas no navegador (voltar/recarregar mantém-nas); o código EPP nunca.
// Os preços mostrados vêm do catálogo (product_prices / domain_prices); o servidor volta a
// calcular e a validar tudo no carrinho e ao criar a encomenda.

export interface BuyPlan {
  slug: string; name: string; description: string | null; category: string; serviceType: string
  quantityUnit: string | null; maxQuantity: number; needsDomain: boolean; features: string[]
  prices: { cycle: Cycle; months: number; price: number; renewal: number }[]
}
type Mode = 'register' | 'transfer' | 'existing'
type Status = 'available' | 'unavailable' | 'confirm' | 'on_request'
interface Ext { extension: string; status: 'active' | 'on_request'; register: number | null; renew: number | null; transfer: number | null; eppRequired: boolean; national: boolean; maxYears: number }
interface Result extends Ext { domain: string; availability: Status }
interface Selection { mode: Mode | null; domain: string; availability: Status | null; years: number; cycle: Cycle | null; quantity: number; flowId: string }

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
const useSelections = create<{ by: Record<string, Selection>; set: (slug: string, patch: Partial<Selection>) => void }>()(
  persist(
    (set) => ({
      by: {},
      set: (slug, patch) => set(s => {
        const cur = s.by[slug] ?? { mode: null, domain: '', availability: null, years: 1, cycle: null, quantity: 1, flowId: newId() }
        return { by: { ...s.by, [slug]: { ...cur, ...patch } } }
      }),
    }),
    { name: 'viralizahost-compra-v1' },
  ),
)

const kz = (n: number) => kzFmt(Math.round(n))
export const CYCLE_NAME: Record<Cycle, string> = { monthly: 'Mensal', '3months': 'Trimestral', '6months': 'Semestral', '1year': 'Anual', '2years': '2 anos', '3years': '3 anos' }
const DURATION = (m: number) => (m === 1 ? '1 mês' : m < 12 ? `${m} meses` : m === 12 ? '12 meses (1 ano)' : `${m} meses (${m / 12} anos)`)
const NS = ['ns1.viralizahost.com', 'ns2.viralizahost.com']
const STATUS_UI: Record<Status, { label: string; cls: string }> = {
  available: { label: 'Disponível', cls: 'bg-green-50 text-green-700 border-green-200' },
  unavailable: { label: 'Indisponível', cls: 'bg-red-50 text-red-700 border-red-200' },
  confirm: { label: 'A confirmar pela equipa', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  on_request: { label: 'Sob consulta', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}
const card = 'bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-5 sm:p-7'
const btnPrimary = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-[#0A0A0A] bg-[#F5B700] hover:bg-[#E5A800] disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
const btnGhost = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E8E8E8] bg-white text-[#0A0A0A] hover:border-[#F5B700]'
const input = 'w-full border border-[#E2E2E2] rounded-xl px-3.5 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/20'

function useHydrated() {
  return useSyncExternalStore(
    cb => { const a = useSelections.persist.onFinishHydration(cb); const b = useCart.persist.onFinishHydration(cb); return () => { a(); b() } },
    () => useSelections.persist.hasHydrated() && useCart.persist.hasHydrated(),
    () => false,
  )
}

function Steps({ current, needsDomain }: { current: 'domain' | 'cycle'; needsDomain: boolean }) {
  const steps = [['Plano', true], ...(needsDomain ? [['Domínio', current === 'cycle']] : []), ['Duração', false], ['Carrinho', false], ['Checkout', false]] as [string, boolean][]
  const active = current === 'domain' ? 'Domínio' : 'Duração'
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs sm:text-sm mb-6" aria-label="Passos da compra">
      {steps.map(([s, done], i) => (
        <li key={s} className="flex items-center gap-2" aria-current={s === active ? 'step' : undefined}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${done ? 'bg-[#0A0A0A] text-white' : s === active ? 'bg-[#F5B700] text-[#0A0A0A]' : 'bg-[#EFEFEF] text-[#999]'}`}>{done ? <Check size={13} /> : i + 1}</span>
          <span className={s === active ? 'font-bold text-[#0A0A0A]' : 'text-[#888]'}>{s}</span>
          {i < steps.length - 1 && <ChevronRight size={14} className="text-[#CCC]" />}
        </li>
      ))}
    </ol>
  )
}

/* ───────────────────────── Passo «Domínio» ───────────────────────── */

function DomainStep({ plan, sel, update, exts, extsError, reloadExts, onDone, epp, setEpp }: {
  plan: BuyPlan; sel: Selection; update: (p: Partial<Selection>) => void
  exts: Ext[] | null; extsError: string; reloadExts: () => void; onDone: () => void
  epp: string; setEpp: (v: string) => void
}) {
  const [mode, setMode] = useState<Mode>(sel.mode ?? 'register')
  const sold = useMemo(() => (exts ?? []).filter(e => e.status === 'active'), [exts])
  const [name, setName] = useState(sel.mode === 'register' && sel.domain ? sel.domain.split('.')[0] : '')
  const [ext, setExt] = useState('.ao')
  const [results, setResults] = useState<{ exact: Result; alternatives: Result[] } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [own, setOwn] = useState(sel.mode && sel.mode !== 'register' ? sel.domain : '')
  const [ownError, setOwnError] = useState('')

  const search = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    const n = name.trim().toLowerCase().replace(/^www\./, '')
    if (!n) return
    setSearching(true); setSearchError(''); setResults(null)
    try {
      const q = n.includes('.') ? n : `${n}${ext}`
      const r = await fetch(`/api/domains/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'A pesquisa falhou.')
      setResults(j)
    } catch (err) {
      setSearchError((err as Error).message === 'Failed to fetch' ? 'Sem ligação. Verifique a internet e tente novamente.' : (err as Error).message)
    } finally { setSearching(false) }
  }, [name, ext])

  const choose = (r: Result) => { update({ mode: 'register', domain: r.domain, availability: r.availability, years: Math.min(sel.years || 1, r.maxYears) }); onDone() }

  const continueOwn = () => {
    const d = own.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
    if (!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) { setOwnError('Escreva o domínio completo, por exemplo: empresa.ao'); return }
    if (mode === 'transfer') {
      const e = [...sold].sort((a, b) => b.extension.length - a.extension.length).find(x => d.endsWith(x.extension))
      if (!e || e.transfer == null) { setOwnError('Não fazemos transferências desta extensão. Escolha «Usar um domínio que já tenho».'); return }
      if (e.eppRequired && !epp.trim()) { setOwnError('Indique o código de autorização (EPP) dado pelo registrador actual.'); return }
    }
    setOwnError('')
    update({ mode, domain: d, availability: null, years: 1 })
    onDone()
  }
  const transferExt = mode === 'transfer' ? [...sold].sort((a, b) => b.extension.length - a.extension.length).find(x => own.trim().toLowerCase().endsWith(x.extension)) : undefined

  const Row = ({ r, exact }: { r: Result; exact?: boolean }) => {
    const ui = STATUS_UI[r.availability]
    const selectable = r.availability === 'available' || r.availability === 'confirm'
    return (
      <li className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${exact ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE]'}`} data-testid="domain-result" data-status={r.availability}>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#0A0A0A] break-all">{r.domain}</p>
          <span className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${ui.cls}`}>{ui.label}</span>
          {r.availability === 'confirm' && <p className="text-xs text-amber-800 mt-1">Esta extensão não tem consulta automática. Pode encomendar já; o pagamento só é pedido depois de a equipa confirmar que está livre.</p>}
        </div>
        {r.register != null && r.availability !== 'on_request' && (
          <div className="text-sm sm:text-right">
            <p className="font-bold text-[#0A0A0A]">{kz(r.register)} <span className="font-normal text-[#888]">/ 1.º ano</span></p>
            {r.renew != null && <p className="text-xs text-[#888]">Renova por {kz(r.renew)}/ano</p>}
          </div>
        )}
        {selectable ? (
          <button className={btnPrimary} onClick={() => choose(r)} data-testid="choose-domain">
            {r.availability === 'confirm' ? 'Pedir confirmação e continuar' : 'Adicionar ao carrinho e continuar'}
          </button>
        ) : r.availability === 'unavailable' ? (
          <button className={btnGhost} disabled aria-disabled="true"><XCircle size={14} /> Indisponível</button>
        ) : (
          <Link href={`/suporte/contactar?assunto=${encodeURIComponent('Domínio ' + r.domain)}`} className={btnGhost}>Pedir preço</Link>
        )}
      </li>
    )
  }

  return (
    <div className={card}>
      <h1 className="text-2xl font-black text-[#0A0A0A] mb-1">Escolha o domínio para {plan.name}</h1>
      <p className="text-sm text-[#666] mb-5">{plan.serviceType === 'email' ? 'O e-mail usa o seu domínio (nome@empresa.ao).' : 'O site fica disponível neste domínio.'}</p>

      <div role="radiogroup" aria-label="Opção de domínio" className="grid sm:grid-cols-3 gap-3 mb-6">
        {([['register', 'Registar um novo domínio', Globe], ['transfer', 'Transferir um domínio', ArrowRightLeft], ['existing', 'Usar um domínio que já tenho', Link2]] as const).map(([m, label, Icon]) => (
          <button key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setOwnError('') }}
            className={`flex items-center gap-2 p-4 rounded-xl border-2 text-left text-sm font-bold transition-colors ${mode === m ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE] hover:border-[#F5B700]/50'}`}>
            <Icon size={18} className="text-[#D9A300] shrink-0" /> {label}
          </button>
        ))}
      </div>

      {extsError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex flex-wrap items-center gap-3" role="alert">
          <AlertCircle size={16} /> {extsError} <button className="underline font-bold" onClick={reloadExts}>Tentar novamente</button>
        </div>
      )}

      {mode === 'register' && (
        <>
          <form onSubmit={search} className="flex flex-col sm:flex-row gap-2 mb-4" role="search">
            <label className="sr-only" htmlFor="dn">Nome do domínio</label>
            <input id="dn" className={input} placeholder="nome-da-empresa" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
            <label className="sr-only" htmlFor="dx">Extensão</label>
            <select id="dx" className={`${input} sm:max-w-[200px]`} value={ext} onChange={e => setExt(e.target.value)} disabled={!sold.length}>
              {sold.map(e => <option key={e.extension} value={e.extension}>{e.extension}{e.register != null ? ` — ${kz(e.register)}` : ''}</option>)}
            </select>
            <button className={btnPrimary} disabled={!name.trim() || searching || !sold.length}>{searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Pesquisar</button>
          </form>
          {searchError && (
            <p className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex flex-wrap items-center gap-2" role="alert">
              <AlertCircle size={16} /> {searchError} <button className="underline font-bold" onClick={() => search()}>Tentar novamente</button>
            </p>
          )}
          {searching && <p className="text-sm text-[#666] flex items-center gap-2" role="status"><Loader2 size={14} className="animate-spin" /> A verificar a disponibilidade…</p>}
          {results && (
            <div aria-live="polite">
              {results.exact.availability === 'unavailable' && <p className="text-sm text-red-700 mb-3 font-semibold">{results.exact.domain} já está registado. Escolha uma das alternativas abaixo.</p>}
              <ul className="space-y-2">
                <Row r={results.exact} exact />
                {results.alternatives.length > 0 && <li className="pt-3 text-xs font-black uppercase tracking-widest text-[#888]">Alternativas</li>}
                {results.alternatives.map(r => <Row key={r.domain} r={r} />)}
              </ul>
              <p className="text-xs text-[#888] mt-3">A disponibilidade volta a ser verificada quando confirmar a encomenda.</p>
            </div>
          )}
          {sel.mode === 'register' && sel.domain && !results && (
            <p className="text-sm text-[#555] mt-2">Seleccionado: <strong>{sel.domain}</strong> — <button className="underline" onClick={onDone}>continuar com este domínio</button></p>
          )}
        </>
      )}

      {mode !== 'register' && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-[#333]">{mode === 'transfer' ? 'Domínio a transferir' : 'O seu domínio'}
            <input className={`${input} mt-1`} placeholder="empresa.ao" value={own} onChange={e => setOwn(e.target.value)} autoComplete="off" inputMode="url" />
          </label>
          {mode === 'transfer' && (
            <>
              {transferExt && <p className="text-sm text-[#555]">Transferência de {transferExt.extension}: <strong>{kz(transferExt.transfer ?? 0)}</strong>{transferExt.transfer === 0 ? ' (sem custo)' : ''}. Desbloqueie o domínio no registrador actual antes de pedir.</p>}
              {(!transferExt || transferExt.eppRequired) && (
                <label className="block text-sm font-semibold text-[#333]">Código de autorização (EPP)
                  <input className={`${input} mt-1`} type="password" autoComplete="off" value={epp} onChange={e => setEpp(e.target.value)} />
                  <span className="block text-xs font-normal text-[#888] mt-1">Pedido ao registrador actual. Guardado cifrado e usado só para a transferência; não fica no seu navegador.</span>
                </label>
              )}
              {transferExt && !transferExt.eppRequired && <p className="text-xs text-[#888]">Domínios {transferExt.extension} não precisam de código EPP: a equipa trata do pedido com o registo nacional.</p>}
            </>
          )}
          {mode === 'existing' && (
            <div className="p-4 rounded-xl bg-[#F8F8F8] text-sm text-[#444]">
              <p className="font-bold text-[#0A0A0A] mb-1">Sem custo de domínio</p>
              <p>Depois da activação, no registrador onde o domínio está, altere os nameservers para:</p>
              <ul className="font-mono text-xs mt-2 space-y-0.5">{NS.map(n => <li key={n}>{n}</li>)}</ul>
              <p className="mt-2 text-xs text-[#777]">A propagação do DNS pode demorar até 48 horas.</p>
            </div>
          )}
          {ownError && <p className="text-sm text-red-700 flex gap-1" role="alert"><AlertCircle size={16} className="shrink-0" /> {ownError}</p>}
          <button className={btnPrimary} onClick={continueOwn} disabled={!own.trim()} data-testid="continue-own-domain">Continuar <ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Passo «Duração» ───────────────────────── */

function CycleStep({ plan, sel, update, exts, onBack, onAdd, adding }: {
  plan: BuyPlan; sel: Selection; update: (p: Partial<Selection>) => void; exts: Ext[] | null
  onBack: (() => void) | null; onAdd: () => void; adding: boolean
}) {
  const qty = plan.quantityUnit ? Math.max(1, Math.min(sel.quantity || 1, plan.maxQuantity)) : 1
  const chosen = plan.prices.find(p => p.cycle === sel.cycle) ?? null
  const ext = sel.domain ? [...(exts ?? [])].sort((a, b) => b.extension.length - a.extension.length).find(e => sel.domain.endsWith(e.extension)) : undefined
  const domainTotal = sel.mode === 'register' && ext?.register != null ? ext.register + (ext.renew ?? ext.register) * ((sel.years || 1) - 1)
    : sel.mode === 'transfer' && ext?.transfer != null ? ext.transfer : 0
  const total = (chosen ? chosen.price * qty : 0) + domainTotal

  return (
    <div className={card}>
      <h1 className="text-2xl font-black text-[#0A0A0A] mb-1">Escolha a duração</h1>
      <p className="text-sm text-[#666] mb-5">{plan.name}{sel.domain ? <> · <strong>{sel.domain}</strong> {onBack && <button className="underline text-[#555]" onClick={onBack}>alterar domínio</button>}</> : null}</p>

      {plan.quantityUnit && (
        <div className="mb-6">
          <p className="text-sm font-bold text-[#0A0A0A] mb-2">Número de caixas de correio</p>
          <div className="flex items-center gap-3">
            <button className={btnGhost} aria-label="Menos uma caixa" onClick={() => update({ quantity: Math.max(1, qty - 1) })} disabled={qty <= 1}><Minus size={14} /></button>
            <input aria-label="Número de caixas" className={`${input} w-20 text-center`} type="number" min={1} max={plan.maxQuantity} value={qty}
              onChange={e => update({ quantity: Math.max(1, Math.min(plan.maxQuantity, Math.floor(Number(e.target.value) || 1))) })} />
            <button className={btnGhost} aria-label="Mais uma caixa" onClick={() => update({ quantity: Math.min(plan.maxQuantity, qty + 1) })} disabled={qty >= plan.maxQuantity}><Plus size={14} /></button>
            <span className="text-xs text-[#888]">máx. {plan.maxQuantity}</span>
          </div>
        </div>
      )}

      <div role="radiogroup" aria-label="Duração do plano" className="grid gap-3 mb-6">
        {plan.prices.map(p => {
          const on = sel.cycle === p.cycle
          return (
            <button key={p.cycle} role="radio" aria-checked={on} onClick={() => update({ cycle: p.cycle })} data-testid={`cycle-${p.cycle}`}
              className={`text-left p-4 rounded-xl border-2 transition-colors ${on ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE] hover:border-[#F5B700]/50'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-black text-[#0A0A0A]">{CYCLE_NAME[p.cycle]}</span>
                <span className="text-sm"><strong className="text-[#0A0A0A]">{kz((p.price / p.months) * qty)}</strong><span className="text-[#888]">/mês{plan.quantityUnit ? ` (${qty} ${qty === 1 ? plan.quantityUnit : plan.quantityUnit + 's'})` : ''}</span></span>
              </div>
              <div className="grid sm:grid-cols-3 gap-1 mt-2 text-xs text-[#555]">
                <span>Duração: {DURATION(p.months)}</span>
                <span>A pagar agora: <strong className="text-[#0A0A0A]">{kz(p.price * qty)}</strong></span>
                <span>Renova por {kz(p.renewal * qty)} {p.months === 1 ? 'todos os meses' : `a cada ${DURATION(p.months).split(' (')[0]}`}</span>
              </div>
              {plan.quantityUnit && <p className="text-[11px] text-[#888] mt-1">{kz(p.price / p.months)} por {plan.quantityUnit}/mês</p>}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-[#888] mb-6">Sem taxa de activação. Nenhum destes planos inclui domínio grátis: mudar a duração altera apenas o período e o valor a pagar.</p>

      {sel.domain && (
        <div className="mb-6 p-4 rounded-xl bg-[#F8F8F8]">
          <p className="text-sm font-bold text-[#0A0A0A] mb-1">Domínio {sel.domain}</p>
          {sel.mode === 'register' && ext && (
            <>
              <label className="text-sm text-[#555] flex flex-wrap items-center gap-2">Registo por
                <select className="border border-[#E2E2E2] rounded-lg px-2 py-1.5 text-sm" value={sel.years || 1} onChange={e => update({ years: Number(e.target.value) })} aria-label="Anos de registo do domínio">
                  {Array.from({ length: ext.maxYears }, (_, i) => i + 1).map(y => <option key={y} value={y}>{y} {y === 1 ? 'ano' : 'anos'}</option>)}
                </select>
                — <strong className="text-[#0A0A0A]">{kz(domainTotal)}</strong>
              </label>
              <p className="text-xs text-[#888] mt-1">Renova por {kz(ext.renew ?? ext.register ?? 0)}/ano.{(sel.years || 1) > 1 ? ` (${kz(ext.register ?? 0)} no 1.º ano + ${kz(ext.renew ?? 0)} por ano seguinte)` : ''}</p>
              {sel.availability === 'confirm' && <p className="text-xs text-amber-800 mt-2 flex gap-1"><Clock size={13} className="shrink-0 mt-0.5" /> A confirmar pela equipa: a encomenda fica registada e só paga depois da confirmação (aviso na Área do Cliente).</p>}
            </>
          )}
          {sel.mode === 'transfer' && <p className="text-sm text-[#555]">Transferência (inclui 1 ano): <strong className="text-[#0A0A0A]">{kz(domainTotal)}</strong></p>}
          {sel.mode === 'existing' && <p className="text-sm text-[#555]">Domínio próprio: sem custo. Aponte os nameservers para {NS.join(' e ')} depois da activação.</p>}
        </div>
      )}

      {plan.serviceType === 'email' && <p className="text-xs text-[#666] mb-4">Depois do pagamento confirmado, o serviço é activado e cria as caixas na Área do Cliente (Emails). Para receber e-mail, o domínio tem de usar os nossos nameservers.</p>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#EEE] pt-4">
        <p className="text-sm text-[#555]">Total a pagar agora: <strong className="text-xl text-[#0A0A0A]" data-testid="flow-total">{chosen ? kz(total) : '—'}</strong></p>
        <div className="flex gap-2">
          {onBack && <button className={btnGhost} onClick={onBack}><ChevronLeft size={16} /> Voltar</button>}
          <button className={btnPrimary} disabled={!chosen || adding} onClick={onAdd} data-testid="add-to-cart">{adding ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />} Adicionar ao carrinho</button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── Página ───────────────────────── */

export function BuyFlow({ plan, initialCycle }: { plan: BuyPlan; initialCycle?: string | null }) {
  const hydrated = useHydrated()
  const router = useRouter()
  const params = useSearchParams()
  const sel = useSelections(s => s.by[plan.slug]) ?? { mode: null, domain: '', availability: null, years: 1, cycle: null, quantity: 1, flowId: '' }
  const setSel = useSelections(s => s.set)
  const update = useCallback((p: Partial<Selection>) => setSel(plan.slug, p), [setSel, plan.slug])
  const setPurchase = useCart(s => s.setPurchase)
  const [exts, setExts] = useState<Ext[] | null>(null)
  const [extsError, setExtsError] = useState('')
  const [epp, setEpp] = useState('')
  const [adding, setAdding] = useState(false)

  const loadExts = useCallback(() => {
    setExtsError('')
    fetch('/api/catalog/domains', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setExts(j.extensions) })
      .catch(() => setExtsError('Não foi possível carregar as extensões e preços de domínios.'))
  }, [])
  useEffect(() => { if (plan.needsDomain) loadExts() }, [plan.needsDomain, loadExts])

  // Ciclo inicial: o do cartão (?ciclo=) ou o primeiro disponível
  useEffect(() => {
    if (!hydrated) return
    const valid = (c?: string | null) => plan.prices.some(p => p.cycle === c)
    if (initialCycle && valid(initialCycle) && !sel.cycle) update({ cycle: initialCycle as Cycle })
    else if (!valid(sel.cycle)) update({ cycle: plan.prices[0]?.cycle ?? null })
    if (!sel.flowId) update({ flowId: newId() })
  }, [hydrated, initialCycle, plan.prices, sel.cycle, sel.flowId, update])

  const step: 'domain' | 'cycle' = !plan.needsDomain ? 'cycle' : params.get('passo') === 'duracao' && sel.domain ? 'cycle' : 'domain'
  const goCycle = () => router.push(`/comprar/${plan.slug}?passo=duracao`)
  const goDomain = () => router.push(`/comprar/${plan.slug}?passo=dominio`)

  const addToCart = () => {
    const chosen = plan.prices.find(p => p.cycle === sel.cycle)
    if (!chosen) return
    setAdding(true)
    const lines: NewCartLine[] = [{
      type: 'product', slug: plan.slug, cycle: chosen.cycle, quantity: plan.quantityUnit ? Math.max(1, sel.quantity || 1) : 1,
      ...(plan.needsDomain ? { domain: sel.domain, domainMode: sel.mode === 'existing' ? 'existing' : sel.mode === 'transfer' ? 'transfer' : 'register' } : {}),
    }]
    if (plan.needsDomain && (sel.mode === 'register' || sel.mode === 'transfer')) {
      lines.push({ type: 'domain', domain: sel.domain, operation: sel.mode, years: sel.mode === 'register' ? sel.years || 1 : 1, ...(sel.mode === 'transfer' && epp ? { eppCode: epp } : {}) })
    }
    setPurchase(sel.flowId || newId(), lines)
    router.push('/carrinho')
  }

  if (!hydrated) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  if (!plan.prices.length) return <div className={card}><p className="text-sm text-[#555]">Este plano ainda não tem preços publicados.</p></div>

  return (
    <div>
      <Steps current={step} needsDomain={plan.needsDomain} />
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full">
          {step === 'domain'
            ? <DomainStep plan={plan} sel={sel} update={update} exts={exts} extsError={extsError} reloadExts={loadExts} onDone={goCycle} epp={epp} setEpp={setEpp} />
            : <CycleStep plan={plan} sel={sel} update={update} exts={exts} onBack={plan.needsDomain ? goDomain : null} onAdd={addToCart} adding={adding} />}
        </div>
        <aside className="w-full lg:w-80 shrink-0 bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-5" aria-label="Plano escolhido">
          <p className="text-xs font-black uppercase tracking-widest text-[#888] mb-2">Plano escolhido</p>
          <p className="font-black text-[#0A0A0A]">{plan.name}</p>
          {plan.description && <p className="text-sm text-[#666]">{plan.description}</p>}
          <ul className="mt-3 space-y-1.5">{plan.features.slice(0, 8).map(f => <li key={f} className="text-sm text-[#444] flex gap-2"><Check size={14} className="text-green-600 mt-0.5 shrink-0" />{f}</li>)}</ul>
          <Link href="/carrinho" className="mt-4 inline-flex items-center gap-1 text-xs font-bold underline text-[#555]"><ShoppingCart size={12} /> Ver carrinho</Link>
        </aside>
      </div>
    </div>
  )
}
