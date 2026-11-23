'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, PlugZap, Save, XCircle } from 'lucide-react'

// Integrações → Registrador de domínios.
// Sem fornecedor activo, cada extensão continua em registo manual pela equipa.
type Provider = { id: string; label: string; testOnly?: boolean; needsUrl?: boolean; needsUser?: boolean }
type State = {
  settings: { provider: string; mode: 'test' | 'live'; enabled: boolean; apiUrl: string | null; username: string | null; hasSecret: boolean; extensions: string[]; lastTest: { at: string | null; ok: boolean | null; message: string | null } }
  defaultNameservers: string[]
  providers: Provider[]; extensions: { extension: string; onSale: boolean }[]; operations: Record<string, number>; encryptionKey: boolean; testProvisioning: boolean
}

const input = 'w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]'

export default function RegistrarIntegrationPage() {
  const [st, setSt] = useState<State | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | 'ns' | null>(null)
  const [nsForm, setNsForm] = useState<string[]>(['', '', '', ''])
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [form, setForm] = useState({ provider: 'none', mode: 'test' as 'test' | 'live', apiUrl: '', username: '', secret: '', extensions: [] as string[], enabled: false })

  const apply = (s: State) => {
    setSt(s)
    setNsForm([...s.defaultNameservers, '', '', '', ''].slice(0, 4))
    setForm({ provider: s.settings.provider, mode: s.settings.mode, apiUrl: s.settings.apiUrl ?? '', username: s.settings.username ?? '', secret: '', extensions: s.settings.extensions, enabled: s.settings.enabled })
  }
  const load = useCallback(() => {
    fetch('/api/admin/integrations/registrar', { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); apply(j) })
      .catch(e => setErr(e.message))
  }, [])
  useEffect(load, [load])

  async function post(body: Record<string, unknown>, kind: 'save' | 'test' | 'ns') {
    setBusy(kind); setNotice(null)
    try {
      const r = await fetch('/api/admin/integrations/registrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) setNotice({ ok: false, text: j.error ?? 'Falhou.' })
      else {
        apply(j.state)
        setNotice(kind === 'test' ? { ok: j.ok, text: j.message } : { ok: true, text: kind === 'ns' ? 'Nameservers padrão guardados.' : 'Configuração guardada.' })
      }
    } catch { setNotice({ ok: false, text: 'Falha de rede.' }) } finally { setBusy(null) }
  }

  if (err) return <p className="text-sm text-red-600" role="alert">Falha ao carregar: {err}</p>
  if (!st) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  const provider = st.providers.find(p => p.id === form.provider)
  const lt = st.settings.lastTest
  const toggleExt = (e: string) => setForm(f => ({ ...f, extensions: f.extensions.includes(e) ? f.extensions.filter(x => x !== e) : [...f.extensions, e] }))

  return (
    <div className="max-w-4xl space-y-5">
      <Link href="/admin/settings/integrations" className="inline-flex items-center gap-1 text-xs font-bold text-[#64748B] hover:text-[#0B0B0D]"><ArrowLeft size={14} /> Integrações</Link>
      <div>
        <h1 className="text-2xl font-black text-[#0B0B0D]">Registrador de domínios</h1>
        <p className="text-sm text-[#64748B]">Consulta de disponibilidade e registo automático depois do pagamento validado. As extensões não seleccionadas continuam em registo manual pela equipa.</p>
      </div>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5" data-testid="registrar-status">
        <div className="flex flex-wrap items-center gap-3">
          {st.settings.enabled ? <CheckCircle2 className="text-green-600" size={20} /> : <XCircle className="text-amber-600" size={20} />}
          <p className="font-bold text-[#0B0B0D]">
            {st.settings.enabled ? `Activo — ${st.providers.find(p => p.id === st.settings.provider)?.label} (${st.settings.mode === 'live' ? 'produção' : 'ensaio'})` : 'Integração inactiva: registo, renovação e transferência manuais'}
          </p>
        </div>
        <p className="text-sm text-[#334155] mt-2">
          Último teste: {lt.at ? `${new Date(lt.at.replace(' ', 'T').slice(0, 23) + 'Z').toLocaleString('pt-PT')} — ${lt.ok ? 'ligação OK' : 'falhou'}${lt.message ? ` (${lt.message})` : ''}` : 'nunca testado'}
        </p>
        {st.settings.enabled && st.settings.mode === 'test' && !st.testProvisioning && (
          <p className="text-xs text-amber-800 mt-2">Modo de ensaio: as encomendas reais continuam em registo manual (só o servidor de ensaio executa operações simuladas).</p>
        )}
        <p className="text-xs text-[#64748B] mt-2">Operações registadas: {Object.entries(st.operations).map(([k, v]) => `${v} ${k}`).join(', ') || 'nenhuma'}</p>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-4">
        <h2 className="font-bold text-[#0B0B0D]">Configuração</h2>
        {!st.encryptionKey && <p className="text-sm text-red-700" role="alert">WHM_ENCRYPTION_KEY não está configurada: não é possível guardar credenciais.</p>}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-sm font-semibold text-[#334155]">Fornecedor
            <select className={input} value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value, mode: st.providers.find(p => p.id === e.target.value)?.testOnly ? 'test' : f.mode, enabled: false }))} data-testid="registrar-provider">
              {st.providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#334155]">Modo
            <select className={input} value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as 'test' | 'live', enabled: false }))} disabled={!!provider?.testOnly}>
              <option value="test">Ensaio (OT&amp;E / sandbox)</option>
              <option value="live">Produção</option>
            </select>
          </label>
          {form.provider !== 'none' && (
            <>
              <label className="text-sm font-semibold text-[#334155] sm:col-span-2">Endereço da API
                <input className={input} value={form.apiUrl} onChange={e => setForm(f => ({ ...f, apiUrl: e.target.value }))} placeholder="https://…" data-testid="registrar-url" />
              </label>
              <label className="text-sm font-semibold text-[#334155]">Utilizador / ID de revendedor
                <input className={input} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoComplete="off" />
              </label>
              <label className="text-sm font-semibold text-[#334155]">Chave da API
                <input className={input} type="password" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} autoComplete="new-password"
                  placeholder={st.settings.hasSecret ? 'Guardada — deixe em branco para manter' : 'Cole a chave'} data-testid="registrar-secret" />
              </label>
            </>
          )}
        </div>

        {form.provider !== 'none' && (
          <div>
            <p className="text-sm font-semibold text-[#334155] mb-2">Extensões com registo automático</p>
            <div className="flex flex-wrap gap-2">
              {st.extensions.map(e => (
                <label key={e.extension} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm cursor-pointer ${form.extensions.includes(e.extension) ? 'border-[#F5B700] bg-[#FFF8E1]' : 'border-[#E5E7EB]'}`}>
                  <input type="checkbox" checked={form.extensions.includes(e.extension)} onChange={() => toggleExt(e.extension)} data-testid={`registrar-ext-${e.extension}`} />
                  {e.extension}{!e.onSale && <span className="text-[10px] text-[#94A3B8]">(fora de venda)</span>}
                </label>
              ))}
            </div>
            <p className="text-xs text-[#64748B] mt-2">Seleccione só as extensões que o fornecedor contratado aceita por API (consulta e registo). As restantes ficam «A confirmar pela equipa» e são registadas à mão.</p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm font-semibold text-[#334155]">
          <input type="checkbox" checked={form.enabled} disabled={form.provider === 'none'} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} data-testid="registrar-enabled" />
          Activar integração (exige um teste de ligação bem-sucedido com esta configuração)
        </label>

        {notice && <div role="status" className={`p-3 rounded-xl text-sm ${notice.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{notice.text}</div>}
        <div className="flex flex-wrap gap-2">
          <button disabled={!!busy} onClick={() => post({ action: 'save', ...form }, 'save')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B0B0D] text-white text-sm font-bold" data-testid="registrar-save">
            {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
          <button disabled={!!busy || st.settings.provider === 'none'} onClick={() => post({ action: 'test' }, 'test')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-bold" data-testid="registrar-test"
            title="Consulta só de leitura: não regista nem cobra">
            {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Testar ligação
          </button>
        </div>
        <p className="text-xs text-[#64748B]">«Testar ligação» usa a configuração guardada e faz apenas uma consulta de leitura à conta — nunca regista, transfere nem cobra.</p>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-3" data-testid="default-ns">
        <h2 className="font-bold text-[#0B0B0D]">Nameservers padrão</h2>
        <p className="text-sm text-[#64748B]">Mostrados na configuração de domínios do site («Usar os nameservers da ViralizaHost») e enviados ao registrador nos registos que os usam. Mínimo 2.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {nsForm.map((v, i) => (
            <label key={i} className="text-sm font-semibold text-[#334155]">Nameserver {i + 1}{i < 2 ? ' *' : ''}
              <input className={`${input} font-mono`} value={v} onChange={e => { const n = [...nsForm]; n[i] = e.target.value; setNsForm(n) }} placeholder={`ns${i + 1}.viralizahost.com`} data-testid={`default-ns-${i + 1}`} />
            </label>
          ))}
        </div>
        <button disabled={!!busy} onClick={() => post({ action: 'nameservers', nameservers: nsForm.filter(x => x.trim()) }, 'ns')} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B0B0D] text-white text-sm font-bold" data-testid="default-ns-save">
          {busy === 'ns' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar nameservers
        </button>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 text-sm text-[#334155] space-y-2">
        <h2 className="font-bold text-[#0B0B0D]">Como funciona</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Depois de o pagamento ser validado, a disponibilidade é confirmada no fornecedor e o registo é pedido <strong>uma única vez</strong> (referência fixa por serviço).</li>
          <li>Se o fornecedor não responder a tempo, o estado fica «inconclusivo»: a repetição consulta primeiro o fornecedor e só volta a pedir se ele não tiver o pedido.</li>
          <li>O domínio só passa a «Activo» quando o fornecedor confirma o registo, ou quando a equipa o marca manualmente com a referência do registo.</li>
          <li>O passo a passo para contratar e configurar está em <code>docs/integracoes-registrador-whm.md</code>.</li>
        </ul>
      </section>
    </div>
  )
}
