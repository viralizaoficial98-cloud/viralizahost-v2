import { Metadata } from 'next'
import { MessageSquare, Clock, CheckCircle2, AlertCircle, User } from 'lucide-react'

export const metadata: Metadata = { title: 'Tickets — Admin ViralizaHost' }

const tickets = [
  { id: 'TK-001', client: 'Maria Santos', subject: 'Erro ao acessar cPanel', dept: 'Hospedagem', priority: 'Alta', status: 'Aberto', date: '28 Jun 2026', waiting: '2h' },
  { id: 'TK-002', client: 'João Silva', subject: 'Configuração de DNS para domínio .ao', dept: 'Domínios', priority: 'Média', status: 'Respondido', date: '27 Jun 2026', waiting: '1d' },
  { id: 'TK-003', client: 'Ana Costa', subject: 'Upgrade de plano Business para Pro', dept: 'Financeiro', priority: 'Baixa', status: 'Fechado', date: '25 Jun 2026', waiting: '—' },
  { id: 'TK-004', client: 'Carlos Mendes', subject: 'Conta suspensa sem aviso', dept: 'Técnico', priority: 'Urgente', status: 'Aberto', date: '28 Jun 2026', waiting: '30min' },
]

const statusConfig: Record<string, { class: string; icon: React.ElementType }> = {
  'Aberto': { class: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20', icon: Clock },
  'Respondido': { class: 'bg-blue-400/10 text-blue-400 border-blue-400/20', icon: MessageSquare },
  'Fechado': { class: 'bg-gray-400/10 text-gray-500 border-gray-400/20', icon: CheckCircle2 },
}

const priorityColor: Record<string, string> = {
  'Urgente': 'text-red-400 bg-red-400/10 border-red-400/20',
  'Alta': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  'Média': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  'Baixa': 'text-green-400 bg-green-400/10 border-green-400/20',
}

export default function AdminTicketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Gestão de Tickets</h1>
        <p className="text-gray-500 text-sm mt-1">Central de suporte — todos os tickets da plataforma</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Abertos', value: '12', color: 'yellow' },
          { label: 'Respondidos', value: '8', color: 'blue' },
          { label: 'Urgentes', value: '2', color: 'red' },
          { label: 'Fechados hoje', value: '5', color: 'green' },
        ].map((s) => (
          <div key={s.label} className={`glass-dark rounded-xl border border-${s.color}-400/20 p-4 text-center`}>
            <div className={`text-2xl font-black text-${s.color}-400`}>{s.value}</div>
            <div className="text-xs text-gray-600 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <MessageSquare size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Todos os Tickets</h2>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {tickets.map((ticket) => {
            const s = statusConfig[ticket.status]
            const StatusIcon = s.icon
            return (
              <div key={ticket.id} className="p-5 flex items-center gap-4 hover:bg-[#111] transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={16} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{ticket.subject}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{ticket.id} · {ticket.client} · {ticket.dept} · {ticket.date}</div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${priorityColor[ticket.priority]}`}>{ticket.priority}</span>
                  <span className="text-xs text-gray-700 flex items-center gap-1"><Clock size={10} /> {ticket.waiting}</span>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1 ${s.class}`}>
                  <StatusIcon size={10} /> {ticket.status}
                </span>
                <div className="flex items-center gap-1">
                  <button className="p-2 text-gray-600 hover:text-yellow-400 hover:bg-[#1A1A1A] rounded-lg transition-all">
                    <User size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
