import { Metadata } from 'next'
import { MessageSquare, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Suporte — ViralizaHost' }

const card = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

const statusMap: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: 'Aberto',       bg: 'rgba(245,183,0,0.08)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
  in_progress: { label: 'Em progresso', bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)' },
  resolved:    { label: 'Resolvido',    bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
  closed:      { label: 'Fechado',      bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)' },
}

const priorityMap: Record<string, { label: string; color: string }> = {
  low:      { label: 'Baixa',   color: '#059669' },
  medium:   { label: 'Média',   color: '#D9A300' },
  high:     { label: 'Alta',    color: '#DC2626' },
  critical: { label: 'Crítica', color: '#DC2626' },
}

async function fetchTickets(userId: string) {
  const supabase = await createClient()
  const result = await supabase
    .from('tickets')
    .select('*, ticket_messages(count)')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
  return (result.data ?? []) as any[]
}

export default async function TicketsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tickets = await fetchTickets(user.id)
  const openCount       = tickets.filter(t => t.status === 'open').length
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length
  const closedCount     = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Suporte</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Central de atendimento e tickets</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <Plus size={16} /> Abrir Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Abertos',      value: openCount,       accent: '#D9A300', bg: 'rgba(245,183,0,0.08)',   border: 'rgba(245,183,0,0.20)',  Icon: Clock },
          { label: 'Em progresso', value: inProgressCount, accent: '#2563EB', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.15)', Icon: MessageSquare },
          { label: 'Fechados',     value: closedCount,     accent: '#059669', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.15)', Icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.Icon size={13} style={{ color: s.accent }} />
              <span className="text-xs font-semibold" style={{ color: s.accent }}>{s.label}</span>
            </div>
            <div className="text-3xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tickets list */}
      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <MessageSquare size={15} style={{ color: '#7C3AED' }} />
          </div>
          <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Meus Tickets</h2>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
          </span>
        </div>

        {tickets.length > 0 ? (
          <div>
            {tickets.map((ticket: any, i: number) => {
              const s = statusMap[ticket.status] ?? statusMap.open
              const p = priorityMap[ticket.priority] ?? priorityMap.medium
              const created = new Date(ticket.created_at).toLocaleDateString('pt-BR')
              const replies = (ticket.ticket_messages as any)?.[0]?.count ?? 0
              return (
                <div key={ticket.id} className="px-6 py-4 flex items-start gap-4 cursor-pointer"
                  style={{ borderBottom: i < tickets.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <MessageSquare size={16} style={{ color: '#7C3AED' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{ticket.subject}</div>
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                      {ticket.department && (
                        <span className="text-xs font-medium" style={{ color: '#64748B' }}>{ticket.department}</span>
                      )}
                      <span className="text-xs font-semibold" style={{ color: p.color }}>● {p.label}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{created}</span>
                      {replies > 0 && (
                        <span className="text-xs" style={{ color: '#94A3B8' }}>{replies} resposta{replies !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <MessageSquare size={28} style={{ color: '#7C3AED' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhum ticket aberto</p>
            <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>Tem alguma dúvida ou problema? A nossa equipa está pronta para ajudar</p>
            <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
              Abrir primeiro ticket
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
