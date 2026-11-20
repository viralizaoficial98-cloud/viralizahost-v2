import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ACTIVATION_STATUS, PAYMENT_STATUS, TONE_CLASS, kz } from '@/lib/commerce/status'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Encomendas' }

export default async function OrdersPage() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')
  // Políticas: o cliente só vê as suas encomendas
  const { data: orders, error } = await db.from('orders')
    .select('id, order_number, created_at, amount, payment_status, activation_status, status, order_items(service_name)')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-black text-white mb-6">Encomendas</h1>
      {error && <p className="text-red-400 text-sm">Não foi possível carregar as encomendas.</p>}
      {!error && !orders?.length && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <ShoppingBag className="mx-auto text-gray-500 mb-3" />
          <p className="text-gray-300 mb-4">Ainda não tem encomendas.</p>
          <Link href="/checkout" className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-[#F5B700]">Ver serviços</Link>
        </div>
      )}
      <ul className="space-y-3">
        {(orders ?? []).map(o => {
          const p = PAYMENT_STATUS[o.payment_status] ?? PAYMENT_STATUS.unpaid
          const a = ACTIVATION_STATUS[o.activation_status] ?? ACTIVATION_STATUS.pending
          return (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="block rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-[#F5B700]/50 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-white">{o.order_number ?? o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString('pt-PT')} · {(o.order_items ?? []).map((i: { service_name: string }) => i.service_name).join(', ')}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[p.tone]}`}>{p.label}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[a.tone]}`}>{a.label}</span>
                    <span className="font-bold text-white">{kz(o.amount)}</span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
