'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, PlugZap, Save, XCircle } from 'lucide-react'

// Integrações → Hostinger VPS. «Testar ligação» só lê (catálogo VPS, centros de dados, sistemas, métodos de
// pagamento, VMs). O aprovisionamento automático é uma opção explícita: compra na Hostinger com o método de
// pagamento da conta, depois de o pagamento do cliente estar validado. O token nunca é mostrado.

type Opt = { id: string; label: string; detail?: string | null; enabled: boolean }
/** Opção de instalação (template Hostinger ou opção manual) com a configuração comercial do administrador. */
type Img = Opt & { source: 'api' | 'manual'; category: 'os' | 'panel' | 'app'; name: string; version: string | null; icon: string | null; includedOs: string | null
  license: { type: 'included' | 'paid'; monthlyKz: number | null; note: string | null }; locations: string[]; minRamGb: number | null; plans: string[]; accessUrl: string | null; sshUser: string }
type Settings = { mode: 'test' | 'live'; apiUrl: string | null; hasSecret: boolean; usesRegistrarToken: boolean; autoProvision: boolean; paymentMethodId: number | null; hostnameSuffix: string
  locations: Opt[]; images: Img[]; allowChooseLater: boolean; lastTest: { at: string | null; ok: boolean | null; message: string | null } }
const CAT = { os: 'Sistema operativo', panel: 'Painel de controlo', app: 'Aplicação' } as const
type PM = { id: number; label: string; isDefault: boolean; unusable: boolean }
const input = 'w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]'

export default function HostingerVpsPage() {
  const [st, setSt] = useState<Settings | null>(null)
  const [liveAllowed, setLiveAllowed] = useState(false)
  const [pms, setPms] = useState<PM[]>([])
  const [form, setForm] = useState({ mode: 'test' as 'test' | 'live', apiUrl: '', secret: '', paymentMethodId: '', hostnameSuffix: '', auto: false, confirmAuto: false, locations: [] as string[], images: [] as Img[], later: false })
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const apply = (s: Settings) => {
    setSt(s)
    setForm({ mode: s.mode, apiUrl: s.apiUrl ?? '', secret: '', paymentMethodId: s.paymentMethodId?.toString() ?? '', hostnameSuffix: s.hostnameSuffix, auto: s.autoProvision, confirmAuto: false,
      locations: s.locations.filter(x => x.enabled).map(x => x.id), images: s.images.map(x => ({ ...x })), later: s.allowChooseLater })
  }
  const load = useCallback(() => {
    fetch('/api/admin/integrations/hostinger-vps', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.settings) { apply(j.settings); setLiveAllowed(!!j.liveAllowed) } })
  }, [])
  useEffect(load, [load])

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy('save'); setNotice(null)
    const res = await fetch('/api/admin/integrations/hostinger-vps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      mode: form.mode, apiUrl: form.apiUrl, secret: form.secret || undefined, paymentMethodId: form.paymentMethodId || null, hostnameSuffix: form.hostnameSuffix,
      autoProvision: form.auto, confirmAuto: form.confirmAuto, enabledLocations: form.locations, images: form.images, allowChooseLater: form.later, ...extra }) })
    const j = await res.json(); setBusy(null)
    if (!res.ok) { setNotice({ ok: false, text: j.error }); return }
    apply(j.settings); setNotice({ ok: true, text: 'Guardado.' })
  }
  const test = async () => {
    setBusy('test'); setNotice(null)
    const res = await fetch('/api/admin/integrations/hostinger-vps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) })
    const j = await res.json(); setBusy(null)
    if (j.settings) apply(j.settings)
    if (j.result?.detail?.paymentMethods) setPms(j.result.detail.paymentMethods)
    setNotice({ ok: !!j.result?.ok, text: j.result?.message ?? j.error ?? 'Falhou.' })
  }
  const toggle = (id: string) => setForm(f => ({ ...f, locations: f.locations.includes(id) ? f.locations.filter(x => x !== id) : [...f.locations, id] }))
  const setImg = (id: string, patch: Partial<Img>) => setForm(f => ({ ...f, images: f.images.map(x => (x.id === id ? { ...x, ...patch } : x)) }))
  if (!st) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-5" data-testid="hostinger-vps-integration">
      <Link href="/admin/settings/integrations" className="text-sm text-[#555] inline-flex items-center gap-1"><ArrowLeft size={14} /> Integrações</Link>
      <h1 className="text-2xl font-black">Hostinger VPS</h1>
      <p className="text-sm text-[#555]">A API da Hostinger permite <strong>comprar um VPS novo</strong> (POST /api/vps/v1/virtual-machines, sem idempotência) e configurar um VPS já pago. Ver <code>docs/hostinger-vps-api.md</code>.
        Sem aprovisionamento automático, cada VPS pago fica como tarefa da equipa em Encomendas (adquirir no hPanel e «Associar VPS…»).</p>
      {notice && <p role="status" data-testid="vps-int-notice" className={`p-3 rounded-xl text-sm ${notice.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{notice.text}</p>}

      <section className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Ligação</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-[#64748B]">Modo
            <select className={input} value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value as 'test' | 'live' })} data-testid="vps-int-mode"><option value="test">Ensaio (API simulada)</option><option value="live">Produção (developers.hostinger.com)</option></select>
          </label>
          {form.mode === 'test' && <label className="text-xs text-[#64748B]">Endereço da API simulada<input className={input} value={form.apiUrl} onChange={e => setForm({ ...form, apiUrl: e.target.value })} data-testid="vps-int-url" /></label>}
          <label className="text-xs text-[#64748B] sm:col-span-2">Token da API (hPanel → Perfil → API) {st.hasSecret ? '— configurado (deixe vazio para manter)' : st.usesRegistrarToken ? '— a usar o token do Registrador Hostinger' : ''}
            <input className={input} type="password" autoComplete="off" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value })} data-testid="vps-int-token" />
          </label>
        </div>
        <p className="text-xs text-[#64748B]">Último teste: {st.lastTest.at ? `${String(st.lastTest.at).slice(0, 16).replace('T', ' ')} — ${st.lastTest.ok ? 'OK' : 'falhou'}: ${st.lastTest.message ?? ''}` : 'nunca'}</p>
        <div className="flex gap-2">
          <button onClick={() => save()} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#F5B700]" data-testid="vps-int-save">{busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar</button>
          <button onClick={test} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB]" data-testid="vps-int-test">{busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Testar ligação (só leitura)</button>
        </div>
      </section>

      <section className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-4">
        <h2 className="font-bold">Opções oferecidas ao cliente</h2>
        <p className="text-xs text-[#64748B]">Os centros de dados e os templates vêm do «Testar ligação». <strong>A API da Hostinger não indica categoria, versão, licença nem compatibilidade</strong> dos templates: a classificação é sugerida pelo nome e deve ser confirmada aqui. Licenças pagas (ex.: cPanel, Plesk) só podem ser activadas com o preço mensal de venda definido. Só as opções activas aparecem em «Escolha o que instalar».</p>
        <div><p className="text-xs font-bold mb-1">Localizações (centros de dados)</p><div className="grid sm:grid-cols-3 gap-1">{st.locations.length ? st.locations.map(o => <label key={o.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.locations.includes(o.id)} onChange={() => toggle(o.id)} data-testid={`vps-int-loc-${o.id}`} /> {o.label} <span className="text-[11px] text-[#94A3B8]">#{o.id}</span></label>) : <p className="text-xs text-[#94A3B8]">— teste a ligação —</p>}</div></div>
        <div>
          <p className="text-xs font-bold mb-1">O que instalar (sistemas, painéis e aplicações)</p>
          {form.images.length ? <ul className="divide-y divide-[#F1F5F9] border border-[#F1F5F9] rounded-xl">{form.images.map(o => (
            <li key={o.id} className="p-3" data-testid={`vps-int-imgrow-${o.id}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input type="checkbox" checked={o.enabled} onChange={e => setImg(o.id, { enabled: e.target.checked })} data-testid={`vps-int-img-${o.id}`} aria-label={`Activar ${o.label}`} />
                <strong>{o.label}</strong> <span className="text-[11px] text-[#94A3B8]">{o.source === 'manual' ? 'manual' : `#${o.id}`}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F1F5F9]">{CAT[o.category]}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${o.license.type === 'paid' ? 'bg-amber-100 text-amber-900' : 'bg-green-50 text-green-700'}`}>{o.license.type === 'paid' ? `Licença paga${o.license.monthlyKz ? `: Kz ${o.license.monthlyKz}/mês` : ' — sem preço'}` : 'Licença incluída'}</span>
                {o.source === 'manual' && <button className="ml-auto text-xs text-red-700 underline" onClick={() => { if (window.confirm(`Remover a opção manual «${o.label}»?`)) save({ removeImage: o.id }) }}>Remover</button>}
              </div>
              <details className="mt-2"><summary className="text-xs text-[#555] cursor-pointer" data-testid={`vps-int-imgedit-${o.id}`}>Configurar</summary>
                <div className="grid sm:grid-cols-3 gap-2 mt-2">
                  <label className="text-xs text-[#64748B]">Categoria<select className={input} value={o.category} onChange={e => setImg(o.id, { category: e.target.value as Img['category'] })} data-testid={`vps-int-cat-${o.id}`}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  <label className="text-xs text-[#64748B]">Nome<input className={input} value={o.name} onChange={e => setImg(o.id, { name: e.target.value })} /></label>
                  <label className="text-xs text-[#64748B]">Versão<input className={input} value={o.version ?? ''} onChange={e => setImg(o.id, { version: e.target.value || null })} /></label>
                  {o.category !== 'os' && <label className="text-xs text-[#64748B]">Sistema incluído<input className={input} value={o.includedOs ?? ''} onChange={e => setImg(o.id, { includedOs: e.target.value || null })} /></label>}
                  <label className="text-xs text-[#64748B]">Licença<select className={input} value={o.license.type} onChange={e => setImg(o.id, { license: { ...o.license, type: e.target.value as 'included' | 'paid' } })} data-testid={`vps-int-lic-${o.id}`}><option value="included">Incluída</option><option value="paid">Paga</option></select></label>
                  {o.license.type === 'paid' && <label className="text-xs text-[#64748B]">Preço da licença (Kz/mês)<input className={input} type="number" min={0} value={o.license.monthlyKz ?? ''} onChange={e => setImg(o.id, { license: { ...o.license, monthlyKz: e.target.value === '' ? null : Number(e.target.value) } })} data-testid={`vps-int-licprice-${o.id}`} /></label>}
                  <label className="text-xs text-[#64748B]">RAM mínima do plano (GB)<input className={input} type="number" min={0} value={o.minRamGb ?? ''} onChange={e => setImg(o.id, { minRamGb: e.target.value === '' ? null : Number(e.target.value) })} data-testid={`vps-int-ram-${o.id}`} /></label>
                  <label className="text-xs text-[#64748B]">Endereço de acesso<input className={input} placeholder="https://{ip}:8090" value={o.accessUrl ?? ''} onChange={e => setImg(o.id, { accessUrl: e.target.value || null })} data-testid={`vps-int-url-${o.id}`} /></label>
                  <label className="text-xs text-[#64748B]">Utilizador SSH<input className={input} value={o.sshUser} onChange={e => setImg(o.id, { sshUser: e.target.value })} /></label>
                  <label className="text-xs text-[#64748B] sm:col-span-2">Planos permitidos (slugs separados por vírgula; vazio = todos)<input className={input} value={o.plans.join(', ')} onChange={e => setImg(o.id, { plans: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} /></label>
                  <div className="sm:col-span-3 text-xs text-[#64748B]">Localizações compatíveis (nenhuma marcada = todas):
                    <span className="flex flex-wrap gap-3 mt-1">{st.locations.map(l => <label key={l.id} className="inline-flex items-center gap-1 text-[#333]"><input type="checkbox" checked={o.locations.includes(l.id)} onChange={() => setImg(o.id, { locations: o.locations.includes(l.id) ? o.locations.filter(x => x !== l.id) : [...o.locations, l.id] })} data-testid={`vps-int-imgloc-${o.id}-${l.id}`} /> {l.label}</label>)}</span>
                  </div>
                </div>
              </details>
            </li>
          ))}</ul> : <p className="text-xs text-[#94A3B8]">— teste a ligação —</p>}
          <ManualOption onAdd={label => save({ addManualImage: { label, category: 'os' } })} />
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.later} onChange={e => setForm({ ...form, later: e.target.checked })} data-testid="vps-int-later" /> <span>Permitir «Escolher mais tarde»<span className="block text-xs text-[#64748B]">O cliente paga e escolhe a instalação em «Os meus VPS». Nada é comprado na Hostinger antes dessa escolha (a compra exige o template). Só opções com licença incluída.</span></span></label>
        <label className="text-xs text-[#64748B] block max-w-sm">Sufixo do hostname dos VPS (cada item recebe um nome único, usado para conciliar compras)<input className={input} value={form.hostnameSuffix} onChange={e => setForm({ ...form, hostnameSuffix: e.target.value })} data-testid="vps-int-suffix" /></label>
        <button onClick={() => save()} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#F5B700]" data-testid="vps-int-save-options"><Save size={14} /> Guardar opções</button>
      </section>

      <section className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2">Aprovisionamento automático {st.autoProvision ? <span className="text-xs text-green-700 inline-flex items-center gap-1"><CheckCircle2 size={14} /> activo</span> : <span className="text-xs text-[#64748B] inline-flex items-center gap-1"><XCircle size={14} /> desactivado</span>}</h2>
        <p className="text-xs text-[#475569] flex gap-2"><AlertTriangle size={14} className="text-amber-600 shrink-0" /> Com esta opção, depois de o pagamento do cliente ser validado, a ViralizaHost <strong>compra o VPS na Hostinger</strong> com o método de pagamento abaixo, só para planos em modo automático e dentro do limite de custo de cada plano. Nunca são enviados comprovativos nem dados de pagamento do cliente. {st.mode === 'live' && !liveAllowed && 'Em produção as compras reais só acontecem com VPS_LIVE_PURCHASES=1 no servidor (por aprovar).'}</p>
        <label className="text-xs text-[#64748B] block max-w-md">Método de pagamento da conta Hostinger
          {pms.length ? <select className={input} value={form.paymentMethodId} onChange={e => setForm({ ...form, paymentMethodId: e.target.value })} data-testid="vps-int-pm"><option value="">—</option>{pms.map(p => <option key={p.id} value={p.id} disabled={p.unusable}>{p.label}{p.isDefault ? ' (predefinido)' : ''}{p.unusable ? ' — indisponível' : ''}</option>)}</select>
            : <input className={input} value={form.paymentMethodId} placeholder="teste a ligação para escolher" onChange={e => setForm({ ...form, paymentMethodId: e.target.value })} data-testid="vps-int-pm" />}
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.auto} onChange={e => setForm({ ...form, auto: e.target.checked })} data-testid="vps-int-auto" /> Activar o aprovisionamento automático</label>
        {form.auto && !st.autoProvision && <label className="flex items-start gap-2 text-sm text-amber-900"><input type="checkbox" checked={form.confirmAuto} onChange={e => setForm({ ...form, confirmAuto: e.target.checked })} data-testid="vps-int-confirm" /> Confirmo que pretendo que a plataforma compre VPS na Hostinger, com cobrança no método de pagamento da conta, sempre que um pagamento de cliente for validado.</label>}
        <button onClick={() => save()} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#F5B700]" data-testid="vps-int-save-auto"><Save size={14} /> Guardar</button>
      </section>
    </div>
  )
}

function ManualOption({ onAdd }: { onAdd: (label: string) => void }) {
  const [label, setLabel] = useState('')
  return (
    <form className="flex flex-wrap gap-2 mt-2" onSubmit={e => { e.preventDefault(); if (label.trim()) { onAdd(label.trim()); setLabel('') } }}>
      <input className={`${input} max-w-xs`} placeholder="Opção manual (ex.: Windows Server 2022)" value={label} onChange={e => setLabel(e.target.value)} data-testid="vps-int-manual-label" />
      <button className="px-3 py-2 rounded-xl text-xs font-bold border border-[#E5E7EB]" data-testid="vps-int-manual-add">Adicionar opção manual</button>
      <span className="text-[11px] text-[#94A3B8] w-full">Para activação manual: a equipa entrega estas opções (sem template da Hostinger).</span>
    </form>
  )
}
