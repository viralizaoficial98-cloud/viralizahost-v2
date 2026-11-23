'use client'
import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Save, Star } from 'lucide-react'

// Catálogo → Domínios: oferta comercial e cartões da página inicial.
// Preços (Kz, 1 ano) gravados em domain_prices — a mesma fonte da pesquisa, configuração, carrinho e checkout.
// Activar uma extensão não garante a disponibilidade dos nomes nem automatiza o registrador.

export interface DomainExtension {
  extension: string; sale: 'active' | 'on_request' | 'draft'
  register: number | null; renew: number | null; transfer: number | null
  description: string | null; featured: boolean; position: number
  badge: 'none' | 'popular' | 'promo' | 'new' | 'custom'; badgeText: string | null; highlight: boolean
}

const SALE: Record<DomainExtension['sale'], string> = { active: 'À venda', on_request: 'Sob consulta', draft: 'Retirada da venda' }
const BADGE: Record<DomainExtension['badge'], string> = { none: 'Sem etiqueta', popular: 'Popular', promo: 'Promoção', new: 'Novo', custom: 'Personalizada…' }
const input = 'w-full rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#F5B700]'
const kz = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`)
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\s/g, '').replace(',', '.')))

async function call(method: 'PATCH' | 'POST', body: unknown) {
  const r = await fetch('/api/admin/catalog', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
  return j
}

function ExtensionCard({ e, onSaved }: { e: DomainExtension; onSaved: () => void }) {
  const [f, setF] = useState({
    sale: e.sale, description: e.description ?? '', register: e.register == null ? '' : String(e.register), renew: e.renew == null ? '' : String(e.renew),
    transfer: e.transfer == null ? '' : String(e.transfer), featured: e.featured, badge: e.badge, badgeText: e.badgeText ?? '', highlight: e.highlight,
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF(p => ({ ...p, [k]: v })); setMsg(null) }
  async function save() {
    setBusy(true); setMsg(null)
    try {
      await call('PATCH', { kind: 'extension', extension: e.extension, sale: f.sale, description: f.description, register: num(f.register), renew: num(f.renew), transfer: num(f.transfer), featured: f.featured, badge: f.badge, badgeText: f.badgeText, highlight: f.highlight })
      setMsg({ ok: true, text: 'Guardado.' }); onSaved()
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }) } finally { setBusy(false) }
  }
  const visible = f.featured && f.sale === 'active'
  return (
    <div className={`rounded-xl border bg-white p-3 space-y-2 ${e.featured ? 'border-[#F5B700]' : 'border-[#E5E7EB]'}`} data-testid="ext-editor" data-ext={e.extension}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono font-black text-[#0B0B0D] text-base">{e.extension}</p>
        <select className={`${input} max-w-[170px]`} value={f.sale} onChange={x => set('sale', x.target.value as DomainExtension['sale'])} aria-label={`Estado de venda ${e.extension}`} data-testid="ext-sale">
          {Object.entries(SALE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <label className="block text-xs text-[#64748B]">Descrição no cartão
        <input className={input} maxLength={80} value={f.description} onChange={x => set('description', x.target.value)} placeholder="Ex.: Empresas em Angola" data-testid="ext-description" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {([['register', 'Registo 1.º ano'], ['renew', 'Renovação/ano'], ['transfer', 'Transferência']] as const).map(([k, l]) => (
          <label key={k} className="text-xs text-[#64748B]">{l} (Kz)
            <input className={input} inputMode="decimal" value={f[k]} onChange={x => set(k, x.target.value)} aria-label={`${l} ${e.extension}`} data-testid={`ext-${k}`} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.featured} onChange={x => set('featured', x.target.checked)} data-testid="ext-featured" /> Cartão na página inicial</label>
        <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={f.highlight} onChange={x => set('highlight', x.target.checked)} data-testid="ext-highlight" /> Destaque visual</label>
        <select className={`${input} max-w-[160px]`} value={f.badge} onChange={x => set('badge', x.target.value as DomainExtension['badge'])} aria-label={`Etiqueta ${e.extension}`} data-testid="ext-badge">
          {Object.entries(BADGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {f.badge === 'custom' && <input className={`${input} max-w-[150px]`} maxLength={20} value={f.badgeText} onChange={x => set('badgeText', x.target.value)} placeholder="Até 20 caracteres" aria-label={`Etiqueta personalizada ${e.extension}`} data-testid="ext-badge-text" />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#64748B]">{visible ? 'Aparece nos cartões da página inicial.' : f.featured ? 'Escolhida para os cartões, mas só aparece quando estiver à venda.' : f.sale === 'active' ? 'À venda no catálogo completo e na pesquisa (fora dos cartões).' : 'Não aparece no site para novos registos; renovações continuam.'}</p>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-700'}`} role="status">{msg.text}</span>}
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B0B0D] text-white text-xs font-bold disabled:opacity-50" data-testid="ext-save">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

function FeaturedOrder({ list, onSaved }: { list: DomainExtension[]; onSaved: () => void }) {
  const [order, setOrder] = useState(list.map(e => e.extension))
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o catálogo recarregado
  useEffect(() => { setOrder(list.map(e => e.extension)) }, [list])
  const move = (i: number, d: -1 | 1) => setOrder(o => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n })
  const changed = order.join() !== list.map(e => e.extension).join()
  async function save() {
    setBusy(true); setMsg(null)
    try { await call('POST', { kind: 'reorder', order }); setMsg({ ok: true, text: 'Ordem guardada.' }); onSaved() } catch (err) { setMsg({ ok: false, text: (err as Error).message }) } finally { setBusy(false) }
  }
  const byExt = Object.fromEntries(list.map(e => [e.extension, e]))
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-3" data-testid="featured-order">
      <p className="text-sm font-bold text-[#0B0B0D] mb-1 flex items-center gap-1.5"><Star size={14} className="text-[#F5B700]" /> Cartões da página inicial (ordem)</p>
      <p className="text-xs text-[#64748B] mb-2">Só aparecem as extensões à venda. As restantes continuam no catálogo completo («Ver todos os domínios e preços»).</p>
      {order.length === 0 ? <p className="text-sm text-[#64748B]">Nenhuma extensão escolhida para os cartões.</p> : (
        <ol className="space-y-1">
          {order.map((ext, i) => {
            const e = byExt[ext]
            return (
              <li key={ext} className="flex items-center gap-2 text-sm" data-testid="featured-item" data-ext={ext}>
                <span className="w-5 text-right text-[#94A3B8]">{i + 1}.</span>
                <span className="font-mono font-bold w-20">{ext}</span>
                <span className="text-xs text-[#64748B] flex-1 truncate">{kz(e?.register ?? null)}{e?.sale !== 'active' ? ' · não visível (fora de venda)' : ''}</span>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label={`Subir ${ext}`} data-testid="featured-up"><ArrowUp size={13} /></button>
                <button onClick={() => move(i, 1)} disabled={i === order.length - 1} className="p-1 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label={`Descer ${ext}`} data-testid="featured-down"><ArrowDown size={13} /></button>
              </li>
            )
          })}
        </ol>
      )}
      <div className="flex items-center gap-2 mt-2">
        <button onClick={save} disabled={!changed || busy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F5B700] text-black text-xs font-bold disabled:opacity-50" data-testid="featured-save">{busy && <Loader2 size={12} className="animate-spin" />} Guardar ordem</button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-700'}`} role="status">{msg.text}</span>}
      </div>
    </div>
  )
}

export function DomainExtensionsEditor({ extensions, onSaved }: { extensions: DomainExtension[]; onSaved: () => void }) {
  const featured = extensions.filter(e => e.featured).sort((a, b) => a.position - b.position)
  return (
    <div className="space-y-3">
      <FeaturedOrder list={featured} onSaved={onSaved} />
      <p className="text-xs text-[#64748B]">Preços por 1 ano, em Kz; registos de 2–3 anos = registo + renovações. Pôr à venda permite oferecer a extensão no site: a disponibilidade de cada nome continua a ser verificada na compra e o registo automático depende de Integrações → Registrador.</p>
      <div className="grid md:grid-cols-2 gap-3">
        {extensions.map(e => <ExtensionCard key={e.extension} e={e} onSaved={onSaved} />)}
      </div>
    </div>
  )
}
