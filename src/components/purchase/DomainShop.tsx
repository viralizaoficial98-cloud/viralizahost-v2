'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ChevronRight, Clock, Loader2, Search, ShoppingCart, XCircle, ArrowRightLeft, Globe, RefreshCw } from 'lucide-react'
import { kz as kzFmt } from '@/lib/commerce/status'
import { useCart } from '@/store/cartStore'

// Domínio avulso: pesquisa → disponibilidade e alternativas → «Registrar Agora» → Configuração do domínio
// (/dominios/configurar: período, nameservers, alojamento opcional) → carrinho.
// Transferência: domínio + código EPP (só quando a extensão o exige) → carrinho.
// Preços de domain_prices (os mesmos do carrinho/checkout); o servidor revalida tudo.

type Status = 'available' | 'unavailable' | 'confirm' | 'on_request'
interface Ext { extension: string; status: 'active' | 'on_request'; register: number | null; renew: number | null; transfer: number | null; eppRequired: boolean; national: boolean; maxYears: number }
interface Result extends Ext { domain: string; availability: Status }

const kz = (n: number) => kzFmt(Math.round(n))
const STATUS_UI: Record<Status, { label: string; cls: string }> = {
  available: { label: 'Disponível', cls: 'bg-green-50 text-green-700 border-green-200' },
  unavailable: { label: 'Indisponível', cls: 'bg-red-50 text-red-700 border-red-200' },
  confirm: { label: 'A confirmar pela equipa', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  on_request: { label: 'Sob consulta', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}
const btnPrimary = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-[#0A0A0A] bg-[#F5B700] hover:bg-[#E5A800] disabled:opacity-50 disabled:cursor-not-allowed'
const btnGhost = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E8E8E8] bg-white text-[#0A0A0A] hover:border-[#F5B700] disabled:opacity-60'
const input = 'w-full border border-[#E2E2E2] rounded-xl px-3.5 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/20'

export function DomainShop({ initialMode = 'register' }: { initialMode?: 'register' | 'transfer' }) {
  const params = useSearchParams()
  const router = useRouter()
  const addDomain = useCart(s => s.setPurchase)
  const [mode, setMode] = useState<'register' | 'transfer'>(initialMode)
  const [exts, setExts] = useState<Ext[] | null>(null)
  const [extsError, setExtsError] = useState('')
  const [name, setName] = useState(params.get('q') ?? '')
  const [ext, setExt] = useState(params.get('ext') ?? '.ao')
  const [results, setResults] = useState<{ exact: Result; alternatives: Result[] } | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [tDomain, setTDomain] = useState('')
  const [epp, setEpp] = useState('')
  const [tError, setTError] = useState('')

  const loadExts = useCallback(() => {
    setExtsError('')
    fetch('/api/catalog/domains', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setExts(j.extensions) })
      .catch(() => setExtsError('Não foi possível carregar as extensões e os preços.'))
  }, [])
  useEffect(loadExts, [loadExts])
  const sold = (exts ?? []).filter(e => e.status === 'active')

  const search = useCallback(async (q?: string) => {
    const n = (q ?? name).trim().toLowerCase().replace(/^www\./, '')
    if (!n) return
    setSearching(true); setError(''); setResults(null)
    try {
      const r = await fetch(`/api/domains/search?q=${encodeURIComponent(n.includes('.') ? n : n + ext)}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'A pesquisa falhou.')
      setResults(j)
    } catch (e) {
      setError((e as Error).message === 'Failed to fetch' ? 'Sem ligação. Verifique a internet e tente novamente.' : (e as Error).message)
    } finally { setSearching(false) }
  }, [name, ext])

  // ?q= vindo da pesquisa da página inicial
  const [autoDone, setAutoDone] = useState(false)
  useEffect(() => {
    if (autoDone || !exts || !params.get('q')) return
    setAutoDone(true)
    void search(params.get('q') ?? '')
  }, [autoDone, exts, params, search])

  const configure = (r: Result) => {
    // «Voltar» da configuração repete esta pesquisa
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?q=${encodeURIComponent(results?.exact.domain ?? r.domain)}`)
    router.push(`/dominios/configurar?dominio=${encodeURIComponent(r.domain)}`)
  }
  const tExt = [...sold].sort((a, b) => b.extension.length - a.extension.length).find(x => tDomain.trim().toLowerCase().endsWith(x.extension))
  const addTransfer = () => {
    const d = tDomain.trim().toLowerCase().replace(/^www\./, '')
    if (!tExt || tExt.transfer == null) { setTError('Não fazemos transferências desta extensão.'); return }
    if (tExt.eppRequired && !epp.trim()) { setTError('Indique o código de autorização (EPP).'); return }
    setTError('')
    addDomain(`dominio:${d}`, [{ type: 'domain', domain: d, operation: 'transfer', years: 1, ...(epp ? { eppCode: epp } : {}) }])
    router.push('/carrinho')
  }

  const Row = ({ r, exact }: { r: Result; exact?: boolean }) => {
    const ui = STATUS_UI[r.availability]
    return (
      <li className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border ${exact ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE] bg-white'}`} data-testid="domain-result" data-status={r.availability}>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[#0A0A0A] break-all">{r.domain}</p>
          <span className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${ui.cls}`}>{ui.label}</span>
          {r.availability === 'confirm' && <p className="text-xs text-amber-800 mt-1 flex gap-1"><Clock size={12} className="shrink-0 mt-0.5" /> Sem consulta automática nesta extensão. Pode pagar agora: a nossa equipa confirma a disponibilidade antes de o registar.</p>}
        </div>
        {r.register != null && r.availability !== 'on_request' && (
          <div className="text-sm sm:text-right"><p className="font-bold">{kz(r.register)} <span className="font-normal text-[#888]">/ 1.º ano</span></p>{r.renew != null && <p className="text-xs text-[#888]">Renova por {kz(r.renew)}/ano</p>}</div>
        )}
        {r.availability === 'available' ? (
          <button className={btnPrimary} onClick={() => configure(r)} data-testid="register-now">Registrar Agora <ChevronRight size={15} /></button>
        ) : r.availability === 'confirm' ? (
          <button className={btnPrimary} onClick={() => configure(r)} data-testid="request-registration">Solicitar registo <ChevronRight size={15} /></button>
        ) : r.availability === 'unavailable' ? (
          <button className={btnGhost} disabled aria-disabled="true"><XCircle size={14} /> Indisponível</button>
        ) : <Link href={`/suporte/contactar?assunto=${encodeURIComponent('Domínio ' + r.domain)}`} className={btnGhost}>Pedir preço</Link>}
      </li>
    )
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Operação" className="inline-flex gap-2 bg-white border border-[#E8E8E8] rounded-2xl p-1.5">
        {([['register', 'Registar', Globe], ['transfer', 'Transferir', ArrowRightLeft]] as const).map(([m, l, Icon]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${mode === m ? 'bg-[#F5B700] text-[#0A0A0A]' : 'text-[#555]'}`}><Icon size={15} /> {l}</button>
        ))}
        <Link href="/dominios/renovar" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-[#555]"><RefreshCw size={15} /> Renovar</Link>
      </div>

      {extsError && <p className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex flex-wrap gap-2" role="alert"><AlertCircle size={16} /> {extsError} <button className="underline font-bold" onClick={loadExts}>Tentar novamente</button></p>}

      {mode === 'register' && (
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-5 sm:p-7">
          <form onSubmit={e => { e.preventDefault(); void search() }} className="flex flex-col sm:flex-row gap-2" role="search">
            <label className="sr-only" htmlFor="sn">Nome do domínio</label>
            <input id="sn" className={input} placeholder="nome-da-empresa" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
            <label className="sr-only" htmlFor="sx">Extensão</label>
            <select id="sx" className={`${input} sm:max-w-[200px]`} value={ext} onChange={e => setExt(e.target.value)} disabled={!sold.length}>
              {sold.map(e => <option key={e.extension} value={e.extension}>{e.extension}{e.register != null ? ` — ${kz(e.register)}` : ''}</option>)}
            </select>
            <button className={btnPrimary} disabled={!name.trim() || searching || !sold.length}>{searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Pesquisar</button>
          </form>
          {searching && <p className="text-sm text-[#666] mt-4 flex items-center gap-2" role="status"><Loader2 size={14} className="animate-spin" /> A verificar a disponibilidade…</p>}
          {error && <p className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex flex-wrap gap-2" role="alert"><AlertCircle size={16} /> {error} <button className="underline font-bold" onClick={() => search()}>Tentar novamente</button></p>}
          {results && (
            <div className="mt-5" aria-live="polite">
              {results.exact.availability === 'unavailable' && <p className="text-sm text-red-700 mb-3 font-semibold">{results.exact.domain} já está registado. Escolha uma alternativa.</p>}
              <ul className="space-y-2">
                <Row r={results.exact} exact />
                {results.alternatives.length > 0 && <li className="pt-3 text-xs font-black uppercase tracking-widest text-[#888]">Alternativas</li>}
                {results.alternatives.map(r => <Row key={r.domain} r={r} />)}
              </ul>
              <p className="text-xs text-[#888] mt-3">A disponibilidade e o preço voltam a ser verificados no servidor antes de confirmar a encomenda.</p>
            </div>
          )}
        </div>
      )}

      {mode === 'transfer' && (
        <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-5 sm:p-7 space-y-4">
          <label className="block text-sm font-semibold">Domínio a transferir
            <input className={`${input} mt-1`} placeholder="empresa.ao" value={tDomain} onChange={e => setTDomain(e.target.value)} autoComplete="off" />
          </label>
          {tExt && <p className="text-sm text-[#555]">Transferência de {tExt.extension} (inclui 1 ano): <strong>{kz(tExt.transfer ?? 0)}</strong>{tExt.transfer === 0 ? ' — sem custo' : ''}.</p>}
          {(!tExt || tExt.eppRequired) ? (
            <label className="block text-sm font-semibold">Código de autorização (EPP)
              <input className={`${input} mt-1`} type="password" autoComplete="off" value={epp} onChange={e => setEpp(e.target.value)} />
              <span className="block text-xs font-normal text-[#888] mt-1">Peça-o ao registrador actual e desbloqueie o domínio. É guardado cifrado e não fica no navegador.</span>
            </label>
          ) : <p className="text-xs text-[#888]">Domínios {tExt.extension} não precisam de código EPP.</p>}
          {tError && <p className="text-sm text-red-700 flex gap-1" role="alert"><AlertCircle size={16} /> {tError}</p>}
          <button className={btnPrimary} onClick={addTransfer} disabled={!tDomain.trim()} data-testid="add-transfer-to-cart"><ShoppingCart size={16} /> Adicionar ao carrinho</button>
        </div>
      )}
    </div>
  )
}
