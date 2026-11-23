'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, AlertTriangle } from 'lucide-react'
import { flushCart } from '@/store/cartSync'
import { COUNTRIES, FIELD_LABEL } from '@/lib/commerce/customer-fields'
import { PurchaseSteps, btnGhost, btnPrimary, card, input, label } from './shared'

// Visitante sem sessão: cadastro (com os dados do titular) ou «Já tenho conta».
// O carrinho fica guardado no servidor: depois de confirmar o e-mail (se for obrigatório)
// e de iniciar sessão, a compra continua com os mesmos itens.

type Errors = Record<string, string>
const EMPTY = { full_name: '', email: '', phone: '', country: 'AO', address: '', city: '', state: '', company_name: '', tax_id: '', password: '', confirm: '' }

function Field({ name, value, onChange, error, type = 'text', autoComplete, required, placeholder, children }: {
  name: string; value: string; onChange: (v: string) => void; error?: string; type?: string; autoComplete?: string; required?: boolean; placeholder?: string; children?: React.ReactNode
}) {
  const id = `f-${name}`
  return (
    <label className={label} htmlFor={id}>{name === 'email' ? 'E-mail' : name === 'password' ? 'Senha' : name === 'confirm' ? 'Confirmar senha' : FIELD_LABEL[name as keyof typeof FIELD_LABEL]}{required ? ' *' : ' (opcional)'}
      {children ?? <input id={id} name={name} type={type} autoComplete={autoComplete} placeholder={placeholder} className={`${input} mt-1 ${error ? 'border-red-400' : ''}`} value={value} onChange={e => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} />}
      {error && <span id={`${id}-e`} className="block text-xs font-normal text-red-700 mt-1">{error}</span>}
    </label>
  )
}

export function AccountStep() {
  const router = useRouter()
  const [tab, setTab] = useState<'register' | 'login'>('register')
  const [f, setF] = useState(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ email: string; ok: boolean } | null>(null)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [unverified, setUnverified] = useState(false)
  const set = (k: keyof typeof EMPTY) => (v: string) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })) }

  const register = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (f.password !== f.confirm) { setErrors({ confirm: 'As senhas não coincidem.' }); return }
    setBusy(true)
    try {
      await flushCart()
      const { confirm: _c, ...body } = f // eslint-disable-line @typescript-eslint/no-unused-vars
      const r = await fetch('/api/checkout/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) {
        setErrors(j.errors ?? {}); setError(j.error ?? 'Não foi possível criar a conta.')
        if (j.code === 'email_exists') setLogin(l => ({ ...l, email: f.email }))
        return
      }
      if (j.verify) { setSent({ email: j.email, ok: j.emailSent !== false }); window.scrollTo({ top: 0 }); return }
      router.push(j.next ?? '/carrinho/finalizar')
      router.refresh()
    } catch { setError('Sem ligação. Verifique a internet e tente novamente.') } finally { setBusy(false) }
  }

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setLoginError(''); setUnverified(false)
    try {
      await flushCart()
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        const m = j.error?.message
        setUnverified(m === 'Email not confirmed')
        setLoginError(m === 'Invalid login credentials' ? 'E-mail ou senha incorrectos.' : m === 'Email not confirmed' ? 'Confirme o seu e-mail antes de entrar: abra o link que enviámos.' : m === 'User is banned' ? 'O acesso desta conta está suspenso. Contacte o suporte.' : r.status === 429 ? 'Demasiadas tentativas. Aguarde alguns minutos.' : (m ?? 'Não foi possível iniciar sessão.'))
        return
      }
      router.push('/carrinho/finalizar')
      router.refresh()
    } catch { setLoginError('Sem ligação. Verifique a internet e tente novamente.') } finally { setBusy(false) }
  }

  if (sent) {
    return (
      <div className={`${card} max-w-xl mx-auto text-center`} data-testid="account-verify">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 ${sent.ok ? 'bg-green-50' : 'bg-amber-50'}`}>
          {sent.ok ? <Mail size={26} className="text-green-600" /> : <AlertTriangle size={26} className="text-amber-600" />}
        </div>
        <h1 className="text-2xl font-black text-[#0A0A0A] mb-2">Confirme o seu e-mail</h1>
        {sent.ok
          ? <p className="text-sm text-[#555] mb-3">Enviámos um link de confirmação para <strong>{sent.email}</strong> (válido durante 24 horas). Verifique também a pasta de spam.</p>
          : <p className="text-sm text-amber-800 mb-3">A conta foi criada, mas não conseguimos enviar o e-mail para <strong>{sent.email}</strong>. Peça um novo envio abaixo.</p>}
        <p className="text-sm text-[#555] mb-6" data-testid="account-cart-kept"><CheckCircle2 size={15} className="inline text-green-600 mr-1" />O seu carrinho fica guardado. Ao abrir o link, a sessão é iniciada e voltamos a esta compra para concluir o pagamento.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-2">
          <Link href={`/verificar-email?email=${encodeURIComponent(sent.email)}`} className={btnGhost}>Reenviar e-mail</Link>
          <button className={btnPrimary} onClick={() => { setSent(null); setTab('login'); setLogin({ email: sent.email, password: '' }) }}>Já confirmei — iniciar sessão</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PurchaseSteps current="Dados" />
      <div className={card}>
        <h1 className="text-2xl font-black text-[#0A0A0A] mb-1">{tab === 'register' ? 'Criar conta' : 'Iniciar sessão'}</h1>
        <p className="text-sm text-[#666] mb-5">Para concluir a compra precisamos de uma conta ViralizaHost. O carrinho mantém-se.</p>
        <div className="inline-flex gap-1 bg-[#F5F5F5] rounded-xl p-1 mb-6" role="tablist" aria-label="Conta">
          <button role="tab" aria-selected={tab === 'register'} onClick={() => setTab('register')} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'register' ? 'bg-white shadow-sm text-[#0A0A0A]' : 'text-[#666]'}`} data-testid="tab-register">Criar conta</button>
          <button role="tab" aria-selected={tab === 'login'} onClick={() => setTab('login')} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'login' ? 'bg-white shadow-sm text-[#0A0A0A]' : 'text-[#666]'}`} data-testid="tab-login">Já tenho conta</button>
        </div>

        {tab === 'register' ? (
          <form onSubmit={register} noValidate className="grid sm:grid-cols-2 gap-4" data-testid="register-form">
            <div className="sm:col-span-2"><Field name="full_name" required autoComplete="name" value={f.full_name} onChange={set('full_name')} error={errors.full_name} /></div>
            <Field name="email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} error={errors.email} />
            <Field name="phone" type="tel" required autoComplete="tel" placeholder="+244 923 000 000" value={f.phone} onChange={set('phone')} error={errors.phone} />
            <div className="sm:col-span-2"><Field name="address" required autoComplete="street-address" value={f.address} onChange={set('address')} error={errors.address} /></div>
            <Field name="city" required autoComplete="address-level2" value={f.city} onChange={set('city')} error={errors.city} />
            <Field name="state" autoComplete="address-level1" value={f.state} onChange={set('state')} error={errors.state} />
            <Field name="country" required value={f.country} onChange={set('country')} error={errors.country}>
              <select id="f-country" className={`${input} mt-1`} value={f.country} onChange={e => set('country')(e.target.value)}>
                {Object.entries(COUNTRIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field name="company_name" autoComplete="organization" value={f.company_name} onChange={set('company_name')} error={errors.company_name} />
            <Field name="tax_id" value={f.tax_id} onChange={set('tax_id')} error={errors.tax_id} />
            <div className="hidden sm:block" />
            <Field name="password" type="password" required autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={f.password} onChange={set('password')} error={errors.password} />
            <Field name="confirm" type="password" required autoComplete="new-password" value={f.confirm} onChange={set('confirm')} error={errors.confirm} />
            {error && <p className="sm:col-span-2 text-sm text-red-700 flex gap-1.5" role="alert" data-testid="register-error"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}</p>}
            <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
              <Link href="/carrinho" className={btnGhost}>Voltar ao carrinho</Link>
              <button className={btnPrimary} disabled={busy} data-testid="register-submit">{busy ? <Loader2 size={16} className="animate-spin" /> : null} Criar conta e continuar</button>
            </div>
            <p className="sm:col-span-2 text-xs text-[#888]">Ao criar a conta aceita os <Link href="/terms" className="underline" target="_blank">Termos de Serviço</Link> e a <Link href="/privacy" className="underline" target="_blank">Política de Privacidade</Link>.</p>
          </form>
        ) : (
          <form onSubmit={doLogin} className="space-y-4 max-w-md" data-testid="login-form">
            <label className={label} htmlFor="l-email">E-mail
              <input id="l-email" type="email" autoComplete="email" required className={`${input} mt-1`} value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} />
            </label>
            <label className={label} htmlFor="l-pass">Senha
              <input id="l-pass" type="password" autoComplete="current-password" required className={`${input} mt-1`} value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} />
            </label>
            {loginError && (
              <p className="text-sm text-red-700" role="alert" data-testid="login-error">{loginError}
                {unverified && <Link href={`/verificar-email?email=${encodeURIComponent(login.email)}`} className="block mt-1 underline">Reenviar e-mail de verificação</Link>}
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <Link href="/forgot-password" className="text-xs text-[#888] underline">Esqueci a senha</Link>
              <button className={btnPrimary} disabled={busy} data-testid="login-submit">{busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Entrar e continuar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
