import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Conversa do agente' }

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AgentConversationPage({ params }: { params: Promise<{ id: string }> }) {
  try { await requireAdminRole() } catch { redirect('/login') }
  const { id } = await params
  const db = getPool()
  const [[conv]] = await db.query('SELECT c.id, c.title, c.user_level, c.status, c.created_at, p.full_name, p.email FROM ai_conversations c LEFT JOIN profiles p ON p.id = c.profile_id WHERE c.id = ?', [id]) as any
  if (!conv) notFound()
  const [messages] = await db.query("SELECT id, role, content, tool_name, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY created_at LIMIT 500", [id]) as any
  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/agent" className="inline-flex items-center gap-1 text-sm text-[#64748B]"><ChevronLeft size={14} /> Conversas</Link>
      <div>
        <h1 className="text-2xl font-black text-[#0B0B0D]">{conv.title ?? 'Conversa'}</h1>
        <p className="text-sm text-[#64748B]">{conv.full_name ?? conv.email ?? 'Visitante'} · {conv.user_level} · {conv.status} · {new Date(conv.created_at).toLocaleString('pt-PT')}</p>
      </div>
      {!messages.length && <p className="text-sm text-[#64748B]">Sem mensagens.</p>}
      <ul className="space-y-2">
        {messages.map((m: any) => (
          <li key={m.id} className={`rounded-xl border p-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-white border-[#E5E7EB]' : m.role === 'tool' ? 'bg-[#F8FAFC] border-[#E5E7EB] text-xs text-[#64748B]' : 'bg-[#FFF8E1] border-[#F5E3A3]'}`}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#64748B] mb-1">{m.role === 'user' ? 'Utilizador' : m.role === 'tool' ? `Ferramenta ${m.tool_name ?? ''}` : 'Agente'} · {new Date(m.created_at).toLocaleTimeString('pt-PT')}</p>
            {String(m.content ?? '').slice(0, 4000)}
          </li>
        ))}
      </ul>
    </div>
  )
}
