import { Metadata } from 'next'
import { Globe, Plus, RefreshCw, Lock, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Domínios — ViralizaHost' }

const statusConfig: Record<string, { label: string; class: string }> = {
  active: { label: 'Ativo', class: 'bg-green-400/10 text-green-400 border border-green-400/20' },
  expired: { label: 'Expirado', class: 'bg-red-400/10 text-red-400 border border-red-400/20' },
  pending: { label: 'Pendente', class: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' },
  transferred: { label: 'Transferido', class: 'bg-blue-400/10 text-blue-400 border border-blue-400/20' },
  locked: { label: 'Bloqueado', class: 'bg-gray-400/10 text-gray-500 border border-gray-400/20' },
}

export default async function DomainsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: domainsRaw } = await supabase
    .from('domains')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
  const domains = domainsRaw as any[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Domínios</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie todos os seus domínios</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold">
          <Plus size={16} /> Registar Domínio
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['active', 'expired', 'pending'] as const).map(s => {
          const count = domains?.filter(d => d.status === s).length ?? 0
          const borderColor = s === 'active' ? 'border-green-400/20' : s === 'expired' ? 'border-red-400/20' : 'border-yellow-400/20'
          return (
            <div key={s} className={`glass-dark rounded-xl border p-4 ${borderColor}`}>
              <div className="text-xs text-gray-600 mb-1">{statusConfig[s].label}</div>
              <div className="text-2xl font-black text-white">{count}</div>
            </div>
          )
        })}
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <Globe size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Meus Domínios</h2>
          <span className="ml-auto text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">{domains?.length ?? 0} domínios</span>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {domains && domains.length > 0 ? domains.map((domain) => {
            const cfg = statusConfig[domain.status] ?? statusConfig.pending
            const expires = domain.expires_at ? new Date(domain.expires_at).toLocaleDateString('pt-BR') : '—'
            return (
              <div key={domain.id} className="p-5 flex items-center gap-4 hover:bg-[#111] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center flex-shrink-0">
                  <Globe size={18} className="text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{domain.full_domain ?? (domain.name + domain.extension)}</span>
                    {domain.is_locked && <Lock size={12} className="text-gray-600" />}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">Expira: {expires} · {domain.registrar}</div>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  {domain.auto_renew && (
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <RefreshCw size={11} /> Auto-renovar
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-blue-400">
                    <Shield size={11} /> SSL
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.class}`}>{cfg.label}</span>
              </div>
            )
          }) : (
            <div className="p-12 text-center">
              <Globe size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum domínio registado</p>
              <button className="mt-4 btn-primary text-xs px-4 py-2 rounded-xl font-bold">Registar primeiro domínio</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
