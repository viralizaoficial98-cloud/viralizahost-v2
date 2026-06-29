import { Metadata } from 'next'
import { Server, HardDrive, Wifi, Shield, ExternalLink, Cpu, RefreshCw } from 'lucide-react'

export const metadata: Metadata = { title: 'Hospedagem — ViralizaHost' }

const plans = [
  {
    name: 'Plano Business', domain: 'meusite.com', status: 'Ativo',
    storage: { used: 6, total: 10, pct: 60 },
    bandwidth: { used: 32, total: 100, pct: 32 },
    emails: { used: 8, total: 20 },
    databases: { used: 3, total: 10 },
    php: '8.2', ssl: true, expiry: '01 Ago 2026',
  },
  {
    name: 'Plano Starter', domain: 'loja.ao', status: 'Ativo',
    storage: { used: 1, total: 5, pct: 20 },
    bandwidth: { used: 4, total: 50, pct: 8 },
    emails: { used: 2, total: 5 },
    databases: { used: 1, total: 3 },
    php: '8.1', ssl: true, expiry: '20 Ago 2026',
  },
]

export default function HostingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Hospedagem</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os seus planos de hospedagem</p>
        </div>
        <a href="/billing" className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold">
          <Server size={16} /> Adicionar Plano
        </a>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.name} className="glass-dark rounded-2xl border border-[#222] hover:border-[#FFC107]/20 transition-all overflow-hidden">
            <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <Server size={18} className="text-yellow-400" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-white">{plan.name}</div>
                <div className="text-xs text-gray-600">{plan.domain} · Expira: {plan.expiry}</div>
              </div>
              <div className="flex items-center gap-2">
                {plan.ssl && <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full flex items-center gap-1"><Shield size={10} /> SSL</span>}
                <span className="badge-yellow text-xs px-2 py-0.5 rounded-full">{plan.status}</span>
              </div>
              <button className="text-gray-600 hover:text-yellow-400 transition-colors ml-2">
                <ExternalLink size={16} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                  <HardDrive size={12} /> Armazenamento
                </div>
                <div className="text-white font-bold text-sm mb-1">{plan.storage.used} GB / {plan.storage.total} GB</div>
                <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${plan.storage.pct > 80 ? 'bg-red-400' : 'bg-yellow-400'}`} style={{ width: `${plan.storage.pct}%` }} />
                </div>
                <div className="text-xs text-gray-700 mt-1">{plan.storage.pct}% usado</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                  <Wifi size={12} /> Bandwidth
                </div>
                <div className="text-white font-bold text-sm mb-1">{plan.bandwidth.used} GB / {plan.bandwidth.total} GB</div>
                <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${plan.bandwidth.pct}%` }} />
                </div>
                <div className="text-xs text-gray-700 mt-1">{plan.bandwidth.pct}% usado</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2">
                  <Cpu size={12} /> PHP / Databases
                </div>
                <div className="text-white font-bold text-sm">PHP {plan.php}</div>
                <div className="text-xs text-gray-600 mt-1">{plan.databases.used}/{plan.databases.total} DBs · {plan.emails.used}/{plan.emails.total} Emails</div>
              </div>
              <div className="flex flex-col gap-2">
                <button className="w-full py-2 px-3 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-lg text-xs text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5">
                  <ExternalLink size={12} /> Abrir cPanel
                </button>
                <button className="w-full py-2 px-3 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] rounded-lg text-xs text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1.5">
                  <RefreshCw size={12} /> Backup Agora
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
