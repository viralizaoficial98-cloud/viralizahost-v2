'use client'
import { useEffect, useRef, useState } from 'react'
import { Building2, Save, Loader2, CheckCircle, AlertCircle, ImagePlus, Trash2, X } from 'lucide-react'
import { BankTransferCard } from '@/components/billing/BankTransferCard'
import type { BankDetails } from '@/lib/billing/bank-details'

interface BillingSettings {
  id?: string
  company_name: string
  email: string
  website: string
  phone: string
  address: string
  bank_name: string
  account_holder: string
  account_number: string
  iban: string
  swift: string
  payment_instructions: string
  footer_text: string
  default_due_days: number
  tax_rate: number
  tax_label: string
  email_subject_template: string
  email_body_template: string
  auto_email_on_create: boolean
}

const EMPTY: BillingSettings = {
  company_name: 'ViralizaHost',
  email: 'comercial@viralizahost.com',
  website: 'viralizahost.com',
  phone: '',
  address: '',
  bank_name: '',
  account_holder: '',
  account_number: '',
  iban: '',
  swift: '',
  payment_instructions: 'Após efectuar a transferência, envie o comprovativo para comercial@viralizahost.com indicando o número da factura.',
  footer_text: 'ViralizaHost — Hospedagem Web, Domínios e E-mails Corporativos\nE-mail: comercial@viralizahost.com | viralizahost.com | Suporte 24/7',
  default_due_days: 7,
  tax_rate: 0,
  tax_label: 'IVA',
  email_subject_template: 'Factura ViralizaHost nº {invoice_number} — {service_name}',
  email_body_template: '',
  auto_email_on_create: false,
}

export default function BillingSettingsPage() {
  const [form, setForm] = useState<BillingSettings>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErr, setFieldErr] = useState<{ field: string; message: string } | null>(null)
  const [bankCheck, setBankCheck] = useState<{ valid: boolean; message: string | null } | null>(null)
  // Imagem do cartão: a actual (guardada) e a escolhida (pré-visualização, ainda não guardada)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)
  const [imgBusy, setImgBusy] = useState(false)
  const [imgMsg, setImgMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/billing-settings', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.settings) setForm(f => ({ ...f, ...Object.fromEntries(Object.entries(d.settings).filter(([, v]) => v !== null)) }))
        setBankCheck(d?.bankCheck ?? null); setImageUrl(d?.cardImageUrl ?? null)
      })
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url) }, [pending])

  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp']
  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setImgMsg(null)
    if (!ACCEPT.includes(f.type)) { setImgMsg({ ok: false, text: 'Formato não aceite: use PNG, JPEG ou WebP.' }); return }
    if (f.size > 2 * 1024 * 1024) { setImgMsg({ ok: false, text: 'Imagem demasiado grande (máx. 2 MB).' }); return }
    setPending({ file: f, url: URL.createObjectURL(f) })
  }
  const saveImage = async () => {
    if (!pending) return
    setImgBusy(true); setImgMsg(null)
    try {
      const fd = new FormData(); fd.append('file', pending.file)
      const res = await fetch('/api/admin/billing-settings/bank-card-image', { method: 'POST', body: fd })
      const j = await res.json()
      if (!res.ok) { setImgMsg({ ok: false, text: j.error ?? 'Falha ao guardar a imagem. A imagem anterior mantém-se.' }); return }
      setImageUrl(j.cardImageUrl); setPending(null); setImgMsg({ ok: true, text: 'Imagem guardada.' })
    } catch { setImgMsg({ ok: false, text: 'Falha de rede. A imagem anterior mantém-se.' }) } finally { setImgBusy(false) }
  }
  const removeImage = async () => {
    if (!window.confirm('Remover a imagem do cartão? Os dados bancários continuam visíveis no site.')) return
    setImgBusy(true); setImgMsg(null)
    try {
      const res = await fetch('/api/admin/billing-settings/bank-card-image', { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok) { setImgMsg({ ok: false, text: j.error ?? 'Falha ao remover.' }); return }
      setImageUrl(null); setImgMsg({ ok: true, text: 'Imagem removida.' })
    } finally { setImgBusy(false) }
  }
  const preview: BankDetails = {
    bank: form.bank_name || 'Banco', holder: form.account_holder || 'Titular da conta', iban: form.iban || null,
    accountNumber: form.iban ? null : form.account_number || null, swift: form.swift || null, instructions: null,
    cardImageUrl: pending?.url ?? imageUrl, source: 'settings',
  }

  const set = (key: keyof BillingSettings, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setStatus('idle')
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus('idle'); setFieldErr(null)
    try {
      const res = await fetch('/api/admin/billing-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { if (data.field) setFieldErr({ field: data.field, message: data.error }); throw new Error(data.error ?? 'Erro ao guardar') }
      if (data.settings) setForm(f => ({ ...f, ...Object.fromEntries(Object.entries(data.settings).filter(([, v]) => v !== null)) }))
      setBankCheck(data.bankCheck ?? null)
      setStatus('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro desconhecido')
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#F5B700]" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Building2 className="text-[#F5B700]" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A]">Dados de Facturação</h1>
          <p className="text-sm text-gray-500">Empresa, banco e templates de e-mail para facturas</p>
        </div>
      </div>

      {status === 'success' && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
          <CheckCircle size={18} /> <span>Definições guardadas com sucesso.</span>
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle size={18} /> <span>{errorMsg}</span>
        </div>
      )}

      {/* Company info */}
      <Section title="Informações da Empresa">
        <Field label="Nome da empresa" required>
          <Input value={form.company_name} onChange={v => set('company_name', v)} />
        </Field>
        <Field label="E-mail de contacto" required>
          <Input type="email" value={form.email} onChange={v => set('email', v)} />
        </Field>
        <Field label="Website">
          <Input value={form.website} onChange={v => set('website', v)} />
        </Field>
        <Field label="Telefone">
          <Input value={form.phone} onChange={v => set('phone', v)} />
        </Field>
        <Field label="Morada">
          <Textarea value={form.address} onChange={v => set('address', v)} rows={2} />
        </Field>
      </Section>

      {/* Transferência bancária */}
      <Section title="Transferência bancária">
        <p className="text-xs text-gray-500 -mt-1">Dados mostrados no checkout, na página da encomenda, na Área do Cliente e nas facturas novas (as facturas já emitidas mantêm os dados com que foram emitidas).</p>
        {bankCheck && !bankCheck.valid && bankCheck.message && (
          <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900" role="alert" data-testid="iban-warning">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{bankCheck.message}</span>
          </div>
        )}
        <Field label="Nome do banco">
          <Input value={form.bank_name} onChange={v => set('bank_name', v)} testid="bank-name" />
        </Field>
        <Field label="Titular da conta (entidade)" required error={fieldErr?.field === 'account_holder' ? fieldErr.message : undefined}>
          <Input value={form.account_holder} onChange={v => set('account_holder', v)} testid="bank-holder" />
        </Field>
        <Field label="IBAN" required error={fieldErr?.field === 'iban' ? fieldErr.message : undefined}
          hint="Como aparece no extracto, com o código do país (ex.: AO06 …). Pode usar espaços; os zeros iniciais são mantidos. O número não é completado automaticamente.">
          <Input value={form.iban} onChange={v => set('iban', v)} placeholder="AO06 0000 0000 0000 0000 0000 0" testid="bank-iban" mono />
        </Field>
        {form.account_number && <p className="text-xs text-gray-500" data-testid="legacy-account">N.º de conta antigo guardado: <span className="font-mono">{form.account_number}</span> (só é usado se não houver IBAN).</p>}
        <Field label="SWIFT / BIC">
          <Input value={form.swift} onChange={v => set('swift', v)} />
        </Field>
        <Field label="Instruções de pagamento">
          <Textarea value={form.payment_instructions} onChange={v => set('payment_instructions', v)} rows={3} />
        </Field>

        <div className="border-t border-[#F0F0F0] pt-4" data-testid="card-image-section">
          <p className="text-sm font-medium text-[#333] mb-1">Imagem do cartão (opcional)</p>
          <p className="text-xs text-gray-500 mb-3">Imagem <strong>decorativa</strong> mostrada por trás dos dados. Não use imagens com número de cartão, validade ou CVV. PNG, JPEG ou WebP até 2 MB. Sem imagem, o cartão usa o fundo vermelho; os dados bancários aparecem sempre em texto.</p>
          <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="max-w-md" data-testid="card-preview">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">{pending ? 'Pré-visualização (ainda não guardada)' : 'Como aparece no site'}</p>
              <BankTransferCard bank={preview} />
            </div>
            <div className="flex sm:flex-col gap-2 flex-wrap">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={choose} data-testid="card-image-input" />
              {pending ? (
                <>
                  <button type="button" onClick={saveImage} disabled={imgBusy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#F5B700] text-black disabled:opacity-50" data-testid="card-image-save">{imgBusy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar imagem</button>
                  <button type="button" onClick={() => setPending(null)} disabled={imgBusy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E0E0E0]" data-testid="card-image-cancel"><X size={14} /> Cancelar</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={imgBusy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E0E0E0]" data-testid="card-image-choose"><ImagePlus size={14} /> {imageUrl ? 'Substituir imagem' : 'Carregar imagem'}</button>
                  {imageUrl && <button type="button" onClick={removeImage} disabled={imgBusy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-red-200 text-red-700" data-testid="card-image-remove"><Trash2 size={14} /> Remover imagem</button>}
                </>
              )}
            </div>
          </div>
          {imgMsg && <p className={`text-sm mt-2 ${imgMsg.ok ? 'text-green-700' : 'text-red-700'}`} role="status" data-testid="card-image-msg">{imgMsg.text}</p>}
        </div>
      </Section>

      {/* Invoice defaults */}
      <Section title="Configurações de Factura">
        <Field label="Prazo de pagamento (dias)">
          <Input
            type="number"
            value={String(form.default_due_days)}
            onChange={v => set('default_due_days', parseInt(v) || 7)}
          />
        </Field>
        <Field label="Imposto aplicado no checkout (%) — 0 = sem imposto">
          <Input type="number" value={String(form.tax_rate)} onChange={v => set('tax_rate', Math.min(100, Math.max(0, Number(v) || 0)))} />
        </Field>
        <Field label="Nome do imposto">
          <Input value={form.tax_label} onChange={v => set('tax_label', v)} />
        </Field>
        <Field label="Rodapé da factura PDF">
          <Textarea value={form.footer_text} onChange={v => set('footer_text', v)} rows={2} />
        </Field>
      </Section>

      {/* Email templates */}
      <Section title="Templates de E-mail">
        <p className="text-xs text-gray-400 mb-3">
          Variáveis disponíveis: <code className="bg-gray-100 px-1 rounded">{'{invoice_number}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{service_name}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{client_name}'}</code>
        </p>
        <Field label="Assunto do e-mail">
          <Input value={form.email_subject_template} onChange={v => set('email_subject_template', v)} />
        </Field>
        <Field label="Corpo do e-mail (opcional)">
          <Textarea value={form.email_body_template} onChange={v => set('email_body_template', v)} rows={4} placeholder="Deixar em branco para usar texto predefinido..." />
        </Field>
        <Field label="">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.auto_email_on_create}
              onChange={e => set('auto_email_on_create', e.target.checked)}
              className="w-4 h-4 accent-[#F5B700]"
            />
            <span className="text-sm text-[#333]">Enviar factura automaticamente por e-mail ao criar</span>
          </label>
        </Field>
      </Section>

      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#F5B700] hover:bg-[#E0A800] disabled:opacity-50 text-black font-bold px-6 py-3 rounded-xl transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar Alterações
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-4">
      <h2 className="font-bold text-[#0A0A0A] text-base border-b border-[#F0F0F0] pb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-[#333] mb-1.5">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-700 mt-1 font-semibold" role="alert" data-testid="field-error">{error}</p>}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, testid, mono }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; testid?: string; mono?: boolean
}) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testid}
      className={`${mono ? 'font-mono ' : ''}w-full px-3.5 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#0A0A0A] outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/10 transition-all`}
    />
  )
}

function Textarea({ value, onChange, rows = 3, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#0A0A0A] outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/10 transition-all resize-none"
    />
  )
}
