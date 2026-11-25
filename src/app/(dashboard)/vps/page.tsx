import Link from 'next/link'
import { redirect } from 'next/navigation'
import { HardDrive, MapPin, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { listMyVps, type MyVps } from '@/lib/vps/manage'
import { clientVpsRequests, VPS_REQ_LABEL, type VpsRequestStatus } from '@/lib/vps/requests'
import { VPS_TONE } from '@/components/vps/tone'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Os meus VPS' }

export default async function MyVpsPage() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')
  let items: MyVps[] = []
  let failed = false
  try { items = await listMyVps(user.id) } catch { failed = true }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: any[] = await clientVpsRequests(user.id).catch(() => [])

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0B0B0D]">Os meus VPS</h1>
          <p className="text-sm text-[#64748B] mt-1">Estado, acesso, energia e reinstalação dos seus servidores VPS.</p>
        </div>
        <Link href="/servidor-vps/configurar" className="px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-[#F5B700]">Contratar VPS</Link>
      </div>
      {failed && <p className="text-sm text-red-600" role="alert">Não foi possível carregar os VPS. Tente novamente dentro de instantes.</p>}
      {!failed && !items.length && !requests.length && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-sm" data-testid="vps-empty">
          <HardDrive className="mx-auto text-[#94A3B8] mb-3" />
          <p className="text-[#334155] mb-4">Ainda não tem VPS. Depois de uma compra, os servidores aparecem aqui.</p>
          <Link href="/servidor-vps" className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-[#F5B700]">Ver planos VPS</Link>
        </div>
      )}
      {requests.length > 0 && (
        <section className="space-y-2" data-testid="vps-requests">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#64748B]">Pedidos de VPS</h2>
          {requests.map(r => (
            <div key={r.id} className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm p-4 flex flex-wrap gap-x-4 gap-y-1 items-center text-sm" data-testid="vps-request-row" data-ref={r.reference}>
              <span className="font-mono text-xs font-bold">{r.reference}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFF8E1] text-[#92400E]" data-testid="vps-request-status" data-status={r.status}>{VPS_REQ_LABEL[r.status as VpsRequestStatus] ?? r.status}</span>
              <span>{r.plan_name}{r.kind === 'upgrade' ? ' (upgrade)' : ''} · {r.options?.image?.label ?? ''} · {r.options?.location?.label ?? ''}</span>
              {r.invoice_id && r.payment_status !== 'paid' && <Link href={`/billing/invoices/${r.invoice_id}`} className="text-xs font-bold underline" data-testid="vps-request-invoice">Pagar factura {r.invoice_number}</Link>}
              {r.decision_reason && ['rejected', 'cancelled'].includes(r.status) && <p className="w-full text-xs text-[#555]">Motivo: {r.decision_reason}</p>}
            </div>
          ))}
        </section>
      )}
      <ul className="space-y-3">
        {items.map(v => (
          <li key={v.id}>
            <Link href={`/vps/${v.id}`} className="block rounded-2xl border border-[#E5E7EB] bg-white shadow-sm p-4 sm:p-5 hover:border-[#F5B700]" data-testid="vps-card" data-state={v.state}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#FFF8E1] shrink-0"><HardDrive size={20} className="text-[#B45309]" /></div>
                <div className="flex-1 min-w-[180px]">
                  <p className="font-black text-[#0B0B0D]">{v.plan}</p>
                  <p className="text-sm text-[#334155]">{v.install ? `${v.install.label}${v.install.includedOs && !v.install.label.includes(v.install.includedOs) ? ` · ${v.install.includedOs}` : ''}` : v.awaitingChoice ? 'Instalação por escolher' : '—'}</p>
                  <p className="text-xs text-[#64748B] mt-1 flex flex-wrap gap-x-3">{v.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{v.location}</span>}{v.ip && <span className="font-mono">{v.ip}</span>}<span>{v.cycleLabel}</span><span>Encomenda {v.orderNumber}</span></p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${VPS_TONE[v.state]}`} data-testid="vps-state">{v.stateLabel}</span>
                <ChevronRight size={18} className="text-[#CBD5E1] self-center" />
              </div>
              {v.awaitingChoice && <p className="mt-3 text-sm font-bold text-[#B45309]">Escolha o que instalar para iniciarmos a preparação →</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
