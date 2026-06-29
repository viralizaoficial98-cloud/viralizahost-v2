import { Metadata } from 'next'
import { CreditCard, Download, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Financeiro — ViralizaHost' }

const statusConfig: Record<string, { label: string; class: string; icon: typeof CheckCircle2 }> = {
  paid: { label: 'Pago', class: 'bg-green-400/10 text-green-400 border-green-400/20', icon: CheckCircle2 },
  pending: { label: 'Pendente', class: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20', icon: Clock },
  overdue: { label: 'Vencido', class: 'bg-red-400/10 text-red-400 border-red-400/20', icon: AlertCircle },
  cancelled: { label: 'Cancelado', class: 'bg-gray-400/10 text-gray-500 border-gray-400/20', icon: AlertCircle },
  refunded: { label: 'Reembolsado', class: 'bg-blue-400/10 text-blue-400 border-blue-400/20', icon: CheckCircle2 },
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase.from('profiles').select('id, currency').eq('id', user.id).single()
  const profile = profileRaw as any
  const currency = profile?.currency ?? 'USD'

  const { data: invoicesRaw } = await supabase
    .from('invoices')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  const invoices = invoicesRaw as any[]
  const { data: clientRaw } = await supabase.from('clients').select('credit_balance').eq('profile_id', user.id).single()
  const client = clientRaw as any

  const totalPaid = invoices?.filter(i => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total), 0) ?? 0
  const totalPending = invoices?.filter(i => i.status === 'pending').reduce((s: number, i: any) => s + Number(i.total), 0) ?? 0
  const nextDue = invoices?.filter(i => i.status === 'pending').sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]

  const fmt = (n: number) => currency === 'BRL' ? `R$ ${n.toFixed(2)}` : currency === 'AKZ' ? `${n.toFixed(0)} Kz` : `$ ${n.toFixed(2)}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Faturas, pagamentos e subscrições</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold">
          <CreditCard size={16} /> Pagar Fatura
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-dark rounded-xl border border-green-400/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-400" />
            <span className="text-xs text-gray-600">Total pago</span>
          </div>
          <div className="text-2xl font-black text-white">{fmt(totalPaid)}</div>
        </div>
        <div className="glass-dark rounded-xl border border-yellow-400/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-yellow-400" />
            <span className="text-xs text-gray-600">Pendente</span>
          </div>
          <div className="text-2xl font-black text-white">{fmt(totalPending)}</div>
        </div>
        <div className="glass-dark rounded-xl border border-[#222] p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={14} className="text-gray-500" />
            <span className="text-xs text-gray-600">
              {client?.credit_balance ? 'Crédito disponível' : 'Próxima cobrança'}
            </span>
          </div>
          <div className="text-2xl font-black text-white">
            {client?.credit_balance ? fmt(client.credit_balance) : nextDue ? new Date(nextDue.due_date).toLocaleDateString('pt-BR') : '—'}
          </div>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <CreditCard size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Histórico de Faturas</h2>
          <span className="ml-auto text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">{invoices?.length ?? 0} faturas</span>
        </div>

        {invoices && invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-600 border-b border-[#1A1A1A]">
                  <th className="text-left px-5 py-3 font-medium">Nº Fatura</th>
                  <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Descrição</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Vencimento</th>
                  <th className="text-right px-5 py-3 font-medium">Valor</th>
                  <th className="text-center px-5 py-3 font-medium">Estado</th>
                  <th className="text-center px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {invoices.map((inv) => {
                  const cfg = statusConfig[inv.status] ?? statusConfig.pending
                  const Icon = cfg.icon
                  const due = new Date(inv.due_date).toLocaleDateString('pt-BR')
                  return (
                    <tr key={inv.id} className="hover:bg-[#111] transition-colors">
                      <td className="px-5 py-4 text-sm font-mono text-yellow-400">{inv.invoice_number}</td>
                      <td className="px-5 py-4 text-sm text-gray-400 hidden sm:table-cell">{inv.notes ?? 'Fatura de serviço'}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 hidden md:table-cell">{due}</td>
                      <td className="px-5 py-4 text-sm font-bold text-white text-right">{fmt(Number(inv.total))}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.class}`}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {inv.status === 'pending' ? (
                          <button className="btn-primary text-xs px-3 py-1.5 rounded-lg font-bold">Pagar</button>
                        ) : (
                          <button className="text-gray-600 hover:text-gray-400 transition-colors">
                            <Download size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <CreditCard size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhuma fatura ainda</p>
          </div>
        )}
      </div>
    </div>
  )
}
