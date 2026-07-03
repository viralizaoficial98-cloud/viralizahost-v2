'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Eye, EyeOff, Users, Crown } from 'lucide-react'
import { AdminPageShell, adminCard, adminInput, adminLabel, btnPrimary, btnSecondary } from '@/components/admin/AdminPageShell'

type TeamMember = {
  id: string; name: string; role: string | null; title: string | null; bio: string | null
  photo_url: string | null; flag: string | null; country: string | null
  accent_color: string; is_ceo: boolean; active: boolean; position: number
}

const empty: Omit<TeamMember, 'id' | 'position'> = {
  name: '', role: '', title: 'Especialista', bio: '', photo_url: '', flag: '🇦🇴',
  country: 'Angola', accent_color: '#6366F1', is_ceo: false, active: true,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={adminLabel}>{label}</label>{children}</div>
}

export default function TeamPage() {
  const supabase = createClient() as any
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<Omit<TeamMember, 'id' | 'position'>>(empty)
  const [saving, setSaving] = useState(false)

  const load = async () => { setLoading(true); const { data } = await supabase.from('site_team').select('*').order('is_ceo', { ascending: false }).order('position'); setMembers(data ?? []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew  = () => { setEditing(null); setForm(empty); setShowModal(true) }
  const openEdit = (m: TeamMember) => { setEditing(m); setForm({ name: m.name, role: m.role, title: m.title, bio: m.bio, photo_url: m.photo_url, flag: m.flag, country: m.country, accent_color: m.accent_color, is_ceo: m.is_ceo, active: m.active }); setShowModal(true) }
  const save     = async () => { setSaving(true); const payload = { ...form, photo_url: form.photo_url || null }; if (editing) { await supabase.from('site_team').update(payload).eq('id', editing.id) } else { const maxPos = members.reduce((m, x) => Math.max(m, x.position), -1); await supabase.from('site_team').insert({ ...payload, position: maxPos + 1 }) }; setSaving(false); setShowModal(false); load() }
  const remove   = async (id: string) => { if (!confirm('Apagar membro?')) return; await supabase.from('site_team').delete().eq('id', id); load() }
  const toggle   = async (m: TeamMember) => { await supabase.from('site_team').update({ active: !m.active }).eq('id', m.id); load() }

  return (
    <AdminPageShell title="Equipa" subtitle="Membros e estrutura organizacional"
      action={<button style={btnPrimary} onClick={openNew}><Plus size={15} /> Novo Membro</button>}>

      {!loading && members.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {members.map(m => (
            <div key={m.id} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
              <div className="p-5" style={{ borderBottom: `3px solid ${m.accent_color}` }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    {m.is_ceo && <Crown size={13} fill="#F5B700" style={{ color: '#F5B700' }} />}
                    <button onClick={() => toggle(m)} className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={m.active ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' } : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                      {m.active ? <Eye size={10} className="inline mr-1" /> : <EyeOff size={10} className="inline mr-1" />}{m.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#D9A300'; (e.currentTarget as any).style.background = 'rgba(245,183,0,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Pencil size={13} /></button>
                    <button onClick={() => remove(m.id)} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#DC2626'; (e.currentTarget as any).style.background = 'rgba(239,68,68,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="flex flex-col items-center text-center">
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.name} className="w-16 h-16 rounded-full object-cover object-top mb-3" style={{ border: `3px solid ${m.accent_color}40` }} />
                  ) : (
                    <div className="w-16 h-16 rounded-full mb-3 flex items-center justify-center font-black text-xl" style={{ background: `${m.accent_color}18`, color: m.accent_color, border: `3px solid ${m.accent_color}30` }}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mb-1">
                    {m.flag && <span className="text-base">{m.flag}</span>}
                    <span className="font-black text-sm" style={{ color: '#0B0B0D' }}>{m.name}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full mb-1" style={{ background: `${m.accent_color}12`, color: m.accent_color, border: `1px solid ${m.accent_color}25` }}>{m.title}</span>
                  {m.role && <p className="text-xs mt-1" style={{ color: '#64748B' }}>{m.role}</p>}
                  {m.country && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{m.country}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="p-10 text-center text-sm" style={{ color: '#94A3B8', ...adminCard }}>A carregar...</div>
      ) : (
        <div className="p-14 text-center" style={adminCard}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <Users size={24} style={{ color: '#7C3AED' }} />
          </div>
          <p className="font-semibold text-sm mb-4" style={{ color: '#0B0B0D' }}>Nenhum membro da equipa</p>
          <button style={btnPrimary} onClick={openNew}><Plus size={14} /> Novo Membro</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="font-black text-lg" style={{ color: '#0B0B0D' }}>{editing ? 'Editar Membro' : 'Novo Membro'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Avatar preview */}
              <div className="flex items-center gap-4 mb-2">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="" className="w-16 h-16 rounded-full object-cover object-top" style={{ border: `3px solid ${form.accent_color}40` }} onError={e => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl flex-shrink-0" style={{ background: `${form.accent_color}18`, color: form.accent_color, border: `3px solid ${form.accent_color}30` }}>
                    {form.name ? form.name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
                <Field label="URL da Foto">
                  <input style={adminInput} value={form.photo_url ?? ''} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} placeholder="/foto.jpg ou https://..." />
                </Field>
              </div>
              <Field label="Nome Completo"><input style={adminInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Manuel Muenho" /></Field>
              <Field label="Título (badge)"><input style={adminInput} value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ex: CEO & Fundador" /></Field>
              <Field label="Cargo / Área"><input style={adminInput} value={form.role ?? ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="ex: Tráfego Pago" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Flag (emoji)"><input style={adminInput} value={form.flag ?? ''} onChange={e => setForm(f => ({ ...f, flag: e.target.value }))} placeholder="🇦🇴" /></Field>
                <Field label="País"><input style={adminInput} value={form.country ?? ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Angola" /></Field>
              </div>
              <Field label="Bio"><textarea style={{ ...adminInput, resize: 'none' }} rows={3} value={form.bio ?? ''} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} /></Field>
              <Field label="Cor de Destaque">
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-10 rounded-lg cursor-pointer" style={{ border: '1px solid #E2E8F0' }} value={form.accent_color} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                  <input style={{ ...adminInput, flex: 1, width: 'auto' }} value={form.accent_color} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                </div>
              </Field>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_ceo} onChange={e => setForm(f => ({ ...f, is_ceo: e.target.checked }))} className="rounded" /><span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>CEO / Fundador</span></label>
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
