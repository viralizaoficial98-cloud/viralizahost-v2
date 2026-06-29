import { Metadata } from 'next'
import { Plus, Globe, RefreshCw, AlertCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Domínios' }

const domains = [
  { name: 'meusite', ext: '.com', status: 'active', expires: '15/07/2025', autoRenew: true },
  { name: 'loja', ext: '.ao', status: 'active', expires: '20/08/2025', autoRenew: false },
  { name: 'blog', ext: '.com.br', status: 'expired', expires: '01/06/2025', autoRenew: false },
]

const statusConfig = {
  active: { label: 'Ativo', class: 'bg-green-100 text-green-700' },
  expired: { label: 'Expirado', class: 'bg-red-100 text-red-700' },
  pending: { label: 'Pendente', class: 'bg-yellow-100 text-yellow-700' },
}

export default function DomainsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Domínios</h1>
          <p className="text-slate-500 mt-1">Gerencie todos os seus domínios</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
          <Plus size={18} /> Registar Domínio
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Domínio','Status','Expiração','Auto-renovar','Ações'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {domains.map((domain) => {
                const status = statusConfig[domain.status as keyof typeof statusConfig]
                return (
                  <tr key={domain.name} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Globe size={18} className="text-indigo-500" />
                        <span className="font-medium text-slate-900">{domain.name}<span className="text-slate-500">{domain.ext}</span></span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.class}`}>{status.label}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        {domain.status === 'expired' && <AlertCircle size={14} className="text-red-500" />}
                        {domain.expires}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium ${domain.autoRenew ? 'text-green-600' : 'text-slate-400'}`}>
                        {domain.autoRenew ? '✓ Ativado' : '✗ Desativado'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Gerir</button>
                        <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><RefreshCw size={12} /> Renovar</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
