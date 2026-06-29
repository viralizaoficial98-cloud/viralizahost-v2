import { Metadata } from 'next'
import { Plus, Server, ExternalLink } from 'lucide-react'

export const metadata: Metadata = { title: 'Hospedagem' }

const hostings = [
  { domain: 'meusite.com', plan: 'Business', status: 'active', diskUsed: 12, diskTotal: 50, expires: '01/08/2025' },
  { domain: 'loja.ao', plan: 'Starter', status: 'active', diskUsed: 3, diskTotal: 10, expires: '15/09/2025' },
]

export default function HostingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hospedagem</h1>
          <p className="text-slate-500 mt-1">Gerencie os seus planos de hospedagem</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
          <Plus size={18} /> Novo Plano
        </button>
      </div>
      <div className="grid gap-6">
        {hostings.map((h) => (
          <div key={h.domain} className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Server size={24} className="text-indigo-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{h.domain}</div>
                  <div className="text-sm text-slate-500">Plano {h.plan}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">Ativo</span>
                <button className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  <ExternalLink size={14} /> cPanel
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-2">Disco Usado</div>
                <div className="bg-slate-100 rounded-full h-2 mb-1">
                  <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(h.diskUsed / h.diskTotal) * 100}%` }} />
                </div>
                <div className="text-xs text-slate-600">{h.diskUsed} GB / {h.diskTotal} GB</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Vencimento</div>
                <div className="text-sm font-medium text-slate-900">{h.expires}</div>
              </div>
              <div className="flex items-end gap-2">
                <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Gerenciar</button>
                <button className="text-sm text-slate-500 hover:text-slate-700">Renovar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
