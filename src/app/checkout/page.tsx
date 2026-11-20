'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Check, CheckCircle2, ChevronRight, Copy, Globe, Loader2, Lock, Minus, Plus, Search, ShoppingCart, Trash2, Upload, XCircle } from 'lucide-react'
import { useCart, toApiLine, type CartLine, type Cycle, type DomainMode } from '@/store/cartStore'
import { PLAN_CATALOG } from '@/lib/checkout/catalog'
import { createAuthClient, createClient } from '@/lib/supabase/client'

/* ─── Tipos da cotação (espelho de src/lib/commerce/quote.ts) ─────────── */
interface QuoteLine {
  index: number; type: 'product' | 'domain'; slug?: string; name: string; serviceType: string
  cycle?: Cycle; months?: number; quantity: number; quantityUnit?: string | null; maxQuantity?: number
  unitPrice: number; lineTotal: number; renewalPrice: number; domain?: string; domainMode?: DomainMode
  operation?: 'register' | 'transfer' | 'renew'; extension?: string
  availability?: { available: boolean; verified: boolean; note?: string }
  cycles?: { cycle: Cycle; months: number; price: number; renewal: number }[]
  error?: { code: string; message: string }
}
interface Quote { currency: 'AKZ'; lines: QuoteLine[]; subtotal: number; taxRate: number; taxLabel: string; tax: number; total: number; valid: boolean }
interface PayMethod { id: string; label: string; available: boolean; reason?: string; requiresProof?: boolean; bank?: Record<string, string | null> }

const CYCLE_LABEL: Record<Cycle, string> = { monthly: 'Mensal', '6months': '6 meses', '1year': '1 ano', '2years': '2 anos', '3years': '3 anos' }
const CYCLE_PER: Record<Cycle, string> = { monthly: 'mês', '6months': '6 meses', '1year': 'ano', '2years': '2 anos', '3years': '3 anos' }
const LEGACY_BILLING: Record<string, Cycle> = { monthly: 'monthly', mensal: 'monthly', '6months': '6months', semiannual: '6months', '1year': '1year', annual: '1year', anual: '1year', '2years': '2years', '3years': '3years' }
const STEPS = ['Carrinho', 'Conta', 'Pagamento', 'Revisão']

const kz = (n: number) => `Kz ${n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ /g, ' ')}`
const card = 'bg-white border border-[#E8E8E8] rounded-2xl p-6 shadow-sm'
const btnPrimary = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-black bg-[#F5B700] hover:bg-[#e0a800] disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
const btnGhost = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-[#555] border border-[#E8E8E8] hover:border-[#F5B700] transition-colors'
const input = 'w-full border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F5B700] transition-colors'

/* ─── Cotação no servidor (debounce) ──────────────────────────────────── */
function useQuote(lines: CartLine[]) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const body = useMemo(() => JSON.stringify({ lines: lines.map(toApiLine) }), [lines])
  const seq = useRef(0)
  const refresh = useCallback(async () => {
    const my = ++seq.current
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/checkout/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      const j = await res.json()
      if (my !== seq.current) return
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
      setQuote(j.quote)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message || 'Falha ao calcular os preços.')
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [body])
  useEffect(() => { const t = setTimeout(refresh, 350); return () => clearTimeout(t) }, [refresh])
  return { quote, setQuote, loading, error, refresh }
}

function StepBar({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 mb-8 overflow-x-auto" aria-label="Passos do checkout">
      {STEPS.map((label, i) => {
        const n = i + 1, done = n < current, active = n === current
        return (
          <li key={label} className="flex items-center gap-2 shrink-0">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${done ? 'bg-green-500 text-white' : active ? 'bg-[#F5B700] text-black' : 'bg-[#EEE] text-[#999]'}`}>{done ? <Check size={14} /> : n}</span>
            <span className={`text-sm font-bold ${active ? 'text-[#0A0A0A]' : 'text-[#999]'}`} aria-current={active ? 'step' : undefined}>{label}</span>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-[#CCC]" />}
          </li>
        )
      })}
    </ol>
  )
}

function Summary({ quote, loading }: { quote: Quote | null; loading: boolean }) {
  return (
    <div className={card}>
      <p className="text-xs font-black text-[#999] uppercase tracking-widest mb-4">Resumo</p>
      {!quote ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#F5B700]" /></div> : (
        <>
          <ul className="space-y-3 mb-4">
            {quote.lines.filter(l => !l.error).map(l => (
              <li key={l.index} className="flex justify-between gap-3 text-sm">
                <span className="text-[#333]">{l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ''}{l.cycle ? <span className="block text-xs text-[#999]">{CYCLE_LABEL[l.cycle]}</span> : null}</span>
                <span className="font-bold whitespace-nowrap">{kz(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-[#F0F0F0] pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[#888]">Subtotal</span><span>{kz(quote.subtotal)}</span></div>
            {quote.taxRate > 0 && <div className="flex justify-between"><span className="text-[#888]">{quote.taxLabel} ({quote.taxRate}%)</span><span>{kz(quote.tax)}</span></div>}
            <div className="flex justify-between text-base font-black pt-1"><span>Total</span><span>{kz(quote.total)}</span></div>
            {quote.taxRate === 0 && <p className="text-[11px] text-[#999]">Sem impostos aplicados.</p>}
          </div>
          {loading && <p className="text-xs text-[#999] mt-2 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> A actualizar…</p>}
        </>
      )}
    </div>
  )
}

/* ─── Passo 1: carrinho ───────────────────────────────────────────────── */
function DomainSearch() {
  const addDomain = useCart(s => s.addDomain)
  const [name, setName] = useState('')
  const [exts, setExts] = useState<{ extension: string; price: number }[]>([])
  const [ext, setExt] = useState('.ao')
  const [state, setState] = useState<{ checking: boolean; result?: { available: boolean; verified: boolean }; error?: string }>({ checking: false })
  useEffect(() => {
    createClient().from('domain_prices').select('extension, price').eq('operation', 'register').eq('status', 'active').order('price')
      .then(({ data }) => { if (data) setExts((data as { extension: string; price: number }[]).filter(e => e.price != null)) })
  }, [])
  const domain = `${name.trim().toLowerCase().replace(/\..*$/, '')}${ext}`
  const check = async () => {
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name.trim().toLowerCase().replace(/\..*$/, ''))) { setState({ checking: false, error: 'Nome inválido: use letras, números e hífen.' }); return }
    setState({ checking: true })
    try {
      const r = await fetch(`/api/checkout/domain-check?domain=${encodeURIComponent(domain)}`).then(r => r.json())
      setState({ checking: false, result: { available: !!r.available, verified: !!r.verified } })
    } catch { setState({ checking: false, error: 'Não foi possível verificar agora. Tente novamente.' }) }
  }
  return (
    <div className="border border-[#E8E8E8] rounded-xl p-4">
      <p className="text-sm font-bold mb-3 flex items-center gap-2"><Globe size={16} className="text-[#F5B700]" /> Adicionar domínio</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className={input} placeholder="nome-da-empresa" value={name} onChange={e => { setName(e.target.value); setState({ checking: false }) }} aria-label="Nome do domínio" />
        <select className={`${input} sm:w-44`} value={ext} onChange={e => { setExt(e.target.value); setState({ checking: false }) }} aria-label="Extensão">
          {exts.length === 0 && <option value=".ao">.ao</option>}
          {exts.map(e => <option key={e.extension} value={e.extension}>{e.extension} — {kz(Number(e.price))}</option>)}
        </select>
        <button className={btnPrimary} onClick={check} disabled={!name.trim() || state.checking}>{state.checking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Verificar</button>
      </div>
      {state.error && <p className="text-xs text-red-600 mt-2">{state.error}</p>}
      {state.result && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {state.result.available
            ? <span className="text-green-700 font-bold flex items-center gap-1"><CheckCircle2 size={16} /> {domain} {state.result.verified ? 'está disponível' : 'parece disponível (confirmação manual após a encomenda)'}</span>
            : <span className="text-red-600 font-bold flex items-center gap-1"><XCircle size={16} /> {domain} já está registado</span>}
          {state.result.available
            ? <button className={btnGhost} onClick={() => { addDomain(domain, 'register'); setState({ checking: false }); setName('') }}>Registar</button>
            : <button className={btnGhost} onClick={() => { addDomain(domain, 'transfer'); setState({ checking: false }); setName('') }}>É meu — transferir</button>}
        </div>
      )}
    </div>
  )
}

function CartStep({ quote, onNext }: { quote: Quote | null; onNext: () => void }) {
  const { lines, update, remove, addDomain } = useCart()
  if (!lines.length) {
    return (
      <div className="text-center py-10">
        <ShoppingCart className="mx-auto text-[#CCC] mb-3" size={40} />
        <h2 className="text-xl font-black mb-2">O carrinho está vazio</h2>
        <p className="text-sm text-[#888] mb-6">Escolha um serviço para começar.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link className={btnPrimary} href="/hospedagem-de-sites">Hospedagem</Link>
          <Link className={btnGhost} href="/email-corporativo">E-mail</Link>
          <Link className={btnGhost} href="/servidor-vps">VPS</Link>
        </div>
        <div className="mt-8 text-left"><DomainSearch /></div>
      </div>
    )
  }
  const ql = (i: number) => quote?.lines.find(l => l.index === i)
  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-1">O seu carrinho</h2>
      <p className="text-sm text-[#888] mb-6">Escolha o ciclo e, nos serviços de alojamento e e-mail, o domínio a usar.</p>
      <ul className="space-y-4 mb-6">
        {lines.map((l, i) => {
          const q = ql(i)
          return (
            <li key={l.key} className="border border-[#E8E8E8] rounded-xl p-4" data-testid="cart-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#0A0A0A]">{q?.name ?? (l.type === 'domain' ? l.domain : l.slug)}</p>
                  {q && !q.error && <p className="text-sm text-[#555] mt-0.5">{kz(q.lineTotal)}{q.cycle ? ` / ${CYCLE_PER[q.cycle]}` : ' / ano'}{q.renewalPrice ? <span className="text-xs text-[#999]"> · renova por {kz(q.renewalPrice)}</span> : null}</p>}
                  {q?.error && (
                    <p className="text-sm text-red-600 mt-1 flex items-start gap-1" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" />{q.error.message}
                      {q.error.code === 'on_request' && <Link href="/suporte/contactar" className="underline ml-1">Contactar</Link>}</p>
                  )}
                  {q?.availability && !q.availability.verified && <p className="text-xs text-amber-700 mt-1">Disponibilidade confirmada manualmente após a encomenda (o registo desta extensão não tem consulta automática).</p>}
                </div>
                <button onClick={() => remove(l.key)} className="text-[#999] hover:text-red-600 p-1" aria-label="Remover do carrinho"><Trash2 size={16} /></button>
              </div>

              {l.type === 'product' && (
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <label className="text-xs text-[#888]">Ciclo de facturação
                    <select className={`${input} mt-1`} value={l.cycle} onChange={e => update(l.key, { cycle: e.target.value as Cycle })}>
                      {(q?.cycles?.length ? q.cycles : [{ cycle: l.cycle, months: 0, price: 0, renewal: 0 }]).map(c => (
                        <option key={c.cycle} value={c.cycle}>{CYCLE_LABEL[c.cycle as Cycle]}{c.price ? ` — ${kz(c.price * (l.quantity || 1))}` : ''}</option>
                      ))}
                    </select>
                  </label>
                  {q?.quantityUnit && (
                    <div className="text-xs text-[#888]">Quantidade ({q.quantityUnit}s)
                      <div className="flex items-center gap-2 mt-1">
                        <button className={btnGhost} aria-label="Diminuir" onClick={() => update(l.key, { quantity: Math.max(1, l.quantity - 1) })}><Minus size={14} /></button>
                        <span className="w-10 text-center font-bold text-sm text-[#0A0A0A]" aria-live="polite">{l.quantity}</span>
                        <button className={btnGhost} aria-label="Aumentar" onClick={() => update(l.key, { quantity: Math.min(q.maxQuantity ?? 1, l.quantity + 1) })}><Plus size={14} /></button>
                      </div>
                    </div>
                  )}
                  {(q?.serviceType === 'hosting' || q?.serviceType === 'email') && (
                    <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
                      <label className="text-xs text-[#888]">Domínio do serviço
                        <input className={`${input} mt-1`} placeholder="exemplo.ao" value={l.domain ?? ''} onChange={e => update(l.key, { domain: e.target.value.trim().toLowerCase() })} />
                      </label>
                      <label className="text-xs text-[#888]">Este domínio…
                        <select className={`${input} mt-1`} value={l.domainMode ?? 'existing'} onChange={e => {
                          const mode = e.target.value as DomainMode
                          update(l.key, { domainMode: mode })
                          if (l.domain && mode !== 'existing') addDomain(l.domain, mode)
                        }}>
                          <option value="existing">já é meu (sem custo)</option>
                          <option value="register">é novo — registar</option>
                          <option value="transfer">é meu noutro registrador — transferir</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}
              {l.type === 'domain' && l.operation === 'transfer' && (
                <label className="block text-xs text-[#888] mt-3">Código de autorização (EPP) {q?.extension?.endsWith('.ao') ? '(opcional para .ao)' : ''}
                  <input type="password" autoComplete="off" className={`${input} mt-1`} value={l.eppCode ?? ''} onChange={e => update(l.key, { eppCode: e.target.value })} />
                  <span className="block mt-1 text-[11px]">Guardado cifrado e usado apenas para a transferência. Não fica guardado no navegador.</span>
                </label>
              )}
            </li>
          )
        })}
      </ul>
      <DomainSearch />
      <div className="flex justify-end mt-6">
        <button className={btnPrimary} disabled={!quote?.valid} onClick={onNext}>Continuar <ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

/* ─── Passo 2: conta e dados de facturação ───────────────────────────── */
interface Account { loggedIn: boolean; email?: string; name?: string }
function AccountStep({ account, setAccount, guest, setGuest, billing, setBilling, onNext, onBack }: {
  account: Account; setAccount: (a: Account) => void
  guest: { name: string; email: string; phone: string; password: string }; setGuest: (g: { name: string; email: string; phone: string; password: string }) => void
  billing: Record<string, string>; setBilling: (b: Record<string, string>) => void
  onNext: () => void; onBack: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [creds, setCreds] = useState({ email: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('')
    const { data, error } = await createAuthClient().auth.signInWithPassword(creds)
    setBusy(false)
    if (error || !data.user) { setErr(error?.message === 'Invalid login credentials' ? 'E-mail ou senha incorrectos.' : error?.message === 'Email not confirmed' ? 'Confirme o seu e-mail antes de entrar.' : (error?.message ?? 'Erro ao entrar.')); return }
    setAccount({ loggedIn: true, email: data.user.email, name: data.user.user_metadata?.full_name })
  }
  const guestValid = guest.name.trim().length > 1 && /\S+@\S+\.\S+/.test(guest.email) && guest.password.length >= 8
  const billingValid = (billing.name ?? '').trim().length > 1
  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-6">Conta e facturação</h2>
      {account.loggedIn ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-800"><Check size={14} className="inline mr-1" /> Sessão iniciada como <strong>{account.email}</strong></div>
      ) : (
        <div className="mb-6">
          <div className="flex gap-2 mb-4" role="tablist">
            <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? btnPrimary : btnGhost} onClick={() => setMode('login')}>Já sou cliente</button>
            <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? btnPrimary : btnGhost} onClick={() => setMode('register')}>Criar conta</button>
          </div>
          {mode === 'login' ? (
            <form onSubmit={login} className="space-y-3">
              <input className={input} type="email" autoComplete="email" placeholder="E-mail" value={creds.email} onChange={e => setCreds({ ...creds, email: e.target.value })} required />
              <input className={input} type="password" autoComplete="current-password" placeholder="Senha" value={creds.password} onChange={e => setCreds({ ...creds, password: e.target.value })} required />
              {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
              <button className={btnPrimary} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Entrar</button>
              <Link href="/forgot-password" className="block text-xs text-[#888] underline">Esqueci a senha</Link>
            </form>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <input className={input} placeholder="Nome completo" value={guest.name} onChange={e => setGuest({ ...guest, name: e.target.value })} />
              <input className={input} type="email" autoComplete="email" placeholder="E-mail" value={guest.email} onChange={e => setGuest({ ...guest, email: e.target.value })} />
              <input className={input} type="tel" placeholder="Telefone" value={guest.phone} onChange={e => setGuest({ ...guest, phone: e.target.value })} />
              <input className={input} type="password" autoComplete="new-password" placeholder="Senha (mín. 8 caracteres)" value={guest.password} onChange={e => setGuest({ ...guest, password: e.target.value })} />
              <p className="sm:col-span-2 text-xs text-[#888]">A conta é criada ao confirmar a encomenda.</p>
            </div>
          )}
        </div>
      )}
      <p className="text-sm font-bold mb-3">Dados de facturação</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={input} placeholder="Nome ou empresa *" value={billing.name ?? ''} onChange={e => setBilling({ ...billing, name: e.target.value })} />
        <input className={input} placeholder="NIF (opcional)" value={billing.nif ?? ''} onChange={e => setBilling({ ...billing, nif: e.target.value })} />
        <input className={`${input} sm:col-span-2`} placeholder="Morada (opcional)" value={billing.address ?? ''} onChange={e => setBilling({ ...billing, address: e.target.value })} />
      </div>
      <div className="flex justify-between mt-6">
        <button className={btnGhost} onClick={onBack}>Voltar</button>
        <button className={btnPrimary} disabled={!billingValid || (!account.loggedIn && (mode === 'login' || !guestValid))} onClick={onNext}>Continuar <ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

/* ─── Passo 3: pagamento ─────────────────────────────────────────────── */
function PaymentStep({ methods, method, setMethod, proof, setProof, transferRef, setTransferRef, onNext, onBack }: {
  methods: PayMethod[] | null; method: string; setMethod: (m: string) => void
  proof: { path: string; name: string } | null; setProof: (p: { path: string; name: string } | null) => void
  transferRef: string; setTransferRef: (s: string) => void; onNext: () => void; onBack: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [copied, setCopied] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const bank = methods?.find(m => m.id === 'bank_transfer')?.bank
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 20 * 1024 * 1024) { setUploadErr('Ficheiro demasiado grande (máx. 20 MB).'); return }
    setUploading(true); setUploadErr('')
    const now = new Date()
    const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { data, error } = await createAuthClient().storage.from('payment-proofs').upload(path, f)
    setUploading(false)
    if (error || !data) { setUploadErr(error?.message ?? 'Falha no envio.'); return }
    setProof({ path: data.path, name: f.name })
  }
  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-6">Pagamento</h2>
      {!methods ? <Loader2 className="animate-spin text-[#F5B700]" /> : (
        <div className="grid sm:grid-cols-2 gap-3 mb-6" role="radiogroup" aria-label="Método de pagamento">
          {methods.map(m => (
            <button key={m.id} role="radio" aria-checked={method === m.id} disabled={!m.available} onClick={() => setMethod(m.id)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${method === m.id ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#E8E8E8] bg-white'} ${m.available ? 'hover:border-[#F5B700]/50' : 'opacity-60 cursor-not-allowed'}`}>
              <p className="text-sm font-bold">{m.label}</p>
              <p className="text-xs text-[#888] mt-0.5">{m.available ? 'Disponível' : `Indisponível — ${m.reason}`}</p>
            </button>
          ))}
        </div>
      )}
      {method === 'bank_transfer' && bank && (
        <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-5 space-y-3 mb-6">
          <p className="text-sm font-bold">Dados para transferência — {bank.bank_name}</p>
          {[['Titular', bank.account_holder], ['Conta / Coordenada', bank.account_number], ['IBAN', bank.iban], ['SWIFT', bank.swift]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 bg-white border border-[#EEE] rounded-lg px-3 py-2">
              <div className="min-w-0"><p className="text-[10px] font-black text-[#999] uppercase tracking-widest">{k}</p><p className="text-sm font-bold font-mono break-all">{v}</p></div>
              <button className="text-[#888] hover:text-[#0A0A0A] p-1" aria-label={`Copiar ${k}`} onClick={() => { navigator.clipboard?.writeText(String(v)); setCopied(String(k)); setTimeout(() => setCopied(''), 1500) }}>{copied === k ? <Check size={14} /> : <Copy size={14} />}</button>
            </div>
          ))}
          {bank.payment_instructions && <p className="text-xs text-[#666]">{bank.payment_instructions}</p>}
          <p className="text-xs text-[#888]">A encomenda fica pendente até validarmos o comprovativo. Pode enviá-lo agora ou depois, na Área do Cliente.</p>
          <input className={input} placeholder="Referência da transferência (opcional)" value={transferRef} onChange={e => setTransferRef(e.target.value)} />
          <button className={`${btnGhost} w-full border-dashed`} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : proof ? <Check size={14} className="text-green-600" /> : <Upload size={14} />}{proof ? `Comprovativo: ${proof.name}` : 'Enviar comprovativo (imagem/PDF)'}
          </button>
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={upload} />
          {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
        </div>
      )}
      <div className="flex justify-between">
        <button className={btnGhost} onClick={onBack}>Voltar</button>
        <button className={btnPrimary} disabled={!methods?.find(m => m.id === method && m.available)} onClick={onNext}>Rever encomenda <ChevronRight size={16} /></button>
      </div>
    </div>
  )
}

/* ─── Passo 4: revisão e confirmação ─────────────────────────────────── */
function ReviewStep({ quote, method, proof, submitting, error, onSubmit, onBack }: {
  quote: Quote | null; method: string; proof: { name: string } | null; submitting: boolean; error: string; onSubmit: () => void; onBack: () => void
}) {
  const [accepted, setAccepted] = useState(false)
  if (!quote) return <Loader2 className="animate-spin text-[#F5B700]" />
  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-6">Rever e confirmar</h2>
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-[#999] uppercase"><th className="py-2 pr-3">Serviço</th><th className="py-2 pr-3">Ciclo</th><th className="py-2 pr-3 text-right">Valor</th><th className="py-2 text-right">Renovação</th></tr></thead>
          <tbody>
            {quote.lines.map(l => (
              <tr key={l.index} className="border-t border-[#F0F0F0]">
                <td className="py-2 pr-3">{l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ''}{l.domain && l.type === 'product' ? <span className="block text-xs text-[#999]">{l.domain}</span> : null}</td>
                <td className="py-2 pr-3">{l.cycle ? CYCLE_LABEL[l.cycle] : '1 ano'}</td>
                <td className="py-2 pr-3 text-right font-bold whitespace-nowrap">{kz(l.lineTotal)}</td>
                <td className="py-2 text-right whitespace-nowrap text-[#666]">{kz(l.renewalPrice)} / {l.cycle ? CYCLE_PER[l.cycle] : 'ano'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-sm space-y-1 mb-4">
        <div className="flex justify-between"><span className="text-[#888]">Subtotal</span><span>{kz(quote.subtotal)}</span></div>
        {quote.taxRate > 0 && <div className="flex justify-between"><span className="text-[#888]">{quote.taxLabel} ({quote.taxRate}%)</span><span>{kz(quote.tax)}</span></div>}
        <div className="flex justify-between text-lg font-black"><span>Total a pagar</span><span data-testid="review-total">{kz(quote.total)}</span></div>
        <p className="text-xs text-[#888]">Pagamento: {method === 'bank_transfer' ? `transferência bancária${proof ? ' (comprovativo enviado)' : ' (comprovativo a enviar)'}` : method}. Os serviços são activados depois de confirmarmos o pagamento.</p>
      </div>
      <label className="flex items-start gap-2 text-sm mb-4">
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1" />
        <span>Confirmo os serviços, os ciclos e os valores de renovação indicados.</span>
      </label>
      {error && <p className="text-sm text-red-600 mb-4 flex gap-1" role="alert"><AlertCircle size={16} className="shrink-0" />{error}</p>}
      <div className="flex justify-between">
        <button className={btnGhost} onClick={onBack} disabled={submitting}>Voltar</button>
        <button className={btnPrimary} disabled={!accepted || submitting || !quote.valid} onClick={onSubmit} data-testid="confirm-order">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Confirmar encomenda
        </button>
      </div>
    </div>
  )
}

/* ─── Página ──────────────────────────────────────────────────────────── */
function CheckoutContent() {
  const router = useRouter()
  const params = useSearchParams()
  const cart = useCart()
  // Carrinho lido do localStorage só depois da hidratação (evita divergência servidor/cliente)
  const hydrated = useSyncExternalStore(cb => useCart.persist.onFinishHydration(cb), () => useCart.persist.hasHydrated(), () => false)
  const [step, setStep] = useState(1)
  const { quote, setQuote, loading } = useQuote(cart.lines)
  const [account, setAccount] = useState<Account>({ loggedIn: false })
  const [guest, setGuest] = useState({ name: '', email: '', phone: '', password: '' })
  const [billing, setBilling] = useState<Record<string, string>>({})
  const [methods, setMethods] = useState<PayMethod[] | null>(null)
  const [method, setMethod] = useState('bank_transfer')
  const [proof, setProof] = useState<{ path: string; name: string } | null>(null)
  const [transferRef, setTransferRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    createAuthClient().auth.getUser().then(({ data }) => {
      if (data.user) {
        setAccount({ loggedIn: true, email: data.user.email, name: data.user.user_metadata?.full_name })
        setBilling(b => ({ name: b.name || data.user!.user_metadata?.full_name || '', ...b }))
      }
    })
    fetch('/api/checkout/payment-methods').then(r => r.json()).then(j => setMethods(j.methods ?? [])).catch(() => setMethods([]))
  }, [])

  // Botões de compra: ?plan=slug&billing=ciclo · ?tld=.ao · ?domain=exemplo.ao
  const handled = useRef(false)
  useEffect(() => {
    if (!hydrated || handled.current) return
    handled.current = true
    const plan = params.get('plan'), domain = params.get('domain'), tld = params.get('tld')
    const billingParam = params.get('billing')
    if (plan) {
      const slug = plan.startsWith('domain') ? null : (PLAN_CATALOG[plan]?.id ?? plan)
      if (slug) cart.addProduct(slug, LEGACY_BILLING[billingParam ?? ''] ?? 'monthly')
    }
    if (domain) cart.addDomain(domain, 'register')
    if (tld && !domain) document.getElementById('cart-step')?.scrollIntoView()
    if (plan || domain || tld) router.replace('/checkout')
  }, [hydrated, params, cart, router])

  const submit = async () => {
    if (!quote) return
    setSubmitting(true); setSubmitError('')
    const idempotencyKey = cart.ensureIdempotencyKey()
    try {
      const res = await fetch('/api/checkout/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey, lines: cart.lines.map(toApiLine), acceptedTotal: quote.total, paymentMethod: method,
          proofFile: proof?.path ?? null, transferRef: transferRef || null, billingDetails: billing,
          userData: account.loggedIn ? undefined : guest,
        }),
      })
      const j = await res.json()
      if (res.status === 409 && j.quote) { setQuote(j.quote); setSubmitError(j.error); return }
      if (!res.ok) { setSubmitError(j.error ?? 'Não foi possível concluir a encomenda.'); if (j.code === 'email_exists') setStep(2); return }
      cart.clear()
      router.push(`/orders/${j.order.id}?nova=1`)
    } catch {
      setSubmitError('Falha de rede. A encomenda não foi duplicada: pode tentar de novo com segurança.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!hydrated) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">
      <StepBar current={step} />
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        <div className={`flex-1 w-full ${card}`} id="cart-step">
          {step === 1 && <CartStep quote={quote} onNext={() => setStep(2)} />}
          {step === 2 && <AccountStep account={account} setAccount={a => { setAccount(a); setBilling(b => ({ name: b.name || a.name || '', ...b })) }} guest={guest} setGuest={setGuest} billing={billing} setBilling={setBilling} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <PaymentStep methods={methods} method={method} setMethod={setMethod} proof={proof} setProof={setProof} transferRef={transferRef} setTransferRef={setTransferRef} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
          {step === 4 && <ReviewStep quote={quote} method={method} proof={proof} submitting={submitting} error={submitError} onSubmit={submit} onBack={() => setStep(3)} />}
        </div>
        {cart.lines.length > 0 && <div className="w-full lg:w-80 shrink-0"><Summary quote={quote} loading={loading} /></div>}
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-[#888]">A carregar o checkout…</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
