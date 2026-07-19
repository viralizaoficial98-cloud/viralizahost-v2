import { Metadata } from 'next'
import Link from 'next/link'
import { MessageSquare, Clock, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic   = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: 'Tickets — Admin ViralizaHost' }

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: 'Aberto',       bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.20)' },
  in_progress: { label: 'Em progresso', bg: 'rgba(37,99,235,0.08)',   color: '#2563EB', border: 'rgba(37,99,235,0.20)' },
  resolved:    { label: 'Resolvido',    bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
  closed:      { label: 'Fechado',      bg: '#F1F5F9',                color: '#94A3B8', border: '#E2E8F0' },
}

const PRIORITY_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  critical: { label: 'Crítica', bg: 'rgba(239,68,68,0.08)',  color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  high:     { label: 'Alta',   bg: 'rgba(234,88,12,0.08)',  color: '#EA580C', border: 'rgba(234,88,12,0.20)' },
  medium:   { label: 'Média',  bg: 'rgba(245,183,0,0.10)',  color: '#D9A300', border: 'rgba(245,183,0,0.20)' },
  low:      { label: 'Baixa',  bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'rgba(16,185,129,0.20)' },
}

const card = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' as const }

async function fetchData() {
  try { await requireAdminRole() } catch { redirect('/login') }

  const db = createAdminWriteClient()

  // Load tickets WITHOUT profiles join — tickets has two FKs to profiles (profile_id + assigned_to) → PGRST201
  const { data: ticketsRaw, error: tErr } = await db
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, department, category, profile_id, created_at, updated_at, ticket_messages(count)')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (tErr) console.error('[ADMIN TICKETS] tickets query failed', tErr.message)

  const ticketList = (ticketsRaw ?? []) as {
    id: string; ticket_number: string | null; subject: string; status: string; priority: string;
    department: string | null; category: string | null; profile_id: string; created_at: string;
    updated_at: string | null; ticket_messages: { count: number }[]
  }[]

  // Collect unique profile IDs and fetch profiles separately
  const profileIds = [...new Set(ticketList.map(t => t.profile_id).filter(Boolean))]
  const { data: profilesRaw } = profileIds.length > 0
    ? await db.from('profiles').select('id, full_name, email, avatar_url').in('id', profileIds)
    : { data: [] }

  const profileMap = new Map((profilesRaw ?? []).map(p => [p.id, p]))

  const tickets = ticketList.map(t => ({
    ...t,
    profile: profileMap.get(t.profile_id) ?? null,
  }))

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

  const stats = {
    open:          tickets.filter(t => t.status === 'open').length,
    in_progress:   tickets.filter(t => t.status === 'in_progress').length,
    critical:      tickets.filter(t => t.priority === 'critical').length,
    resolvedToday: tickets.filter(t => t.status === 'resolved' && t.updated_at && new Date(t.updated_at) >= todayStart).length,
    newToday:      tickets.filter(t => new Date(t.created_at) >= todayStart).length,
    total:         tickets.length,
  }
  return { tickets, stats }
}

export default async function AdminTicketsPage() {
  const { tickets, stats } = await fetchData()

  const statsItems = [
    { label: 'Abertos',       value: stats.open,          color: '#D9A300', bg: 'rgba(245,183,0,0.08)',   border: 'rgba(245,183,0,0.15)' },
    { label: 'Em progresso',  value: stats.in_progress,   color: '#2563EB', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.15)' },
    { label: 'Urgentes',      value: stats.critical,      color: '#DC2626', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.15)' },
    { label: 'Resolvidos hoje', value: stats.resolvedToday, color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.15)' },
  ]

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.20)' }}>
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
          <div key={s.label} className="rounded-2xl p-5 text-center"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-semibold mt-1" style={{ color: '#64748B' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tickets list */}
      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <MessageSquare size={16} style={{ color: '#7C3AED' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Todos os Tickets</span>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {tickets.length}
          </span>
        </div>

        {tickets.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 size={32} style={{ color: '#059669', margin: '0 auto 12px' }} />
            <p className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>Sem tickets</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Nenhum ticket na plataforma ainda.</p>
          </div>
        ) : (
          <div>
            {tickets.map((ticket, i) => {
              const s = STATUS_MAP[ticket.status] ?? STATUS_MAP.open
              const p = PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP.medium
              const replies = ticket.ticket_messages?.[0]?.count ?? 0
              const updated = new Date(ticket.updated_at ?? ticket.created_at).toLocaleDateString('pt-PT', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })
              const clientName  = ticket.profile?.full_name ?? 'Desconhecido'
              const clientEmail = ticket.profile?.email ?? ''
              return (
                <Link key={ticket.id} href={`/admin/tickets/${ticket.id}`} className="flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors no-underline"
                  style={{ borderBottom: i < tickets.length - 1 ? '1px solid #F8FAFC' : 'none', color: 'inherit' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                    <MessageSquare size={16} style={{ color: '#7C3AED' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: '#0B0B0D' }}>
                      {ticket.ticket_number && (
                        <span className="font-mono text-xs mr-2" style={{ color: '#94A3B8' }}>{ticket.ticket_number}</span>
                      )}
                      {ticket.subject}
                    </div>
                    <div className="text-xs mt-0.5 flex flex-wrap gap-2" style={{ color: '#94A3B8' }}>
                      <span>{clientName}</span>
                      {clientEmail && <span className="hidden sm:inline">{clientEmail}</span>}
                      {(ticket.category || ticket.department) && <span>{ticket.category || ticket.department}</span>}
                      <span><Clock size={10} className="inline" style={{ verticalAlign: 'middle' }} /> {updated}</span>
                      {replies > 0 && <span>{replies} resp.</span>}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
                      {p.label}
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {s.label}
                  </span>
                  <ChevronRight size={14} style={{ color: '#CBD5E1' }} />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
