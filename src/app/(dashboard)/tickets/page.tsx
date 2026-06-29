import { Metadata } from 'next'
import { MessageSquare, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Suporte — ViralizaHost' }

const tickets = [
  { id: 'TK-001', subject: 'Erro ao acessar cPanel', department: 'Hospedagem', priority: 'Alta', status: 'Aberto', date: '28 Jun 2026', replies: 2 },
  { id: 'TK-002', subject: 'Configuração de DNS para domínio .ao', department: 'Domínios', priority: 'Média', status: 'Respondido', date: '25 Jun 2026', replies: 4 },
  { id: 'TK-003', subject: 'Upgrade de plano Business para Pro', department: 'Financeiro', priority: 'Baixa', status: 'Fechado', date: '20 Jun 2026', replies: 3 },
]

const statusConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  'Aberto': { label: 'Aberto', class: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20', icon: Clock },
  'Respondido': { label: 'Respondido', class: 'bg-blue-400/10 text-blue-400 border-blue-400/20', icon: MessageSquare },
  'Fechado': { label: 'Fechado', class: 'bg-gray-400/10 text-gray-500 border-gray-400/20', icon: CheckCircle2 },
}

const priorityConfig: Record<string, string> = {
  'Alta': 'text-red-400', 'Média': 'text-yellow-400', 'Baixa': 'text-green-400',
}

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Suporte</h1>
          <p className="text-gray-500 text-sm mt-1">Central de atendimento e tickets</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold">
          <Plus size={16} /> Abrir Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-dark rounded-xl border border-yellow-400/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-yellow-400" />
            <span className="text-xs text-gray-600">Abertos</span>
          </div>
          <div className="text-2xl font-black text-white">1</div>
        </div>
        <div className="glass-dark rounded-xl border border-blue-400/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={14} className="text-blue-400" />
            <span className="text-xs text-gray-600">Respondidos</span>
          </div>
          <div className="text-2xl font-black text-white">1</div>
        </div>
        <div className="glass-dark rounded-xl border border-[#222] p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-gray-500" />
            <span className="text-xs text-gray-600">Fechados</span>
          </div>
          <div className="text-2xl font-black text-white">1</div>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <MessageSquare size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Meus Tickets</h2>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {tickets.map((ticket) => {
            const status = statusConfig[ticket.status]
            const StatusIcon = status.icon
            return (
              <div key={ticket.id} className="p-5 flex items-center gap-4 hover:bg-[#111] transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={16} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{ticket.subject}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{ticket.id} · {ticket.department} · {ticket.date}</div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className={`text-xs font-medium ${priorityConfig[ticket.priority]}`}>
                    <AlertCircle size={12} className="inline mr-1" />{ticket.priority}
                  </span>
                  <span className="text-xs text-gray-700">{ticket.replies} respostas</span>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1 ${status.class}`}>
                  <StatusIcon size={10} /> {status.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#FFC107]/10 p-6">
        <h3 className="font-bold text-white mb-2">Abrir Novo Ticket</h3>
        <p className="text-sm text-gray-500 mb-4">Descreva o seu problema e nossa equipa responderá em até 2 horas.</p>
        <div className="space-y-3">
          <input type="text" placeholder="Assunto do ticket" className="input-brand w-full" />
          <select className="input-brand w-full">
            <option value="">Selecione o departamento</option>
            <option>Hospedagem</option><option>Domínios</option><option>Financeiro</option><option>Técnico</option>
          </select>
          <select className="input-brand w-full">
            <option value="">Prioridade</option>
            <option>Baixa</option><option>Média</option><option>Alta</option>
          </select>
          <textarea rows={4} placeholder="Descreva o problema..." className="input-brand w-full resize-none" />
          <button className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
            <Plus size={16} /> Enviar Ticket
          </button>
        </div>
      </div>
    </div>
  )
}
