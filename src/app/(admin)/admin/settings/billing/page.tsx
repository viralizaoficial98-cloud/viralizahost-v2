'use client'
import { useEffect, useState } from 'react'
import { Building2, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

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

  useEffect(() => {
    fetch('/api/admin/billing-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.settings) setForm({ ...EMPTY, ...d.settings })
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof BillingSettings, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setStatus('idle')
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/admin/billing-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao guardar')
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

      {/* Bank */}
      <Section title="Dados Bancários">
        <Field label="Nome do Banco">
          <Input value={form.bank_name} onChange={v => set('bank_name', v)} />
        </Field>
        <Field label="Titular da Conta">
          <Input value={form.account_holder} onChange={v => set('account_holder', v)} />
        </Field>
        <Field label="Número de Conta">
          <Input value={form.account_number} onChange={v => set('account_number', v)} />
        </Field>
        <Field label="IBAN">
          <Input value={form.iban} onChange={v => set('iban', v)} placeholder="AO06..." />
        </Field>
        <Field label="SWIFT / BIC">
          <Input value={form.swift} onChange={v => set('swift', v)} />
        </Field>
        <Field label="Instruções de pagamento">
          <Textarea value={form.payment_instructions} onChange={v => set('payment_instructions', v)} rows={3} />
        </Field>
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-[#333] mb-1.5">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 border border-[#E0E0E0] rounded-xl text-sm text-[#0A0A0A] outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/10 transition-all"
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
