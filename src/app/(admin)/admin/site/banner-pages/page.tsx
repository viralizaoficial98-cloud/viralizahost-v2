'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { Loader2, Pencil, Check, X, Image as ImageIcon, Eye, EyeOff, ChevronDown, ChevronUp, Globe, Plus, Sparkles } from 'lucide-react'

type BannerPage = {
  id: string
  page_slug: string
  page_name: string
  breadcrumb: string | null
  breadcrumb_parent: string | null
  breadcrumb_parent_href: string | null
  tag: string | null
  title: string
  subtitle: string
  bg_image: string | null
  bg_color: string
  highlights: string[]
  button_primary_text: string
  button_primary_link: string
  button_secondary_text: string | null
  button_secondary_link: string | null
  price_text: string | null
  show_guarantee: boolean
  overlay_opacity: number
  is_active: boolean
  updated_at: string
}

const EMPTY: Omit<BannerPage, 'id' | 'updated_at'> = {
  page_slug: '', page_name: '',
  breadcrumb: '', breadcrumb_parent: '', breadcrumb_parent_href: '',
  tag: '', title: '', subtitle: '',
  bg_image: '', bg_color: '#080d1a',
  highlights: [],
  button_primary_text: 'Ver Planos', button_primary_link: '#planos',
  button_secondary_text: '', button_secondary_link: '',
  price_text: '', show_guarantee: true, overlay_opacity: 0,
  is_active: true,
}

const inp = 'w-full border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5B700] transition-colors bg-white'
const label = 'text-xs font-bold text-[#666] mb-1 block'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/storage/banner-page', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Erro no upload')
      onChange(json.publicUrl)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="relative border-2 border-dashed border-[#E8E8E8] rounded-xl overflow-hidden cursor-pointer hover:border-[#F5B700] transition-colors"
        style={{ minHeight: 120 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="preview" className="w-full h-32 object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-[#999]">
            <ImageIcon size={28} className="opacity-40" />
            <span className="text-xs">Clique ou arraste a imagem aqui</span>
            <span className="text-[10px]">PNG, JPG, WEBP — max 10 MB — recomendado 1920×800</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-white" />
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <input
        className={inp}
        placeholder="Ou cole o URL da imagem"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          Remover imagem
        </button>
      )}
    </div>
  )
}

function BannerForm({
  initial, onSave, onCancel
}: {
  initial: Partial<BannerPage>
  onSave: (data: Partial<BannerPage>) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY, ...initial, highlights: initial.highlights ?? [] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [highlightInput, setHighlightInput] = useState('')

  function set<K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function addHighlight() {
    const t = highlightInput.trim()
    if (!t || form.highlights.length >= 6) return
    setForm(f => ({ ...f, highlights: [...f.highlights, t] }))
    setHighlightInput('')
  }

  function removeHighlight(i: number) {
    setForm(f => ({ ...f, highlights: f.highlights.filter((_, j) => j !== i) }))
  }

  async function submit() {
    if (!form.page_slug.trim() || !form.page_name.trim() || !form.title.trim()) {
      setError('Slug, Nome da Página e Título são obrigatórios.')
      return
    }
    setSaving(true); setError('')
    try { await onSave(form) } catch (e: any) { setError(e.message ?? 'Erro ao guardar') } finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 shadow-sm space-y-6">

      {/* Identificação */}
      <div>
        <p className={`${label} text-[#333] text-sm mb-3`}>Identificação da Página</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Slug da Página *</label>
            <input className={inp} value={form.page_slug} onChange={e => set('page_slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="ex: hospedagem-de-sites" />
          </div>
          <div>
            <label className={label}>Nome da Página *</label>
            <input className={inp} value={form.page_name} onChange={e => set('page_name', e.target.value)} placeholder="ex: Hospedagem de Sites" />
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div>
        <p className={`${label} text-[#333] text-sm mb-3`}>Breadcrumb</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={label}>Último Segmento</label>
            <input className={inp} value={form.breadcrumb ?? ''} onChange={e => set('breadcrumb', e.target.value)} placeholder="Hospedagem de Sites" />
          </div>
          <div>
            <label className={label}>Segmento Pai (opcional)</label>
            <input className={inp} value={form.breadcrumb_parent ?? ''} onChange={e => set('breadcrumb_parent', e.target.value)} placeholder="Servidor VPS" />
          </div>
          <div>
            <label className={label}>Link do Segmento Pai</label>
            <input className={inp} value={form.breadcrumb_parent_href ?? ''} onChange={e => set('breadcrumb_parent_href', e.target.value)} placeholder="/servidor-vps" />
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div>
        <p className={`${label} text-[#333] text-sm mb-3`}>Conteúdo Principal</p>
        <div className="space-y-4">
          <div>
            <label className={label}>Badge / Tag</label>
            <input className={inp} value={form.tag ?? ''} onChange={e => set('tag', e.target.value)} placeholder="ex: HOSPEDAGEM PREMIUM" />
          </div>
          <div>
            <label className={label}>Título *</label>
            <textarea className={`${inp} resize-none`} rows={2} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Hospedagem de Sites Premium para o seu Negócio" />
          </div>
          <div>
            <label className={label}>Descrição / Subtítulo</label>
            <textarea className={`${inp} resize-none`} rows={3} value={form.subtitle} onChange={e => set('subtitle', e.target.value)} placeholder="Performance ultrarrápida com LiteSpeed..." />
          </div>
        </div>
      </div>

      {/* Imagem */}
      <div>
        <p className={`${label} text-[#333] text-sm mb-3`}>Imagem de Fundo</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <ImageUpload value={form.bg_image ?? ''} onChange={v => set('bg_image', v)} />
          </div>
          <div className="space-y-4">
            <div>
              <label className={label}>Cor de Fundo</label>
              <div className="flex gap-2">
                <input type="color" value={form.bg_color} onChange={e => set('bg_color', e.target.value)} className="w-10 h-9 rounded border border-[#E8E8E8] cursor-pointer" />
                <input className={`${inp} flex-1`} value={form.bg_color} onChange={e => set('bg_color', e.target.value)} placeholder="#080d1a" />
              </div>
            </div>
            <div>
              <label className={label}>Opacidade do Overlay: {Math.round((form.overlay_opacity ?? 0) * 100)}%</label>
              <input type="range" min="0" max="100" step="10" value={Math.round((form.overlay_opacity ?? 0) * 100)} onChange={e => set('overlay_opacity', parseInt(e.target.value) / 100)} className="w-full accent-[#F5B700]" />
              <div className="flex justify-between text-[10px] text-[#999] mt-1">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => <span key={v}>{v}%</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefícios */}
      <div>
        <p className={`${label} text-[#333] text-sm mb-3`}>Benefícios / Highlights <span className="text-[#999] font-normal">(máx. 6)</span></p>
        <div className="space-y-2 mb-3">
          {form.highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#FAFAFA] rounded-lg px-3 py-2">
              <Check size={13} className="text-[#F5B700] shrink-0" />
              <span className="flex-1 text-sm text-[#444]">{h}</span>
              <button type="button" onClick={() => removeHighlight(i)} className="text-[#CCC] hover:text-red-500 transition-colors">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        {form.highlights.length < 6 && (
          <div className="flex gap-2">
            <input
              className={`${inp} flex-1`}
              value={highlightInput}
              onChange={e => setHighlightInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHighlight())}
              placeholder="ex: LiteSpeed Enterprise"
            />
            <button type="button" onClick={addHighlight} className="px-3 py-2 bg-[#F5B700] text-[#0A0A0A] text-sm font-bold rounded-lg hover:bg-[#D9A300] transition-colors">
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Botões */}
      <div>
        <p className={`${label} text-[#333] text-sm mb-3`}>Botões CTA</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={label}>Botão Primário — Texto</label>
            <input className={inp} value={form.button_primary_text} onChange={e => set('button_primary_text', e.target.value)} placeholder="Ver Planos" />
          </div>
          <div className="space-y-2">
            <label className={label}>Botão Primário — Link</label>
            <input className={inp} value={form.button_primary_link} onChange={e => set('button_primary_link', e.target.value)} placeholder="#planos" />
          </div>
          <div className="space-y-2">
            <label className={label}>Botão Secundário — Texto</label>
            <input className={inp} value={form.button_secondary_text ?? ''} onChange={e => set('button_secondary_text', e.target.value)} placeholder="Falar com Especialista" />
          </div>
          <div className="space-y-2">
            <label className={label}>Botão Secundário — Link</label>
            <input className={inp} value={form.button_secondary_link ?? ''} onChange={e => set('button_secondary_link', e.target.value)} placeholder="/tickets" />
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div>
        <p className={`${label} text-[#333] text-sm mb-3`}>Rodapé do Banner</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label className={label}>Texto de Preço</label>
            <input className={inp} value={form.price_text ?? ''} onChange={e => set('price_text', e.target.value)} placeholder="A partir de Kz 19.900/mês" />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.show_guarantee} onChange={e => set('show_guarantee', e.target.checked)} className="accent-[#F5B700]" />
              Mostrar garantia de 30 dias
            </label>
          </div>
        </div>
      </div>

      {/* Estado */}
      <div className="flex items-center gap-3 pt-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer font-semibold">
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="accent-[#F5B700]" />
          Banner activo
        </label>
      </div>

      {/* Preview Hero (simplificado) */}
      {(form.title || form.bg_image) && (
        <div>
          <p className={`${label} text-[#333] text-sm mb-3`}>Preview</p>
          <div
            className="relative rounded-xl overflow-hidden"
            style={{ minHeight: 200, backgroundColor: form.bg_color }}
          >
            {form.bg_image && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.bg_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/30" />
                {form.overlay_opacity > 0 && (
                  <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${form.overlay_opacity})` }} />
                )}
              </>
            )}
            <div className="relative p-6">
              {form.breadcrumb && (
                <p className="text-[10px] text-gray-500 mb-3">Início {form.breadcrumb_parent ? `› ${form.breadcrumb_parent} ` : ''}› {form.breadcrumb}</p>
              )}
              {form.tag && (
                <span className="inline-block bg-[#F5B700]/10 border border-[#F5B700]/25 text-[#F5B700] text-[9px] font-bold px-2.5 py-1 rounded-full mb-3 uppercase tracking-widest">{form.tag}</span>
              )}
              <h2 className="text-white text-xl font-black mb-2 leading-tight">{form.title || 'Título do Banner'}</h2>
              {form.subtitle && <p className="text-gray-300 text-xs mb-3 max-w-sm">{form.subtitle}</p>}
              {form.highlights.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-3">
                  {form.highlights.map((h, i) => (
                    <span key={i} className="flex items-center gap-1 text-[10px] text-gray-300">
                      <Check size={10} className="text-[#F5B700]" /> {h}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {form.button_primary_text && (
                  <span className="px-4 py-2 bg-[#F5B700] text-[#0A0A0A] text-[10px] font-bold rounded-lg">{form.button_primary_text}</span>
                )}
                {form.button_secondary_text && (
                  <span className="px-4 py-2 border border-white/20 text-white text-[10px] font-semibold rounded-lg">{form.button_secondary_text}</span>
                )}
              </div>
              {form.price_text && <p className="text-gray-400 text-[10px] mt-2">{form.price_text}</p>}
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#F5B700] text-[#0A0A0A] text-sm font-bold rounded-xl hover:bg-[#D9A300] transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'A guardar…' : 'Guardar Banner'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-[#E8E8E8] text-sm text-[#666] rounded-xl hover:bg-[#F8F8F8] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function isTableMissingError(msg: string) {
  return msg.toLowerCase().includes('could not find') || msg.toLowerCase().includes('does not exist') || msg.includes('42P01')
}

export default function AdminBannerPagesPage() {
  const [banners, setBanners] = useState<BannerPage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null); setTableMissing(false)
    try {
      const res = await fetch('/api/admin/banner-pages', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        const errMsg = json.message ?? 'Não foi possível carregar os banners'
        if (isTableMissingError(errMsg)) {
          setTableMissing(true)
        } else {
          setLoadError(`Erro ${res.status}: ${errMsg}`)
        }
        console.error('[banner-pages] load error:', json)
      } else {
        setBanners(json.data ?? [])
      }
    } catch (e: any) {
      setLoadError('Erro de ligação. Tente novamente.')
      console.error('[banner-pages] fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleSetup() {
    setSettingUp(true)
    try {
      const res = await fetch('/api/admin/setup-banner-pages', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Erro ao configurar')
      flash(`Tabela criada e ${json.count ?? 0} banners inseridos com sucesso.`, 'ok')
      await load()
    } catch (e: any) {
      flash(e.message ?? 'Erro ao configurar', 'err')
    } finally {
      setSettingUp(false)
    }
  }

  useEffect(() => { load() }, [load])

  function flash(text: string, type: 'ok' | 'err' = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  async function handleSave(data: Partial<BannerPage>, id?: string) {
    const url = id ? `/api/admin/banner-pages/${id}` : '/api/admin/banner-pages'
    const method = id ? 'PUT' : 'POST'
    // Strip DB-managed fields so we never send id/timestamps in the body
    const { id: _id, created_at: _ca, updated_at: _ts, ...payload } = data as any
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok || !json.success) {
      console.error('[banner-pages] save error:', json)
      throw new Error(json.message ?? 'Não foi possível guardar o banner. Tente novamente.')
    }
    flash(id ? 'Banner actualizado com sucesso.' : 'Banner criado com sucesso.')
    setEditingId(null)
    setCreating(false)
    await load()
  }

  async function handleToggle(banner: BannerPage) {
    const res = await fetch(`/api/admin/banner-pages/${banner.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !banner.is_active }),
    })
    const json = await res.json()
    if (json.success) {
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: !b.is_active } : b))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0A0A0A]">Banner das Páginas</h1>
          <p className="text-[#666] text-sm mt-0.5">Gerir os banners hero de todas as páginas de serviço</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditingId(null) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0A0A0A] text-white text-sm font-bold rounded-xl hover:bg-[#1A1A1A] transition-colors"
        >
          <Globe size={14} /> Nova Página
        </button>
      </div>

      {/* Flash */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.type === 'ok' ? <Check size={14} /> : <X size={14} />} {msg.text}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <BannerForm
          initial={EMPTY}
          onSave={data => handleSave(data)}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#F5B700]" /></div>
      )}

      {/* Table missing — setup banner */}
      {!loading && tableMissing && (
        <div className="p-6 rounded-2xl flex items-center gap-4"
          style={{ background: 'rgba(245,183,0,0.06)', border: '1px solid rgba(245,183,0,0.20)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,183,0,0.12)', border: '1px solid rgba(245,183,0,0.25)' }}>
            <Sparkles size={18} style={{ color: '#D9A300' }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Tabela não encontrada</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              A tabela <code className="bg-[#F5F5F5] px-1 py-0.5 rounded text-[10px]">banner_pages</code> ainda não existe.
              Clique em &ldquo;Configurar agora&rdquo; para criá-la e inserir os 18 banners pré-configurados para todas as páginas de serviço.
            </p>
          </div>
          <button
            onClick={handleSetup}
            disabled={settingUp}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', color: '#000', boxShadow: '0 4px 14px rgba(245,183,0,0.30)', border: 'none', cursor: 'pointer', opacity: settingUp ? 0.7 : 1 }}
          >
            {settingUp ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {settingUp ? 'A configurar…' : 'Configurar agora'}
          </button>
        </div>
      )}

      {/* Error */}
      {!loading && loadError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600 text-sm font-medium mb-3">{loadError}</p>
          <button onClick={load} className="px-4 py-2 bg-red-100 text-red-700 text-sm font-bold rounded-lg hover:bg-red-200 transition-colors">Tentar novamente</button>
        </div>
      )}

      {/* List */}
      {!loading && !loadError && (
        <div className="space-y-3">
          {banners.length === 0 && !creating && (
            <div className="text-center py-16 text-[#999] text-sm">Nenhum banner encontrado. Clique em &ldquo;Nova Página&rdquo; para começar.</div>
          )}
          {banners.map(banner => (
            <div key={banner.id} className="bg-white border border-[#E8E8E8] rounded-2xl shadow-sm overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-4 p-4">
                {/* Thumbnail */}
                <div className="w-24 h-14 rounded-lg overflow-hidden shrink-0 bg-[#0A0A0A]" style={{ backgroundColor: banner.bg_color }}>
                  {banner.bg_image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={banner.bg_image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-[#444]" /></div>
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[#0A0A0A] text-sm truncate">{banner.page_name}</p>
                    <code className="text-[10px] bg-[#F5F5F5] border border-[#E8E8E8] px-1.5 py-0.5 rounded font-mono text-[#666]">{banner.page_slug}</code>
                  </div>
                  <p className="text-xs text-[#888] mt-0.5 truncate">{banner.title}</p>
                  <p className="text-[10px] text-[#AAA] mt-0.5">Atualizado {fmtDate(banner.updated_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(banner)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${banner.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-[#F5F5F5] text-[#999] hover:bg-[#EFEFEF]'}`}
                    title={banner.is_active ? 'Desactivar' : 'Activar'}
                  >
                    {banner.is_active ? <Eye size={11} /> : <EyeOff size={11} />}
                    {banner.is_active ? 'Activo' : 'Inactivo'}
                  </button>

                  <button
                    onClick={() => { setEditingId(editingId === banner.id ? null : banner.id); setCreating(false) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A0A0A] text-white text-xs font-bold rounded-lg hover:bg-[#1A1A1A] transition-colors"
                  >
                    <Pencil size={11} /> Editar
                  </button>

                  <button
                    onClick={() => setExpandedId(expandedId === banner.id ? null : banner.id)}
                    className="p-1.5 text-[#CCC] hover:text-[#666] transition-colors"
                  >
                    {expandedId === banner.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === banner.id && (
                <div className="border-t border-[#F5F5F5] px-4 py-3 bg-[#FAFAFA]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div><span className="text-[#999]">Tag:</span> <span className="font-medium text-[#444]">{banner.tag || '—'}</span></div>
                    <div><span className="text-[#999]">Preço:</span> <span className="font-medium text-[#444]">{banner.price_text || '—'}</span></div>
                    <div><span className="text-[#999]">CTA:</span> <span className="font-medium text-[#444]">{banner.button_primary_text}</span></div>
                    <div><span className="text-[#999]">Garantia:</span> <span className="font-medium text-[#444]">{banner.show_guarantee ? 'Sim' : 'Não'}</span></div>
                    {banner.highlights.length > 0 && (
                      <div className="col-span-2 md:col-span-4">
                        <span className="text-[#999]">Benefícios: </span>
                        <span className="font-medium text-[#444]">{banner.highlights.join(' · ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Edit form */}
              {editingId === banner.id && (
                <div className="border-t border-[#E8E8E8] p-4">
                  <BannerForm
                    initial={banner}
                    onSave={data => handleSave(data, banner.id)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
