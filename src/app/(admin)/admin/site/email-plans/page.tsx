'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Eye, EyeOff, Mail, Star } from 'lucide-react'
import { AdminPageShell, adminCard, adminInput, adminLabel, btnPrimary, btnSecondary } from '@/components/admin/AdminPageShell'

type EmailPlan = {
  id: string; name: string; price_monthly: number; price_annual: number | null
  currency: string; storage_gb: number; accounts: number; features: string[] | null
  popular: boolean; active: boolean; position: number; color: string | null
}

const empty: Omit<EmailPlan, 'id' | 'position'> = {
  name: '', price_monthly: 0, price_annual: null, currency: 'AOA', storage_gb: 5,
  accounts: 1, features: [], popular: false, active: true, color: '#10B981',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={adminLabel}>{label}</label>{children}</div>
}

export default function EmailPlansPage() {
  const supabase = createClient() as any
  const [plans, setPlans] = useState<EmailPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EmailPlan | null>(null)
  const [form, setForm] = useState<Omit<EmailPlan, 'id' | 'position'>>(empty)
  const [featuresText, setFeaturesText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => { setLoading(true); const { data } = await supabase.from('site_email_plans').select('*').order('position'); setPlans(data ?? []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew  = () => { setEditing(null); setForm(empty); setFeaturesText(''); setShowModal(true) }
  const openEdit = (p: EmailPlan) => { setEditing(p); setForm({ name: p.name, price_monthly: p.price_monthly, price_annual: p.price_annual, currency: p.currency, storage_gb: p.storage_gb, accounts: p.accounts, features: p.features, popular: p.popular, active: p.active, color: p.color }); setFeaturesText((p.features ?? []).join('\n')); setShowModal(true) }
  const save     = async () => { setSaving(true); const payload = { ...form, features: featuresText.split('\n').map(f => f.trim()).filter(Boolean) }; if (editing) { await supabase.from('site_email_plans').update(payload).eq('id', editing.id) } else { const maxPos = plans.reduce((m, p) => Math.max(m, p.position), -1); await supabase.from('site_email_plans').insert({ ...payload, position: maxPos + 1 }) }; setSaving(false); setShowModal(false); load() }
  const remove   = async (id: string) => { if (!confirm('Apagar plano?')) return; await supabase.from('site_email_plans').delete().eq('id', id); load() }
  const toggle   = async (p: EmailPlan) => { await supabase.from('site_email_plans').update({ active: !p.active }).eq('id', p.id); load() }

  return (
    <AdminPageShell title="Planos de Email" subtitle="Planos de email corporativo do site"
      action={<button style={btnPrimary} onClick={openNew}><Plus size={15} /> Novo Plano</button>}>

      {/* Cards view */}
      {!loading && plans.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map(p => (
            <div key={p.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
              <div className="p-5" style={{ borderBottom: `3px solid ${p.color ?? '#10B981'}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${p.color ?? '#10B981'}15`, border: `1px solid ${p.color ?? '#10B981'}30` }}>
                    <Mail size={18} style={{ color: p.color ?? '#10B981' }} />
                  </div>
                  <div className="flex items-center gap-2">
                    {p.popular && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }}><Star size={10} className="inline" /> Popular</span>}
                    <button onClick={() => toggle(p)} className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={p.active ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' } : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                      {p.active ? <Eye size={10} className="inline mr-1" /> : <EyeOff size={10} className="inline mr-1" />}{p.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                </div>
                <h3 className="font-black text-base" style={{ color: '#0B0B0D' }}>{p.name}</h3>
                <div className="text-2xl font-black mt-1" style={{ color: p.color ?? '#10B981' }}>
                  {p.currency === 'AOA' ? `Kz ${p.price_monthly.toLocaleString()}` : p.currency === 'USD' ? `$ ${p.price_monthly}` : `R$ ${p.price_monthly}`}
                  <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>/mês</span>
                </div>
                <div className="flex gap-3 mt-3 text-xs font-semibold" style={{ color: '#64748B' }}>
                  <span>{p.storage_gb} GB</span><span>·</span><span>{p.accounts} conta{p.accounts !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(p.features ?? []).slice(0, 3).map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${p.color ?? '#10B981'}12`, color: p.color ?? '#10B981', border: `1px solid ${p.color ?? '#10B981'}25` }}>{f}</span>
                  ))}
                </div>
              </div>
              <div className="px-5 py-3 flex items-center justify-end gap-2">
                <button onClick={() => openEdit(p)} className="p-2 rounded-lg" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#D9A300'; (e.currentTarget as any).style.background = 'rgba(245,183,0,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Pencil size={14} /></button>
                <button onClick={() => remove(p.id)} className="p-2 rounded-lg" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#DC2626'; (e.currentTarget as any).style.background = 'rgba(239,68,68,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="p-10 text-center text-sm" style={{ color: '#94A3B8', ...adminCard }}>A carregar...</div>
      ) : (
        <div className="p-14 text-center" style={adminCard}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <Mail size={24} style={{ color: '#059669' }} />
          </div>
          <p className="font-semibold text-sm mb-4" style={{ color: '#0B0B0D' }}>Nenhum plano de email criado</p>
          <button style={btnPrimary} onClick={openNew}><Plus size={14} /> Novo Plano</button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="font-black text-lg" style={{ color: '#0B0B0D' }}>{editing ? 'Editar Plano' : 'Novo Plano de Email'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Nome do Plano"><input style={adminInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Business Pro" /></Field>
              <Field label="Moeda"><select style={adminInput} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}><option value="AOA">AOA — Kwanza</option><option value="USD">USD — Dólar</option><option value="BRL">BRL — Real</option></select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço Mensal"><input type="number" style={adminInput} value={form.price_monthly} onChange={e => setForm(f => ({ ...f, price_monthly: Number(e.target.value) }))} /></Field>
                <Field label="Preço Anual"><input type="number" style={adminInput} value={form.price_annual ?? ''} onChange={e => setForm(f => ({ ...f, price_annual: e.target.value ? Number(e.target.value) : null }))} placeholder="Opcional" /></Field>
                <Field label="Armazenamento (GB)"><input type="number" style={adminInput} value={form.storage_gb} onChange={e => setForm(f => ({ ...f, storage_gb: Number(e.target.value) }))} /></Field>
                <Field label="Nº de Contas"><input type="number" style={adminInput} value={form.accounts} onChange={e => setForm(f => ({ ...f, accounts: Number(e.target.value) }))} /></Field>
              </div>
              <Field label="Cor do Plano">
                <div className="flex items-center gap-2"><input type="color" className="h-9 w-10 rounded-lg cursor-pointer" style={{ border: '1px solid #E2E8F0' }} value={form.color ?? '#10B981'} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} /><input style={{ ...adminInput, flex: 1, width: 'auto' }} value={form.color ?? '#10B981'} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} /></div>
              </Field>
              <Field label="Features (uma por linha)"><textarea style={{ ...adminInput, resize: 'none' }} rows={4} value={featuresText} onChange={e => setFeaturesText(e.target.value)} placeholder="Anti-spam avançado&#10;Backup diário&#10;SSL incluído" /></Field>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.popular} onChange={e => setForm(f => ({ ...f, popular: e.target.checked }))} className="rounded" /><span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Popular</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" /><span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Ativo</span></label>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid #F1F5F9' }}>
              <button style={btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
              <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? 'A guardar...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
