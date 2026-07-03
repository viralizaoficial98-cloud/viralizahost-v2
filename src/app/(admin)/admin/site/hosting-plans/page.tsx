'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Eye, EyeOff, Server, Star, ChevronUp, ChevronDown } from 'lucide-react'
import { AdminPageShell, adminCard, adminInput, adminLabel, btnPrimary, btnSecondary } from '@/components/admin/AdminPageShell'

type HostingPlan = {
  id: string; name: string; description: string | null; badge: string | null
  price_monthly: number | null; price_annual: number | null; discount_annual: number
  features: string[] | null; active: boolean; featured: boolean; position: number
}

const empty: Omit<HostingPlan, 'id' | 'position'> = {
  name: '', description: '', badge: '', price_monthly: null, price_annual: null,
  discount_annual: 0, features: [], active: true, featured: false,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={adminLabel}>{label}</label>{children}</div>
}

const PLAN_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#6366F1', '#A855F7']

export default function HostingPlansPage() {
  const supabase = createClient() as any
  const [plans, setPlans] = useState<HostingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<HostingPlan | null>(null)
  const [form, setForm] = useState<Omit<HostingPlan, 'id' | 'position'>>(empty)
  const [featuresText, setFeaturesText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => { setLoading(true); const { data } = await supabase.from('site_hosting_plans').select('*').order('position'); setPlans(data ?? []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew  = () => { setEditing(null); setForm(empty); setFeaturesText(''); setShowModal(true) }
  const openEdit = (p: HostingPlan) => { setEditing(p); setForm({ name: p.name, description: p.description, badge: p.badge, price_monthly: p.price_monthly, price_annual: p.price_annual, discount_annual: p.discount_annual, features: p.features, active: p.active, featured: p.featured }); setFeaturesText((p.features ?? []).join('\n')); setShowModal(true) }
  const save     = async () => { setSaving(true); const payload = { ...form, features: featuresText.split('\n').map(f => f.trim()).filter(Boolean) }; if (editing) { await supabase.from('site_hosting_plans').update(payload).eq('id', editing.id) } else { const maxPos = plans.reduce((m, p) => Math.max(m, p.position), -1); await supabase.from('site_hosting_plans').insert({ ...payload, position: maxPos + 1 }) }; setSaving(false); setShowModal(false); load() }
  const remove   = async (id: string) => { if (!confirm('Apagar plano?')) return; await supabase.from('site_hosting_plans').delete().eq('id', id); load() }
  const toggle   = async (p: HostingPlan) => { await supabase.from('site_hosting_plans').update({ active: !p.active }).eq('id', p.id); load() }
  const move     = async (p: HostingPlan, dir: -1 | 1) => { const idx = plans.findIndex(x => x.id === p.id); const si = idx + dir; if (si < 0 || si >= plans.length) return; const swap = plans[si]; await supabase.from('site_hosting_plans').update({ position: swap.position }).eq('id', p.id); await supabase.from('site_hosting_plans').update({ position: p.position }).eq('id', swap.id); load() }

  const planColor = (i: number) => PLAN_COLORS[i % PLAN_COLORS.length]

  return (
    <AdminPageShell title="Planos de Hospedagem" subtitle="Planos e preços de hosting"
      action={<button style={btnPrimary} onClick={openNew}><Plus size={15} /> Novo Plano</button>}>

      {!loading && plans.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((p, i) => {
            const color = planColor(i)
            return (
              <div key={p.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
                <div className="p-5" style={{ borderBottom: `3px solid ${color}` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                      <Server size={18} style={{ color }} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {p.featured && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }}><Star size={10} className="inline" /> Destaque</span>}
                      <button onClick={() => toggle(p)} className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={p.active ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' } : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                        {p.active ? <Eye size={10} className="inline mr-1" /> : <EyeOff size={10} className="inline mr-1" />}{p.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </div>
                  {p.badge && <span className="inline-block text-xs font-black px-2.5 py-0.5 rounded-full mb-2" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>{p.badge}</span>}
                  <h3 className="font-black text-base" style={{ color: '#0B0B0D' }}>{p.name}</h3>
                  {p.description && <p className="text-xs mt-0.5 mb-2" style={{ color: '#64748B' }}>{p.description}</p>}
                  <div className="text-2xl font-black mt-2" style={{ color }}>
                    {p.price_monthly != null ? `Kz ${p.price_monthly.toLocaleString()}` : '—'}
                    <span className="text-xs font-semibold" style={{ color: '#94A3B8' }}>/mês</span>
                  </div>
                  {p.price_annual != null && (
                    <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                      Anual: Kz {p.price_annual.toLocaleString()}
                      {p.discount_annual > 0 && <span className="ml-1 font-bold" style={{ color: '#059669' }}>(-{p.discount_annual}%)</span>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(p.features ?? []).slice(0, 4).map(f => (
                      <span key={f} className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${color}10`, color, border: `1px solid ${color}20` }}>{f}</span>
                    ))}
                    {(p.features ?? []).length > 4 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>+{(p.features ?? []).length - 4}</span>}
                  </div>
                </div>
                <div className="px-5 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => move(p, -1)} className="p-1 rounded" style={{ color: '#CBD5E1' }} onMouseEnter={e => (e.currentTarget as any).style.color = '#0B0B0D'} onMouseLeave={e => (e.currentTarget as any).style.color = '#CBD5E1'}><ChevronUp size={14} /></button>
                    <span className="text-xs font-mono font-bold w-5 text-center" style={{ color: '#64748B' }}>{p.position}</span>
                    <button onClick={() => move(p, 1)} className="p-1 rounded" style={{ color: '#CBD5E1' }} onMouseEnter={e => (e.currentTarget as any).style.color = '#0B0B0D'} onMouseLeave={e => (e.currentTarget as any).style.color = '#CBD5E1'}><ChevronDown size={14} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="p-2 rounded-lg" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#D9A300'; (e.currentTarget as any).style.background = 'rgba(245,183,0,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Pencil size={14} /></button>
                    <button onClick={() => remove(p.id)} className="p-2 rounded-lg" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#DC2626'; (e.currentTarget as any).style.background = 'rgba(239,68,68,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : loading ? (
        <div className="p-10 text-center text-sm" style={{ color: '#94A3B8', ...adminCard }}>A carregar...</div>
      ) : (
        <div className="p-14 text-center" style={adminCard}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <Server size={24} style={{ color: '#DC2626' }} />
          </div>
          <p className="font-semibold text-sm mb-4" style={{ color: '#0B0B0D' }}>Nenhum plano de hospedagem criado</p>
          <button style={btnPrimary} onClick={openNew}><Plus size={14} /> Novo Plano</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="font-black text-lg" style={{ color: '#0B0B0D' }}>{editing ? 'Editar Plano' : 'Novo Plano de Hospedagem'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Nome do Plano"><input style={adminInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Business Pro" /></Field>
              <Field label="Descrição"><input style={adminInput} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="ex: Ideal para empresas" /></Field>
              <Field label="Badge"><input style={adminInput} value={form.badge ?? ''} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} placeholder="ex: MAIS POPULAR" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço Mensal (Kz)"><input type="number" style={adminInput} value={form.price_monthly ?? ''} onChange={e => setForm(f => ({ ...f, price_monthly: e.target.value ? Number(e.target.value) : null }))} placeholder="0" /></Field>
                <Field label="Preço Anual (Kz)"><input type="number" style={adminInput} value={form.price_annual ?? ''} onChange={e => setForm(f => ({ ...f, price_annual: e.target.value ? Number(e.target.value) : null }))} placeholder="Opcional" /></Field>
              </div>
              <Field label="Desconto Anual (%)"><input type="number" style={adminInput} value={form.discount_annual} onChange={e => setForm(f => ({ ...f, discount_annual: Number(e.target.value) || 0 }))} placeholder="0" /></Field>
              <Field label="Features (uma por linha)"><textarea style={{ ...adminInput, resize: 'none' }} rows={5} value={featuresText} onChange={e => setFeaturesText(e.target.value)} placeholder="10 GB SSD&#10;5 Contas Email&#10;SSL Grátis&#10;Backup Diário" /></Field>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} className="rounded" /><span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Destaque</span></label>
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
