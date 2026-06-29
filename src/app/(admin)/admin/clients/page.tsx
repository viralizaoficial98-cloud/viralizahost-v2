import { Metadata } from 'next'
import { Search, Users, UserCheck, UserX, Filter } from 'lucide-react'

export const metadata: Metadata = { title: 'Clientes — Admin ViralizaHost' }

const clients = [
  { name: 'Maria Santos', email: 'maria@email.com', country: '🇦🇴', plan: 'Business', domains: 3, status: 'Ativo', since: '15 Jan 2026', spend: 'R$ 479,80' },
  { name: 'João Silva', email: 'joao@empresa.ao', country: '🇦🇴', plan: 'Pro', domains: 5, status: 'Ativo', since: '03 Fev 2026', spend: 'R$ 299,40' },
  { name: 'Ana Costa', email: 'ana@loja.com', country: '🇧🇷', plan: 'Starter', domains: 1, status: 'Ativo', since: '28 Mar 2026', spend: 'R$ 119,40' },
  { name: 'Carlos Mendes', email: 'carlos@site.pt', country: '🇵🇹', plan: 'Business', domains: 2, status: 'Suspenso', since: '10 Abr 2026', spend: 'R$ 79,80' },
  { name: 'Luísa Ferreira', email: 'luisa@negocio.ao', country: '🇦🇴', plan: 'Starter', domains: 1, status: 'Ativo', since: '22 Mai 2026', spend: 'R$ 39,90' },
]

export default function AdminClientsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie todos os clientes da plataforma</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-400/10 border border-green-400/20 rounded-lg text-green-400">
            <UserCheck size={14} /> 1.243 ativos
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400">
            <UserX size={14} /> 4 suspensos
          </span>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input type="search" placeholder="Pesquisar cliente por nome, email..." className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#333] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC107]/50 transition-all" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] border border-[#333] rounded-xl text-sm text-gray-400 hover:text-white hover:border-[#444] transition-all">
          <Filter size={14} /> Filtrar
        </button>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <Users size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Lista de Clientes</h2>
          <span className="ml-auto text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">1.247 clientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1A1A1A]">
                {['Cliente', 'Plano', 'Domínios', 'Total Gasto', 'Membro desde', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {clients.map((c) => (
                <tr key={c.email} className="hover:bg-[#111] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-xs font-bold text-yellow-400">
                        {c.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{c.name} {c.country}</div>
                        <div className="text-xs text-gray-600">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4"><span className="badge-yellow text-xs px-2 py-0.5 rounded-full">{c.plan}</span></td>
                  <td className="px-5 py-4 text-sm text-gray-400">{c.domains}</td>
                  <td className="px-5 py-4 text-sm text-white font-medium">{c.spend}</td>
                  <td className="px-5 py-4 text-xs text-gray-600">{c.since}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.status === 'Ativo' ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button className="text-xs text-yellow-400 hover:text-yellow-300 font-medium transition-colors">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
