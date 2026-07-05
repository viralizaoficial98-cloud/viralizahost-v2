'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Check, ChevronRight, ChevronLeft, Trash2, Plus, Minus,
  Globe, Lock, CreditCard, Smartphone, Building2, Upload,
  X, AlertCircle, Loader2, Package, Mail, Server, Tag,
} from 'lucide-react'
import Image from 'next/image'
import {
  useCheckoutStore,
  BILLING_LABEL, BILLING_DISCOUNT, BILLING_MONTHS,
  type BillingCycle, type CheckoutItem, type ServiceType,
} from '@/store/checkoutStore'
import { createClient } from '@/lib/supabase/client'

// ─── constants ─────────────────────────────────────────────────────────────

const STEPS = ['Ciclo', 'Carrinho', 'Domínio', 'Identificação', 'Pagamento']

const SERVICE_ICONS: Record<ServiceType, React.ElementType> = {
  hosting: Server, email: Mail, domain: Globe,
  vps: Server, dedicated: Server, reseller: Package, other: Tag,
}

const PLAN_CATALOG: Record<string, CheckoutItem> = {
  starter:   { id: 'starter',   name: 'Starter Host',   type: 'hosting',  price: 4500,  currency: 'AOA', quantity: 1 },
  business:  { id: 'business',  name: 'Business Cloud', type: 'hosting',  price: 9500,  currency: 'AOA', quantity: 1 },
  pro:       { id: 'pro',       name: 'Cloud Pro',      type: 'hosting',  price: 19500, currency: 'AOA', quantity: 1 },
  reseller:  { id: 'reseller',  name: 'Revenda WHM',    type: 'reseller', price: 35000, currency: 'AOA', quantity: 1 },
  // EmailPricingSection IDs
  'starter-mail':    { id: 'starter-mail',    name: 'Webmail Start',         type: 'email', price: 6800,  currency: 'AOA', quantity: 1 },
  'business-mail':   { id: 'business-mail',   name: 'Webmail Business',      type: 'email', price: 14800, currency: 'AOA', quantity: 1 },
  'enterprise-mail': { id: 'enterprise-mail', name: 'Webmail Enterprise',    type: 'email', price: 28000, currency: 'AOA', quantity: 1 },
  'corporate-pro':   { id: 'corporate-pro',   name: 'Corporate Pro',         type: 'email', price: 45000, currency: 'AOA', quantity: 1 },
  // EmailCorpSection IDs
  'webmail-start':      { id: 'webmail-start',      name: 'Webmail Start',        type: 'email', price: 6800,  currency: 'AOA', quantity: 1 },
  'webmail-business':   { id: 'webmail-business',   name: 'Webmail Business',     type: 'email', price: 14800, currency: 'AOA', quantity: 1 },
  'webmail-enterprise': { id: 'webmail-enterprise', name: 'Webmail Enterprise',   type: 'email', price: 28000, currency: 'AOA', quantity: 1 },
  'microsoft365':       { id: 'microsoft365',       name: 'Microsoft 365 Outlook',type: 'email', price: 52000, currency: 'AOA', quantity: 1 },
  // individual email pages
  'microsoft-365-outlook': { id: 'microsoft-365-outlook', name: 'Microsoft 365 Outlook', type: 'email', price: 52000, currency: 'AOA', quantity: 1 },
  // Domain TLDs — price = annual base price
  'domain.com':    { id: 'domain.com',    name: 'Domínio .com',    type: 'domain', price: 4500,  currency: 'AOA', quantity: 1 },
  'domain.net':    { id: 'domain.net',    name: 'Domínio .net',    type: 'domain', price: 5200,  currency: 'AOA', quantity: 1 },
  'domain.org':    { id: 'domain.org',    name: 'Domínio .org',    type: 'domain', price: 4800,  currency: 'AOA', quantity: 1 },
  'domain.ao':     { id: 'domain.ao',     name: 'Domínio .ao',     type: 'domain', price: 8000,  currency: 'AOA', quantity: 1 },
  'domain.com.br': { id: 'domain.com.br', name: 'Domínio .com.br', type: 'domain', price: 4900,  currency: 'AOA', quantity: 1 },
  'domain.io':     { id: 'domain.io',     name: 'Domínio .io',     type: 'domain', price: 18000, currency: 'AOA', quantity: 1 },
  // domain-search fallback
  'domain-search': { id: 'domain-search', name: 'Domínio',         type: 'domain', price: 4500,  currency: 'AOA', quantity: 1 },
}

// ─── helpers ───────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return `Kz ${n.toLocaleString('pt-AO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const DOMAIN_YEARS: Record<BillingCycle, number> = {
  monthly: 1, '6months': 1, '1year': 1, '2years': 2, '3years': 3,
}
const DOMAIN_DISCOUNT: Record<BillingCycle, number> = {
  monthly: 0, '6months': 0, '1year': 0, '2years': 0.10, '3years': 0.15,
}

function calcItemTotal(item: CheckoutItem, cycle: BillingCycle) {
  if (item.type === 'domain') {
    const years = DOMAIN_YEARS[cycle]
    const discount = DOMAIN_DISCOUNT[cycle]
    return item.price * item.quantity * years * (1 - discount)
  }
  return item.price * item.quantity * BILLING_MONTHS[cycle] * (1 - BILLING_DISCOUNT[cycle])
}

// ─── sub-components ────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const num = i + 1
        const done = num < current
        const active = num === current
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                done   ? 'bg-green-500 text-white' :
                active ? 'bg-[#F5B700] text-[#0A0A0A]' :
                         'bg-[#E8E8E8] text-[#999]'
              }`}>
                {done ? <Check size={13} /> : num}
              </div>
              <span className={`text-[10px] font-semibold hidden sm:block ${active ? 'text-[#F5B700]' : done ? 'text-green-600' : 'text-[#AAA]'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-10 sm:w-16 h-0.5 mx-1 mb-4 transition-colors ${done ? 'bg-green-400' : 'bg-[#E8E8E8]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function OrderSummary({ items, cycle }: { items: CheckoutItem[]; cycle: BillingCycle }) {
  const discount = BILLING_DISCOUNT[cycle]
  const total = items.reduce((acc, i) => acc + calcItemTotal(i, cycle), 0)
  const baseTotal = items.reduce((acc, i) => acc + i.price * i.quantity * BILLING_MONTHS[cycle], 0)

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-black text-[#999] uppercase tracking-widest mb-4">Resumo do Pedido</p>
      {items.length === 0 ? (
        <p className="text-sm text-[#AAA]">Nenhum serviço selecionado.</p>
      ) : (
        <>
          {items.map(item => {
            const Icon = SERVICE_ICONS[item.type]
            return (
              <div key={item.id} className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#FFF8E1] flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-[#F5B700]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#0A0A0A] truncate">{item.name}</p>
                  <p className="text-xs text-[#888]">{BILLING_LABEL[cycle]} × {item.quantity}</p>
                </div>
                <p className="text-sm font-bold text-[#0A0A0A] whitespace-nowrap">
                  {fmtPrice(calcItemTotal(item, cycle))}
                </p>
              </div>
            )
          })}
          <div className="border-t border-[#F0F0F0] mt-4 pt-4 space-y-1">
            {discount > 0 && (
              <>
                <div className="flex justify-between text-sm text-[#888]">
                  <span>Subtotal</span><span>{fmtPrice(baseTotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600 font-semibold">
                  <span>Desconto {Math.round(discount * 100)}%</span>
                  <span>-{fmtPrice(baseTotal - total)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-black text-base text-[#0A0A0A] pt-1">
              <span>Total</span><span className="text-[#F5B700]">{fmtPrice(total)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Step 1: Billing cycle ──────────────────────────────────────────────────

function Step1Cycle({ onNext }: { onNext: () => void }) {
  const { billingCycle, setBillingCycle, items } = useCheckoutStore()
  const isDomainOnly = items.length > 0 && items.every(i => i.type === 'domain')
  const cycles: BillingCycle[] = isDomainOnly
    ? ['1year', '2years', '3years']
    : ['monthly', '6months', '1year', '2years', '3years']

  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-2">Escolha o ciclo de faturação</h2>
      <p className="text-[#888] text-sm mb-6">Períodos mais longos têm descontos maiores.</p>
      <div className="space-y-3 mb-8">
        {cycles.map(c => {
          const disc = BILLING_DISCOUNT[c]
          const active = billingCycle === c
          return (
            <button
              key={c}
              onClick={() => setBillingCycle(c)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${
                active ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#E8E8E8] bg-white hover:border-[#F5B700]/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  active ? 'border-[#F5B700] bg-[#F5B700]' : 'border-[#CCC]'
                }`}>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className="font-bold text-[#0A0A0A]">{BILLING_LABEL[c]}</span>
              </div>
              {disc > 0 ? (
                <span className="text-xs font-black px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  -{Math.round(disc * 100)}% desconto
                </span>
              ) : (
                <span className="text-xs text-[#AAA]">Sem desconto</span>
              )}
            </button>
          )
        })}
      </div>
      <button
        onClick={onNext}
        className="w-full py-4 bg-[#F5B700] text-[#0A0A0A] font-black rounded-xl flex items-center justify-center gap-2 hover:bg-[#D9A300] transition-colors"
      >
        Continuar <ChevronRight size={18} />
      </button>
    </div>
  )
}

// ─── Step 2: Cart ───────────────────────────────────────────────────────────

function Step2Cart({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { items, billingCycle, removeItem, updateQuantity, addItem } = useCheckoutStore()
  const [showAdd, setShowAdd] = useState(false)

  const extras: CheckoutItem[] = Object.values(PLAN_CATALOG).filter(p => !items.find(i => i.id === p.id))

  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-2">Reveja o seu carrinho</h2>
      <p className="text-[#888] text-sm mb-6">Ciclo: <strong className="text-[#F5B700]">{BILLING_LABEL[billingCycle]}</strong></p>

      {items.length === 0 && (
        <div className="text-center py-10 text-[#AAA]">
          <Package size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum serviço no carrinho.</p>
        </div>
      )}

      <div className="space-y-3 mb-5">
        {items.map(item => {
          const Icon = SERVICE_ICONS[item.type]
          return (
            <div key={item.id} className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFF8E1] flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-[#F5B700]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0A0A0A] text-sm">{item.name}</p>
                <p className="text-xs text-[#888]">{fmtPrice(item.price)}/mês</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-md border border-[#E8E8E8] flex items-center justify-center hover:border-[#F5B700] transition-colors">
                  <Minus size={11} />
                </button>
                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-md border border-[#E8E8E8] flex items-center justify-center hover:border-[#F5B700] transition-colors">
                  <Plus size={11} />
                </button>
              </div>
              <p className="text-sm font-black text-[#0A0A0A] w-24 text-right">
                {fmtPrice(calcItemTotal(item, billingCycle))}
              </p>
              <button onClick={() => removeItem(item.id)} className="text-[#CCC] hover:text-red-500 transition-colors ml-1">
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => setShowAdd(v => !v)}
        className="w-full py-3 border-2 border-dashed border-[#E8E8E8] rounded-xl text-sm text-[#888] hover:border-[#F5B700] hover:text-[#F5B700] transition-all flex items-center justify-center gap-2 mb-8"
      >
        <Plus size={15} /> Adicionar outro serviço
      </button>

      {showAdd && extras.length > 0 && (
        <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4 mb-6 space-y-2">
          {extras.map(p => (
            <button
              key={p.id}
              onClick={() => { addItem({ ...p, quantity: 1 }); setShowAdd(false) }}
              className="w-full flex items-center justify-between p-3 bg-white border border-[#E8E8E8] rounded-lg hover:border-[#F5B700] transition-colors text-left"
            >
              <span className="text-sm font-semibold text-[#0A0A0A]">{p.name}</span>
              <span className="text-xs text-[#888]">{fmtPrice(p.price)}/mês</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 border-2 border-[#E8E8E8] text-[#666] font-bold rounded-xl flex items-center justify-center gap-2 hover:border-[#CCC] transition-colors">
          <ChevronLeft size={18} /> Voltar
        </button>
        <button
          onClick={onNext}
          disabled={items.length === 0}
          className="flex-[2] py-4 bg-[#F5B700] text-[#0A0A0A] font-black rounded-xl flex items-center justify-center gap-2 hover:bg-[#D9A300] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Domain ─────────────────────────────────────────────────────────

function Step3Domain({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { domainAction, domainName, setDomainAction, setDomainName } = useCheckoutStore()
  const [checking, setChecking] = useState(false)
  const [availability, setAvailability] = useState<'available' | 'taken' | null>(null)
  const [error, setError] = useState('')

  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-.]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/

  async function checkDomain() {
    if (!domainRegex.test(domainName)) { setError('Formato inválido. Ex: meusite.com'); return }
    setError(''); setChecking(true); setAvailability(null)
    try {
      const res = await fetch(`/api/checkout/domain-check?domain=${encodeURIComponent(domainName)}`)
      const data = await res.json()
      setAvailability(data.available ? 'available' : 'taken')
    } catch {
      setError('Erro ao verificar domínio. Tente novamente.')
    } finally {
      setChecking(false)
    }
  }

  function canProceed() {
    if (!domainAction) return false
    if (domainAction === 'register') return availability === 'available'
    if (domainAction === 'existing') return domainRegex.test(domainName)
    return false
  }

  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-2">Configurar domínio</h2>
      <p className="text-[#888] text-sm mb-6">O domínio é necessário para activar o seu serviço.</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {(['register', 'existing'] as const).map(action => (
          <button
            key={action}
            onClick={() => { setDomainAction(action); setAvailability(null); setError('') }}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              domainAction === action ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#E8E8E8] bg-white hover:border-[#F5B700]/40'
            }`}
          >
            <p className="font-bold text-sm text-[#0A0A0A] mb-1">
              {action === 'register' ? '🔍 Registar novo' : '🔗 Já tenho domínio'}
            </p>
            <p className="text-xs text-[#888]">
              {action === 'register' ? 'Verificar disponibilidade e registar' : 'Usar um domínio existente'}
            </p>
          </button>
        ))}
      </div>

      {domainAction && (
        <div className="space-y-3 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={domainName}
              onChange={e => { setDomainName(e.target.value); setAvailability(null); setError('') }}
              placeholder="meusite.com"
              className="flex-1 border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F5B700] transition-colors"
            />
            {domainAction === 'register' && (
              <button
                onClick={checkDomain}
                disabled={checking || !domainName.trim()}
                className="px-5 py-3 bg-[#0A0A0A] text-white text-sm font-bold rounded-xl hover:bg-[#222] transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {checking ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                Verificar
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle size={14} />{error}
            </div>
          )}

          {availability === 'available' && (
            <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg border border-green-200">
              <Check size={14} /> <strong>{domainName}</strong> está disponível!
            </div>
          )}
          {availability === 'taken' && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              <X size={14} /> <strong>{domainName}</strong> não está disponível. Tente outro nome.
            </div>
          )}

          {domainAction === 'existing' && domainName && !domainRegex.test(domainName) && (
            <div className="flex items-center gap-2 text-amber-700 text-sm bg-amber-50 px-3 py-2 rounded-lg">
              <AlertCircle size={14} /> Formato inválido. Ex: meusite.com
            </div>
          )}
          {domainAction === 'existing' && domainRegex.test(domainName) && (
            <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg border border-green-200">
              <Check size={14} /> Domínio válido.
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 border-2 border-[#E8E8E8] text-[#666] font-bold rounded-xl flex items-center justify-center gap-2 hover:border-[#CCC] transition-colors">
          <ChevronLeft size={18} /> Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed()}
          className="flex-[2] py-4 bg-[#F5B700] text-[#0A0A0A] font-black rounded-xl flex items-center justify-center gap-2 hover:bg-[#D9A300] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Identification ─────────────────────────────────────────────────

function Step4Ident({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { userData, setUserData } = useCheckoutStore()
  const [authState, setAuthState] = useState<'loading' | 'logged-in' | 'login-form' | 'register-form'>('loading')
  const [profile, setProfile] = useState<{ full_name: string; email: string; phone: string | null } | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('full_name,email,phone').eq('id', user.id).single()
          .then(({ data }) => {
            if (data) {
              setProfile(data as any)
              setUserData({ name: (data as any).full_name, email: (data as any).email, phone: (data as any).phone ?? '' })
            }
          })
        setAuthState('logged-in')
      } else {
        setAuthState('login-form')
      }
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(''); setLoggingIn(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
    if (error) { setLoginError('E-mail ou senha incorretos.'); setLoggingIn(false); return }
    const user = data.user
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('full_name,email,phone').eq('id', user.id).single()
      if (prof) {
        setProfile(prof as any)
        setUserData({ name: (prof as any).full_name, email: (prof as any).email, phone: (prof as any).phone ?? '' })
      }
    }
    setAuthState('logged-in')
    setLoggingIn(false)
  }

  function isRegisterValid() {
    return userData.name.trim().length > 1 && /\S+@\S+\.\S+/.test(userData.email) && userData.phone.trim().length > 5 && userData.password.length >= 6
  }

  const inputCls = 'w-full border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F5B700] transition-colors'
  const canProceed = authState === 'logged-in' || (authState === 'register-form' && isRegisterValid())

  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-2">Identificação</h2>
      <p className="text-[#888] text-sm mb-6">Inicie sessão ou crie uma conta para continuar.</p>

      {authState === 'loading' && (
        <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#F5B700]" /></div>
      )}

      {/* Logged in */}
      {authState === 'logged-in' && profile && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-green-700 font-bold mb-1"><Check size={16} /> Sessão iniciada</div>
          <p className="text-sm text-green-800">{profile.full_name} · {profile.email}</p>
          <button onClick={() => { setAuthState('login-form'); setProfile(null) }}
            className="text-xs text-[#888] hover:text-[#555] mt-2 underline">
            Usar outra conta
          </button>
        </div>
      )}

      {/* Login form */}
      {authState === 'login-form' && (
        <form onSubmit={handleLogin} className="space-y-3 mb-4">
          <input type="email" placeholder="E-mail" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required className={inputCls} />
          <input type="password" placeholder="Senha" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required className={inputCls} />
          {loginError && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle size={14} />{loginError}
            </div>
          )}
          <button type="submit" disabled={loggingIn}
            className="w-full py-3 bg-[#0A0A0A] text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-[#222] transition-colors disabled:opacity-50">
            {loggingIn ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            Entrar
          </button>
          <div className="text-center pt-1">
            <button type="button" onClick={() => setAuthState('register-form')}
              className="text-sm text-[#F5B700] font-bold hover:underline">
              Não tenho conta — Criar agora
            </button>
          </div>
        </form>
      )}

      {/* Register form */}
      {authState === 'register-form' && (
        <div className="space-y-3 mb-4">
          <div className="bg-[#FFF8E1] border border-[#F5B700]/30 rounded-xl p-3 text-sm text-[#888]">
            Preencha os dados abaixo. A sua conta será criada ao finalizar a encomenda.
          </div>
          <input type="text" placeholder="Nome completo" value={userData.name} onChange={e => setUserData({ name: e.target.value })} className={inputCls} />
          <input type="email" placeholder="E-mail" value={userData.email} onChange={e => setUserData({ email: e.target.value })} className={inputCls} />
          <input type="tel" placeholder="Telefone" value={userData.phone} onChange={e => setUserData({ phone: e.target.value })} className={inputCls} />
          <input type="password" placeholder="Senha (mín. 6 caracteres)" value={userData.password} onChange={e => setUserData({ password: e.target.value })} className={inputCls} />
          <button type="button" onClick={() => setAuthState('login-form')}
            className="text-sm text-[#888] hover:text-[#555] underline">
            ← Já tenho conta
          </button>
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button onClick={onBack} className="flex-1 py-4 border-2 border-[#E8E8E8] text-[#666] font-bold rounded-xl flex items-center justify-center gap-2 hover:border-[#CCC] transition-colors">
          <ChevronLeft size={18} /> Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex-[2] py-4 bg-[#F5B700] text-[#0A0A0A] font-black rounded-xl flex items-center justify-center gap-2 hover:bg-[#D9A300] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continuar <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 5: Payment ────────────────────────────────────────────────────────

function Step5Payment({ onSubmit, onBack, submitting }: { onSubmit: () => void; onBack: () => void; submitting: boolean }) {
  const { paymentMethod, setPaymentMethod, transferRef, setTransferRef, setProofFileUrl } = useCheckoutStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setUploading(true)
    try {
      const supabase = createClient()
      const { data, error } = await (supabase as any).storage.from('payment-proofs').upload(
        `${Date.now()}_${file.name}`, file, { upsert: true }
      )
      if (!error && data) {
        const { data: { publicUrl } } = (supabase as any).storage.from('payment-proofs').getPublicUrl(data.path)
        setProofFileUrl(publicUrl)
      }
    } catch { /* ignore upload errors — proof optional */ }
    setUploading(false)
  }

  const methods = [
    { id: 'pix',          icon: Smartphone, label: 'PIX',               desc: 'Pagamento instantâneo',   color: '#00B14F', bg: '#E6F9EE' },
    { id: 'card',         icon: CreditCard, label: 'Cartão',            desc: 'Visa, Mastercard, Amex',  color: '#2563EB', bg: '#EFF6FF' },
    { id: 'paypal',       icon: Globe,      label: 'PayPal',            desc: 'Pagamento internacional', color: '#003087', bg: '#EEF2FF' },
    { id: 'bic_transfer', icon: Building2,  label: 'Banco BIC',         desc: 'Transferência bancária',  color: '#E85D04', bg: '#FFF0E6' },
  ] as const

  return (
    <div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-2">Forma de pagamento</h2>
      <p className="text-[#888] text-sm mb-6">Escolha como deseja pagar.</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {methods.map(m => {
          const Icon = m.icon
          const active = paymentMethod === m.id
          return (
            <button
              key={m.id}
              onClick={() => setPaymentMethod(m.id as any)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                active ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#E8E8E8] bg-white hover:border-[#F5B700]/40'
              }`}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: m.bg }}>
                <Icon size={18} style={{ color: m.color }} />
              </div>
              <p className="text-sm font-bold text-[#0A0A0A]">{m.label}</p>
              <p className="text-xs text-[#888] mt-0.5">{m.desc}</p>
            </button>
          )
        })}
      </div>

      {/* BIC Transfer details */}
      {paymentMethod === 'bic_transfer' && (
        <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-5 mb-6 space-y-4">
          <p className="text-sm font-bold text-[#0A0A0A]">Dados para transferência:</p>
          <div className="rounded-xl overflow-hidden border border-[#E8E8E8] max-w-xs">
            <Image
              src="/cartão BIC.jpeg"
              alt="Cartão BIC para transferência"
              width={400}
              height={250}
              className="w-full h-auto object-cover"
              unoptimized
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-[#888]">Após efectuar a transferência, envie o comprovativo:</p>
            <input
              type="text"
              placeholder="Referência / Observação da transferência"
              value={transferRef}
              onChange={e => setTransferRef(e.target.value)}
              className="w-full border border-[#E8E8E8] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F5B700] transition-colors"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-[#E8E8E8] rounded-xl text-sm text-[#888] hover:border-[#F5B700] hover:text-[#F5B700] transition-all w-full justify-center"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {fileName || 'Carregar comprovativo (imagem/PDF)'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
      )}

      {/* PIX placeholder */}
      {paymentMethod === 'pix' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-800">
          Após confirmar, será gerado um QR Code PIX para pagamento imediato.
        </div>
      )}

      {/* Card placeholder */}
      {paymentMethod === 'card' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          Será redirecionado para o gateway seguro (Stripe/Mercado Pago) após confirmar.
        </div>
      )}

      {/* PayPal placeholder */}
      {paymentMethod === 'paypal' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
          Será redirecionado para o PayPal após confirmar.
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={submitting} className="flex-1 py-4 border-2 border-[#E8E8E8] text-[#666] font-bold rounded-xl flex items-center justify-center gap-2 hover:border-[#CCC] transition-colors disabled:opacity-40">
          <ChevronLeft size={18} /> Voltar
        </button>
        <button
          onClick={onSubmit}
          disabled={!paymentMethod || submitting}
          className="flex-[2] py-4 bg-[#F5B700] text-[#0A0A0A] font-black rounded-xl flex items-center justify-center gap-2 hover:bg-[#D9A300] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <><Loader2 size={16} className="animate-spin" /> A processar...</> : <><Lock size={16} /> Confirmar Pedido</>}
        </button>
      </div>
    </div>
  )
}

// ─── Step 6: Confirmation ───────────────────────────────────────────────────

function StepConfirmation({ orderId }: { orderId: string }) {
  const { items, billingCycle, domainName, paymentMethod, getTotal, clear } = useCheckoutStore()
  const router = useRouter()
  const isPending = paymentMethod === 'bic_transfer'

  useEffect(() => {
    const t = setTimeout(() => { clear(); router.push('/dashboard') }, 4000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish() {
    clear()
    router.push('/dashboard')
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
        {isPending
          ? <AlertCircle size={28} className="text-amber-500" />
          : <Check size={28} className="text-green-600" />}
      </div>
      <h2 className="text-2xl font-black text-[#0A0A0A] mb-2">
        {isPending ? 'Pedido aguardando validação' : 'Pedido confirmado!'}
      </h2>
      <p className="text-[#888] text-sm mb-6">
        {isPending
          ? 'Recebemos o seu pedido. Assim que confirmarmos a transferência, o serviço será activado.'
          : 'O seu serviço será activado em breve. Verifique o seu e-mail.'}
      </p>

      <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-5 text-left mb-6 space-y-3">
        <p className="text-xs font-black text-[#999] uppercase tracking-widest">Resumo</p>
        {items.map(i => (
          <div key={i.id} className="flex justify-between text-sm">
            <span className="text-[#0A0A0A]">{i.name}</span>
            <span className="font-bold">{fmtPrice(calcItemTotal(i, billingCycle))}</span>
          </div>
        ))}
        <div className="border-t border-[#E8E8E8] pt-3 flex justify-between text-sm font-bold">
          <span>Ciclo</span><span className="text-[#F5B700]">{BILLING_LABEL[billingCycle]}</span>
        </div>
        {domainName && (
          <div className="flex justify-between text-sm">
            <span className="text-[#888]">Domínio</span><span className="font-bold">{domainName}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-[#888]">Pagamento</span>
          <span className="font-bold capitalize">{paymentMethod?.replace('_', ' ')}</span>
        </div>
        <div className="flex justify-between font-black text-base border-t border-[#E8E8E8] pt-3">
          <span>Total pago</span><span className="text-[#F5B700]">{fmtPrice(getTotal())}</span>
        </div>
        {orderId && (
          <div className="flex justify-between text-xs text-[#AAA]">
            <span>Nº Pedido</span><span className="font-mono">{orderId.slice(0, 8).toUpperCase()}</span>
          </div>
        )}
      </div>

      {isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
          <strong>Status:</strong> Aguardando confirmação da transferência BIC. Entraremos em contacto assim que validarmos o pagamento.
        </div>
      )}

      <p className="text-xs text-[#AAA] mb-4">A redirecionar para o seu perfil em 4 segundos...</p>
      <button
        onClick={finish}
        className="w-full py-4 bg-[#0A0A0A] text-white font-black rounded-xl hover:bg-[#222] transition-colors"
      >
        Ir para o Dashboard agora
      </button>
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

function CheckoutContent() {
  const searchParams = useSearchParams()
  const {
    step, setStep, items, setItems, billingCycle,
    clear, getTotal,
  } = useCheckoutStore()
  const [orderId, setOrderId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const isDomainCheckout = items.length > 0 && items.every(i => i.type === 'domain')

  // Always load plan from URL — clears stale persisted state
  useEffect(() => {
    const planId = searchParams.get('plan')
    const domainParam = searchParams.get('domain')
    clear()
    if (planId) {
      const plan = PLAN_CATALOG[planId]
      if (plan) {
        const name = domainParam ? `Domínio ${domainParam}` : plan.name
        const isDomain = plan.type === 'domain'
        setItems([{ ...plan, name, quantity: 1 }])
        if (isDomain && domainParam) {
          // Pre-fill domain info so Step 3 is skipped
          useCheckoutStore.getState().setDomainName(domainParam)
          useCheckoutStore.getState().setDomainAction('register')
        }
      } else {
        setItems([{ id: planId, name: planId, type: 'other', price: 0, currency: 'AOA', quantity: 1 }])
      }
    }
    setStep(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('plan'), searchParams.get('domain')])

  async function handleSubmit() {
    const state = useCheckoutStore.getState()
    setSubmitting(true)
    try {
      const res = await fetch('/api/checkout/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items:          state.items,
          billingCycle:   state.billingCycle,
          domainName:     state.domainName,
          domainAction:   state.domainAction,
          paymentMethod:  state.paymentMethod,
          proofFileUrl:   state.proofFileUrl,
          transferRef:    state.transferRef,
          userData:       state.userData,
          amount:         state.getTotal(),
        }),
      })
      const data = await res.json()
      if (data.id) setOrderId(data.id)
      setDone(true)
    } catch {
      alert('Erro ao processar pedido. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {!done && <StepBar current={step} />}

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Main content */}
        <div className="flex-1 bg-white border border-[#E8E8E8] rounded-2xl p-6 shadow-sm">
          {done ? (
            <StepConfirmation orderId={orderId} />
          ) : (
            <>
              {step === 1 && <Step1Cycle onNext={() => setStep(2)} />}
              {step === 2 && <Step2Cart onNext={() => setStep(isDomainCheckout ? 4 : 3)} onBack={() => setStep(1)} />}
              {step === 3 && <Step3Domain onNext={() => setStep(4)} onBack={() => setStep(2)} />}
              {step === 4 && <Step4Ident onNext={() => setStep(5)} onBack={() => setStep(isDomainCheckout ? 2 : 3)} />}
              {step === 5 && <Step5Payment onSubmit={handleSubmit} onBack={() => setStep(4)} submitting={submitting} />}
            </>
          )}
        </div>

        {/* Sidebar summary — hidden when done */}
        {!done && (
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
            <OrderSummary items={items} cycle={billingCycle} />
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-black text-green-800 uppercase tracking-widest mb-2">Garantia</p>
              <p className="text-xs text-green-700">30 dias de garantia de satisfação. Sem perguntas.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-[#888]">Carregando checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
