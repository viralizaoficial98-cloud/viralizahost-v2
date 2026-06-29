import { Metadata } from 'next'
import { Globe, Search, Filter } from 'lucide-react'

export const metadata: Metadata = { title: 'Domínios — Admin ViralizaHost' }

const domains = [
  { name: 'meusite.com', client: 'Maria Santos', status: 'Ativo', expiry: '15 Jul 2026', ns: 'ViralizaHost', tld: '.com' },
  { name: 'loja.ao', client: 'Maria Santos', status: 'Ativo', expiry: '20 Ago 2026', ns: 'ViralizaHost', tld: '.ao' },
  { name: 'empresa.ao', client: 'João Silva', status: 'Ativo', expiry: '10 Set 2026', ns: 'ViralizaHost', tld: '.ao' },
  { name: 'blog.net', client: 'Ana Costa', status: 'Expirado', expiry: '01 Jan 2026', ns: 'Externo', tld: '.net' },
]

export default function AdminDomainsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Domínios</h1>
          <p className="text-gray-500 text-sm mt-1">Gestão de todos os domínios da plataforma</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg text-yellow-400 text-xs">1.247 domínios</span>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input type="search" placeholder="Pesquisar domínio..." className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#333] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC107]/50 transition-all" />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] border border-[#333] rounded-xl text-sm text-gray-400 hover:text-white transition-all">
          <Filter size={14} /> Filtrar
        </button>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <Globe size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Todos os Domínios</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1A1A1A]">
                {['Domínio', 'TLD', 'Cliente', 'Nameservers', 'Expira em', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {domains.map((d) => (
                <tr key={d.name} className="hover:bg-[#111] transition-colors">
                  <td className="px-5 py-4 font-bold text-white text-sm">{d.name}</td>
                  <td className="px-5 py-4"><span className="badge-yellow text-xs px-2 py-0.5 rounded-full">{d.tld}</span></td>
                  <td className="px-5 py-4 text-sm text-gray-400">{d.client}</td>
                  <td className="px-5 py-4 text-xs text-gray-600">{d.ns}</td>
                  <td className="px-5 py-4 text-xs text-gray-600">{d.expiry}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${d.status === 'Ativo' ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button className="text-xs text-yellow-400 hover:text-yellow-300 font-medium transition-colors">Gerir</button>
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
