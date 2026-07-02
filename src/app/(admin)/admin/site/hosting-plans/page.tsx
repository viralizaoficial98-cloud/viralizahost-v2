'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react'
import Link from 'next/link'

type HostingPlan = {
  id: string
  name: string
  description: string | null
  badge: string | null
  price_monthly: number | null
  price_annual: number | null
  discount_annual: number
  features: string[] | null
  active: boolean
  featured: boolean
  position: number
}

const emptyPlan: Omit<HostingPlan, 'id' | 'position'> = {
  name: '',
  description: '',
  badge: '',
  price_monthly: null,
  price_annual: null,
  discount_annual: 0,
  features: [],
  active: true,
  featured: false,
}

export default function HostingPlansPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [plans, setPlans] = useState<HostingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<HostingPlan | null>(null)
  const [form, setForm] = useState<Omit<HostingPlan, 'id' | 'position'>>(emptyPlan)
  const [featuresText, setFeaturesText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('site_hosting_plans').select('*').order('position')
    setPlans(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(emptyPlan); setFeaturesText(''); setShowModal(true) }
  const openEdit = (p: HostingPlan) => {
    setEditing(p)
    setForm({ name: p.name, description: p.description, badge: p.badge, price_monthly: p.price_monthly, price_annual: p.price_annual, discount_annual: p.discount_annual, features: p.features, active: p.active, featured: p.featured })
    setFeaturesText((p.features ?? []).join('\n'))
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = { ...form, features: featuresText.split('\n').map(f => f.trim()).filter(Boolean) }
    if (editing) {
      await supabase.from('site_hosting_plans').update(payload).eq('id', editing.id)
    } else {
      const maxPos = plans.reduce((m, p) => Math.max(m, p.position), -1)
      await supabase.from('site_hosting_plans').insert({ ...payload, position: maxPos + 1 })
    }
    setSaving(false); setShowModal(false); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar este plano?')) return
    await supabase.from('site_hosting_plans').delete().eq('id', id)
    load()
  }

  const move = async (p: HostingPlan, dir: -1 | 1) => {
    const idx = plans.findIndex(x => x.id === p.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= plans.length) return
    const swap = plans[swapIdx]
    await supabase.from('site_hosting_plans').update({ position: swap.position }).eq('id', p.id)
    await supabase.from('site_hosting_plans').update({ position: p.position }).eq('id', swap.id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/site" className="text-gray-400 hover:text-gray-700 transition-colors"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Planos de Hospedagem</h1>
            <p className="text-gray-500 text-sm">Gerir planos e preços de hosting</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#F5B700] text-black font-bold px-4 py-2.5 rounded-xl hover:bg-[#D9A300] transition-colors">
          <Plus size={16} /> Novo Plano
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">A carregar...</div>
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum plano de hospedagem configurado.</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3.5 text-left">Pos.</th>
                <th className="px-5 py-3.5 text-left">Nome</th>
                <th className="px-5 py-3.5 text-left">Badge</th>
                <th className="px-5 py-3.5 text-left">Preço/Mês</th>
                <th className="px-5 py-3.5 text-left">Preço/Ano</th>
                <th className="px-5 py-3.5 text-left">Destaque</th>
                <th className="px-5 py-3.5 text-left">Estado</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(p, -1)} className="text-gray-300 hover:text-gray-600"><ChevronUp size={14} /></button>
                      <span className="text-gray-600 font-mono text-sm w-5 text-center">{p.position}</span>
                      <button onClick={() => move(p, 1)} className="text-gray-300 hover:text-gray-600"><ChevronDown size={14} /></button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-gray-900 text-sm">{p.name}</td>
                  <td className="px-5 py-3.5">
                    {p.badge ? <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{p.badge}</span> : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-sm">{p.price_monthly != null ? p.price_monthly.toLocaleString() : '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-sm">{p.price_annual != null ? p.price_annual.toLocaleString() : '—'}</td>
                  <td className="px-5 py-3.5">
                    {p.featured ? <span className="bg-[#F5B700]/10 text-[#F5B700] text-xs font-bold px-2 py-0.5 rounded-full">Destaque</span> : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-[#F5B700] transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => remove(p.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
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
              <h2 className="font-black text-gray-900 text-lg">{editing ? 'Editar Plano' : 'Novo Plano'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Nome</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Descrição</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Badge</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.badge ?? ''} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))} placeholder="MAIS POPULAR, MELHOR VALOR..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Preço Mensal</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.price_monthly ?? ''} onChange={e => setForm(f => ({ ...f, price_monthly: e.target.value ? parseFloat(e.target.value) : null }))} />
                </div>
                <div>
                  <label className="text-gray-600 text-sm font-medium block mb-1">Preço Anual</label>
                  <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.price_annual ?? ''} onChange={e => setForm(f => ({ ...f, price_annual: e.target.value ? parseFloat(e.target.value) : null }))} />
                </div>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Desconto Anual (%)</label>
                <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.discount_annual} onChange={e => setForm(f => ({ ...f, discount_annual: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Features (uma por linha)</label>
                <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700] resize-none" rows={6} value={featuresText} onChange={e => setFeaturesText(e.target.value)} />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                  Activo
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} />
                  Destaque
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
