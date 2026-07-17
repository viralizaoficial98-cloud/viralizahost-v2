'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Plus, Clock, CheckCircle2, AlertCircle,
  Loader2, X, ChevronRight, RefreshCw,
} from 'lucide-react'

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  department: string
  category: string | null
  created_at: string
  updated_at: string
  ticket_messages?: [{ count: number }]
}

const CATEGORIES = [
  'Hospedagem', 'Domínio', 'E-mail Corporativo', 'cPanel', 'Webmail',
  'Faturação', 'Pagamento', 'Renovação', 'Segurança', 'Migração',
  'Problema Técnico', 'Outro',
]

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: 'Aberto',      bg: 'rgba(245,183,0,0.08)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
  in_progress: { label: 'Em progresso', bg: 'rgba(59,130,246,0.08)', color: '#2563EB', border: 'rgba(59,130,246,0.20)' },
  resolved:    { label: 'Resolvido',   bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
  closed:      { label: 'Fechado',     bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)' },
}

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low:      { label: 'Baixa',   color: '#059669' },
  medium:   { label: 'Média',   color: '#D9A300' },
  high:     { label: 'Alta',    color: '#EA580C' },
  critical: { label: 'Crítica', color: '#DC2626' },
}

function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm"
      style={{ background: type === 'success' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${type === 'success' ? '#6EE7B7' : '#FCA5A5'}` }}
    >
      {type === 'success'
        ? <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
        : <AlertCircle  size={16} style={{ color: '#DC2626', flexShrink: 0 }} />}
      <p className="text-sm font-medium flex-1" style={{ color: type === 'success' ? '#065F46' : '#B91C1C' }}>{msg}</p>
      <button onClick={onClose}><X size={14} style={{ color: '#94A3B8' }} /></button>
    </motion.div>
  )
}

export default function TicketManager() {
  const router = useRouter()
  const [tickets, setTickets]       = useState<Ticket[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]           = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [filter, setFilter]         = useState('all')

  // Form state
  const [subject,     setSubject]     = useState('')
  const [category,    setCategory]    = useState('')
  const [priority,    setPriority]    = useState('medium')
  const [description, setDescription] = useState('')

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4500)
  }

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/support/tickets', { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      setTickets(data.tickets ?? [])
    } catch { showToast('error', 'Erro ao carregar tickets.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const handleCreate = async () => {
    if (!subject.trim() || !category || !description.trim()) {
      showToast('error', 'Preencha todos os campos obrigatórios.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/client/support/tickets', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, priority, description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar ticket.')
      showToast('success', `Ticket ${data.ticket.ticket_number} criado com sucesso!`)
      setShowModal(false)
      setSubject(''); setCategory(''); setPriority('medium'); setDescription('')
      fetchTickets()
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao criar ticket.')
    } finally { setSubmitting(false) }
  }

  const filtered = tickets.filter(t => filter === 'all' || t.status === filter)
  const open   = tickets.filter(t => t.status === 'open').length
  const prog   = tickets.filter(t => t.status === 'in_progress').length
  const closed = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length

  return (
    <div className="space-y-7">
      <AnimatePresence>
        {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Suporte</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Central de atendimento e tickets</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchTickets} disabled={loading}
            className="p-2.5 rounded-xl disabled:opacity-50 transition-all hover:opacity-80"
            style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: '#6B7280' }} />
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
            <Plus size={16} /> Abrir Ticket
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Abertos',      value: open,   accent: '#D9A300', bg: 'rgba(245,183,0,0.08)',   border: 'rgba(245,183,0,0.20)',  Icon: Clock },
          { label: 'Em progresso', value: prog,   accent: '#2563EB', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.15)', Icon: MessageSquare },
          { label: 'Fechados',     value: closed, accent: '#059669', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.15)', Icon: CheckCircle2 },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.Icon size={13} style={{ color: s.accent }} />
              <span className="text-xs font-semibold" style={{ color: s.accent }}>{s.label}</span>
            </div>
            <div className="text-3xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      {tickets.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all',        label: 'Todos' },
            { key: 'open',       label: 'Abertos' },
            { key: 'in_progress', label: 'Em progresso' },
            { key: 'resolved',   label: 'Resolvidos' },
            { key: 'closed',     label: 'Fechados' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={filter === f.key
                ? { background: '#0B0B0D', color: '#FFFFFF' }
                : { background: '#F1F5F9', color: '#64748B' }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Tickets list */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <MessageSquare size={15} style={{ color: '#7C3AED' }} />
          </div>
          <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Meus Tickets</h2>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col gap-3 px-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl shrink-0" style={{ background: '#F3F4F6' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-56 rounded" style={{ background: '#F3F4F6' }} />
                  <div className="h-2 w-36 rounded" style={{ background: '#F9FAFB' }} />
                </div>
                <div className="h-6 w-20 rounded-full" style={{ background: '#F9FAFB' }} />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div>
            {filtered.map((ticket, i) => {
              const s = STATUS_MAP[ticket.status]    ?? STATUS_MAP.open
              const p = PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP.medium
              const replies = (ticket.ticket_messages as any)?.[0]?.count ?? 0
              const updated = new Date(ticket.updated_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
              return (
                <motion.div key={ticket.id}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors duration-150"
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <MessageSquare size={16} style={{ color: '#7C3AED' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: '#0B0B0D' }}>
                      {ticket.ticket_number && <span className="font-mono text-xs mr-2" style={{ color: '#94A3B8' }}>{ticket.ticket_number}</span>}
                      {ticket.subject}
                    </div>
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                      {(ticket.category || ticket.department) && (
                        <span className="text-xs font-medium" style={{ color: '#64748B' }}>{ticket.category || ticket.department}</span>
                      )}
                      <span className="text-xs font-semibold" style={{ color: p.color }}>● {p.label}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{updated}</span>
                      {replies > 0 && (
                        <span className="text-xs" style={{ color: '#94A3B8' }}>{replies} resposta{replies !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {s.label}
                    </span>
                    <ChevronRight size={14} style={{ color: '#CBD5E1' }} />
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <MessageSquare size={28} style={{ color: '#7C3AED' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>
              {tickets.length > 0 ? 'Nenhum ticket com este filtro' : 'Nenhum ticket aberto'}
            </p>
            <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>
              {tickets.length > 0 ? 'Tente outro filtro' : 'A nossa equipa está pronta para ajudar'}
            </p>
            {tickets.length === 0 && (
              <button onClick={() => setShowModal(true)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-black"
                style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
                Abrir primeiro ticket
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create ticket modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg rounded-2xl overflow-hidden"
              style={{ background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}
            >
              {/* Modal header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)' }}>
                    <MessageSquare size={17} style={{ color: '#7C3AED' }} />
                  </div>
                  <h3 className="font-black text-lg" style={{ color: '#0B0B0D' }}>Novo Ticket de Suporte</h3>
                </div>
                <button onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg transition-colors hover:opacity-70">
                  <X size={18} style={{ color: '#94A3B8' }} />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Subject */}
                <div>
                  <label className="text-xs font-bold mb-1.5 block uppercase tracking-wider" style={{ color: '#64748B' }}>
                    Assunto <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="Descreva brevemente o problema"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2"
                    style={{ borderColor: '#E5E7EB' }}
                  />
                </div>

                {/* Category + Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1.5 block uppercase tracking-wider" style={{ color: '#64748B' }}>
                      Categoria <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
                      style={{ borderColor: '#E5E7EB' }}>
                      <option value="">Selecionar…</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1.5 block uppercase tracking-wider" style={{ color: '#64748B' }}>
                      Prioridade
                    </label>
                    <select value={priority} onChange={e => setPriority(e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
                      style={{ borderColor: '#E5E7EB' }}>
                      <option value="low">Baixa</option>
                      <option value="medium">Normal</option>
                      <option value="high">Alta</option>
                      <option value="critical">Urgente</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold mb-1.5 block uppercase tracking-wider" style={{ color: '#64748B' }}>
                    Descrição detalhada <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <textarea
                    value={description} onChange={e => setDescription(e.target.value)}
                    rows={5} placeholder="Descreva o problema em detalhe. Inclua passos para reproduzir, mensagens de erro, etc."
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                    style={{ borderColor: '#E5E7EB' }}
                  />
                </div>
              </div>

              {/* Modal footer */}
              <div className="px-6 pb-6 flex gap-3" style={{ borderTop: '1px solid #F8FAFC', paddingTop: '1rem' }}>
                <button onClick={() => setShowModal(false)} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: '#F3F4F6', color: '#374151' }}>
                  Cancelar
                </button>
                <button onClick={handleCreate}
                  disabled={submitting || !subject.trim() || !category || !description.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
                  {submitting ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : 'Abrir Ticket'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
