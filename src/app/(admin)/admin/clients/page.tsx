import { Metadata } from 'next'
import { Search } from 'lucide-react'

export const metadata: Metadata = { title: 'Clientes - Admin' }

const clients = [
  { id: '001', name: 'João Silva', email: 'joao@email.com', country: '🇦🇴 Angola', plans: 2, status: 'active', spent: 'Kz 19.000' },
  { id: '002', name: 'Maria Santos', email: 'maria@email.com', country: '🇧🇷 Brasil', plans: 1, status: 'active', spent: 'R$ 39,90' },
  { id: '003', name: 'Carlos Mendes', email: 'carlos@email.com', country: '🇦🇴 Angola', plans: 3, status: 'suspended', spent: 'Kz 57.000' },
]

export default function AdminClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Gestão de Clientes</h1>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" placeholder="Buscar cliente..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['ID','Cliente','País','Planos','Total Gasto','Status','Ações'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase px-6 py-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-slate-500">#{c.id}</td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.email}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{c.country}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{c.plans}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{c.spent}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {c.status === 'active' ? 'Ativo' : 'Suspenso'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Ver</button>
                    <button className="text-xs text-slate-500 hover:text-slate-700">Editar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
