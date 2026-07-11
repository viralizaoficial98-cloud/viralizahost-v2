'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Eye, EyeOff, Image as ImageIcon, Upload, X, Loader2, CheckCircle, AlertCircle, Link2,
} from 'lucide-react'
import {
  AdminPageShell, adminCard, adminInput, adminLabel,
  btnPrimary, btnSecondary, thStyle,
} from '@/components/admin/AdminPageShell'

/* ─── Types ─────────────────────────────────────────────────────────── */
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

/* ─── Resolve public URL from any bg_image value ────────────────────── */
function resolveBannerImageUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const s = value.trim()
  if (!s) return null
  // Absolute URL (storage or external)
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  // Relative to /public
  if (s.startsWith('/')) return s
  return null
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'success'; url: string; name: string }
  | { status: 'error'; message: string }

const BUCKET = 'site-banners'
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

/* ─── ImageUploadArea ────────────────────────────────────────────────── */
function ImageUploadArea({
  currentUrl,
  onUrlChange,
}: {
  currentUrl: string | null
  onUrlChange: (url: string) => void
}) {
  const supabase = createClient() as any
  const fileRef = useRef<HTMLInputElement>(null)
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlDraft, setUrlDraft] = useState(currentUrl ?? '')

  const resolved = resolveBannerImageUrl(currentUrl)

  const handleFile = useCallback(async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      setUpload({ status: 'error', message: 'Formato não suportado. Use PNG, JPG, JPEG ou WEBP.' })
      return
    }
    if (file.size > MAX_BYTES) {
      setUpload({ status: 'error', message: `Ficheiro muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.` })
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    setUpload({ status: 'uploading', progress: 0 })

    // Supabase JS v2 does not expose upload progress natively; simulate incremental
    const ticker = setInterval(() => {
      setUpload(prev => prev.status === 'uploading'
        ? { status: 'uploading', progress: Math.min((prev as any).progress + 12, 85) }
        : prev
      )
    }, 200)

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type,
    })

    clearInterval(ticker)

    if (error) {
      setUpload({ status: 'error', message: `Erro no upload: ${error.message}` })
      return
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const publicUrl: string = urlData?.publicUrl ?? ''

    setUpload({ status: 'success', url: publicUrl, name: file.name })
    onUrlChange(publicUrl)
  }, [supabase, onUrlChange])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const removeImage = () => { onUrlChange(''); setUpload({ status: 'idle' }) }

  return (
    <div className="space-y-3">
      <label style={adminLabel}>Imagem de Fundo</label>

      {/* Current preview */}
      {resolved && (
        <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
          <img
            src={resolved}
            alt="Preview do banner"
            className="w-full h-36 object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.60)', color: '#fff' }}
            title="Remover imagem"
          >
            <X size={14} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 text-xs" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
            {resolved.startsWith('http') ? 'Supabase Storage' : 'Ficheiro local /public'}
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={e => { e.preventDefault(); setDragging(false) }}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className="relative flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragging ? '#F5B700' : '#E2E8F0'}`,
          background: dragging ? 'rgba(245,183,0,0.04)' : '#FAFAFA',
          padding: '20px 16px',
          minHeight: 100,
        }}
      >
        <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="sr-only" onChange={onInputChange} />

        {upload.status === 'uploading' ? (
          <>
            <Loader2 size={24} className="animate-spin" style={{ color: '#F5B700' }} />
            <div className="w-full max-w-xs rounded-full h-1.5" style={{ background: '#E2E8F0' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${upload.progress}%`, background: '#F5B700' }} />
            </div>
            <span className="text-xs" style={{ color: '#94A3B8' }}>A enviar… {upload.progress}%</span>
          </>
        ) : upload.status === 'success' ? (
          <>
            <CheckCircle size={22} style={{ color: '#10B981' }} />
            <span className="text-xs font-semibold" style={{ color: '#10B981' }}>Upload concluído</span>
            <span className="text-xs" style={{ color: '#94A3B8' }}>{upload.name}</span>
          </>
        ) : (
          <>
            <Upload size={22} style={{ color: '#94A3B8' }} />
            <span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>
              {resolved ? 'Substituir imagem' : 'Selecionar imagem'}
            </span>
            <span className="text-xs text-center" style={{ color: '#94A3B8' }}>
              Arraste aqui ou clique para selecionar<br />PNG, JPG, WEBP · Máx. 10 MB · Recomendado: 1920×800
            </span>
          </>
        )}
      </div>

      {/* Upload error */}
      {upload.status === 'error' && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)', color: '#DC2626' }}>
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {upload.message}
        </div>
      )}

      {/* URL fallback toggle */}
      <button
        type="button"
        onClick={() => setShowUrlInput(v => !v)}
        className="flex items-center gap-1.5 text-xs transition-colors"
        style={{ color: '#94A3B8' }}
      >
        <Link2 size={12} />
        {showUrlInput ? 'Ocultar URL manual' : 'Inserir URL manualmente (avançado)'}
      </button>

      {showUrlInput && (
        <div className="space-y-1.5">
          <input
            style={adminInput}
            value={urlDraft}
            placeholder="/banner.png ou https://…"
            onChange={e => setUrlDraft(e.target.value)}
            onBlur={() => onUrlChange(urlDraft)}
          />
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Use apenas caminhos de ficheiros em <code>/public</code> ou URLs do Supabase Storage.
          </p>
        </div>
      )}
    </div>
  )
}

/* ─── Field ─────────────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={adminLabel}>{label}</label>{children}</div>
}

/* ─── Page ───────────────────────────────────────────────────────────── */
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
    setForm({
      active: b.active, bg_image: b.bg_image ?? '', bg_color: b.bg_color ?? '#000000',
      accent_color: b.accent_color ?? '#F5B700', tag: b.tag ?? '', title: b.title ?? '',
      subtitle: b.subtitle ?? '', cta_text: b.cta_text ?? '', cta_href: b.cta_href ?? '#',
      cta_secondary_text: b.cta_secondary_text ?? '', cta_secondary_href: b.cta_secondary_href ?? '#',
      features: b.features ?? [],
    })
    setFeaturesText((b.features ?? []).join('\n'))
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = { ...form, features: featuresText.split('\n').map(f => f.trim()).filter(Boolean) }
    if (editing) {
      await supabase.from('site_banners').update(payload).eq('id', editing.id)
    } else {
      const maxPos = banners.reduce((m, b) => Math.max(m, b.position), -1)
      await supabase.from('site_banners').insert({ ...payload, position: maxPos + 1 })
    }
    setSaving(false); setShowModal(false); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar este banner?')) return
    await supabase.from('site_banners').delete().eq('id', id)
    load()
  }

  const toggle = async (b: Banner) => {
    await supabase.from('site_banners').update({ active: !b.active }).eq('id', b.id)
    load()
  }

  const move = async (b: Banner, dir: -1 | 1) => {
    const sorted = [...banners]
    const idx = sorted.findIndex(x => x.id === b.id)
    const si = idx + dir
    if (si < 0 || si >= sorted.length) return
    const swap = sorted[si]
    await supabase.from('site_banners').update({ position: swap.position }).eq('id', b.id)
    await supabase.from('site_banners').update({ position: b.position }).eq('id', swap.id)
    load()
  }

  return (
    <AdminPageShell
      title="Banners / Hero"
      subtitle="Slides do carrossel principal do site"
      action={<button style={btnPrimary} onClick={openNew}><Plus size={15} /> Novo Banner</button>}
    >
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
            <thead>
              <tr>
                {['Pos.', 'Preview', 'Título / Tag', 'Estado', 'Ações'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {banners.map((b, i) => {
                const previewUrl = resolveBannerImageUrl(b.bg_image)
                return (
                  <tr key={b.id} style={{ borderBottom: i < banners.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => move(b, -1)} className="p-1 rounded transition-colors" style={{ color: '#CBD5E1' }} onMouseEnter={e => (e.currentTarget as any).style.color = '#0B0B0D'} onMouseLeave={e => (e.currentTarget as any).style.color = '#CBD5E1'}><ChevronUp size={13} /></button>
                        <span className="text-xs font-mono font-bold w-5 text-center" style={{ color: '#64748B' }}>{b.position}</span>
                        <button onClick={() => move(b, 1)} className="p-1 rounded transition-colors" style={{ color: '#CBD5E1' }} onMouseEnter={e => (e.currentTarget as any).style.color = '#0B0B0D'} onMouseLeave={e => (e.currentTarget as any).style.color = '#CBD5E1'}><ChevronDown size={13} /></button>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt=""
                          className="h-10 w-20 object-cover rounded-lg"
                          style={{ border: '1px solid #E2E8F0' }}
                          onError={e => {
                            const img = e.currentTarget as HTMLImageElement
                            img.style.display = 'none'
                            const fallback = img.nextElementSibling as HTMLElement | null
                            if (fallback) fallback.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className="h-10 w-20 rounded-lg items-center justify-center"
                        style={{ background: b.bg_color ?? '#000', border: '1px solid #E2E8F0', display: previewUrl ? 'none' : 'flex' }}
                      >
                        {!previewUrl && (
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>▶ vídeo</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>
                        {b.title || <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>sem título</span>}
                      </div>
                      {b.tag && (
                        <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: `${b.accent_color ?? '#F5B700'}18`, color: b.accent_color ?? '#D9A300' }}>
                          {b.tag}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <button
                        onClick={() => toggle(b)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-full transition-all"
                        style={b.active
                          ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                          : { background: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}
                      >
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
            <div className="px-6 py-5" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <h2 className="font-black text-lg" style={{ color: '#0B0B0D' }}>{editing ? 'Editar Banner' : 'Novo Banner'}</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                Slide {editing?.position ?? (banners.length + 1)} — as alterações aparecem imediatamente no carousel
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Image upload */}
              <ImageUploadArea
                currentUrl={form.bg_image}
                onUrlChange={url => setForm(f => ({ ...f, bg_image: url }))}
              />

              {/* Text content */}
              <Field label="Tag">
                <input style={adminInput} value={form.tag ?? ''} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} placeholder="ex: Inteligência Artificial" />
              </Field>
              <Field label="Título">
                <textarea style={{ ...adminInput, resize: 'none' }} rows={2} value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título do banner" />
              </Field>
              <Field label="Subtítulo">
                <textarea style={{ ...adminInput, resize: 'none' }} rows={2} value={form.subtitle ?? ''} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
              </Field>

              {/* CTAs */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="CTA Principal">
                  <input style={adminInput} value={form.cta_text ?? ''} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))} placeholder="Texto botão" />
                </Field>
                <Field label="Link CTA">
                  <input style={adminInput} value={form.cta_href ?? ''} onChange={e => setForm(f => ({ ...f, cta_href: e.target.value }))} placeholder="/checkout" />
                </Field>
                <Field label="CTA Secundário">
                  <input style={adminInput} value={form.cta_secondary_text ?? ''} onChange={e => setForm(f => ({ ...f, cta_secondary_text: e.target.value }))} placeholder="Saiba Mais" />
                </Field>
                <Field label="Link Secundário">
                  <input style={adminInput} value={form.cta_secondary_href ?? ''} onChange={e => setForm(f => ({ ...f, cta_secondary_href: e.target.value }))} placeholder="#" />
                </Field>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cor de Fundo">
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-10 rounded-lg cursor-pointer" style={{ border: '1px solid #E2E8F0' }} value={form.bg_color ?? '#000000'} onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))} />
                    <input style={{ ...adminInput, flex: 1 }} value={form.bg_color ?? '#000000'} onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))} />
                  </div>
                </Field>
                <Field label="Cor de Destaque">
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-10 rounded-lg cursor-pointer" style={{ border: '1px solid #E2E8F0' }} value={form.accent_color ?? '#F5B700'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                    <input style={{ ...adminInput, flex: 1 }} value={form.accent_color ?? '#F5B700'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                  </div>
                </Field>
              </div>

              {/* Features */}
              <Field label="Destaques (um por linha)">
                <textarea
                  style={{ ...adminInput, resize: 'none' }}
                  rows={3}
                  value={featuresText}
                  onChange={e => setFeaturesText(e.target.value)}
                  placeholder={'Chatbots Inteligentes\nAutomação de Processos\nIntegração Completa'}
                />
              </Field>

              {/* Active */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                <span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Ativo (visível no site)</span>
              </label>
            </div>

            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid #F1F5F9' }}>
              <button style={btnSecondary} onClick={() => setShowModal(false)}>Cancelar</button>
              <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
