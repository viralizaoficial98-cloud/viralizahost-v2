import { Metadata } from 'next'
import { MessageSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Tickets — Admin ViralizaHost' }

const tickets = [
  { id: 'TK-001', client: 'Maria Santos',  subject: 'Erro ao acessar cPanel',              dept: 'Hospedagem', priority: 'Alta',    status: 'Aberto',     date: '28 Jun 2026', waiting: '2h' },
  { id: 'TK-002', client: 'João Silva',    subject: 'Configuração de DNS para domínio .ao', dept: 'Domínios',   priority: 'Média',   status: 'Respondido', date: '27 Jun 2026', waiting: '1d' },
  { id: 'TK-003', client: 'Ana Costa',     subject: 'Upgrade de plano Business para Pro',   dept: 'Financeiro', priority: 'Baixa',   status: 'Fechado',    date: '25 Jun 2026', waiting: '—' },
  { id: 'TK-004', client: 'Carlos Mendes', subject: 'Conta suspensa sem aviso',              dept: 'Técnico',    priority: 'Urgente', status: 'Aberto',     date: '28 Jun 2026', waiting: '30min' },
]

const statusStyle: Record<string, { bg: string; color: string; border: string; icon: React.ElementType }> = {
  Aberto:     { bg: 'rgba(245,183,0,0.10)',  color: '#D9A300', border: 'rgba(245,183,0,0.20)',  icon: Clock },
  Respondido: { bg: 'rgba(37,99,235,0.08)',  color: '#2563EB', border: 'rgba(37,99,235,0.20)',  icon: MessageSquare },
  Fechado:    { bg: '#F1F5F9',               color: '#94A3B8', border: '#E2E8F0',               icon: CheckCircle2 },
}

const priorityStyle: Record<string, { bg: string; color: string; border: string }> = {
  Urgente: { bg: 'rgba(239,68,68,0.08)',  color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  Alta:    { bg: 'rgba(234,88,12,0.08)',  color: '#EA580C', border: 'rgba(234,88,12,0.20)' },
  Média:   { bg: 'rgba(245,183,0,0.10)',  color: '#D9A300', border: 'rgba(245,183,0,0.20)' },
  Baixa:   { bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'rgba(16,185,129,0.20)' },
}

const statsItems = [
  { label: 'Abertos',       value: '12', bg: 'rgba(245,183,0,0.08)',  color: '#D9A300', border: 'rgba(245,183,0,0.15)' },
  { label: 'Respondidos',   value: '8',  bg: 'rgba(37,99,235,0.08)',  color: '#2563EB', border: 'rgba(37,99,235,0.15)' },
  { label: 'Urgentes',      value: '2',  bg: 'rgba(239,68,68,0.08)',  color: '#DC2626', border: 'rgba(239,68,68,0.15)' },
  { label: 'Fechados hoje', value: '5',  bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'rgba(16,185,129,0.15)' },
]

const card = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' as const }

export default function AdminTicketsPage() {
  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.20)' }}>
          <MessageSquare size={20} style={{ color: '#7C3AED' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Gestão de Tickets</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Central de suporte — todos os tickets da plataforma</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statsItems.map(s => (
          <div key={s.label} style={{ ...card, padding: 20, textAlign: 'center', overflow: 'visible' }}>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-semibold mt-1" style={{ color: '#64748B' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <MessageSquare size={16} style={{ color: '#7C3AED' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Todos os Tickets</span>
        </div>
        <div>
          {tickets.map((ticket, i) => {
            const s = statusStyle[ticket.status]
            const p = priorityStyle[ticket.priority]
            const StatusIcon = s.icon
            return (
              <div key={ticket.id} className="flex items-center gap-4 px-6 py-4 cursor-pointer"
                style={{ borderBottom: i < tickets.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <MessageSquare size={16} style={{ color: '#7C3AED' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>{ticket.subject}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{ticket.id} · {ticket.client} · {ticket.dept} · {ticket.date}</div>
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>{ticket.priority}</span>
                  <span className="text-xs flex items-center gap-1" style={{ color: '#94A3B8' }}><Clock size={10} /> {ticket.waiting}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  <StatusIcon size={10} /> {ticket.status}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
