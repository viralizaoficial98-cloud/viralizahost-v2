import Link from 'next/link'
import { Monitor, Image, Globe, Mail, Users, Server } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const modules = [
  { href: '/admin/site/banners',       icon: Image,   label: 'Banners / Hero',       desc: 'Slides do carrossel principal',        color: '#F5B700' },
  { href: '/admin/site/domains',        icon: Globe,   label: 'Domínios',             desc: 'Extensões e preços de domínios',       color: '#3B82F6' },
  { href: '/admin/site/email-plans',    icon: Mail,    label: 'Planos de Email',      desc: 'Planos de email corporativo',          color: '#10B981' },
  { href: '/admin/site/team',           icon: Users,   label: 'Equipa',               desc: 'Membros e estrutura organizacional',   color: '#8B5CF6' },
  { href: '/admin/site/hosting-plans',  icon: Server,  label: 'Planos de Hospedagem', desc: 'Planos e preços de hosting',          color: '#EF4444' },
]

async function getCounts() {
  const supabase = await createAdminClient()
  const results = await Promise.allSettled([
    supabase.from('site_banners').select('*', { count: 'exact', head: true }),
    supabase.from('site_domains').select('*', { count: 'exact', head: true }),
    supabase.from('site_email_plans').select('*', { count: 'exact', head: true }),
    supabase.from('site_team').select('*', { count: 'exact', head: true }),
    supabase.from('site_hosting_plans').select('*', { count: 'exact', head: true }),
  ])
  return results.map(r => r.status === 'fulfilled' ? ((r.value as any).count ?? 0) : 0)
}

export default async function SitePage() {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const counts = await getCounts()

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
          <Monitor size={20} style={{ color: '#D9A300' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Gestão do Site</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Gerir conteúdo dinâmico do website público</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((mod, i) => {
          const Icon = mod.icon
          return (
            <Link key={mod.href} href={mod.href}
              className="group p-6 transition-all duration-200"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: 18,
                boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
              }}
              onMouseEnter={undefined}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}30` }}>
                  <Icon size={22} style={{ color: mod.color }} />
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: '#F1F5F9', color: '#64748B' }}>
                  {counts[i]} itens
                </span>
              </div>
              <h2 className="font-black text-base mb-1" style={{ color: '#0B0B0D' }}>{mod.label}</h2>
              <p className="text-sm" style={{ color: '#64748B' }}>{mod.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: mod.color }}>
                Gerir →
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
