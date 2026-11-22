import Link from 'next/link'
import { Users, Activity, Globe, CheckCircle2, CreditCard, Server, MessageSquare, AlertTriangle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { requireAdminRole } from '@/lib/api/require-admin'
import { dashboard } from '@/lib/admin/dashboard'
import { kz } from '@/lib/commerce/status'
import { PendingActions } from '@/components/admin/PendingActions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin Dashboard' }

const card = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }
const money = (currency: string, n: number) => currency === 'AKZ' ? kz(n) : `${currency} ${n.toLocaleString('pt-PT', { maximumFractionDigits: 2 })}`

function Tile({ title, value, sub, Icon, testId, error }: { title: string; value: React.ReactNode; sub?: React.ReactNode; Icon: typeof Users; testId: string; error?: boolean }) {
  return (
    <div className="rounded-2xl p-5 bg-white border border-[#E5E7EB]" data-testid={testId}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}><Icon size={15} style={{ color: '#D9A300' }} /></div>
        <span className="text-xs font-bold text-[#64748B]">{title}</span>
      </div>
      {error ? <p className="text-sm font-bold text-red-700 flex items-center gap-1" role="alert"><AlertTriangle size={14} /> Falha ao carregar</p>
        : <div className="text-2xl font-black text-[#0B0B0D]" data-testid={`${testId}-value`}>{value}</div>}
      {sub && !error && <div className="text-xs text-[#64748B] mt-1 space-y-0.5">{sub}</div>}
    </div>
  )
}

export default async function AdminPage() {
  try { await requireAdminRole() } catch { redirect('/login') }
  const { safe } = dashboard
  const [revenue, clients, recent, plans, tickets, servers] = await Promise.all([
    safe(() => dashboard.monthRevenue()), safe(dashboard.clientStats), safe(() => dashboard.recentAccounts()),
    safe(dashboard.activePlans), safe(dashboard.openTickets), safe(dashboard.whmServers),
  ])

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Dashboard Administrativo</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>O que exige intervenção e o estado da plataforma ViralizaHost</p>
      </div>

      <PendingActions />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile testId="stat-clients" title="Clientes registados" Icon={Users} error={!clients.ok}
          value={clients.ok ? clients.data.registered : '—'}
          sub={clients.ok && <>
            <p>{clients.data.buyersPaid} conta(s) com encomenda paga</p>
            {clients.data.staffOrders > 0 && <p className="text-amber-800">{clients.data.staffOrders} encomenda(s) feitas com contas da equipa</p>}
            <p>{clients.data.guestOrders ? `${clients.data.guestOrders} encomenda(s) sem conta` : 'Compras sem conta: não há (o checkout exige sessão)'}</p>
          </>} />
        <Tile testId="stat-plans" title="Serviços activos" Icon={Server} error={!plans.ok}
          value={plans.ok ? plans.data.total : '—'}
          sub={plans.ok && <p>{Object.entries(plans.data.byKind).map(([k, v]) => `${v} ${k}`).join(' · ') || 'Pagos e activados; renovações não contam'}</p>} />
        <Tile testId="stat-revenue" title={`Receita confirmada — ${revenue.ok ? revenue.data.month : 'este mês'}`} Icon={CreditCard} error={!revenue.ok}
          value={revenue.ok ? (revenue.data.byCurrency.length ? revenue.data.byCurrency.map(c => <span key={c.currency} className="block">{money(c.currency, c.net)}</span>) : kz(0)) : '—'}
          sub={revenue.ok && <>
            <p>Pagamentos validados no mês (hora de Luanda), menos reembolsos</p>
            {revenue.data.byCurrency.some(c => c.refunds > 0) && <p>Reembolsos: {revenue.data.byCurrency.filter(c => c.refunds).map(c => money(c.currency, c.refunds)).join(', ')}</p>}
            {revenue.data.excludedDuplicates > 0 && <p className="text-amber-800">Excluído por duplicado: {kz(revenue.data.excludedDuplicates)}</p>}
            {revenue.data.excludedTest.count > 0 && <p className="text-amber-800">Excluídas {revenue.data.excludedTest.count} encomenda(s) marcadas como teste ({Object.entries(revenue.data.excludedTest.byCurrency).map(([c, v]) => money(c, v)).join(', ')})</p>}
            {revenue.data.paidWithoutPayment > 0 && <p className="text-amber-800">{revenue.data.paidWithoutPayment} factura(s) paga(s) sem registo de pagamento</p>}
          </>} />
        <Tile testId="stat-tickets" title="Tickets abertos" Icon={MessageSquare} error={!tickets.ok} value={tickets.ok ? tickets.data : '—'} sub={<Link href="/admin/tickets" className="underline">Ver tickets</Link>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6" style={card} data-testid="recent-accounts">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}><Users size={15} style={{ color: '#D9A300' }} /></div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Clientes e compradores recentes</h2>
          </div>
          {!recent.ok ? <p className="text-sm text-red-700" role="alert">Falha ao carregar.</p>
            : recent.data.length === 0 ? <div className="py-8 text-center text-sm" style={{ color: '#94A3B8' }}>Ainda sem clientes nem encomendas</div>
            : recent.data.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)', color: '#D9A300' }}>
                  {(c.name?.[0] ?? c.email[0]).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2" style={{ color: '#0B0B0D' }}>
                    {c.name}
                    {c.role !== 'client' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">{c.role === 'admin' ? 'Conta da equipa' : c.role}</span>}
                  </div>
                  <div className="text-xs truncate" style={{ color: '#94A3B8' }}>{c.email}</div>
                </div>
                <div className="text-right shrink-0 text-xs" style={{ color: '#64748B' }}>
                  {c.lastOrder ? <span className="block">{c.lastOrder} · {c.lastOrderPaid ? 'paga' : 'por pagar'}</span> : <span className="block">sem encomendas</span>}
                  <span className="block">{c.activeServices} serviço(s) activo(s)</span>
                </div>
              </div>
            ))}
        </div>

        <div className="p-6" style={card}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}><Activity size={15} style={{ color: '#059669' }} /></div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Servidores</h2>
          </div>
          {!servers.ok ? <p className="text-sm text-red-700" role="alert">Falha ao carregar.</p>
            : servers.data.length === 0 ? <div className="py-4 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhum servidor configurado</div>
            : (
              <ul className="space-y-2">
                {servers.data.map((s: { id: string; name: string; hostname: string; is_active: number; has_whm: number }) => (
                  <li key={s.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <span className="flex items-center gap-2 text-sm font-medium" style={{ color: '#0B0B0D' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.is_active ? '#10B981' : '#EF4444' }} />
                      {s.name === '__whm_config__' ? s.hostname : s.name}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: Number(s.has_whm) ? '#059669' : '#94A3B8' }}>{Number(s.has_whm) ? 'API WHM' : 'sem API'}</span>
                  </li>
                ))}
              </ul>
            )}
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold">
            <Link href="/admin/settings/integrations/whm" className="underline inline-flex items-center gap-1"><CheckCircle2 size={12} /> WHM/cPanel</Link>
            <Link href="/admin/settings/integrations/registrar" className="underline inline-flex items-center gap-1"><Globe size={12} /> Registrador</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
