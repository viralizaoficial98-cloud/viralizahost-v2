'use client'
import { useEffect, useState } from 'react'
import { Bot, MessageSquare, Users, Clock, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Conversation {
  id: string
  title: string
  user_level: string
  status: string
  created_at: string
  updated_at: string
  profile_id: string | null
  profile?: { full_name: string | null; email: string | null }
  message_count?: number
}

interface Stats {
  total: number
  active: number
  visitors: number
  clients: number
  admins: number
}

export default function AdminAgentPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/agent/conversations')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setConversations(data.conversations ?? [])
        setStats(data.stats ?? null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const levelBadge: Record<string, string> = {
    visitor: 'bg-gray-100 text-gray-600',
    client: 'bg-blue-50 text-blue-700',
    admin: 'bg-yellow-50 text-yellow-700',
  }

  const statusBadge: Record<string, string> = {
    active: 'bg-green-50 text-green-700',
    resolved: 'bg-gray-100 text-gray-600',
    abandoned: 'bg-red-50 text-red-600',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#F5B700]/10 rounded-xl flex items-center justify-center">
          <Bot size={20} className="text-[#B08000]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agente IA</h1>
          <p className="text-sm text-gray-500">Conversas e actividade do assistente virtual</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: MessageSquare, color: 'text-gray-700' },
            { label: 'Activas', value: stats.active, icon: Clock, color: 'text-green-600' },
            { label: 'Visitantes', value: stats.visitors, icon: Users, color: 'text-gray-500' },
            { label: 'Clientes', value: stats.clients, icon: Users, color: 'text-blue-600' },
            { label: 'Admins', value: stats.admins, icon: Bot, color: 'text-yellow-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon size={14} className={s.color} />
                <span className="text-xs text-gray-500 font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Conversations list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Conversas recentes</h2>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">A carregar...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 mx-5 my-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bot size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Ainda não há conversas com o agente IA.</p>
          </div>
        )}

        {!loading && !error && conversations.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Conversa</th>
                <th className="px-5 py-3 text-left font-medium">Utilizador</th>
                <th className="px-5 py-3 text-left font-medium">Nível</th>
                <th className="px-5 py-3 text-left font-medium">Estado</th>
                <th className="px-5 py-3 text-left font-medium">Data</th>
                <th className="px-5 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversations.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-900 line-clamp-1">{c.title ?? 'Sem título'}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {c.profile?.full_name ?? c.profile?.email ?? (c.profile_id ? c.profile_id.slice(0, 8) : 'Visitante')}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${levelBadge[c.user_level] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.user_level}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">
                    {new Date(c.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/agent/${c.id}`} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
