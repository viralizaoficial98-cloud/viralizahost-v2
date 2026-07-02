'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, ArrowLeft, Crown } from 'lucide-react'
import Link from 'next/link'

type TeamMember = {
  id: string
  is_ceo: boolean
  name: string
  role: string | null
  title: string | null
  bio: string | null
  photo_url: string | null
  flag: string | null
  country: string | null
  accent_color: string
  position: number
  active: boolean
}

const emptyMember: Omit<TeamMember, 'id' | 'position'> = {
  is_ceo: false,
  name: '',
  role: '',
  title: 'Especialista',
  bio: '',
  photo_url: '',
  flag: '',
  country: '',
  accent_color: '#F5B700',
  active: true,
}

export default function TeamPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<Omit<TeamMember, 'id' | 'position'>>(emptyMember)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('site_team').select('*').order('is_ceo', { ascending: false }).order('position')
    setMembers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(emptyMember); setShowModal(true) }
  const openEdit = (m: TeamMember) => {
    setEditing(m)
    setForm({ is_ceo: m.is_ceo, name: m.name, role: m.role, title: m.title, bio: m.bio, photo_url: m.photo_url, flag: m.flag, country: m.country, accent_color: m.accent_color, active: m.active })
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    if (editing) {
      await supabase.from('site_team').update(form).eq('id', editing.id)
    } else {
      const maxPos = members.reduce((m, x) => Math.max(m, x.position), -1)
      await supabase.from('site_team').insert({ ...form, position: maxPos + 1 })
    }
    setSaving(false); setShowModal(false); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar este membro?')) return
    await supabase.from('site_team').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/site" className="text-gray-400 hover:text-gray-700 transition-colors"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Equipa</h1>
            <p className="text-gray-500 text-sm">Membros e estrutura organizacional</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#F5B700] text-black font-bold px-4 py-2.5 rounded-xl hover:bg-[#D9A300] transition-colors">
          <Plus size={16} /> Novo Membro
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-400">A carregar...</div>
        ) : members.length === 0 ? (
          <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">Nenhum membro configurado.</div>
        ) : members.map((m) => (
          <div key={m.id} className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#F5B700]/30 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {m.is_ceo && <Crown size={14} className="text-[#F5B700]" />}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {m.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-[#F5B700] transition-colors"><Pencil size={14} /></button>
                <button onClick={() => remove(m.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              {m.photo_url ? (
                <img src={m.photo_url} alt={m.name} className="w-16 h-16 rounded-full object-cover object-top mb-2" style={{ border: `2px solid ${m.accent_color}60` }} />
              ) : (
                <div className="w-16 h-16 rounded-full mb-2 flex items-center justify-center text-white font-bold text-xl" style={{ background: m.accent_color }}>
                  {m.name.charAt(0)}
                </div>
              )}
              <div className="flex items-center gap-1 mb-0.5">
                {m.flag && <span>{m.flag}</span>}
                <span className="font-black text-gray-900 text-sm">{m.name}</span>
              </div>
              <p className="text-xs font-semibold mb-1" style={{ color: m.accent_color }}>{m.title}</p>
              <p className="text-xs text-gray-500">{m.role}</p>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-black text-gray-900 text-lg">{editing ? 'Editar Membro' : 'Novo Membro'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Nome</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Cargo / Área</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.role ?? ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Tráfego Pago" />
                </div>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Título</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Especialista" />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Bio</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700] resize-none" rows={3} value={form.bio ?? ''} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">URL da Foto</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.photo_url ?? ''} onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} placeholder="/Manuel Muenho.jpeg ou https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Flag (emoji)</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.flag ?? ''} onChange={e => setForm(f => ({ ...f, flag: e.target.value }))} placeholder="🇦🇴" />
                </div>
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">País</label>
                  <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.country ?? ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Angola" />
                </div>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Cor de Destaque</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-12 border border-gray-200 rounded-lg cursor-pointer" value={form.accent_color} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                  <input className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.accent_color} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.is_ceo} onChange={e => setForm(f => ({ ...f, is_ceo: e.target.checked }))} />
                  É CEO / Fundador
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                  Activo
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 font-medium text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={save} disabled={saving} className="px-5 py-2 bg-[#F5B700] text-black font-bold text-sm rounded-xl hover:bg-[#D9A300] disabled:opacity-60">
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
