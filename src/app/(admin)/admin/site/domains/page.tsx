'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Eye, EyeOff, Globe, Star } from 'lucide-react'
import { AdminPageShell, adminCard, adminInput, adminLabel, btnPrimary, btnSecondary, thStyle } from '@/components/admin/AdminPageShell'

type Domain = {
  id: string; extension: string; price_monthly: number | null; price_annual: number | null
  currency: string; popular: boolean; active: boolean; position: number
}

const empty: Omit<Domain, 'id' | 'position'> = { extension: '', price_monthly: null, price_annual: null, currency: 'AKZ', popular: false, active: true }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={adminLabel}>{label}</label>{children}</div>
}

const currencyMap: Record<string, string> = { AOA: 'Kz', AKZ: 'Kz', USD: '$', BRL: 'R$', EUR: '€' }

export default function DomainsAdminPage() {
  const supabase = createClient() as any
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Domain | null>(null)
  const [form, setForm] = useState<Omit<Domain, 'id' | 'position'>>(empty)
  const [saving, setSaving] = useState(false)

  const load = async () => { setLoading(true); const { data } = await supabase.from('site_domains').select('*').order('position'); setDomains(data ?? []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew  = () => { setEditing(null); setForm(empty); setShowModal(true) }
  const openEdit = (d: Domain) => { setEditing(d); setForm({ extension: d.extension, price_monthly: d.price_monthly, price_annual: d.price_annual, currency: d.currency, popular: d.popular, active: d.active }); setShowModal(true) }
  const save     = async () => { setSaving(true); if (editing) { await supabase.from('site_domains').update(form).eq('id', editing.id) } else { const maxPos = domains.reduce((m, d) => Math.max(m, d.position), -1); await supabase.from('site_domains').insert({ ...form, position: maxPos + 1 }) }; setSaving(false); setShowModal(false); load() }
  const remove   = async (id: string) => { if (!confirm('Apagar?')) return; await supabase.from('site_domains').delete().eq('id', id); load() }
  const toggle   = async (d: Domain) => { await supabase.from('site_domains').update({ active: !d.active }).eq('id', d.id); load() }

  const sym = currencyMap[form.currency] ?? form.currency

  return (
    <AdminPageShell title="Domínios" subtitle="Extensões e preços de registo de domínios"
      action={<button style={btnPrimary} onClick={openNew}><Plus size={15} /> Nova Extensão</button>}>

      <div style={adminCard}>
        {loading ? <div className="p-10 text-center text-sm" style={{ color: '#94A3B8' }}>A carregar...</div>
        : domains.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <Globe size={24} style={{ color: '#2563EB' }} />
            </div>
            <p className="font-semibold text-sm mb-4" style={{ color: '#0B0B0D' }}>Nenhuma extensão de domínio criada</p>
            <button style={btnPrimary} onClick={openNew}><Plus size={14} /> Nova Extensão</button>
          </div>
        ) : (
          <table className="w-full">
            <thead><tr>{['Extensão', 'Preço Mensal', 'Preço Anual', 'Moeda', 'Popular', 'Estado', 'Ações'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {domains.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < domains.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm px-2.5 py-1 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)', color: '#2563EB', border: '1px solid rgba(59,130,246,0.15)' }}>{d.extension}</span>
                      {d.popular && <Star size={12} fill="#F5B700" style={{ color: '#F5B700' }} />}
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#0B0B0D', fontWeight: 600 }}>{d.price_monthly != null ? `${currencyMap[d.currency] ?? d.currency} ${d.price_monthly.toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '14px 20px', color: '#0B0B0D', fontWeight: 600 }}>{d.price_annual != null ? `${currencyMap[d.currency] ?? d.currency} ${d.price_annual.toLocaleString()}` : '—'}</td>
                  <td style={{ padding: '14px 20px' }}><span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>{d.currency}</span></td>
                  <td style={{ padding: '14px 20px' }}>
                    {d.popular ? <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }}>⭐ Popular</span> : <span style={{ color: '#CBD5E1', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button onClick={() => toggle(d)} className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full"
                      style={d.active ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' } : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                      {d.active ? <Eye size={11} /> : <EyeOff size={11} />} {d.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(d)} className="p-2 rounded-lg" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#D9A300'; (e.currentTarget as any).style.background = 'rgba(245,183,0,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Pencil size={14} /></button>
                      <button onClick={() => remove(d.id)} className="p-2 rounded-lg" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#DC2626'; (e.currentTarget as any).style.background = 'rgba(239,68,68,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="font-black text-lg" style={{ color: '#0B0B0D' }}>{editing ? 'Editar Extensão' : 'Nova Extensão'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Extensão (ex: .com, .ao)"><input style={adminInput} value={form.extension} onChange={e => setForm(f => ({ ...f, extension: e.target.value }))} placeholder=".com" /></Field>
              <Field label="Moeda">
                <select style={adminInput} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="AKZ">AKZ — Kwanza (Kz)</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="BRL">BRL — Real</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`Preço Mensal (${sym})`}><input type="number" style={adminInput} value={form.price_monthly ?? ''} onChange={e => setForm(f => ({ ...f, price_monthly: e.target.value ? Number(e.target.value) : null }))} placeholder="0" /></Field>
                <Field label={`Preço Anual (${sym})`}><input type="number" style={adminInput} value={form.price_annual ?? ''} onChange={e => setForm(f => ({ ...f, price_annual: e.target.value ? Number(e.target.value) : null }))} placeholder="0" /></Field>
              </div>
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
