'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, Send, XCircle } from 'lucide-react'

// Integrações → E-mail transaccional: o que o processo em execução usa para enviar os e-mails
// de verificação e recuperação, estado do domínio no Resend, teste e estado de entrega.
type Config = { keyPresent: boolean; fromEmail: string; fromEmailSet: boolean; fromName: string; fromNameSet: boolean; fromDomain: string; confirmationRequired: boolean; linkBase: string; linkBaseOk: boolean; simulated: boolean }
type Row = { id: string; kind: string; recipient: string; provider_id: string | null; status: string; error: string | null; last_event: string | null; created_at: string }

const KIND: Record<string, string> = { signup: 'Verificação', recovery: 'Recuperação', test: 'Teste' }
const EVENT: Record<string, string> = { sent: 'Enviado (a aguardar entrega)', delivered: 'Entregue', delivery_delayed: 'Entrega atrasada', bounced: 'Devolvido', complained: 'Marcado como spam', opened: 'Aberto', clicked: 'Link aberto', queued: 'Em fila', scheduled: 'Agendado' }
const when = (s: string) => new Date(s.replace(' ', 'T').slice(0, 23) + 'Z').toLocaleString('pt-PT')

function Item({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#334155]">
      {ok ? <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" /> : warn ? <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-red-600 mt-0.5 shrink-0" />}
      <span>{children}</span>
    </li>
  )
}

export default function EmailIntegrationPage() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [domain, setDomain] = useState<{ ok: boolean; message: string } | null>(null)
  const [to, setTo] = useState('')
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    fetch('/api/admin/integrations/email', { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); setCfg(j.config); setRows(j.recent) })
      .catch(e => setErr(e.message))
  }, [])
  useEffect(load, [load])

  async function post(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setNotice(null)
    try {
      const r = await fetch('/api/admin/integrations/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
      const j = await r.json()
      if (action === 'domain') setDomain(j)
      if (j.recent) setRows(j.recent)
      if (action === 'test') setNotice(r.ok && j.ok ? { ok: true, text: `Pedido aceite pelo Resend (id ${j.id}). Isto ainda não prova a entrega: use «Actualizar estado de entrega» dentro de alguns segundos.` } : { ok: false, text: j.error ?? 'Falhou.' })
      if (action === 'refresh') setNotice(j.error ? { ok: false, text: `Estado actualizado em ${j.updated} de ${j.checked}; erro: ${j.error}` } : { ok: true, text: `Estado de entrega actualizado (${j.updated} mensagem(ns)).` })
    } catch { setNotice({ ok: false, text: 'Falha de rede.' }) } finally { setBusy(null) }
  }

  if (err) return <p className="text-sm text-red-600" role="alert">Falha ao carregar: {err}</p>
  if (!cfg) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>

  return (
    <div className="max-w-5xl space-y-5">
      <Link href="/admin/settings/integrations" className="inline-flex items-center gap-1 text-xs font-bold text-[#64748B] hover:text-[#0B0B0D]"><ArrowLeft size={14} /> Integrações</Link>
      <div>
        <h1 className="text-2xl font-black text-[#0B0B0D]">E-mail transaccional</h1>
        <p className="text-sm text-[#64748B]">Verificação de conta e recuperação de senha (Resend). Valores lidos do processo em execução; segredos nunca são mostrados.</p>
      </div>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5" data-testid="email-config">
        <h2 className="font-bold text-[#0B0B0D] mb-3">Configuração</h2>
        <ul className="space-y-2">
          <Item ok={cfg.keyPresent}>{cfg.keyPresent ? <><code>RESEND_API_KEY</code> disponível ao processo</> : <><code>RESEND_API_KEY</code> em falta: nenhum e-mail é enviado (registos ficam «por verificar»)</>}</Item>
          <Item ok={cfg.fromEmailSet} warn>Remetente: <strong>{cfg.fromName} &lt;{cfg.fromEmail}&gt;</strong>{!cfg.fromEmailSet && ' (valor por omissão — defina RESEND_FROM_EMAIL)'}{!cfg.fromNameSet && ' · RESEND_FROM_NAME por omissão'}</Item>
          <Item ok={cfg.linkBaseOk} warn>Links dos e-mails começam por <strong>{cfg.linkBase}</strong>{!cfg.linkBaseOk && ' — em produção deve ser https://viralizahost.com (NEXT_PUBLIC_SITE_URL, fixado no build)'}</Item>
          <Item ok={cfg.confirmationRequired} warn>{cfg.confirmationRequired ? 'Novos clientes só entram depois de confirmar o e-mail' : 'Novos clientes entram sem confirmar o e-mail (o endereço fica por verificar)'} — <a href="/admin/settings/contas" className="underline">Configurações → Contas</a></Item>
          {cfg.simulated && <Item ok={false} warn>RESEND_API_URL definido: envios vão para um simulador (só ensaio)</Item>}
        </ul>
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => post('domain')} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-bold" data-testid="email-domain">
            {busy === 'domain' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Verificar domínio {cfg.fromDomain} no Resend
          </button>
        </div>
        {domain && <div role="status" data-testid="email-domain-result" className={`mt-3 p-3 rounded-xl text-sm ${domain.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>{domain.message}</div>}
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="font-bold text-[#0B0B0D] mb-2">Enviar e-mail de teste</h2>
        <div className="flex flex-wrap gap-2">
          <input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="destino@exemplo.com" className="flex-1 min-w-[220px] rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm" data-testid="email-test-to" />
          <button onClick={() => post('test', { to })} disabled={!!busy || !to} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B0B0D] text-white text-sm font-bold disabled:opacity-50" data-testid="email-test-send">
            {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar teste
          </button>
        </div>
        {notice && <div role="status" data-testid="email-notice" className={`mt-3 p-3 rounded-xl text-sm ${notice.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{notice.text}</div>}
      </section>

      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold text-[#0B0B0D]">Últimos envios</h2>
          <button onClick={() => post('refresh')} disabled={!!busy} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E5E7EB] text-xs font-bold" data-testid="email-refresh">
            {busy === 'refresh' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualizar estado de entrega
          </button>
        </div>
        {rows.length === 0 ? <p className="text-sm text-[#64748B]">Ainda não há envios registados.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[#94A3B8]"><th className="py-2 pr-2">Quando</th><th className="pr-2">Tipo</th><th className="pr-2">Destino</th><th className="pr-2">Pedido ao Resend</th><th>Entrega</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-[#F1F5F9] align-top" data-testid="email-log-row">
                    <td className="py-2 pr-2 whitespace-nowrap">{when(r.created_at)}</td>
                    <td className="py-2 pr-2">{KIND[r.kind] ?? r.kind}</td>
                    <td className="py-2 pr-2 break-all">{r.recipient}</td>
                    <td className="py-2 pr-2">{r.status === 'accepted' ? <span className="text-green-700 font-bold">Aceite</span> : r.status === 'not_configured' ? <span className="text-red-700 font-bold">Não enviado (sem chave)</span> : <span className="text-red-700 font-bold">Recusado</span>}{r.error && <span className="block text-[#B45309]">{r.error}</span>}</td>
                    <td className="py-2">{r.status !== 'accepted' ? '—' : r.last_event ? <span className={r.last_event === 'delivered' || r.last_event === 'opened' || r.last_event === 'clicked' ? 'text-green-700 font-bold' : r.last_event === 'bounced' || r.last_event === 'complained' ? 'text-red-700 font-bold' : 'text-amber-800'}>{EVENT[r.last_event] ?? r.last_event}</span> : <span className="text-[#94A3B8]">Por consultar</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-[#64748B] mt-3">«Aceite» significa que o Resend recebeu o pedido. A entrega só fica provada com o evento «Entregue» (ou «Aberto»). «Devolvido» indica endereço inexistente ou recusa do servidor de destino.</p>
      </section>
    </div>
  )
}
