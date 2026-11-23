'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, CheckCircle2, Loader2 } from 'lucide-react'
import { COUNTRIES, FIELD_LABEL, REQUIRED_FIELDS, type CustomerData, type CustomerField } from '@/lib/commerce/customer-fields'
import { PurchaseSteps, btnGhost, btnPrimary, card, input, label } from './shared'

// Cliente com sessão e dados obrigatórios em falta: mostra o que já está guardado e pede só o que
// falta. Sem e-mail nem senha (a identidade é a da sessão). Com ?editar=1, permite rever todos os campos.

export function CustomerStep({ verified, editAll = false }: { verified: boolean; editAll?: boolean }) {
  const router = useRouter()
  const [c, setC] = useState<{ email: string; data: CustomerData; missing: CustomerField[] } | null>(null)
  const [loadError, setLoadError] = useState('')
  const [values, setValues] = useState<Partial<Record<CustomerField, string>>>({})
  const [errors, setErrors] = useState<Partial<Record<CustomerField, string>>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/checkout/customer', { cache: 'no-store' }).then(async r => {
      const j = await r.json()
      if (r.status === 401) { router.replace('/checkout/conta'); return }
      if (!r.ok) throw new Error(j.error)
      if (!j.missing.length && !editAll) { router.replace('/carrinho/finalizar'); return }
      setC(j)
      const fields: CustomerField[] = editAll ? Object.keys(FIELD_LABEL) as CustomerField[] : j.missing
      setValues(Object.fromEntries(fields.map(f => [f, j.data[f] || (f === 'country' ? 'AO' : '')])))
    }).catch(() => setLoadError('Não foi possível carregar os seus dados. Recarregue a página.'))
  }, [router, editAll])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/checkout/customer', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const j = await r.json()
      if (!r.ok) { setErrors(j.errors ?? {}); setError(j.error ?? 'Não foi possível guardar.'); return }
      router.push('/carrinho/finalizar')
    } catch { setError('Sem ligação. Verifique a internet e tente novamente.') } finally { setBusy(false) }
  }

  if (loadError) return <div className={card} role="alert"><p className="text-sm text-red-700">{loadError}</p></div>
  if (!c) return <div className="flex justify-center py-16" role="status"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  const fields: CustomerField[] = editAll ? Object.keys(FIELD_LABEL) as CustomerField[] : c.missing
  const saved = editAll ? [] : (Object.keys(FIELD_LABEL) as CustomerField[]).filter(f => !c.missing.includes(f) && c.data[f])

  return (
    <div className="max-w-3xl mx-auto">
      <PurchaseSteps current="Dados" />
      {verified && <p className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800 flex gap-2" role="status"><CheckCircle2 size={16} className="shrink-0 mt-0.5" /> E-mail confirmado. A sua compra continua com o mesmo carrinho.</p>}
      <div className={card}>
        <h1 className="text-2xl font-black text-[#0A0A0A] mb-1">Dados do cliente</h1>
        <p className="text-sm text-[#666] mb-5">{editAll ? 'Reveja os dados do titular do domínio e da factura.' : 'Faltam alguns dados do titular para registar o domínio e emitir a factura.'}</p>
        <div className="p-4 rounded-xl bg-[#F8F8F8] text-sm mb-6" data-testid="customer-saved">
          <p className="text-[#555]">Sessão iniciada como <strong className="text-[#0A0A0A]" data-testid="customer-email">{c.email}</strong></p>
          {saved.length > 0 && (
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3">
              {saved.map(f => <div key={f} className="flex gap-2"><dt className="text-[#888]">{FIELD_LABEL[f]}:</dt><dd className="font-semibold text-[#0A0A0A] flex items-center gap-1">{f === 'country' ? COUNTRIES[c.data[f]] ?? c.data[f] : c.data[f]} <Check size={13} className="text-green-600" /></dd></div>)}
            </dl>
          )}
        </div>
        <form onSubmit={save} noValidate className="grid sm:grid-cols-2 gap-4" data-testid="customer-form">
          {fields.map(f => (
            <label key={f} className={`${label} ${f === 'address' || f === 'full_name' ? 'sm:col-span-2' : ''}`} htmlFor={`c-${f}`}>{FIELD_LABEL[f]}{REQUIRED_FIELDS.includes(f) ? ' *' : ' (opcional)'}
              {f === 'country' ? (
                <select id={`c-${f}`} className={`${input} mt-1`} value={values[f] ?? 'AO'} onChange={e => setValues({ ...values, [f]: e.target.value })}>
                  {Object.entries(COUNTRIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              ) : (
                <input id={`c-${f}`} name={f} className={`${input} mt-1 ${errors[f] ? 'border-red-400' : ''}`} value={values[f] ?? ''} aria-invalid={!!errors[f]}
                  type={f === 'phone' ? 'tel' : 'text'} autoComplete={f === 'phone' ? 'tel' : f === 'address' ? 'street-address' : f === 'city' ? 'address-level2' : f === 'full_name' ? 'name' : undefined}
                  placeholder={f === 'phone' ? '+244 923 000 000' : undefined}
                  onChange={e => { setValues({ ...values, [f]: e.target.value }); setErrors({ ...errors, [f]: '' }) }} data-testid={`customer-${f}`} />
              )}
              {errors[f] && <span className="block text-xs font-normal text-red-700 mt-1">{errors[f]}</span>}
            </label>
          ))}
          {error && <p className="sm:col-span-2 text-sm text-red-700 flex gap-1.5" role="alert"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}</p>}
          <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
            <Link href="/carrinho" className={btnGhost}>Voltar ao carrinho</Link>
            <button className={btnPrimary} disabled={busy} data-testid="customer-submit">{busy ? <Loader2 size={16} className="animate-spin" /> : null} Guardar e continuar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
