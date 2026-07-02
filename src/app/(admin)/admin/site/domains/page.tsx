'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react'
import Link from 'next/link'

type Domain = {
  id: string
  extension: string
  price_monthly: number | null
  price_annual: number | null
  currency: string
  popular: boolean
  active: boolean
  position: number
}

const emptyDomain: Omit<Domain, 'id' | 'position'> = {
  extension: '',
  price_monthly: null,
  price_annual: null,
  currency: 'AOA',
  popular: false,
  active: true,
}

export default function DomainsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Domain | null>(null)
  const [form, setForm] = useState<Omit<Domain, 'id' | 'position'>>(emptyDomain)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('site_domains').select('*').order('position')
    setDomains(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(emptyDomain); setShowModal(true) }
  const openEdit = (d: Domain) => {
    setEditing(d)
    setForm({ extension: d.extension, price_monthly: d.price_monthly, price_annual: d.price_annual, currency: d.currency, popular: d.popular, active: d.active })
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    if (editing) {
      await supabase.from('site_domains').update(form).eq('id', editing.id)
    } else {
      const maxPos = domains.reduce((m, d) => Math.max(m, d.position), -1)
      await supabase.from('site_domains').insert({ ...form, position: maxPos + 1 })
    }
    setSaving(false); setShowModal(false); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Apagar este domínio?')) return
    await supabase.from('site_domains').delete().eq('id', id)
    load()
  }

  const move = async (d: Domain, dir: -1 | 1) => {
    const sorted = [...domains]
    const idx = sorted.findIndex(x => x.id === d.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const swap = sorted[swapIdx]
    await supabase.from('site_domains').update({ position: swap.position }).eq('id', d.id)
    await supabase.from('site_domains').update({ position: d.position }).eq('id', swap.id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/site" className="text-gray-400 hover:text-gray-700 transition-colors"><ArrowLeft size={20} /></Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Domínios</h1>
            <p className="text-gray-500 text-sm">Extensões e preços de domínios disponíveis</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-[#F5B700] text-black font-bold px-4 py-2.5 rounded-xl hover:bg-[#D9A300] transition-colors">
          <Plus size={16} /> Novo Domínio
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">A carregar...</div>
        ) : domains.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum domínio configurado.</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-100">
              <tr className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-5 py-3.5 text-left">Pos.</th>
                <th className="px-5 py-3.5 text-left">Extensão</th>
                <th className="px-5 py-3.5 text-left">Preço Mensal</th>
                <th className="px-5 py-3.5 text-left">Preço Anual</th>
                <th className="px-5 py-3.5 text-left">Moeda</th>
                <th className="px-5 py-3.5 text-left">Popular</th>
                <th className="px-5 py-3.5 text-left">Estado</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {domains.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(d, -1)} className="text-gray-300 hover:text-gray-600"><ChevronUp size={14} /></button>
                      <span className="text-gray-600 font-mono text-sm w-5 text-center">{d.position}</span>
                      <button onClick={() => move(d, 1)} className="text-gray-300 hover:text-gray-600"><ChevronDown size={14} /></button>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-gray-900">{d.extension}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-sm">{d.price_monthly != null ? d.price_monthly.toLocaleString() : '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-sm">{d.price_annual != null ? d.price_annual.toLocaleString() : '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{d.currency}</td>
                  <td className="px-5 py-3.5">
                    {d.popular ? <span className="bg-[#F5B700]/10 text-[#F5B700] text-xs font-bold px-2 py-0.5 rounded-full">Popular</span> : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${d.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {d.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(d)} className="text-gray-400 hover:text-[#F5B700] transition-colors"><Pencil size={15} /></button>
                      <button onClick={() => remove(d.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-black text-gray-900 text-lg">{editing ? 'Editar Domínio' : 'Novo Domínio'}</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-gray-600 text-sm font-medium block mb-1">Extensão</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.extension} onChange={e => setForm(f => ({ ...f, extension: e.target.value }))} placeholder=".ao" />
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
                <label className="text-gray-600 text-sm font-medium block mb-1">Moeda</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="AOA" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.popular} onChange={e => setForm(f => ({ ...f, popular: e.target.checked }))} />
                  Popular
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
