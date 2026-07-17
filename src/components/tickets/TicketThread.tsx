'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, ArrowLeft, Send, Loader2, CheckCircle2,
  AlertCircle, X, Clock, User, Shield, RefreshCw,
} from 'lucide-react'

interface Message {
  id: string
  message: string
  is_staff: boolean
  is_internal: boolean
  created_at: string
  profiles?: { full_name: string; avatar_url?: string; role?: string }
}

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
  profiles?: { full_name: string; email: string; avatar_url?: string }
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: 'Aberto',       bg: 'rgba(245,183,0,0.08)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
  in_progress: { label: 'Em progresso', bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)' },
  resolved:    { label: 'Resolvido',    bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
  closed:      { label: 'Fechado',      bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)' },
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

function Avatar({ name, size = 36 }: { name?: string; size?: number }) {
  const initials = (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-bold text-xs"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff' }}>
      {initials}
    </div>
  )
}

export default function TicketThread({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [ticket,     setTicket]     = useState<Ticket | null>(null)
  const [messages,   setMessages]   = useState<Message[]>([])
  const [loading,    setLoading]    = useState(true)
  const [reply,      setReply]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [toast,      setToast]      = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/client/support/tickets/${ticketId}`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar ticket.')
      setTicket(data.ticket)
      setMessages(data.messages ?? [])
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao carregar ticket.')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/client/support/tickets/${ticketId}/messages`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar mensagem.')
      setReply('')
      await load()
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao enviar mensagem.')
    } finally {
      setSending(false)
    }
  }

  const changeStatus = async (status: 'open' | 'resolved') => {
    try {
      const res = await fetch(`/api/client/support/tickets/${ticketId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Erro ao actualizar estado.')
      showToast('success', status === 'resolved' ? 'Ticket marcado como resolvido.' : 'Ticket reaberto.')
      await load()
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro.')
    }
  }

  const s = ticket ? (STATUS_MAP[ticket.status] ?? STATUS_MAP.open)     : null
  const p = ticket ? (PRIORITY_MAP[ticket.priority] ?? PRIORITY_MAP.medium) : null
  const canReply   = ticket && !['closed'].includes(ticket.status)
  const canResolve = ticket && !['resolved', 'closed'].includes(ticket.status)
  const canReopen  = ticket && ['resolved', 'closed'].includes(ticket.status)

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-8 w-40 rounded-xl" style={{ background: '#F3F4F6' }} />
        <div className="h-24 rounded-2xl" style={{ background: '#F3F4F6' }} />
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-9 h-9 rounded-full shrink-0" style={{ background: '#F3F4F6' }} />
              <div className="flex-1 h-16 rounded-2xl" style={{ background: '#F3F4F6' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="py-20 text-center">
        <AlertCircle size={32} style={{ color: '#DC2626', margin: '0 auto 12px' }} />
        <p className="font-semibold" style={{ color: '#0B0B0D' }}>Ticket não encontrado</p>
        <button onClick={() => router.push('/tickets')} className="mt-4 text-sm underline" style={{ color: '#7C3AED' }}>Voltar</button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <AnimatePresence>
        {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Back + refresh */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={() => router.push('/tickets')}
          className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#64748B' }}>
          <ArrowLeft size={15} /> Voltar aos tickets
        </button>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl disabled:opacity-50 hover:opacity-80 transition-opacity"
          style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
          <RefreshCw size={13} style={{ color: '#6B7280' }} />
        </button>
      </div>

      {/* Ticket header card */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            {ticket.ticket_number && (
              <p className="font-mono text-xs mb-1" style={{ color: '#94A3B8' }}>{ticket.ticket_number}</p>
            )}
            <h1 className="text-xl font-black" style={{ color: '#0B0B0D' }}>{ticket.subject}</h1>
          </div>
          {s && (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full shrink-0"
              style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
              {s.label}
            </span>
          )}
        </div>
        <div className="flex items-center flex-wrap gap-3 text-xs" style={{ color: '#64748B' }}>
          {ticket.category && <span className="font-medium">{ticket.category}</span>}
          {p && <span style={{ color: p.color }}>● {p.label}</span>}
          <span><Clock size={11} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
            {new Date(ticket.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {/* Actions */}
        <div className="flex gap-2 pt-1 flex-wrap">
          {canResolve && (
            <button onClick={() => changeStatus('resolved')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{ background: 'rgba(16,185,129,0.10)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
              <CheckCircle2 size={12} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
              Marcar Resolvido
            </button>
          )}
          {canReopen && (
            <button onClick={() => changeStatus('open')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
              style={{ background: 'rgba(245,183,0,0.08)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }}>
              Reabrir Ticket
            </button>
          )}
        </div>
      </div>

      {/* Messages thread */}
      <div className="space-y-4">
        {messages.map((msg, i) => {
          const isStaff = msg.is_staff
          const name    = msg.profiles?.full_name ?? (isStaff ? 'Suporte ViralizaHost' : 'Você')
          const time    = new Date(msg.created_at).toLocaleString('pt-PT', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })
          return (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className={`flex gap-3 ${isStaff ? '' : 'flex-row-reverse'}`}
            >
              {isStaff
                ? <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1"
                    style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.20)' }}>
                    <Shield size={15} style={{ color: '#7C3AED' }} />
                  </div>
                : <Avatar name={ticket.profiles?.full_name ?? 'Eu'} size={36} />
              }
              <div className={`flex-1 max-w-lg ${isStaff ? '' : 'items-end flex flex-col'}`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: '#0B0B0D' }}>{name}</span>
                  {isStaff && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.15)' }}>
                      Equipa de Suporte
                    </span>
                  )}
                  <span className="text-xs" style={{ color: '#94A3B8' }}>{time}</span>
                </div>
                <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={isStaff
                    ? { background: '#F8FAFC', border: '1px solid #F1F5F9', color: '#1E293B', borderTopLeftRadius: 4 }
                    : { background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', borderTopRightRadius: 4 }
                  }>
                  {msg.message}
                </div>
              </div>
            </motion.div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {canReply ? (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <User size={14} style={{ color: '#94A3B8' }} />
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>A sua resposta</span>
          </div>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply() }}
            rows={4}
            placeholder="Escreva a sua mensagem… (Ctrl+Enter para enviar)"
            className="w-full px-5 py-4 text-sm outline-none resize-none"
            style={{ color: '#0B0B0D' }}
          />
          <div className="px-5 pb-4 flex justify-end">
            <button onClick={sendReply}
              disabled={sending || !reply.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 12px rgba(245,183,0,0.30)' }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl px-5 py-4 text-center text-sm"
          style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', color: '#94A3B8' }}>
          {ticket.status === 'closed' ? 'Este ticket está fechado.' : 'Este ticket foi resolvido.'}
          {' '}
          <button onClick={() => changeStatus('open')} className="underline font-semibold" style={{ color: '#7C3AED' }}>
            Reabrir?
          </button>
        </div>
      )}
    </div>
  )
}
