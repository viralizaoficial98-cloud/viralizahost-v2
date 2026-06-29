import { Metadata } from 'next'
import { Users, UserCheck, UserX } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Clientes — Admin ViralizaHost' }

export default async function AdminClientsPage() {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') redirect('/dashboard')

  const { data: rawClients } = await supabase
    .from('profiles')
    .select('id, full_name, email, country, role, is_active, created_at, services(count), domains(count), invoices(total, status)')
    .eq('role', 'client' as any)
    .order('created_at', { ascending: false })

  const clients = rawClients as any[]
  const activeCount = clients?.filter(c => c.is_active).length ?? 0
  const suspendedCount = clients?.filter(c => !c.is_active).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie todos os clientes da plataforma</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-400/10 border border-green-400/20 rounded-lg text-green-400">
            <UserCheck size={14} /> {activeCount} ativos
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400">
            <UserX size={14} /> {suspendedCount} suspensos
          </span>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <Users size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Lista de Clientes</h2>
          <span className="ml-auto text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">{clients?.length ?? 0} clientes</span>
        </div>
        {clients && clients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1A1A1A]">
                  {['Cliente', 'País', 'Serviços', 'Domínios', 'Total Gasto', 'Membro desde', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {clients.map((c: any) => {
                  const totalSpent = c.invoices?.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total), 0) ?? 0
                  const since = new Date(c.created_at).toLocaleDateString('pt-BR')
                  const svcCount = c.services?.[0]?.count ?? 0
                  const domCount = c.domains?.[0]?.count ?? 0
                  return (
                    <tr key={c.id} className="hover:bg-[#111] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-xs font-bold text-yellow-400">
                            {(c.full_name?.[0] ?? c.email[0]).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{c.full_name || 'Sem nome'}</div>
                            <div className="text-xs text-gray-600">{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">{c.country}</td>
                      <td className="px-5 py-4 text-sm text-gray-400">{svcCount}</td>
                      <td className="px-5 py-4 text-sm text-gray-400">{domCount}</td>
                      <td className="px-5 py-4 text-sm text-white font-medium">${totalSpent.toFixed(2)}</td>
                      <td className="px-5 py-4 text-xs text-gray-600">{since}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${c.is_active ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
                          {c.is_active ? 'Ativo' : 'Suspenso'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button className="text-xs text-yellow-400 hover:text-yellow-300 font-medium transition-colors">Ver</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum cliente ainda</p>
          </div>
        )}
      </div>
    </div>
  )
}
