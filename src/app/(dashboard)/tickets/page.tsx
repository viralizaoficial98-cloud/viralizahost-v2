import { Metadata } from 'next'
import { Plus, MessageSquare } from 'lucide-react'

export const metadata: Metadata = { title: 'Suporte' }

const tickets = [
  { id: 'TKT-001', subject: 'Erro no cPanel ao criar email', status: 'open', priority: 'high', department: 'Técnico', date: '25/06/2025' },
  { id: 'TKT-002', subject: 'Dúvida sobre renovação do domínio', status: 'resolved', priority: 'low', department: 'Domínios', date: '20/06/2025' },
]

const statusConfig: Record<string, { label: string; class: string }> = {
  open: { label: 'Aberto', class: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Em Andamento', class: 'bg-yellow-100 text-yellow-700' },
  resolved: { label: 'Resolvido', class: 'bg-green-100 text-green-700' },
  closed: { label: 'Fechado', class: 'bg-slate-100 text-slate-500' },
}

const priorityConfig: Record<string, { label: string; class: string }> = {
  low: { label: 'Baixa', class: 'text-slate-500' },
  medium: { label: 'Média', class: 'text-yellow-600' },
  high: { label: 'Alta', class: 'text-red-600' },
  critical: { label: 'Crítica', class: 'text-red-700 font-bold' },
}

export default function TicketsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suporte</h1>
          <p className="text-slate-500 mt-1">Gerencie os seus tickets de suporte</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
          <Plus size={18} /> Abrir Ticket
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['ID','Assunto','Departamento','Prioridade','Status','Data','Ação'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((ticket) => {
                const status = statusConfig[ticket.status]
                const priority = priorityConfig[ticket.priority]
                return (
                  <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">{ticket.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={14} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{ticket.subject}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{ticket.department}</td>
                    <td className="px-6 py-4 text-sm"><span className={priority.class}>{priority.label}</span></td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.class}`}>{status.label}</span></td>
                    <td className="px-6 py-4 text-sm text-slate-500">{ticket.date}</td>
                    <td className="px-6 py-4"><button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Ver</button></td>
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
