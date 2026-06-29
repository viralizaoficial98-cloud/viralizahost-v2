import { Metadata } from 'next'
import { Activity, User, Globe, CreditCard, Server, Lock } from 'lucide-react'

export const metadata: Metadata = { title: 'Atividade — Admin ViralizaHost' }

const logs = [
  { icon: User, color: 'text-yellow-400', event: 'Novo cliente registado', detail: 'maria@email.com', time: 'Há 5 min', type: 'auth' },
  { icon: CreditCard, color: 'text-green-400', event: 'Pagamento recebido', detail: 'R$ 39,90 — João Silva', time: 'Há 12 min', type: 'billing' },
  { icon: Globe, color: 'text-blue-400', event: 'Domínio registado', detail: 'empresa.ao — João Silva', time: 'Há 28 min', type: 'domain' },
  { icon: Server, color: 'text-purple-400', event: 'Conta cPanel criada', detail: 'meusite.com — Plano Business', time: 'Há 1h', type: 'hosting' },
  { icon: Lock, color: 'text-red-400', event: 'Tentativa de login falhada', detail: 'IP: 197.221.45.99', time: 'Há 2h', type: 'security' },
  { icon: User, color: 'text-yellow-400', event: 'Senha redefinida', detail: 'ana@loja.com', time: 'Há 3h', type: 'auth' },
  { icon: CreditCard, color: 'text-yellow-400', event: 'Fatura gerada', detail: 'INV-2026-008 — R$ 79,90', time: 'Há 4h', type: 'billing' },
  { icon: Server, color: 'text-green-400', event: 'Backup concluído', detail: 'meusite.com — 2.4 GB', time: 'Há 6h', type: 'hosting' },
]

const typeColors: Record<string, string> = {
  auth: 'bg-yellow-400/10 text-yellow-400',
  billing: 'bg-green-400/10 text-green-400',
  domain: 'bg-blue-400/10 text-blue-400',
  hosting: 'bg-purple-400/10 text-purple-400',
  security: 'bg-red-400/10 text-red-400',
}

export default function AdminActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Registo de Atividade</h1>
        <p className="text-gray-500 text-sm mt-1">Todos os eventos do sistema em tempo real</p>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <Activity size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Eventos Recentes</h2>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400">Ao vivo</span>
          </div>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {logs.map((log, i) => {
            const Icon = log.icon
            return (
              <div key={i} className="p-5 flex items-center gap-4 hover:bg-[#111] transition-colors">
                <div className={`w-9 h-9 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={log.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm">{log.event}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{log.detail}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[log.type]}`}>{log.type}</span>
                  <span className="text-xs text-gray-700">{log.time}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
