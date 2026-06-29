import { Metadata } from 'next'
import { Globe, Plus, RefreshCw, Lock, Shield, Search, ExternalLink } from 'lucide-react'

export const metadata: Metadata = { title: 'Domínios — ViralizaHost' }

const domains = [
  { name: 'meusite.com', status: 'Ativo', expiry: '15 Jul 2026', autoRenew: true, locked: true, ns: 'ViralizaHost' },
  { name: 'loja.ao', status: 'Ativo', expiry: '20 Ago 2026', autoRenew: true, locked: true, ns: 'ViralizaHost' },
  { name: 'blog.net', status: 'Expirado', expiry: '01 Jan 2026', autoRenew: false, locked: false, ns: 'Externo' },
]

export default function DomainsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Domínios</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie todos os seus domínios</p>
        </div>
        <a href="/domains/register" className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold">
          <Plus size={16} /> Registar Domínio
        </a>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input type="search" placeholder="Pesquisar domínios..." className="w-full pl-10 pr-4 py-2.5 bg-[#1A1A1A] border border-[#333] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC107] focus:ring-1 focus:ring-[#FFC107]/20 transition-all" />
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <Globe size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Meus Domínios</h2>
          <span className="ml-auto text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">{domains.length} domínios</span>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {domains.map((domain) => (
            <div key={domain.name} className="p-5 flex items-center gap-4 hover:bg-[#111] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                <Globe size={18} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{domain.name}</span>
                  {domain.locked && <Lock size={12} className="text-gray-600" />}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">Expira: {domain.expiry} · NS: {domain.ns}</div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                {domain.autoRenew && (
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <RefreshCw size={11} /> Auto-renovar
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-blue-400">
                  <Shield size={11} /> SSL
                </div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${domain.status === 'Ativo' ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>
                {domain.status}
              </span>
              <button className="text-gray-600 hover:text-yellow-400 transition-colors">
                <ExternalLink size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#FFC107]/10 p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Search size={16} className="text-yellow-400" /> Verificar Disponibilidade</h3>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input type="text" placeholder="seudominio.com" className="input-brand pl-10 w-full" />
          </div>
          <button className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold flex-shrink-0">Verificar</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {['.com', '.ao', '.net', '.org', '.io', '.co', '.store', '.online'].map(ext => (
            <div key={ext} className="text-center py-1.5 px-3 bg-[#1A1A1A] border border-[#222] rounded-lg text-xs text-gray-500 hover:border-yellow-400/30 hover:text-yellow-400 cursor-pointer transition-all">{ext}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
