import { Metadata } from 'next'
import { Mail, Plus, Trash2, Key, Settings } from 'lucide-react'

export const metadata: Metadata = { title: 'Emails — ViralizaHost' }

const emails = [
  { address: 'contato@meusite.com', domain: 'meusite.com', quota: { used: 120, total: 500 }, status: 'Ativo' },
  { address: 'suporte@meusite.com', domain: 'meusite.com', quota: { used: 45, total: 500 }, status: 'Ativo' },
  { address: 'admin@meusite.com', domain: 'meusite.com', quota: { used: 890, total: 500 }, status: 'Lotado' },
  { address: 'loja@loja.ao', domain: 'loja.ao', quota: { used: 10, total: 200 }, status: 'Ativo' },
]

export default function EmailPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Emails Corporativos</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie as contas de email profissionais</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold">
          <Plus size={16} /> Criar Email
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-dark rounded-xl border border-[#222] p-4 text-center">
          <div className="text-2xl font-black text-white">12</div>
          <div className="text-xs text-gray-600 mt-1">Contas ativas</div>
        </div>
        <div className="glass-dark rounded-xl border border-[#222] p-4 text-center">
          <div className="text-2xl font-black text-white">20</div>
          <div className="text-xs text-gray-600 mt-1">Total disponível</div>
        </div>
        <div className="glass-dark rounded-xl border border-[#222] p-4 text-center">
          <div className="text-2xl font-black text-yellow-400">8</div>
          <div className="text-xs text-gray-600 mt-1">Slots restantes</div>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <Mail size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Contas de Email</h2>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {emails.map((email) => (
            <div key={email.address} className="p-5 flex items-center gap-4 hover:bg-[#111] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                <Mail size={16} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm">{email.address}</div>
                <div className="text-xs text-gray-600 mt-0.5">{email.quota.used} MB / {email.quota.total} MB usados</div>
                <div className="h-1 bg-[#222] rounded-full mt-1.5 w-32">
                  <div className={`h-full rounded-full ${email.status === 'Lotado' ? 'bg-red-400' : 'bg-yellow-400'}`} style={{ width: `${Math.min((email.quota.used / email.quota.total) * 100, 100)}%` }} />
                </div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${email.status === 'Ativo' ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-red-400/10 text-red-400 border border-red-400/20'}`}>
                {email.status}
              </span>
              <div className="flex items-center gap-1">
                <button className="p-2 text-gray-600 hover:text-yellow-400 hover:bg-[#1A1A1A] rounded-lg transition-all"><Key size={14} /></button>
                <button className="p-2 text-gray-600 hover:text-yellow-400 hover:bg-[#1A1A1A] rounded-lg transition-all"><Settings size={14} /></button>
                <button className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
