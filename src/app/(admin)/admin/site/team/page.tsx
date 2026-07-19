'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Eye, EyeOff, Users, Crown, Upload, X, Link as LinkIcon, Loader2 } from 'lucide-react'
import { AdminPageShell, adminCard, adminInput, adminLabel, btnPrimary, btnSecondary } from '@/components/admin/AdminPageShell'

type TeamMember = {
  id: string; name: string; role: string | null; title: string | null; bio: string | null
  photo_url: string | null; flag: string | null; country: string | null
  country_code: string | null; specialty: string | null
  secondary_flag: string | null; secondary_country_code: string | null; secondary_country_name: string | null
  accent_color: string; is_ceo: boolean; active: boolean; position: number
}

const COUNTRIES = [
  { code: 'AO', name: 'Angola',      flag: '🇦🇴' },
  { code: 'BR', name: 'Brasil',      flag: '🇧🇷' },
  { code: 'PT', name: 'Portugal',    flag: '🇵🇹' },
  { code: 'US', name: 'EUA',         flag: '🇺🇸' },
  { code: 'MZ', name: 'Moçambique',  flag: '🇲🇿' },
  { code: 'CV', name: 'Cabo Verde',  flag: '🇨🇻' },
  { code: 'ST', name: 'São Tomé',    flag: '🇸🇹' },
  { code: 'GW', name: 'Guiné-Bissau',flag: '🇬🇼' },
]

function countryByCode(code: string | null) {
  return COUNTRIES.find(c => c.code === code) ?? null
}

const empty: Omit<TeamMember, 'id' | 'position'> = {
  name: '', role: '', title: 'Especialista', bio: '', photo_url: '',
  flag: '🇦🇴', country: 'Angola', country_code: 'AO',
  specialty: '',
  secondary_flag: null, secondary_country_code: null, secondary_country_name: null,
  accent_color: '#3B82F6', is_ceo: false, active: true,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={adminLabel}>{label}</label>{children}</div>
}

function CountrySelect({ value, onChange, label }: {
  value: string | null; onChange: (code: string, name: string, flag: string) => void; label: string
}) {
  return (
    <div>
      <label style={adminLabel}>{label}</label>
      <select
        style={{ ...adminInput, paddingLeft: 12 }}
        value={value ?? ''}
        onChange={e => {
          const c = countryByCode(e.target.value)
          if (c) onChange(c.code, c.name, c.flag)
        }}
      >
        <option value="">— Selecionar —</option>
        {COUNTRIES.map(c => (
          <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>
        ))}
      </select>
    </div>
  )
}

export default function TeamPage() {
  const supabase = createClient() as any
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<Omit<TeamMember, 'id' | 'position'>>(empty)
  const [saving, setSaving] = useState(false)

  const [photoMode, setPhotoMode] = useState<'upload' | 'url'>('upload')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingStoragePath, setPendingStoragePath] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('site_team').select('*').order('is_ceo', { ascending: false }).order('position')
    setMembers(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm(empty)
    setPhotoMode('upload')
    setPendingStoragePath(null)
    setUploadError(null)
    setShowModal(true)
  }

  const openEdit = (m: TeamMember) => {
    setEditing(m)
    setForm({
      name: m.name, role: m.role, title: m.title, bio: m.bio, photo_url: m.photo_url,
      flag: m.flag, country: m.country, country_code: m.country_code,
      specialty: m.specialty,
      secondary_flag: m.secondary_flag, secondary_country_code: m.secondary_country_code,
      secondary_country_name: m.secondary_country_name,
      accent_color: m.accent_color, is_ceo: m.is_ceo, active: m.active,
    })
    setPhotoMode(m.photo_url && m.photo_url.includes('/storage/') ? 'upload' : 'url')
    setPendingStoragePath(null)
    setUploadError(null)
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = { ...form, photo_url: form.photo_url || null }
    if (editing) {
      await supabase.from('site_team').update(payload).eq('id', editing.id)
    } else {
      const maxPos = members.reduce((m, x) => Math.max(m, x.position), -1)
      await supabase.from('site_team').insert({ ...payload, position: maxPos + 1 })
    }
    setPendingStoragePath(null)
    setSaving(false)
    setShowModal(false)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar membro?')) return
    await supabase.from('site_team').delete().eq('id', id)
    load()
  }

  const toggle = async (m: TeamMember) => {
    await supabase.from('site_team').update({ active: !m.active }).eq('id', m.id)
    load()
  }

  const closeModal = async () => {
    if (pendingStoragePath) {
      await fetch('/api/admin/storage/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: pendingStoragePath }),
      }).catch(() => {})
      setPendingStoragePath(null)
    }
    setShowModal(false)
  }

  const handleFileUpload = async (file: File) => {
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/storage/team', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro no upload')
      if (pendingStoragePath) {
        await fetch('/api/admin/storage/team', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storagePath: pendingStoragePath }),
        }).catch(() => {})
      }
      setPendingStoragePath(json.storagePath)
      setForm(f => ({ ...f, photo_url: json.publicUrl }))
    } catch (err: any) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async () => {
    if (pendingStoragePath) {
      await fetch('/api/admin/storage/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath: pendingStoragePath }),
      }).catch(() => {})
      setPendingStoragePath(null)
    }
    setForm(f => ({ ...f, photo_url: '' }))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  const primaryFlag = form.flag ?? ''
  const secondaryFlag = form.secondary_flag ?? ''

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
                    <img src={m.photo_url} alt={m.name} className="w-16 h-16 rounded-full object-cover object-top mb-3" style={{ border: `3px solid ${m.accent_color}40` }} onError={e => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <div className="w-16 h-16 rounded-full mb-3 flex items-center justify-center font-black text-xl" style={{ background: `${m.accent_color}18`, color: m.accent_color, border: `3px solid ${m.accent_color}30` }}>
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mb-1">
                    {m.flag && <span className="text-base">{m.flag}</span>}
                    {m.is_ceo && m.secondary_flag && <span className="text-base">{m.secondary_flag}</span>}
                    <span className="font-black text-sm" style={{ color: '#0B0B0D' }}>{m.name}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full mb-1" style={{ background: `${m.accent_color}12`, color: m.accent_color, border: `1px solid ${m.accent_color}25` }}>{m.title}</span>
                  {(m.specialty || m.role) && <p className="text-xs mt-1" style={{ color: '#64748B' }}>{m.specialty ?? m.role}</p>}
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
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <Users size={24} style={{ color: '#3B82F6' }} />
          </div>
          <p className="font-semibold text-sm mb-4" style={{ color: '#0B0B0D' }}>Nenhum membro da equipa</p>
          <button style={btnPrimary} onClick={openNew}><Plus size={14} /> Novo Membro</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="font-black text-lg" style={{ color: '#0B0B0D' }}>{editing ? 'Editar Membro' : 'Novo Membro'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* Photo */}
              <div>
                <label style={adminLabel}>Foto</label>
                <div className="flex gap-1 mb-3 p-1 rounded-xl" style={{ background: '#F1F5F9' }}>
                  <button type="button" onClick={() => setPhotoMode('upload')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={photoMode === 'upload' ? { background: '#fff', color: '#0B0B0D', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: '#94A3B8' }}>
                    <Upload size={12} /> Carregar imagem
                  </button>
                  <button type="button" onClick={() => setPhotoMode('url')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={photoMode === 'url' ? { background: '#fff', color: '#0B0B0D', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: '#94A3B8' }}>
                    <LinkIcon size={12} /> Usar URL
                  </button>
                </div>
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    {form.photo_url ? (
                      <>
                        <img src={form.photo_url} alt="" className="w-16 h-16 rounded-full object-cover object-top"
                          style={{ border: `3px solid ${form.accent_color}40` }} onError={e => { e.currentTarget.style.display = 'none' }} />
                        <button type="button" onClick={removePhoto}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: '#EF4444', color: '#fff' }}>
                          <X size={10} />
                        </button>
                      </>
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center font-black text-xl"
                        style={{ background: `${form.accent_color}18`, color: form.accent_color, border: `3px solid ${form.accent_color}30` }}>
                        {form.name ? form.name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {photoMode === 'upload' ? (
                      <>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
                        <div className="rounded-xl border-2 border-dashed text-center py-4 px-3 cursor-pointer transition-all"
                          style={{ borderColor: dragOver ? '#3B82F6' : '#E2E8F0', background: dragOver ? 'rgba(59,130,246,0.04)' : '#FAFAFA' }}
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={onDrop}>
                          {uploading ? (
                            <div className="flex items-center justify-center gap-2 text-xs" style={{ color: '#3B82F6' }}>
                              <Loader2 size={14} className="animate-spin" /> A carregar...
                            </div>
                          ) : (
                            <>
                              <Upload size={16} className="mx-auto mb-1" style={{ color: '#94A3B8' }} />
                              <p className="text-xs font-semibold" style={{ color: '#64748B' }}>Clique ou arraste a foto</p>
                              <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>JPG, PNG ou WEBP · máx. 5 MB</p>
                            </>
                          )}
                        </div>
                        {uploadError && <p className="text-xs mt-1.5 font-medium" style={{ color: '#EF4444' }}>{uploadError}</p>}
                      </>
                    ) : (
                      <input style={adminInput} value={form.photo_url ?? ''}
                        onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                        placeholder="/foto.jpg ou https://..." />
                    )}
                  </div>
                </div>
              </div>

              <Field label="Nome Completo">
                <input style={adminInput} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Manuel Muenho" />
              </Field>
              <Field label="Título (badge)">
                <input style={adminInput} value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ex: CEO & FUNDADOR" />
              </Field>
              <Field label="Especialidade / Área">
                <input style={adminInput} value={form.specialty ?? ''} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} placeholder="ex: Tráfego Pago" />
              </Field>
              <Field label="Cargo (role)">
                <input style={adminInput} value={form.role ?? ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="ex: Especialista em Meta Ads" />
              </Field>
              <Field label="Descrição / Bio">
                <textarea style={{ ...adminInput, resize: 'none' }} rows={3} value={form.bio ?? ''}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
              </Field>

              {/* Country selector */}
              <CountrySelect
                label="País Principal"
                value={form.country_code}
                onChange={(code, name, flag) => setForm(f => ({ ...f, country_code: code, country: name, flag }))}
              />
              {/* Preview */}
              {form.country_code && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#64748B' }}>
                  <span className="text-lg">{primaryFlag}</span>
                  <span>{form.country} ({form.country_code})</span>
                </div>
              )}

              {/* Secondary country — CEO only */}
              {form.is_ceo && (
                <>
                  <CountrySelect
                    label="Segundo País (CEO)"
                    value={form.secondary_country_code}
                    onChange={(code, name, flag) => setForm(f => ({ ...f, secondary_country_code: code, secondary_country_name: name, secondary_flag: flag }))}
                  />
                  {form.secondary_country_code && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#64748B' }}>
                      <span className="text-lg">{secondaryFlag}</span>
                      <span>{form.secondary_country_name} ({form.secondary_country_code})</span>
                    </div>
                  )}
                </>
              )}

              <Field label="Cor de Destaque">
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-10 rounded-lg cursor-pointer" style={{ border: '1px solid #E2E8F0' }}
                    value={form.accent_color} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                  <input style={{ ...adminInput, flex: 1, width: 'auto' }} value={form.accent_color}
                    onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                </div>
              </Field>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_ceo} onChange={e => setForm(f => ({ ...f, is_ceo: e.target.checked }))} className="rounded" />
                  <span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>CEO / Fundador</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                  <span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Ativo</span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid #F1F5F9' }}>
              <button style={btnSecondary} onClick={closeModal}>Cancelar</button>
              <button style={{ ...btnPrimary, opacity: saving || uploading ? 0.6 : 1 }} onClick={save} disabled={saving || uploading}>
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
