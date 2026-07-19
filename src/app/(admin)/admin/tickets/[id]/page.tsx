'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Send, Loader2, Clock, Shield, User,
  AlertCircle, CheckCircle2, RefreshCw, Lock, Unlock,
  Tag, ChevronDown,
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
  ticket_number: string | null
  subject: string
  status: string
  priority: string
  department: string
  category: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  profiles?: { full_name: string; email: string; avatar_url?: string }
  assigned_profile?: { full_name: string; email: string } | null
}

const STATUS_OPTS = [
  { value: 'open',        label: 'Aberto',       color: '#D9A300' },
  { value: 'in_progress', label: 'Em progresso', color: '#2563EB' },
  { value: 'resolved',    label: 'Resolvido',    color: '#059669' },
  { value: 'closed',      label: 'Fechado',      color: '#6B7280' },
]

const PRIORITY_OPTS = [
  { value: 'low',      label: 'Baixa',   color: '#059669' },
  { value: 'medium',   label: 'Média',   color: '#D9A300' },
  { value: 'high',     label: 'Alta',    color: '#EA580C' },
  { value: 'critical', label: 'Urgente', color: '#DC2626' },
]

function statusMeta(s: string) {
  return STATUS_OPTS.find(o => o.value === s) ?? { label: s, color: '#888' }
}
function priorityMeta(p: string) {
  return PRIORITY_OPTS.find(o => o.value === p) ?? { label: p, color: '#888' }
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

export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [ticket,   setTicket]   = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [reply,       setReply]       = useState('')
  const [isInternal,  setIsInternal]  = useState(false)
  const [sending,     setSending]     = useState(false)

  const [updatingStatus,   setUpdatingStatus]   = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/admin/support/tickets/${id}`, { credentials: 'include', cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar ticket.')
      setTicket(data.ticket)
      setMessages(data.messages ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar ticket.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const patch = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/support/tickets/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Erro ao actualizar.')
    }
  }

  const changeStatus = async (status: string) => {
    setUpdatingStatus(true)
    try {
      await patch({ status })
      await load()
      showToast('success', 'Estado atualizado.')
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const changePriority = async (priority: string) => {
    setUpdatingPriority(true)
    try {
      await patch({ priority })
      await load()
      showToast('success', 'Prioridade atualizada.')
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro.')
    } finally {
      setUpdatingPriority(false)
    }
  }

  const sendReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}/messages`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply, is_internal: isInternal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar mensagem.')
      setReply('')
      setIsInternal(false)
      await load()
      showToast('success', isInternal ? 'Nota interna adicionada.' : 'Resposta enviada ao cliente.')
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao enviar.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-5 animate-pulse max-w-4xl">
        <div className="h-8 w-40 rounded-xl" style={{ background: '#F3F4F6' }} />
        <div className="h-28 rounded-2xl" style={{ background: '#F3F4F6' }} />
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

  if (error || !ticket) {
    return (
      <div className="p-6">
        <button onClick={() => router.push('/admin/tickets')}
          className="flex items-center gap-2 text-sm mb-6" style={{ color: '#64748B' }}>
          <ArrowLeft size={15} /> Voltar
        </button>
        <div className="py-20 text-center">
          <AlertCircle size={32} style={{ color: '#DC2626', margin: '0 auto 12px' }} />
          <p className="font-semibold" style={{ color: '#0B0B0D' }}>{error ?? 'Ticket não encontrado'}</p>
        </div>
      </div>
    )
  }

  const st = statusMeta(ticket.status)
  const pr = priorityMeta(ticket.priority)
  const isClosed = ['closed', 'resolved'].includes(ticket.status)

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
          style={{ background: toast.type === 'success' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${toast.type === 'success' ? '#6EE7B7' : '#FCA5A5'}` }}>
          {toast.type === 'success'
            ? <CheckCircle2 size={15} style={{ color: '#059669' }} />
            : <AlertCircle  size={15} style={{ color: '#DC2626' }} />}
          <p className="text-sm font-medium" style={{ color: toast.type === 'success' ? '#065F46' : '#B91C1C' }}>{toast.msg}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button onClick={() => router.push('/admin/tickets')}
          className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-70 transition-opacity"
          style={{ color: '#64748B' }}>
          <ArrowLeft size={15} /> Todos os Tickets
        </button>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl disabled:opacity-50 hover:opacity-80"
          style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
          <RefreshCw size={13} style={{ color: '#6B7280' }} />
        </button>
      </div>

      {/* Ticket info card */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
        <div className="px-6 py-5 space-y-4">
          {/* Number + subject */}
          <div>
            {ticket.ticket_number && (
              <p className="font-mono text-xs mb-1" style={{ color: '#94A3B8' }}>{ticket.ticket_number}</p>
            )}
            <h1 className="text-xl font-black" style={{ color: '#0B0B0D' }}>{ticket.subject}</h1>
          </div>

          {/* Client + meta */}
          <div className="flex flex-wrap gap-4 text-sm">
            {ticket.profiles && (
              <div className="flex items-center gap-2">
                <Avatar name={ticket.profiles.full_name} size={28} />
                <div>
                  <p className="font-semibold text-xs" style={{ color: '#0B0B0D' }}>{ticket.profiles.full_name}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{ticket.profiles.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
              <Clock size={11} />
              {new Date(ticket.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
            {ticket.category && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#64748B' }}>
                <Tag size={11} /> {ticket.category}
              </div>
            )}
          </div>

          {/* Status + priority controls */}
          <div className="flex flex-wrap gap-3 pt-1">
            {/* Status selector */}
            <div className="relative">
              <select
                value={ticket.status}
                onChange={e => changeStatus(e.target.value)}
                disabled={updatingStatus}
                className="appearance-none text-xs font-bold px-3 py-1.5 pr-7 rounded-full cursor-pointer border transition-all disabled:opacity-50"
                style={{ background: `${st.color}14`, color: st.color, borderColor: `${st.color}35` }}
              >
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {updatingStatus
                ? <Loader2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin" style={{ color: st.color }} />
                : <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: st.color }} />
              }
            </div>

            {/* Priority selector */}
            <div className="relative">
              <select
                value={ticket.priority}
                onChange={e => changePriority(e.target.value)}
                disabled={updatingPriority}
                className="appearance-none text-xs font-bold px-3 py-1.5 pr-7 rounded-full cursor-pointer border transition-all disabled:opacity-50"
                style={{ background: `${pr.color}14`, color: pr.color, borderColor: `${pr.color}35` }}
              >
                {PRIORITY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {updatingPriority
                ? <Loader2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin" style={{ color: pr.color }} />
                : <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: pr.color }} />
              }
            </div>

            {/* Quick actions */}
            {isClosed ? (
              <button onClick={() => changeStatus('open')}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }}>
                <Unlock size={11} /> Reabrir
              </button>
            ) : (
              <button onClick={() => changeStatus('closed')}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
                style={{ background: 'rgba(107,114,128,0.08)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.20)' }}>
                <Lock size={11} /> Fechar
              </button>
            )}
            <button onClick={() => changeStatus('resolved')}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-80"
              style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
              <CheckCircle2 size={11} /> Resolver
            </button>
          </div>
        </div>
      </div>

      {/* Messages thread */}
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="py-10 text-center rounded-2xl" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
            <p className="text-sm" style={{ color: '#94A3B8' }}>Sem mensagens ainda.</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isStaff   = msg.is_staff
          const isIntNote = msg.is_internal
          const name      = msg.profiles?.full_name ?? (isStaff ? 'Suporte' : 'Cliente')
          const time      = new Date(msg.created_at).toLocaleString('pt-PT', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })
          return (
            <div key={msg.id} className={`flex gap-3 ${isStaff && !isIntNote ? '' : 'flex-row-reverse'}`}>
              {isStaff
                ? <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1"
                    style={{ background: isIntNote ? 'rgba(234,88,12,0.10)' : 'rgba(124,58,237,0.10)', border: `1px solid ${isIntNote ? 'rgba(234,88,12,0.20)' : 'rgba(124,58,237,0.20)'}` }}>
                    <Shield size={15} style={{ color: isIntNote ? '#EA580C' : '#7C3AED' }} />
                  </div>
                : <Avatar name={ticket.profiles?.full_name ?? 'Cliente'} size={36} />
              }
              <div className={`flex-1 max-w-lg ${isStaff && !isIntNote ? '' : 'items-end flex flex-col'}`}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: '#0B0B0D' }}>{name}</span>
                  {isStaff && !isIntNote && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.15)' }}>
                      Suporte
                    </span>
                  )}
                  {isIntNote && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(234,88,12,0.08)', color: '#EA580C', border: '1px solid rgba(234,88,12,0.15)' }}>
                      Nota interna
                    </span>
                  )}
                  <span className="text-xs" style={{ color: '#94A3B8' }}>{time}</span>
                </div>
                <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    isIntNote
                      ? { background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412', borderTopRightRadius: 4 }
                      : isStaff
                      ? { background: '#F8FAFC', border: '1px solid #F1F5F9', color: '#1E293B', borderTopLeftRadius: 4 }
                      : { background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', borderTopRightRadius: 4 }
                  }>
                  {msg.message}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: `1px solid ${isInternal ? '#FED7AA' : '#E5E7EB'}`, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
        <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-2">
            {isInternal
              ? <Shield size={14} style={{ color: '#EA580C' }} />
              : <User size={14} style={{ color: '#94A3B8' }} />
            }
            <span className="text-xs font-semibold" style={{ color: isInternal ? '#EA580C' : '#64748B' }}>
              {isInternal ? 'Nota interna (não visível ao cliente)' : 'Resposta ao cliente'}
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={e => setIsInternal(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Nota interna</span>
          </label>
        </div>
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply() }}
          rows={4}
          placeholder={isInternal ? 'Escreva uma nota interna…' : 'Escreva a sua resposta ao cliente… (Ctrl+Enter para enviar)'}
          className="w-full px-5 py-4 text-sm outline-none resize-none"
          style={{ color: '#0B0B0D' }}
        />
        <div className="px-5 pb-4 flex justify-end">
          <button onClick={sendReply}
            disabled={sending || !reply.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all hover:opacity-90"
            style={isInternal
              ? { background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA' }
              : { background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.30)' }
            }>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Enviando…' : isInternal ? 'Guardar nota' : 'Enviar resposta'}
          </button>
        </div>
      </div>
    </div>
  )
}
