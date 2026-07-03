'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Image as ImageIcon } from 'lucide-react'
import { AdminPageShell, adminCard, adminInput, adminLabel, btnPrimary, btnSecondary, thStyle } from '@/components/admin/AdminPageShell'

type Banner = {
  id: string; position: number; active: boolean
  bg_image: string | null; bg_color: string | null; accent_color: string | null
  tag: string | null; title: string | null; subtitle: string | null
  cta_text: string | null; cta_href: string | null
  cta_secondary_text: string | null; cta_secondary_href: string | null
  features: string[] | null
}

const empty: Omit<Banner, 'id' | 'position'> = {
  active: true, bg_image: '', bg_color: '#000000', accent_color: '#F5B700',
  tag: '', title: '', subtitle: '', cta_text: '', cta_href: '#',
  cta_secondary_text: '', cta_secondary_href: '#', features: [],
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={adminLabel}>{label}</label>{children}</div>
}

export default function BannersPage() {
  const supabase = createClient() as any
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [form, setForm] = useState<Omit<Banner, 'id' | 'position'>>(empty)
  const [featuresText, setFeaturesText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('site_banners').select('*').order('position')
    setBanners(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(empty); setFeaturesText(''); setShowModal(true) }
  const openEdit = (b: Banner) => {
    setEditing(b)
    setForm({ active: b.active, bg_image: b.bg_image ?? '', bg_color: b.bg_color ?? '#000000', accent_color: b.accent_color ?? '#F5B700', tag: b.tag ?? '', title: b.title ?? '', subtitle: b.subtitle ?? '', cta_text: b.cta_text ?? '', cta_href: b.cta_href ?? '#', cta_secondary_text: b.cta_secondary_text ?? '', cta_secondary_href: b.cta_secondary_href ?? '#', features: b.features ?? [] })
    setFeaturesText((b.features ?? []).join('\n'))
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = { ...form, features: featuresText.split('\n').map(f => f.trim()).filter(Boolean) }
    if (editing) { await supabase.from('site_banners').update(payload).eq('id', editing.id) }
    else { const maxPos = banners.reduce((m, b) => Math.max(m, b.position), -1); await supabase.from('site_banners').insert({ ...payload, position: maxPos + 1 }) }
    setSaving(false); setShowModal(false); load()
  }

  const remove    = async (id: string) => { if (!confirm('Apagar este banner?')) return; await supabase.from('site_banners').delete().eq('id', id); load() }
  const toggle    = async (b: Banner) => { await supabase.from('site_banners').update({ active: !b.active }).eq('id', b.id); load() }
  const move      = async (b: Banner, dir: -1 | 1) => {
    const sorted = [...banners]; const idx = sorted.findIndex(x => x.id === b.id); const si = idx + dir
    if (si < 0 || si >= sorted.length) return
    const swap = sorted[si]
    await supabase.from('site_banners').update({ position: swap.position }).eq('id', b.id)
    await supabase.from('site_banners').update({ position: b.position }).eq('id', swap.id)
    load()
  }

  return (
    <AdminPageShell title="Banners / Hero" subtitle="Slides do carrossel principal do site"
      action={<button style={btnPrimary} onClick={openNew}><Plus size={15} /> Novo Banner</button>}>

      <div style={adminCard}>
        {loading ? (
          <div className="p-10 text-center text-sm" style={{ color: '#94A3B8' }}>A carregar...</div>
        ) : banners.length === 0 ? (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.08)', border: '1px solid rgba(245,183,0,0.20)' }}>
              <ImageIcon size={24} style={{ color: '#D9A300' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhum banner criado</p>
            <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>Crie o primeiro banner para o carrossel do site</p>
            <button style={btnPrimary} onClick={openNew}><Plus size={14} /> Novo Banner</button>
          </div>
        ) : (
          <table className="w-full">
            <thead><tr>
              {['Pos.', 'Preview', 'Título / Tag', 'Estado', 'Ações'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {banners.map((b, i) => (
                <tr key={b.id} style={{ borderBottom: i < banners.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => move(b, -1)} className="p-1 rounded transition-colors" style={{ color: '#CBD5E1' }} onMouseEnter={e => (e.currentTarget as any).style.color = '#0B0B0D'} onMouseLeave={e => (e.currentTarget as any).style.color = '#CBD5E1'}><ChevronUp size={13} /></button>
                      <span className="text-xs font-mono font-bold w-5 text-center" style={{ color: '#64748B' }}>{b.position}</span>
                      <button onClick={() => move(b, 1)} className="p-1 rounded transition-colors" style={{ color: '#CBD5E1' }} onMouseEnter={e => (e.currentTarget as any).style.color = '#0B0B0D'} onMouseLeave={e => (e.currentTarget as any).style.color = '#CBD5E1'}><ChevronDown size={13} /></button>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {b.bg_image ? (
                      <img src={b.bg_image} alt="" className="h-10 w-20 object-cover rounded-lg" style={{ border: '1px solid #E2E8F0' }} />
                    ) : (
                      <div className="h-10 w-20 rounded-lg" style={{ background: b.bg_color ?? '#000', border: '1px solid #E2E8F0' }} />
                    )}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>{b.title || <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>sem título</span>}</div>
                    {b.tag && <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${b.accent_color ?? '#F5B700'}18`, color: b.accent_color ?? '#D9A300' }}>{b.tag}</span>}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button onClick={() => toggle(b)} className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full transition-all"
                      style={b.active ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' } : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                      {b.active ? <Eye size={11} /> : <EyeOff size={11} />}
                      {b.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(b)} className="p-2 rounded-lg transition-all" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#D9A300'; (e.currentTarget as any).style.background = 'rgba(245,183,0,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Pencil size={14} /></button>
                      <button onClick={() => remove(b.id)} className="p-2 rounded-lg transition-all" style={{ color: '#94A3B8', background: '#F8FAFC' }} onMouseEnter={e => { (e.currentTarget as any).style.color = '#DC2626'; (e.currentTarget as any).style.background = 'rgba(239,68,68,0.08)' }} onMouseLeave={e => { (e.currentTarget as any).style.color = '#94A3B8'; (e.currentTarget as any).style.background = '#F8FAFC' }}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="font-black text-lg" style={{ color: '#0B0B0D' }}>{editing ? 'Editar Banner' : 'Novo Banner'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Field label="Tag"><input style={adminInput} value={form.tag ?? ''} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} placeholder="ex: Inteligência Artificial" /></Field>
              <Field label="Título"><textarea style={{ ...adminInput, resize: 'none' }} rows={2} value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título do banner" /></Field>
              <Field label="Subtítulo"><textarea style={{ ...adminInput, resize: 'none' }} rows={2} value={form.subtitle ?? ''} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CTA Principal"><input style={adminInput} value={form.cta_text ?? ''} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))} placeholder="Texto botão" /></Field>
                <Field label="Link CTA"><input style={adminInput} value={form.cta_href ?? ''} onChange={e => setForm(f => ({ ...f, cta_href: e.target.value }))} placeholder="#servicos" /></Field>
                <Field label="CTA Secundário"><input style={adminInput} value={form.cta_secondary_text ?? ''} onChange={e => setForm(f => ({ ...f, cta_secondary_text: e.target.value }))} placeholder="Saiba Mais" /></Field>
                <Field label="Link Secundário"><input style={adminInput} value={form.cta_secondary_href ?? ''} onChange={e => setForm(f => ({ ...f, cta_secondary_href: e.target.value }))} placeholder="#" /></Field>
              </div>
              <Field label="URL da Imagem de Fundo"><input style={adminInput} value={form.bg_image ?? ''} onChange={e => setForm(f => ({ ...f, bg_image: e.target.value }))} placeholder="/banner.png ou https://..." /></Field>
              {form.bg_image && <img src={form.bg_image} alt="preview" className="w-full h-28 object-cover rounded-xl" style={{ border: '1px solid #E2E8F0' }} onError={e => (e.currentTarget.style.display = 'none')} />}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cor de Fundo">
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-10 rounded-lg cursor-pointer" style={{ border: '1px solid #E2E8F0' }} value={form.bg_color ?? '#000000'} onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))} />
                    <input style={{ ...adminInput, width: 'auto', flex: 1 }} value={form.bg_color ?? '#000000'} onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))} />
                  </div>
                </Field>
                <Field label="Cor de Destaque">
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-10 rounded-lg cursor-pointer" style={{ border: '1px solid #E2E8F0' }} value={form.accent_color ?? '#F5B700'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                    <input style={{ ...adminInput, width: 'auto', flex: 1 }} value={form.accent_color ?? '#F5B700'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                  </div>
                </Field>
              </div>
              <Field label="Features (uma por linha)"><textarea style={{ ...adminInput, resize: 'none' }} rows={3} value={featuresText} onChange={e => setFeaturesText(e.target.value)} placeholder="Chatbots Inteligentes&#10;Automação de Processos" /></Field>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                <span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Ativo (visível no site)</span>
              </label>
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
