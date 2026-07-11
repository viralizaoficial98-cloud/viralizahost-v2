'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

type Feature = { id?: string; feature: string; included: boolean; position: number }

type Product = {
  id: string
  slug: string
  category: string
  name: string
  description: string | null
  badge: string | null
  popular: boolean
  active: boolean
  position: number
  price_monthly: number | null
  price_6months: number | null
  price_1year: number | null
  price_2years: number | null
  price_3years: number | null
  color: string | null
  href_override: string | null
  product_features?: Feature[]
}

const CATEGORIES = [
  { value: 'hosting',           label: 'Hospedagem de Sites' },
  { value: 'wordpress',         label: 'WordPress' },
  { value: 'vps',               label: 'VPS' },
  { value: 'dedicated',         label: 'Servidor Dedicado Linux' },
  { value: 'dedicated-windows', label: 'Servidor Dedicado Windows' },
  { value: 'reseller',          label: 'Revenda de Hospedagem' },
  { value: 'email',             label: 'E-mail Corporativo' },
  { value: 'website-builder',   label: 'Criador de Sites com IA' },
  { value: 'domain',            label: 'Domínios' },
  { value: 'ssl',               label: 'SSL' },
  { value: 'cdn',               label: 'CDN' },
  { value: 'backup',            label: 'Backup Cloud' },
  { value: 'protection',        label: 'Protecção de Site' },
]

const fmtKz = (v: number | null) => v == null ? '' : v.toLocaleString('pt-AO')

const EMPTY: Omit<Product, 'id'> & { id?: string } = {
  slug: '', category: 'hosting', name: '', description: '', badge: '',
  popular: false, active: true, position: 0,
  price_monthly: null, price_6months: null, price_1year: null,
  price_2years: null, price_3years: null,
  color: '', href_override: '', product_features: [],
}

function parseKz(v: string): number | null {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

function ProductForm({ initial, onSave, onCancel }: {
  initial: Partial<Product> & { product_features?: Feature[] }
  onSave: (data: Partial<Product> & { product_features?: Feature[] }) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<typeof initial>({ ...EMPTY, ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [featInput, setFeatInput] = useState('')
  const features = form.product_features ?? []

  function set(key: keyof typeof form, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function addFeature() {
    if (!featInput.trim()) return
    setForm(f => ({
      ...f,
      product_features: [...(f.product_features ?? []), { feature: featInput.trim(), included: true, position: (f.product_features?.length ?? 0) }],
    }))
    setFeatInput('')
  }

  function removeFeature(i: number) {
    setForm(f => ({ ...f, product_features: (f.product_features ?? []).filter((_, j) => j !== i) }))
  }

  function toggleIncluded(i: number) {
    setForm(f => ({ ...f, product_features: (f.product_features ?? []).map((feat, j) => j === i ? { ...feat, included: !feat.included } : feat) }))
  }

  async function submit() {
    if (!form.slug?.trim() || !form.name?.trim()) { setError('Slug e Nome são obrigatórios.'); return }
    setSaving(true); setError('')
    try { await onSave(form) } catch (e: any) { setError(e.message ?? 'Erro ao guardar') } finally { setSaving(false) }
  }

  const inp = 'w-full border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5B700] transition-colors'
  const priceInp = 'w-full border border-[#E8E8E8] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#F5B700] transition-colors'

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 shadow-sm space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-[#666] mb-1 block">Slug *</label>
          <input className={inp} value={form.slug ?? ''} onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="ex: wp-pro" />
        </div>
        <div>
          <label className="text-xs font-bold text-[#666] mb-1 block">Nome *</label>
          <input className={inp} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="WordPress Pro" />
        </div>
        <div>
          <label className="text-xs font-bold text-[#666] mb-1 block">Categoria</label>
          <select className={inp} value={form.category ?? 'hosting'} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-[#666] mb-1 block">Badge</label>
          <input className={inp} value={form.badge ?? ''} onChange={e => set('badge', e.target.value)} placeholder="ex: MAIS POPULAR" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-[#666] mb-1 block">Descrição</label>
          <input className={inp} value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Para pequenas empresas..." />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-[#666] mb-2">Preços (Kz/mês)</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {([['price_monthly','Mensal'],['price_6months','6 Meses'],['price_1year','Anual'],['price_2years','2 Anos'],['price_3years','3 Anos']] as const).map(([key, label]) => (
            <div key={key}>
              <label className="text-[10px] text-[#999] mb-1 block">{label}</label>
              <input className={priceInp} type="text" inputMode="numeric"
                value={form[key] != null ? fmtKz(form[key] as number) : ''}
                onChange={e => set(key, parseKz(e.target.value))}
                placeholder="0" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-bold text-[#666] mb-1 block">Posição</label>
          <input className={inp} type="number" value={form.position ?? 0} onChange={e => set('position', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <label className="text-xs font-bold text-[#666] mb-1 block">Cor (hex)</label>
          <input className={inp} value={form.color ?? ''} onChange={e => set('color', e.target.value)} placeholder="#3B82F6" />
        </div>
        <div>
          <label className="text-xs font-bold text-[#666] mb-1 block">Link override</label>
          <input className={inp} value={form.href_override ?? ''} onChange={e => set('href_override', e.target.value)} placeholder="/tickets" />
        </div>
        <div className="flex flex-col gap-2 pt-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!form.popular} onChange={e => set('popular', e.target.checked)} className="accent-[#F5B700]" />
            Popular
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!form.active} onChange={e => set('active', e.target.checked)} className="accent-[#F5B700]" />
            Activo
          </label>
        </div>
      </div>

      {/* Features */}
      <div>
        <p className="text-xs font-bold text-[#666] mb-2">Funcionalidades</p>
        <div className="space-y-1.5 mb-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-[#FAFAFA] rounded-lg px-3 py-2">
              <button onClick={() => toggleIncluded(i)} className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${f.included ? 'bg-green-500 text-white' : 'bg-red-100 text-red-500'}`}>
                {f.included ? <Check size={11} /> : <X size={11} />}
              </button>
              <span className="flex-1 text-sm text-[#444]">{f.feature}</span>
              <button onClick={() => removeFeature(i)} className="text-[#CCC] hover:text-red-500 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className={`${inp} flex-1`} value={featInput} onChange={e => setFeatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
            placeholder="Adicionar funcionalidade..." />
          <button onClick={addFeature} className="px-4 py-2 bg-[#0A0A0A] text-white text-sm rounded-lg hover:bg-[#222] transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-5 py-2.5 border border-[#E8E8E8] text-[#666] text-sm rounded-xl hover:bg-[#F8F8F8] transition-colors">Cancelar</button>
        <button onClick={submit} disabled={saving} className="px-5 py-2.5 bg-[#F5B700] text-[#0A0A0A] text-sm font-bold rounded-xl hover:bg-[#D9A300] transition-colors flex items-center gap-2 disabled:opacity-50">
          {saving && <Loader2 size={13} className="animate-spin" />} Guardar
        </button>
      </div>
    </div>
  )
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await (supabase as any)
      .from('products')
      .select('*, product_features(id, feature, included, position)')
      .order('category').order('position')

    if (error) {
      setLoadError(`Erro ao carregar produtos: ${error.message}`)
      setLoading(false)
      return
    }
    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function flash(text: string, type: 'ok' | 'err' = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 3500)
  }

  async function handleSave(data: Partial<Product> & { product_features?: Feature[] }, id?: string) {
    const { product_features, ...productData } = data

    if (id) {
      const { error } = await (supabase.from('products') as any).update({ ...productData, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(error.message)
      // Replace features
      await (supabase as any).from('product_features').delete().eq('product_id', id)
      if (product_features?.length) {
        await (supabase as any).from('product_features').insert(
          product_features.map((f, i) => ({ product_id: id, feature: f.feature, included: f.included, position: i }))
        )
      }
      flash('Produto actualizado com sucesso.')
    } else {
      const { data: created, error } = await (supabase as any).from('products').insert(productData as any).select().single()
      if (error) throw new Error(error.message)
      if (product_features?.length && created) {
        await (supabase as any).from('product_features').insert(
          product_features.map((f, i) => ({ product_id: created.id, feature: f.feature, included: f.included, position: i }))
        )
      }
      flash('Produto criado com sucesso.')
    }

    setCreating(false)
    setEditingId(null)
    await load()
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const { error } = await (supabase as any).from('products').delete().eq('id', id)
    setDeleting(false)
    setDeleteId(null)
    if (error) { flash(error.message, 'err') } else { flash('Produto eliminado.'); await load() }
  }

  const filtered = filterCat ? products.filter(p => p.category === filterCat) : products

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A0A0A]">Gestão de Produtos</h1>
          <p className="text-sm text-[#888] mt-1">Todos os planos e serviços do website, carregados dinamicamente.</p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditingId(null) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#F5B700] text-[#0A0A0A] text-sm font-bold rounded-xl hover:bg-[#D9A300] transition-colors"
        >
          <Plus size={15} /> Novo Produto
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-sm font-semibold ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.type === 'ok' ? <Check size={14} /> : <X size={14} />} {msg.text}
        </div>
      )}

      {/* Filter by category */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button onClick={() => setFilterCat('')} className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${!filterCat ? 'bg-[#0A0A0A] text-white' : 'bg-white border border-[#E8E8E8] text-[#666] hover:border-[#0A0A0A]'}`}>
          Todos
        </button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setFilterCat(c.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${filterCat === c.value ? 'bg-[#0A0A0A] text-white' : 'bg-white border border-[#E8E8E8] text-[#666] hover:border-[#0A0A0A]'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {creating && (
        <div className="mb-6">
          <h2 className="text-base font-bold text-[#0A0A0A] mb-3">Novo Produto</h2>
          <ProductForm initial={EMPTY} onSave={d => handleSave(d)} onCancel={() => setCreating(false)} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#F5B700]" /></div>
      ) : loadError ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <p className="text-red-600 font-semibold text-sm">{loadError}</p>
          <button onClick={load} className="text-xs px-4 py-2 bg-[#F5B700] text-[#0A0A0A] font-bold rounded-lg hover:bg-[#D9A300] transition-colors">Tentar novamente</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(product => {
            const isEditing = editingId === product.id
            const isExpanded = expandedId === product.id
            const catLabel = CATEGORIES.find(c => c.value === product.category)?.label ?? product.category

            return (
              <div key={product.id} className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <GripVertical size={14} className="text-[#CCC] cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#0A0A0A]">{product.name}</span>
                      <span className="text-[10px] bg-[#F0F0F0] text-[#666] px-2 py-0.5 rounded-full font-mono">{product.slug}</span>
                      {product.popular && <span className="text-[10px] bg-[#FFF8E1] text-[#D9A300] px-2 py-0.5 rounded-full font-bold">Popular</span>}
                      {!product.active && <span className="text-[10px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-bold">Inactivo</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[#888]">{catLabel}</span>
                      {product.price_monthly != null && <span className="text-xs text-[#0A0A0A] font-semibold">Kz {fmtKz(product.price_monthly)}/mês</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setExpandedId(isExpanded ? null : product.id)} className="p-2 text-[#888] hover:text-[#0A0A0A] transition-colors">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    <button onClick={() => { setEditingId(isEditing ? null : product.id); setCreating(false) }} className="p-2 text-[#888] hover:text-[#F5B700] transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(product.id)} className="p-2 text-[#888] hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isExpanded && !isEditing && (
                  <div className="px-4 pb-4 border-t border-[#F0F0F0] pt-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                      {([['price_monthly','Mensal'],['price_6months','6 Meses'],['price_1year','Anual'],['price_2years','2 Anos'],['price_3years','3 Anos']] as const).map(([key, label]) => (
                        <div key={key} className="text-center bg-[#FAFAFA] rounded-lg p-2">
                          <p className="text-[10px] text-[#999]">{label}</p>
                          <p className="text-sm font-bold text-[#0A0A0A]">{product[key] != null ? `Kz ${fmtKz(product[key] as number)}` : '—'}</p>
                        </div>
                      ))}
                    </div>
                    {product.product_features && product.product_features.length > 0 && (
                      <div className="space-y-1">
                        {[...product.product_features].sort((a, b) => a.position - b.position).map(f => (
                          <div key={f.id ?? f.feature} className="flex items-center gap-2 text-xs text-[#666]">
                            {f.included ? <Check size={11} className="text-green-500" /> : <X size={11} className="text-red-400" />}
                            {f.feature}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isEditing && (
                  <div className="border-t border-[#F0F0F0] p-4">
                    <ProductForm
                      initial={product}
                      onSave={d => handleSave(d, product.id)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {filtered.length === 0 && !loading && (
            <div className="text-center py-16 text-[#AAA]">
              <p className="text-sm">{filterCat ? `Nenhum produto na categoria "${CATEGORIES.find(c => c.value === filterCat)?.label ?? filterCat}".` : 'Nenhum produto no catálogo. Aplique a migração SQL ou crie o primeiro produto manualmente.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-black text-lg text-[#0A0A0A] mb-2">Eliminar produto</h3>
            <p className="text-sm text-[#666] mb-6">Esta acção é irreversível. Tem a certeza?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-[#E8E8E8] text-[#666] text-sm rounded-xl hover:bg-[#F8F8F8] transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {deleting && <Loader2 size={13} className="animate-spin" />} Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
