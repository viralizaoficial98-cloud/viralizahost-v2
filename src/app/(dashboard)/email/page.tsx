import { Metadata } from 'next'
import { Mail, Plus, HardDrive, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Emails — ViralizaHost' }

const card = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

async function fetchEmails(userId: string) {
  const supabase = await createClient()
  const result = await supabase
    .from('emails')
    .select('*, hosting_accounts(primary_domain)')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
  return (result.data ?? []) as any[]
}

export default async function EmailPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const emails = await fetchEmails(user.id)
  const totalQuota = emails.reduce((s, e) => s + (e.quota_mb ?? 0), 0)
  const totalUsed  = emails.reduce((s, e) => s + (e.used_mb  ?? 0), 0)
  const activeCount = emails.filter(e => e.status === 'active').length

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Email Corporativo</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Gerencie as suas contas de email profissional</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <Plus size={16} /> Nova Conta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Contas ativas',     value: activeCount,                     accent: '#059669', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.15)' },
          { label: 'Armazenamento usado', value: `${totalUsed} MB`,              accent: '#2563EB', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.15)' },
          { label: 'Cota total',          value: `${totalQuota} MB`,             accent: '#D9A300', bg: 'rgba(245,183,0,0.08)',   border: 'rgba(245,183,0,0.20)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: s.accent }}>{s.label}</div>
            <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* List card */}
      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <Mail size={15} style={{ color: '#059669' }} />
          </div>
          <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Contas de Email</h2>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {emails.length} conta{emails.length !== 1 ? 's' : ''}
          </span>
        </div>

        {emails.length > 0 ? (
          <div>
            {emails.map((em: any, i: number) => {
              const usedPct  = em.quota_mb > 0 ? Math.round((em.used_mb / em.quota_mb) * 100) : 0
              const barColor = usedPct > 80 ? '#EF4444' : usedPct > 60 ? '#F5B700' : '#10B981'
              const isActive = em.status === 'active'
              return (
                <div key={em.id} className="px-6 py-4 flex items-center gap-4"
                  style={{ borderBottom: i < emails.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <Inbox size={17} style={{ color: '#059669' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{em.email_address}</div>
                    {em.display_name && (
                      <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{em.display_name}</div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(usedPct, 100)}%`, background: barColor }} />
                      </div>
                      <span className="text-xs flex-shrink-0 flex items-center gap-1 font-medium" style={{ color: '#94A3B8' }}>
                        <HardDrive size={10} /> {em.used_mb}/{em.quota_mb} MB
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={isActive
                      ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                      : { background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                    {isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <Mail size={28} style={{ color: '#059669' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhuma conta de email criada</p>
            <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>Crie o seu email profissional com o seu domínio</p>
            <button className="px-5 py-2.5 rounded-xl text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
              Criar primeiro email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
