import { Metadata } from 'next'
import { Users, UserCheck, UserX, Eye } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Clientes — Admin ViralizaHost' }

const thStyle = {
  padding: '12px 20px',
  textAlign: 'left' as const,
  fontSize: 11,
  fontWeight: 700,
  color: '#94A3B8',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  background: '#F8FAFC',
  borderBottom: '1px solid #F1F5F9',
}

async function fetchClients() {
  const supabase = await createAdminClient()
  const results = await Promise.allSettled([
    supabase.from('profiles').select('id, full_name, email, country, role, is_active, created_at').order('created_at', { ascending: false }),
  ])
  const r = results[0]
  return r.status === 'fulfilled' ? ((r.value as any).data ?? []) : []
}

export default async function AdminClientsPage() {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clients: any[] = await fetchClients()
  const activeCount    = clients.filter(c => c.is_active !== false).length
  const suspendedCount = clients.filter(c => c.is_active === false).length

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)' }}>
            <Users size={20} style={{ color: '#7C3AED' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Clientes</h1>
            <p className="text-sm" style={{ color: '#64748B' }}>Gerencie todos os clientes da plataforma</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
            <UserCheck size={12} /> {activeCount} ativos
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
            <UserX size={12} /> {suspendedCount} suspensos
          </span>
        </div>
      </div>

      {/* Table card */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
        {/* Card header */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <Users size={16} style={{ color: '#7C3AED' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Lista de Clientes</span>
          <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>
            {clients.length} clientes
          </span>
        </div>

        {clients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Cliente', 'País', 'Role', 'Membro desde', 'Status', 'Ações'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c: any, i: number) => {
                  const initials = (c.full_name?.[0] ?? c.email?.[0] ?? '?').toUpperCase()
                  const since    = c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—'
                  const active   = c.is_active !== false
                  return (
                    <tr key={c.id} style={{ borderBottom: i < clients.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      {/* Cliente */}
                      <td style={{ padding: '14px 20px' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                            style={{ background: 'rgba(139,92,246,0.10)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.20)' }}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>{c.full_name || 'Sem nome'}</div>
                            <div className="text-xs" style={{ color: '#94A3B8' }}>{c.email}</div>
                          </div>
                        </div>
                      </td>
                      {/* País */}
                      <td style={{ padding: '14px 20px', color: '#64748B', fontSize: 13 }}>{c.country || '—'}</td>
                      {/* Role */}
                      <td style={{ padding: '14px 20px' }}>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={c.role === 'admin'
                            ? { background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }
                            : { background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                          {c.role ?? 'client'}
                        </span>
                      </td>
                      {/* Data */}
                      <td style={{ padding: '14px 20px', color: '#94A3B8', fontSize: 12 }}>{since}</td>
                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={active
                            ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                            : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
                          {active ? 'Ativo' : 'Suspenso'}
                        </span>
                      </td>
                      {/* Ações */}
                      <td style={{ padding: '14px 20px' }}>
                        <button
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                          style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                          onMouseEnter={e => { (e.currentTarget as any).style.color = '#7C3AED'; (e.currentTarget as any).style.background = 'rgba(139,92,246,0.08)'; (e.currentTarget as any).style.border = '1px solid rgba(139,92,246,0.20)' }}
                          onMouseLeave={e => { (e.currentTarget as any).style.color = '#64748B'; (e.currentTarget as any).style.background = '#F8FAFC'; (e.currentTarget as any).style.border = '1px solid #E2E8F0' }}
                        >
                          <Eye size={12} /> Ver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-14 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <Users size={24} style={{ color: '#7C3AED' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhum cliente ainda</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Os clientes aparecerão aqui após o registo</p>
          </div>
        )}
      </div>
    </div>
  )
}
