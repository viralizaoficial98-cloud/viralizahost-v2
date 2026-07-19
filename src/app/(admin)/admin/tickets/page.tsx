'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  MessageSquare, Clock, CheckCircle2, AlertCircle, ChevronRight,
  RefreshCw, Search, Filter, Loader2, Tag, Users,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────────────── */
interface Profile { full_name: string; email: string; avatar_url?: string | null }
interface Ticket {
  id: string
  ticket_number: string | null
  subject: string
  status: string
  priority: string
  department: string | null
  category: string | null
  profile_id: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string | null
  message_count: number
  profiles: Profile | null
  assigned_profile: Profile | null
}
interface Stats {
  open: number; in_progress: number; resolved: number; closed: number
  critical: number; newToday: number; resolvedToday: number; total: number
}

/* ─── Maps ───────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: 'Aberto',       bg: 'rgba(245,183,0,0.10)',  color: '#D9A300', border: 'rgba(245,183,0,0.22)' },
  in_progress: { label: 'Em progresso', bg: 'rgba(37,99,235,0.08)',  color: '#2563EB', border: 'rgba(37,99,235,0.20)' },
  resolved:    { label: 'Resolvido',    bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'rgba(16,185,129,0.20)' },
  closed:      { label: 'Fechado',      bg: '#F1F5F9',               color: '#94A3B8', border: '#E2E8F0' },
}

const PRIORITY_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  critical: { label: 'Urgente', bg: 'rgba(239,68,68,0.08)',  color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  high:     { label: 'Alta',   bg: 'rgba(234,88,12,0.08)',  color: '#EA580C', border: 'rgba(234,88,12,0.20)' },
  medium:   { label: 'Média',  bg: 'rgba(245,183,0,0.10)',  color: '#D9A300', border: 'rgba(245,183,0,0.20)' },
  low:      { label: 'Baixa',  bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'rgba(16,185,129,0.20)' },
}

function statusOf(s: string)   { return STATUS_MAP[s]   ?? STATUS_MAP.open }
function priorityOf(p: string) { return PRIORITY_MAP[p] ?? PRIORITY_MAP.medium }

/* ─── Stat card ─────────────────────────────────────────────── */
function StatCard({ label, value, color, bg, border }: { label: string; value: number; color: string; bg: string; border: string }) {
  return (
    <div className="rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-1"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="text-2xl font-black tabular-nums" style={{ color }}>{value}</div>
      <div className="text-xs font-semibold" style={{ color: '#64748B' }}>{label}</div>
    </div>
  )
}

/* ─── Filter pill ────────────────────────────────────────────── */
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
      style={active
        ? { background: '#7C3AED', color: '#fff', border: '1px solid #7C3AED' }
        : { background: '#F8FAFC', color: '#64748B', border: '1px solid #E5E7EB' }
      }>
      {children}
    </button>
  )
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function AdminTicketsPage() {
  const [tickets,  setTickets]  = useState<Ticket[]>([])
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  /* filters */
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPrio,   setFilterPrio]   = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/admin/support/tickets', { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar tickets.')
      setTickets(data.tickets ?? [])
      setStats(data.stats ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar tickets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* derive unique categories for filter */
  const categories = useMemo(() => {
    const cats = tickets.map(t => t.category ?? t.department ?? '').filter(Boolean)
    return [...new Set(cats)].sort()
  }, [tickets])

  const [filterCat, setFilterCat] = useState('all')

  /* client-side filtering */
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return tickets.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterPrio   !== 'all' && t.priority !== filterPrio)  return false
      if (filterCat    !== 'all' && (t.category ?? t.department) !== filterCat) return false
      if (q) {
        const haystack = [
          t.subject, t.ticket_number,
          t.profiles?.full_name, t.profiles?.email,
          t.category, t.department,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tickets, filterStatus, filterPrio, filterCat, search])

  /* ── Error / loading ──────────────────────────────────────── */
  if (error) {
    return (
      <div className="space-y-7">
        <PageHeader />
        <div className="rounded-2xl py-20 text-center"
          style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <AlertCircle size={32} style={{ color: '#DC2626', margin: '0 auto 12px' }} />
          <p className="font-semibold text-sm mb-4" style={{ color: '#B91C1C' }}>{error}</p>
          <button onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#DC2626', color: '#fff' }}>
            <RefreshCw size={13} /> Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const statsItems = stats ? [
    { label: 'Total',        value: stats.total,      color: '#0B0B0D', bg: '#F8FAFC',               border: '#E5E7EB' },
    { label: 'Abertos',      value: stats.open,       color: '#D9A300', bg: 'rgba(245,183,0,0.08)',  border: 'rgba(245,183,0,0.20)' },
    { label: 'Em progresso', value: stats.in_progress,color: '#2563EB', bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.20)' },
    { label: 'Resolvidos',   value: stats.resolved,   color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.20)' },
    { label: 'Fechados',     value: stats.closed,     color: '#94A3B8', bg: '#F1F5F9',               border: '#E2E8F0' },
    { label: 'Urgentes',     value: stats.critical,   color: '#DC2626', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.20)' },
  ] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader />
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl disabled:opacity-50 transition-opacity hover:opacity-70"
          style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
          {loading
            ? <Loader2 size={15} className="animate-spin" style={{ color: '#6B7280' }} />
            : <RefreshCw size={15} style={{ color: '#6B7280' }} />
          }
        </button>
      </div>

      {/* Stats */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: '#F3F4F6' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statsItems.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-2xl p-4 space-y-3"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar por assunto, cliente, e-mail ou número…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', color: '#0B0B0D' }}
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold mr-1 flex items-center gap-1" style={{ color: '#94A3B8' }}>
            <Filter size={11} /> Estado:
          </span>
          {[
            { value: 'all',         label: 'Todos' },
            { value: 'open',        label: 'Abertos' },
            { value: 'in_progress', label: 'Em progresso' },
            { value: 'resolved',    label: 'Resolvidos' },
            { value: 'closed',      label: 'Fechados' },
          ].map(o => (
            <Pill key={o.value} active={filterStatus === o.value} onClick={() => setFilterStatus(o.value)}>
              {o.label}
            </Pill>
          ))}
        </div>

        {/* Priority pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold mr-1 flex items-center gap-1" style={{ color: '#94A3B8' }}>
            <AlertCircle size={11} /> Prioridade:
          </span>
          {[
            { value: 'all',      label: 'Todas' },
            { value: 'critical', label: 'Urgente' },
            { value: 'high',     label: 'Alta' },
            { value: 'medium',   label: 'Média' },
            { value: 'low',      label: 'Baixa' },
          ].map(o => (
            <Pill key={o.value} active={filterPrio === o.value} onClick={() => setFilterPrio(o.value)}>
              {o.label}
            </Pill>
          ))}
        </div>

        {/* Category pills (dynamic) */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold mr-1 flex items-center gap-1" style={{ color: '#94A3B8' }}>
              <Tag size={11} /> Categoria:
            </span>
            <Pill active={filterCat === 'all'} onClick={() => setFilterCat('all')}>Todas</Pill>
            {categories.map(cat => (
              <Pill key={cat} active={filterCat === cat} onClick={() => setFilterCat(cat)}>
                {cat}
              </Pill>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <MessageSquare size={16} style={{ color: '#7C3AED' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>
            {filterStatus === 'all' && filterPrio === 'all' && filterCat === 'all' && !search
              ? 'Todos os Tickets'
              : 'Resultados filtrados'}
          </span>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {loading ? '…' : filtered.length}
          </span>
        </div>

        {loading ? (
          <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl shrink-0" style={{ background: '#F3F4F6' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded" style={{ background: '#F3F4F6' }} />
                  <div className="h-2.5 w-1/2 rounded" style={{ background: '#F3F4F6' }} />
                </div>
                <div className="h-6 w-16 rounded-full" style={{ background: '#F3F4F6' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle2 size={32} style={{ color: '#059669', margin: '0 auto 12px' }} />
            <p className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>
              {tickets.length === 0 ? 'Sem tickets ainda.' : 'Nenhum ticket corresponde aos filtros.'}
            </p>
            {tickets.length > 0 && (
              <button onClick={() => { setFilterStatus('all'); setFilterPrio('all'); setFilterCat('all'); setSearch('') }}
                className="mt-3 text-xs font-semibold underline" style={{ color: '#7C3AED' }}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((ticket, i) => {
              const s    = statusOf(ticket.status)
              const p    = priorityOf(ticket.priority)
              const name = ticket.profiles?.full_name ?? 'Desconhecido'
              const email = ticket.profiles?.email ?? ''
              const cat  = ticket.category ?? ticket.department ?? ''
              const updated = new Date(ticket.updated_at ?? ticket.created_at).toLocaleDateString('pt-PT', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })

              return (
                <Link
                  key={ticket.id}
                  href={`/admin/tickets/${ticket.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors no-underline hover:bg-gray-50"
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid #F8FAFC' : 'none',
                    color: 'inherit',
                    display: 'flex',
                  }}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                    <MessageSquare size={16} style={{ color: '#7C3AED' }} />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: '#0B0B0D' }}>
                      {ticket.ticket_number && (
                        <span className="font-mono text-xs mr-2" style={{ color: '#94A3B8' }}>
                          {ticket.ticket_number}
                        </span>
                      )}
                      {ticket.subject}
                    </div>
                    <div className="text-xs mt-0.5 flex flex-wrap gap-2 items-center" style={{ color: '#94A3B8' }}>
                      <span className="flex items-center gap-1">
                        <Users size={10} /> {name}
                      </span>
                      {email && <span className="hidden sm:inline truncate max-w-[160px]">{email}</span>}
                      {cat && (
                        <span className="flex items-center gap-1">
                          <Tag size={10} /> {cat}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {updated}
                      </span>
                      {ticket.message_count > 0 && (
                        <span>{ticket.message_count} resp.</span>
                      )}
                    </div>
                  </div>

                  {/* Priority badge (hidden on xs) */}
                  <div className="hidden sm:flex items-center shrink-0">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
                      {p.label}
                    </span>
                  </div>

                  {/* Status badge */}
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

function PageHeader() {
  return (
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
  )
}
