import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Globe, HardDrive, Mail, Package, Server, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listClientServices, type ClientService } from '@/lib/commerce/client-services'
import { PAYMENT_STATUS, TONE_CLASS, kz } from '@/lib/commerce/status'
import { ServiceActions } from '@/components/services/ServiceActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Serviços' }

const ICON = { hosting: Server, email: Mail, domain: Globe, server: HardDrive, other: Package }
const KIND = { hosting: 'Alojamento', email: 'E-mail', domain: 'Domínio', server: 'Servidor', other: 'Serviço' }
const CYCLE: Record<string, string> = { monthly: 'mês', '3months': 'trimestre', '6months': '6 meses', '1year': 'ano', '2years': '2 anos', '3years': '3 anos' }
const STATE: Record<string, { label: string; tone: 'gray' | 'amber' | 'green' | 'red' }> = {
  pending: { label: 'A aguardar pagamento', tone: 'gray' },
  in_progress: { label: 'Em activação', tone: 'amber' },
  manual_required: { label: 'Activação manual pela equipa', tone: 'amber' },
  failed: { label: 'Falha na activação', tone: 'red' },
  active: { label: 'Activo', tone: 'green' },
  suspended: { label: 'Suspenso', tone: 'red' },
  expired: { label: 'Expirado', tone: 'red' },
}
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-PT') : '—')

function state(s: ClientService) {
  if (s.status === 'suspended' || s.hosting?.status === 'suspended') return STATE.suspended
  if (s.status === 'expired') return STATE.expired
  return STATE[s.provisioningStatus] ?? STATE.pending
}

function Usage({ used, limit }: { used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between text-xs text-[#64748B] mb-1"><span>Disco</span><span>{used.toLocaleString('pt-PT')} MB / {limit ? `${limit.toLocaleString('pt-PT')} MB` : 'ilimitado'}</span></div>
      <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Uso de disco">
        <div className="h-full rounded-full" style={{ width: `${limit ? pct : 0}%`, background: pct > 85 ? '#DC2626' : '#F5B700' }} />
      </div>
    </div>
  )
}

export default async function ServicesPage() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  let services: ClientService[] = []
  let failed = false
  try { services = await listClientServices(user.id) } catch { failed = true }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0B0B0D]">Serviços</h1>
          <p className="text-sm text-[#64748B] mt-1">Estado, utilização, facturas, renovação e acções de cada serviço.</p>
        </div>
        <Link href="/checkout" className="px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-[#F5B700]">Contratar serviço</Link>
      </div>

      {failed && <p className="text-sm text-red-600" role="alert">Não foi possível carregar os serviços. Tente novamente dentro de instantes.</p>}
      {!failed && !services.length && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-sm">
          <Package className="mx-auto text-[#94A3B8] mb-3" />
          <p className="text-[#334155] mb-4">Ainda não tem serviços. Depois de uma compra paga, os serviços aparecem aqui.</p>
          <Link href="/checkout" className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-[#F5B700]">Ver serviços</Link>
        </div>
      )}

      <ul className="space-y-4">
        {services.map(s => {
          const Icon = ICON[s.kind]
          const st = state(s)
          const active = s.provisioningStatus === 'active' && st !== STATE.suspended
          const canRenew = active && (s.kind === 'domain' ? !!s.domainInfo : (s.renewalPrice ?? 0) > 0)
          const due = s.kind === 'domain' ? s.domainInfo?.expiresAt ?? null : s.nextDueDate
          return (
            <li key={s.id} className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden" data-testid="service-card">
              <div className="p-5 flex flex-wrap items-start gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#FFF8E1] shrink-0"><Icon size={20} className="text-[#B45309]" /></div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[11px] uppercase tracking-widest text-[#64748B] font-bold">{KIND[s.kind]}</p>
                  <p className="font-black text-[#0B0B0D]">{s.name}</p>
                  {s.domain && <p className="text-sm text-[#334155]">{s.domain}</p>}
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TONE_CLASS[st.tone]}`}>{st.label}</span>
              </div>

              {s.provisioningStatus !== 'active' && (
                <div className="mx-5 mb-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] p-3 text-sm text-[#334155] flex gap-2">
                  {s.provisioningStatus === 'failed' ? <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" /> : <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />}
                  <span>
                    {s.provisioningStatus === 'pending' && 'Activamos o serviço assim que o pagamento for confirmado.'}
                    {s.provisioningStatus === 'in_progress' && 'A activação está em curso.'}
                    {s.provisioningStatus === 'manual_required' && 'Este serviço é activado manualmente pela equipa. Recebe aviso aqui quando estiver pronto.'}
                    {s.provisioningStatus === 'failed' && 'A activação automática falhou. A equipa foi notificada e volta a tentar sem nova cobrança.'}
                    {s.order && <> <Link href={`/orders/${s.order.id}`} className="underline">Ver encomenda {s.order.number}</Link></>}
                  </span>
                </div>
              )}

              <div className="px-5 pb-5 grid md:grid-cols-3 gap-5">
                <dl className="text-sm space-y-1.5">
                  {s.hosting?.package && <div className="flex justify-between gap-2"><dt className="text-[#64748B]">Plano</dt><dd className="font-semibold text-right">{s.hosting.package}</dd></div>}
                  {s.cycle && s.kind !== 'domain' && <div className="flex justify-between gap-2"><dt className="text-[#64748B]">Ciclo</dt><dd className="font-semibold">{CYCLE[s.cycle] ?? s.cycle}</dd></div>}
                  <div className="flex justify-between gap-2"><dt className="text-[#64748B]">{s.kind === 'domain' ? 'Expira' : 'Próximo vencimento'}</dt><dd className="font-semibold">{date(due)}</dd></div>
                  {s.renewalPrice != null && s.renewalPrice > 0 && <div className="flex justify-between gap-2"><dt className="text-[#64748B]">Renovação</dt><dd className="font-semibold">{kz(s.renewalPrice)}{s.cycle && s.kind !== 'domain' ? ` / ${CYCLE[s.cycle] ?? s.cycle}` : ' / ano'}</dd></div>}
                  {s.hosting && <div className="flex justify-between gap-2"><dt className="text-[#64748B]">Utilizador cPanel</dt><dd className="font-mono text-xs">{s.hosting.username}</dd></div>}
                  {s.domainInfo && s.domainInfo.nameservers.length > 0 && <div><dt className="text-[#64748B]">Nameservers</dt><dd className="font-mono text-xs">{s.domainInfo.nameservers.join(', ')}</dd></div>}
                </dl>

                <div className="space-y-3">
                  {s.hosting ? (
                    <>
                      <Usage used={s.hosting.diskUsedMb} limit={s.hosting.diskLimitMb} />
                      <p className="text-xs text-[#64748B]">{s.hosting.emailCount} contas de e-mail · {s.hosting.dbCount} bases de dados{s.hosting.php ? ` · PHP ${s.hosting.php}` : ''}</p>
                      {s.hosting.lastSynced && <p className="text-[11px] text-[#94A3B8]">Dados do WHM em {date(s.hosting.lastSynced)}</p>}
                    </>
                  ) : s.kind === 'domain' ? (
                    <p className="text-xs text-[#64748B]">A gestão automática de DNS/NS depende da integração com o registrador, que ainda não está activa. Peça a alteração ao suporte.</p>
                  ) : s.kind === 'server' ? (
                    <p className="text-xs text-[#64748B]">Reinícios, reinstalações e acessos são feitos pela equipa através de pedido de suporte.</p>
                  ) : null}
                  {s.invoices.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-[#64748B] font-bold mb-1">Facturas</p>
                      <ul className="text-xs space-y-1">
                        {s.invoices.slice(0, 4).map(i => (
                          <li key={i.id} className="flex justify-between gap-2">
                            <Link href={`/billing/invoices/${i.id}`} className="underline">{i.number}</Link>
                            <span className={i.status === 'paid' ? 'text-green-700' : 'text-amber-700'}>{i.status === 'paid' ? 'Paga' : i.status === 'under_review' ? 'Em análise' : 'Por pagar'} · {kz(i.total)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <ServiceActions id={s.id} name={s.name} kind={s.kind} domain={s.domain} active={active} hasCpanel={!!s.hosting} canRenew={canRenew} renewalPendingOrder={s.renewalPending?.orderId ?? null} />
                </div>
              </div>

              <details className="border-t border-[#F1F5F9] px-5 py-3">
                <summary className="text-xs font-bold text-[#64748B] cursor-pointer">Histórico</summary>
                <ul className="mt-2 text-xs space-y-1">
                  {s.history.map(h => {
                    const pay = h.paymentStatus ? PAYMENT_STATUS[h.paymentStatus] : null
                    return (
                      <li key={h.id} className="flex flex-wrap gap-2 items-center">
                        <span className="text-[#94A3B8] w-24">{date(h.date)}</span>
                        <span className="font-semibold">{h.label}</span>
                        {h.orderId && <Link href={`/orders/${h.orderId}`} className="underline">{h.orderNumber}</Link>}
                        {pay && <span className={`px-1.5 rounded ${TONE_CLASS[pay.tone]}`}>{pay.label}</span>}
                        {h.status === 'active' && <CheckCircle2 size={12} className="text-green-600" aria-label="Concluído" />}
                      </li>
                    )
                  })}
                </ul>
              </details>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
