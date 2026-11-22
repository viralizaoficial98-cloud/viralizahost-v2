'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, Loader2, PlugZap, Upload, XCircle } from 'lucide-react'

// Integrações → WHM/cPanel: o que falta (servidor, credencial, pacote por plano),
// teste só de leitura, mapeamento plano → servidor/pacote e importação com pré-visualização.
type Server = { id: string; label: string; host: string | null; username: string; hasToken: boolean; tokenEncrypted: boolean; active: boolean; primary: boolean }
type Plan = { id: string; slug: string; name: string; category: string; service_type: string | null; sale_status: string; provisioning: string; whm_package: string | null; whm_server_id: string | null }
type State = { encryptionKey: boolean; servers: Server[]; plans: Plan[]; accounts: { total: number; linked: number; candidates: number } }
type Pkg = { name: string; maxpop: string; quota: string }
type ImportPlan = { found: number; new: number; updated: number; unchanged: number; alreadyLinked: number; autoLinked: number; pendingValidation: number; unlinked: number; missingFromWhm: string[]; conflicts: { username: string; message: string }[] }

const sel = 'rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-sm'

function Check({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#334155]">
      {ok ? <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" /> : warn ? <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-red-600 mt-0.5 shrink-0" />}
      <span>{children}</span>
    </li>
  )
}

export default function WhmIntegrationPage() {
  const [st, setSt] = useState<State | null>(null)
  const [err, setErr] = useState('')
  const [test, setTest] = useState<{ ok: boolean; message: string; packages?: Pkg[]; pkgError?: string | null } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<ImportPlan | null>(null)

  const load = useCallback(() => {
    fetch('/api/admin/integrations/whm', { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); setSt(j) })
      .catch(e => setErr(e.message))
  }, [])
  useEffect(load, [load])

  const primary = st?.servers.find(s => s.primary) ?? null
  async function runTest() {
    setBusy('test'); setNotice(null)
    try {
      const r = await fetch('/api/admin/integrations/whm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) })
      setTest(await r.json())
    } catch { setTest({ ok: false, message: 'Falha de rede.' }) } finally { setBusy(null) }
  }
  async function map(p: Plan, provisioning: string, whmPackage: string) {
    if (!window.confirm(provisioning === 'whm' ? `Associar «${p.name}» ao pacote WHM «${whmPackage}»? As próximas encomendas pagas deste plano criam a conta cPanel automaticamente.` : `Passar «${p.name}» para activação manual?`)) return
    setBusy(p.id); setNotice(null)
    try {
      const r = await fetch('/api/admin/integrations/whm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'map', productId: p.id, provisioning, whmPackage, serverId: primary?.id }) })
      const j = await r.json()
      if (!r.ok) setNotice({ ok: false, text: j.error ?? 'Falhou.' }); else { setSt(j.state); setNotice({ ok: true, text: `«${p.name}» actualizado.` }) }
    } catch { setNotice({ ok: false, text: 'Falha de rede.' }) } finally { setBusy(null) }
  }
  async function importAccounts(apply: boolean) {
    if (apply && !window.confirm('Importar as contas do WHM? Contas existentes são preservadas; nenhuma conta é associada a um cliente só por e-mail coincidente (fica «a validar»).')) return
    setBusy(apply ? 'import' : 'preview'); setNotice(null)
    try {
      const r = await fetch('/api/admin/whm/import', { method: apply ? 'POST' : 'GET', cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) setNotice({ ok: false, text: j.error ?? 'Falhou.' })
      else { setPreview(j.plan); if (apply) { setNotice({ ok: true, text: 'Importação aplicada.' }); load() } }
    } catch { setNotice({ ok: false, text: 'Falha de rede.' }) } finally { setBusy(null) }
  }

  if (err) return <p className="text-sm text-red-600" role="alert">Falha ao carregar: {err}</p>
  if (!st) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  const whmPlans = st.plans.filter(p => p.sale_status === 'active')
  const missingPkg = whmPlans.filter(p => p.provisioning === 'whm' && !p.whm_package)
  const packages = test?.packages ?? []

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/admin/settings/integrations" className="inline-flex items-center gap-1 text-xs font-bold text-[#64748B] hover:text-[#0B0B0D]"><ArrowLeft size={14} /> Integrações</Link>
      <div>
        <h1 className="text-2xl font-black text-[#0B0B0D]">WHM / cPanel</h1>
        <p className="text-sm text-[#64748B]">Activação automática de alojamento e e-mail, acesso do cliente ao cPanel/Webmail e importação de contas existentes.</p>
      </div>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5" data-testid="whm-checklist">
        <h2 className="font-bold text-[#0B0B0D] mb-3">O que está configurado</h2>
        <ul className="space-y-2">
          <Check ok={st.encryptionKey}>Chave de cifra no servidor (<code>WHM_ENCRYPTION_KEY</code>){st.encryptionKey ? '' : ' — em falta: o token não pode ser guardado nem lido'}</Check>
          <Check ok={!!primary}>{primary ? <>Servidor: <strong>{primary.host}</strong> (utilizador {primary.username})</> : 'Servidor WHM em falta'}</Check>
          <Check ok={!!primary?.hasToken && !!primary?.tokenEncrypted} warn={!!primary?.hasToken && !primary?.tokenEncrypted}>
            {!primary?.hasToken ? 'Credencial (token de API) em falta' : primary.tokenEncrypted ? 'Token guardado cifrado' : 'Token guardado SEM cifra — volte a guardá-lo em Configurações para o cifrar'}
          </Check>
          <Check ok={missingPkg.length === 0} warn>{missingPkg.length ? `${missingPkg.length} plano(s) com activação WHM sem pacote: ${missingPkg.map(p => p.name).join(', ')}` : 'Todos os planos com activação WHM têm pacote'}</Check>
          <Check ok warn={st.accounts.candidates > 0}>{st.accounts.total} conta(s) WHM no portal · {st.accounts.linked} associada(s) · {st.accounts.candidates} candidata(s) por validar</Check>
        </ul>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/admin/settings#whm" className="px-4 py-2 rounded-xl bg-[#0B0B0D] text-white text-sm font-bold" data-testid="whm-configure">{primary ? 'Alterar servidor ou token' : 'Configurar servidor e token'}</Link>
          <button disabled={!primary || !!busy} onClick={runTest} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-bold" data-testid="whm-test" title="Só leitura: versão, lista de contas e pacotes">
            {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Testar ligação
          </button>
        </div>
        {test && <div role="status" data-testid="whm-test-result" className={`mt-3 p-3 rounded-xl text-sm ${test.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{test.message}{test.ok && ` ${packages.length} pacote(s) disponíveis.`}{test.pkgError && ` Pacotes: ${test.pkgError}`}</div>}
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="font-bold text-[#0B0B0D]">Plano → servidor e pacote</h2>
        <p className="text-xs text-[#64748B] mb-3">{test?.ok ? 'Escolha o pacote de cada plano (lista lida do WHM).' : 'Teste a ligação para carregar a lista de pacotes do WHM.'} Servidor: {primary?.host ?? '—'}.</p>
        {notice && <div role="status" className={`mb-3 p-3 rounded-xl text-sm ${notice.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{notice.text}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[#64748B]"><th className="py-2 pr-2">Plano</th><th className="pr-2">Activação</th><th className="pr-2">Pacote WHM</th><th>E-mail</th></tr></thead>
            <tbody>
              {st.plans.map(p => {
                const pkg = packages.find(x => x.name === p.whm_package)
                const email = p.provisioning !== 'whm' || !p.whm_package ? 'Intervenção manual'
                  : pkg ? (pkg.maxpop === '0' ? 'O pacote não permite caixas de e-mail' : `Automático — o cliente cria até ${/unlim/i.test(pkg.maxpop) ? 'ilimitadas' : pkg.maxpop} caixa(s) no seu painel`)
                  : 'Automático (teste a ligação para ver o limite de caixas)'
                return (
                  <tr key={p.id} className="border-t border-[#F3F3F3] align-top" data-testid="whm-plan-row">
                    <td className="py-2 pr-2"><span className="font-semibold">{p.name}</span><span className="block text-xs text-[#94A3B8]">{p.slug}{p.sale_status !== 'active' ? ` · ${p.sale_status === 'on_request' ? 'sob consulta' : 'rascunho'}` : ''}</span></td>
                    <td className="py-2 pr-2">
                      <select className={sel} value={p.provisioning === 'whm' ? 'whm' : 'manual'} disabled={!!busy}
                        onChange={e => e.target.value === 'manual' ? map(p, 'manual', '') : setSt(s => s && ({ ...s, plans: s.plans.map(x => x.id === p.id ? { ...x, provisioning: 'whm' } : x) }))}>
                        <option value="manual">Manual</option><option value="whm">WHM (automática)</option>
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      {p.provisioning === 'whm' ? (
                        packages.length ? (
                          <select className={sel} value={p.whm_package ?? ''} disabled={!!busy} onChange={e => e.target.value && map(p, 'whm', e.target.value)} data-testid={`whm-pkg-${p.slug}`}>
                            <option value="">— escolher —</option>
                            {packages.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}
                          </select>
                        ) : <span className={p.whm_package ? '' : 'text-amber-700'}>{p.whm_package ?? 'sem pacote'}</span>
                      ) : <span className="text-[#94A3B8]">—</span>}
                    </td>
                    <td className="py-2 text-xs text-[#334155]">{email}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#64748B] mt-3">Se a activação falhar, o motivo fica na encomenda e «Repetir activação» procura primeiro a conta no WHM: nunca cria uma segunda conta para o mesmo serviço.</p>
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="font-bold text-[#0B0B0D]">Importar contas existentes</h2>
        <p className="text-xs text-[#64748B] mb-3">A pré-visualização não grava nada. Contas já existentes são preservadas; um e-mail coincidente só cria um <strong>candidato</strong> que a equipa valida em <Link className="underline" href="/admin/servers/whm-accounts">Contas WHM</Link>.</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={!primary || !!busy} onClick={() => importAccounts(false)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-bold" data-testid="whm-preview">
            {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Pré-visualizar
          </button>
          <button disabled={!preview || !!busy} onClick={() => importAccounts(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5B700] text-black text-sm font-bold" data-testid="whm-apply">
            {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Aplicar importação
          </button>
        </div>
        {preview && (
          <div className="mt-3 text-sm" data-testid="whm-preview-result">
            <p>{preview.found} conta(s) no WHM · {preview.new} nova(s) · {preview.updated} actualizada(s) · {preview.unchanged} sem alterações</p>
            <p>{preview.alreadyLinked} já associada(s) · {preview.pendingValidation} candidata(s) por validar (e-mail coincidente) · {preview.unlinked} sem cliente</p>
            <p>{preview.conflicts.length} conflito(s)/duplicado(s){preview.conflicts.length ? ': ' + preview.conflicts.map(c => `${c.username} — ${c.message}`).join('; ') : ''}</p>
            {preview.missingFromWhm.length > 0 && <p>{preview.missingFromWhm.length} conta(s) do portal ausentes do WHM: {preview.missingFromWhm.join(', ')}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
