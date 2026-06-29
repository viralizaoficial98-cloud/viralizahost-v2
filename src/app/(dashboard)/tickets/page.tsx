import { Metadata } from 'next'
import { MessageSquare, Plus, Clock, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Suporte — ViralizaHost' }

const statusConfig: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  open: { label: 'Aberto', class: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20', icon: Clock },
  in_progress: { label: 'Em progresso', class: 'bg-blue-400/10 text-blue-400 border-blue-400/20', icon: MessageSquare },
  resolved: { label: 'Resolvido', class: 'bg-green-400/10 text-green-400 border-green-400/20', icon: CheckCircle2 },
  closed: { label: 'Fechado', class: 'bg-gray-400/10 text-gray-500 border-gray-400/20', icon: CheckCircle2 },
}

const priorityConfig: Record<string, string> = {
  low: 'text-green-400', medium: 'text-yellow-400', high: 'text-red-400', critical: 'text-red-500 font-bold',
}
const priorityLabel: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }

export default async function TicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ticketsRaw } = await supabase
    .from('tickets')
    .select('*, ticket_messages(count)')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  const tickets = ticketsRaw as any[]
  const openCount = tickets?.filter(t => t.status === 'open').length ?? 0
  const inProgressCount = tickets?.filter(t => t.status === 'in_progress').length ?? 0
  const closedCount = tickets?.filter(t => ['resolved', 'closed'].includes(t.status)).length ?? 0

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
          <div className="text-2xl font-black text-white">{openCount}</div>
        </div>
        <div className="glass-dark rounded-xl border border-blue-400/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={14} className="text-blue-400" />
            <span className="text-xs text-gray-600">Em progresso</span>
          </div>
          <div className="text-2xl font-black text-white">{inProgressCount}</div>
        </div>
        <div className="glass-dark rounded-xl border border-[#222] p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-gray-500" />
            <span className="text-xs text-gray-600">Fechados</span>
          </div>
          <div className="text-2xl font-black text-white">{closedCount}</div>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <MessageSquare size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Meus Tickets</h2>
          <span className="ml-auto text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">{tickets?.length ?? 0} tickets</span>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {tickets && tickets.length > 0 ? tickets.map((ticket) => {
            const cfg = statusConfig[ticket.status] ?? statusConfig.open
            const Icon = cfg.icon
            const created = new Date(ticket.created_at).toLocaleDateString('pt-BR')
            const replies = (ticket.ticket_messages as any)?.[0]?.count ?? 0
            return (
              <div key={ticket.id} className="p-5 flex items-start gap-4 hover:bg-[#111] transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={16} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm">{ticket.subject}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-600">{ticket.department}</span>
                    <span className={`text-xs font-medium ${priorityConfig[ticket.priority]}`}>{priorityLabel[ticket.priority]}</span>
                    <span className="text-xs text-gray-700">{created}</span>
                    {replies > 0 && <span className="text-xs text-gray-600">{replies} resposta{replies !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${cfg.class}`}>{cfg.label}</span>
              </div>
            )
          }) : (
            <div className="p-12 text-center">
              <MessageSquare size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum ticket aberto</p>
              <button className="mt-4 btn-primary text-xs px-4 py-2 rounded-xl font-bold">Abrir primeiro ticket</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
