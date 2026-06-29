import { Metadata } from 'next'
import { Mail, Plus, HardDrive } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Emails — ViralizaHost' }

export default async function EmailPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emailsRaw } = await supabase
    .from('emails')
    .select('*, hosting_accounts(primary_domain)')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
  const emails = emailsRaw as any[]

  const totalQuota = emails?.reduce((s: number, e: any) => s + e.quota_mb, 0) ?? 0
  const totalUsed = emails?.reduce((s: number, e: any) => s + e.used_mb, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Email Corporativo</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie as suas contas de email</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold">
          <Plus size={16} /> Nova Conta
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-dark rounded-xl border border-yellow-400/20 p-4">
          <div className="text-xs text-gray-600 mb-1">Total de contas</div>
          <div className="text-2xl font-black text-white">{emails?.length ?? 0}</div>
        </div>
        <div className="glass-dark rounded-xl border border-[#222] p-4">
          <div className="text-xs text-gray-600 mb-1">Armazenamento usado</div>
          <div className="text-2xl font-black text-white">{totalUsed} MB</div>
        </div>
        <div className="glass-dark rounded-xl border border-[#222] p-4">
          <div className="text-xs text-gray-600 mb-1">Cota total</div>
          <div className="text-2xl font-black text-white">{totalQuota} MB</div>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <Mail size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Contas de Email</h2>
          <span className="ml-auto text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">{emails?.length ?? 0} contas</span>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {emails && emails.length > 0 ? emails.map((em) => {
            const usedPct = em.quota_mb > 0 ? Math.round((em.used_mb / em.quota_mb) * 100) : 0
            const barColor = usedPct > 80 ? 'bg-red-400' : usedPct > 60 ? 'bg-yellow-400' : 'bg-green-400'
            return (
              <div key={em.id} className="p-5 flex items-center gap-4 hover:bg-[#111] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                  <Mail size={18} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm">{em.email_address}</div>
                  {em.display_name && <div className="text-xs text-gray-600 mt-0.5">{em.display_name}</div>}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 flex-shrink-0 flex items-center gap-1">
                      <HardDrive size={10} /> {em.used_mb}/{em.quota_mb} MB
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${em.status === 'active' ? 'bg-green-400/10 text-green-400 border border-green-400/20' : 'bg-gray-400/10 text-gray-500 border border-gray-400/20'}`}>
                  {em.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            )
          }) : (
            <div className="p-12 text-center">
              <Mail size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhuma conta de email criada</p>
              <button className="mt-4 btn-primary text-xs px-4 py-2 rounded-xl font-bold">Criar primeiro email</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
