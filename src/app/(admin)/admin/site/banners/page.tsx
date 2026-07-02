'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Banner = {
  id: string
  position: number
  active: boolean
  bg_image: string | null
  bg_color: string | null
  accent_color: string | null
  tag: string | null
  title: string | null
  subtitle: string | null
  cta_text: string | null
  cta_href: string | null
  cta_secondary_text: string | null
  cta_secondary_href: string | null
  features: string[] | null
}

const empty: Omit<Banner, 'id' | 'position'> = {
  active: true,
  bg_image: '',
  bg_color: '#000000',
  accent_color: '#F5B700',
  tag: '',
  title: '',
  subtitle: '',
  cta_text: '',
  cta_href: '#',
  cta_secondary_text: '',
  cta_secondary_href: '#',
  features: [],
}

export default function BannersPage() {
  const supabase = createClient()
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

  const openNew = () => {
    setEditing(null)
    setForm(empty)
    setFeaturesText('')
    setShowModal(true)
  }

  const openEdit = (b: Banner) => {
    setEditing(b)
    setForm({
      active: b.active,
      bg_image: b.bg_image ?? '',
      bg_color: b.bg_color ?? '#000000',
      accent_color: b.accent_color ?? '#F5B700',
      tag: b.tag ?? '',
      title: b.title ?? '',
      subtitle: b.subtitle ?? '',
      cta_text: b.cta_text ?? '',
      cta_href: b.cta_href ?? '#',
      cta_secondary_text: b.cta_secondary_text ?? '',
      cta_secondary_href: b.cta_secondary_href ?? '#',
      features: b.features ?? [],
    })
    setFeaturesText((b.features ?? []).join('\n'))
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = {
      ...form,
      features: featuresText.split('\n').map(f => f.trim()).filter(Boolean),
    }
    if (editing) {
      await supabase.from('site_banners').update(payload).eq('id', editing.id)
    } else {
      const maxPos = banners.reduce((m, b) => Math.max(m, b.position), -1)
      await supabase.from('site_banners').insert({ ...payload, position: maxPos + 1 })
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar este banner?')) return
    await supabase.from('site_banners').delete().eq('id', id)
    load()
  }

  const toggleActive = async (b: Banner) => {
    await supabase.from('site_banners').update({ active: !b.active }).eq('id', b.id)
    load()
  }

  const move = async (b: Banner, dir: -1 | 1) => {
    const sorted = [...banners]
    const idx = sorted.findIndex(x => x.id === b.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const swap = sorted[swapIdx]
    await supabase.from('site_banners').update({ position: swap.position }).eq('id', b.id)
    await supabase.from('site_banners').update({ position: b.position }).eq('id', swap.id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/site" className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Banners / Hero</h1>
            <p className="text-gray-500 text-sm">Slides do carrossel principal</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-[#F5B700] text-black font-bold px-4 py-2.5 rounded-xl hover:bg-[#D9A300] transition-colors"
        >
          <Plus size={16} /> Novo Banner
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">A carregar...</div>
        ) : banners.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum banner criado. Clica em "Novo Banner" para começar.</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3.5 text-left">Pos.</th>
                <th className="px-5 py-3.5 text-left">Título</th>
                <th className="px-5 py-3.5 text-left">Tag</th>
                <th className="px-5 py-3.5 text-left">Imagem</th>
                <th className="px-5 py-3.5 text-left">Estado</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {banners.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(b, -1)} className="text-gray-300 hover:text-gray-600 transition-colors"><ChevronUp size={14} /></button>
                      <span className="text-gray-600 font-mono text-sm w-5 text-center">{b.position}</span>
                      <button onClick={() => move(b, 1)} className="text-gray-300 hover:text-gray-600 transition-colors"><ChevronDown size={14} /></button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-900 font-medium text-sm">{b.title || <span className="text-gray-300 italic">sem título</span>}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{b.tag || '—'}</td>
                  <td className="px-5 py-3.5">
                    {b.bg_image ? (
                      <img src={b.bg_image} alt="" className="h-8 w-16 object-cover rounded" />
                    ) : (
                      <div className="h-8 w-16 rounded" style={{ background: b.bg_color ?? '#000' }} />
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => toggleActive(b)} className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${b.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {b.active ? <Eye size={11} /> : <EyeOff size={11} />}
                      {b.active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(b)} className="text-gray-400 hover:text-[#F5B700] transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => remove(b.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-black text-gray-900 text-lg">{editing ? 'Editar Banner' : 'Novo Banner'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Tag</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.tag ?? ''} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} placeholder="ex: Inteligência Artificial" />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Título</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700] resize-none" rows={2} value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título do banner (\\n para quebra de linha)" />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Subtítulo</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700] resize-none" rows={2} value={form.subtitle ?? ''} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">CTA Principal</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.cta_text ?? ''} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))} placeholder="Texto do botão" />
                </div>
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Link CTA</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.cta_href ?? ''} onChange={e => setForm(f => ({ ...f, cta_href: e.target.value }))} placeholder="#servicos" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">CTA Secundário</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.cta_secondary_text ?? ''} onChange={e => setForm(f => ({ ...f, cta_secondary_text: e.target.value }))} placeholder="Saiba Mais" />
                </div>
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Link Secundário</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.cta_secondary_href ?? ''} onChange={e => setForm(f => ({ ...f, cta_secondary_href: e.target.value }))} placeholder="#" />
                </div>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">URL da Imagem de Fundo</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.bg_image ?? ''} onChange={e => setForm(f => ({ ...f, bg_image: e.target.value }))} placeholder="/viraliza-ai-banner.png ou https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Cor de Fundo</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-12 border border-gray-200 rounded-lg cursor-pointer" value={form.bg_color ?? '#000000'} onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))} />
                    <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.bg_color ?? '#000000'} onChange={e => setForm(f => ({ ...f, bg_color: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Cor de Destaque</label>
                  <div className="flex items-center gap-2">
                    <input type="color" className="h-9 w-12 border border-gray-200 rounded-lg cursor-pointer" value={form.accent_color ?? '#F5B700'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                    <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.accent_color ?? '#F5B700'} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Features (uma por linha)</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700] resize-none" rows={3} value={featuresText} onChange={e => setFeaturesText(e.target.value)} placeholder="Chatbots Inteligentes&#10;Automação de Processos&#10;Agentes IA" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                <label htmlFor="active" className="text-gray-600 text-sm font-medium">Activo (visível no site)</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 font-medium text-sm rounded-xl hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 bg-[#F5B700] text-black font-bold text-sm rounded-xl hover:bg-[#D9A300] transition-colors disabled:opacity-60">
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
