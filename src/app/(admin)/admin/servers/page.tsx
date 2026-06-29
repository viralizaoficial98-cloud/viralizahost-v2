import { Metadata } from 'next'
import { Server, Cpu, HardDrive, Wifi, Activity, CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = { title: 'Servidores — Admin ViralizaHost' }

const servers = [
  { name: 'Servidor Principal AO-1', ip: '197.221.45.12', location: '🇦🇴 Luanda', cpu: 42, ram: 68, disk: 55, status: 'Online', uptime: '99.98%', accounts: 847 },
  { name: 'Servidor Backup AO-2', ip: '197.221.45.13', location: '🇦🇴 Luanda', cpu: 18, ram: 34, disk: 30, status: 'Online', uptime: '99.95%', accounts: 284 },
  { name: 'Servidor BR-1', ip: '177.64.22.100', location: '🇧🇷 São Paulo', cpu: 61, ram: 75, disk: 48, status: 'Online', uptime: '99.89%', accounts: 116 },
]

export default function AdminServersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Servidores</h1>
        <p className="text-gray-500 text-sm mt-1">Monitoramento de servidores e infraestrutura</p>
      </div>

      <div className="space-y-4">
        {servers.map((s) => (
          <div key={s.name} className="glass-dark rounded-2xl border border-[#222] hover:border-[#FFC107]/20 transition-all p-5">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#1A1A1A]">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <Server size={18} className="text-yellow-400" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-white">{s.name}</div>
                <div className="text-xs text-gray-600">{s.location} · {s.ip} · {s.accounts} contas</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-400">{s.uptime}</span>
                <span className="text-xs bg-green-400/10 text-green-400 border border-green-400/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={10} /> {s.status}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2"><Cpu size={12} /> CPU</div>
                <div className="text-lg font-black text-white mb-1">{s.cpu}%</div>
                <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.cpu > 80 ? 'bg-red-400' : s.cpu > 60 ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ width: `${s.cpu}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2"><Activity size={12} /> RAM</div>
                <div className="text-lg font-black text-white mb-1">{s.ram}%</div>
                <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.ram > 85 ? 'bg-red-400' : s.ram > 70 ? 'bg-yellow-400' : 'bg-blue-400'}`} style={{ width: `${s.ram}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-2"><HardDrive size={12} /> Disco</div>
                <div className="text-lg font-black text-white mb-1">{s.disk}%</div>
                <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${s.disk > 85 ? 'bg-red-400' : 'bg-purple-400'}`} style={{ width: `${s.disk}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
