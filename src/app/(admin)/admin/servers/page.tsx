import { Metadata } from 'next'
import { Server, Cpu, HardDrive, Activity, CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = { title: 'Servidores — Admin ViralizaHost' }

const servers = [
  { name: 'Servidor Principal AO-1', ip: '197.221.45.12',  location: '🇦🇴 Luanda',    cpu: 42, ram: 68, disk: 55, status: 'Online', uptime: '99.98%', accounts: 847 },
  { name: 'Servidor Backup AO-2',    ip: '197.221.45.13',  location: '🇦🇴 Luanda',    cpu: 18, ram: 34, disk: 30, status: 'Online', uptime: '99.95%', accounts: 284 },
  { name: 'Servidor BR-1',           ip: '177.64.22.100',  location: '🇧🇷 São Paulo', cpu: 61, ram: 75, disk: 48, status: 'Online', uptime: '99.89%', accounts: 116 },
]

function barColor(val: number, type: 'cpu' | 'ram' | 'disk') {
  if (val > 85) return '#DC2626'
  if (type === 'ram' && val > 70) return '#D9A300'
  if (type === 'cpu' && val > 60) return '#D9A300'
  if (type === 'disk') return '#7C3AED'
  return '#059669'
}

const card = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }

export default function AdminServersPage() {
  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
          <Server size={20} style={{ color: '#D9A300' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Servidores</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Monitoramento de servidores e infraestrutura</p>
        </div>
      </div>

      <div className="space-y-5">
        {servers.map(s => (
          <div key={s.name} style={card}>
            {/* Server header */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
                <Server size={18} style={{ color: '#D9A300' }} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{s.name}</div>
                <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{s.location} · {s.ip} · {s.accounts} contas</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: '#059669' }}>{s.uptime}</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
                  <CheckCircle2 size={10} /> {s.status}
                </span>
              </div>
            </div>
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-0 divide-x" style={{ borderColor: '#F1F5F9' }}>
              {[
                { label: 'CPU', value: s.cpu, icon: Cpu,      type: 'cpu'  as const },
                { label: 'RAM', value: s.ram, icon: Activity, type: 'ram'  as const },
                { label: 'Disco', value: s.disk,icon: HardDrive,type: 'disk' as const },
              ].map(m => {
                const color = barColor(m.value, m.type)
                const Icon  = m.icon
                return (
                  <div key={m.label} className="px-6 py-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Icon size={12} style={{ color: '#94A3B8' }} />
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>{m.label}</span>
                    </div>
                    <div className="text-xl font-black mb-2" style={{ color: '#0B0B0D' }}>{m.value}%</div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${m.value}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
