import { Metadata } from 'next'
import { Activity, User, Globe, CreditCard, Server, Lock } from 'lucide-react'

export const metadata: Metadata = { title: 'Atividade — Admin ViralizaHost' }

const logs = [
  { icon: User,       color: '#D9A300', bg: 'rgba(245,183,0,0.10)',  border: 'rgba(245,183,0,0.20)',  event: 'Novo cliente registado',       detail: 'maria@email.com',              time: 'Há 5 min',  type: 'auth' },
  { icon: CreditCard, color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.20)', event: 'Pagamento recebido',           detail: 'Kz 39.900 — João Silva',       time: 'Há 12 min', type: 'billing' },
  { icon: Globe,      color: '#2563EB', bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.20)',  event: 'Domínio registado',            detail: 'empresa.ao — João Silva',      time: 'Há 28 min', type: 'domain' },
  { icon: Server,     color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.20)', event: 'Conta cPanel criada',          detail: 'meusite.com — Plano Business', time: 'Há 1h',     type: 'hosting' },
  { icon: Lock,       color: '#DC2626', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.20)',  event: 'Tentativa de login falhada',   detail: 'IP: 197.221.45.99',            time: 'Há 2h',     type: 'security' },
  { icon: User,       color: '#D9A300', bg: 'rgba(245,183,0,0.10)',  border: 'rgba(245,183,0,0.20)',  event: 'Senha redefinida',             detail: 'ana@loja.com',                 time: 'Há 3h',     type: 'auth' },
  { icon: CreditCard, color: '#D9A300', bg: 'rgba(245,183,0,0.10)',  border: 'rgba(245,183,0,0.20)',  event: 'Fatura gerada',                detail: 'INV-2026-008 — Kz 79.900',    time: 'Há 4h',     type: 'billing' },
  { icon: Server,     color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.20)', event: 'Backup concluído',             detail: 'meusite.com — 2.4 GB',         time: 'Há 6h',     type: 'hosting' },
]

const card = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' as const }

export default function AdminActivityPage() {
  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)' }}>
          <Activity size={20} style={{ color: '#059669' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Registo de Atividade</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Todos os eventos do sistema em tempo real</p>
        </div>
      </div>

      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <Activity size={16} style={{ color: '#059669' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Eventos Recentes</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#059669' }} />
            <span className="text-xs font-semibold" style={{ color: '#059669' }}>Ao vivo</span>
          </div>
        </div>
        <div>
          {logs.map((log, i) => {
            const Icon = log.icon
            return (
              <div key={i} className="flex items-center gap-4 px-6 py-4"
                style={{ borderBottom: i < logs.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: log.bg, border: `1px solid ${log.border}` }}>
                  <Icon size={15} style={{ color: log.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>{log.event}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{log.detail}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: log.bg, color: log.color }}>{log.type}</span>
                  <span className="text-xs" style={{ color: '#94A3B8' }}>{log.time}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
