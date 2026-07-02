import Link from 'next/link'
import { Monitor, Image, Globe, Mail, Users, Server } from 'lucide-react'

const modules = [
  {
    href: '/admin/site/banners',
    icon: Image,
    label: 'Banners / Hero',
    description: 'Gerir slides do carrossel principal',
    color: '#F5B700',
  },
  {
    href: '/admin/site/domains',
    icon: Globe,
    label: 'Domínios',
    description: 'Extensões e preços de domínios',
    color: '#3B82F6',
  },
  {
    href: '/admin/site/email-plans',
    icon: Mail,
    label: 'Planos de Email',
    description: 'Planos de email corporativo',
    color: '#10B981',
  },
  {
    href: '/admin/site/team',
    icon: Users,
    label: 'Equipa',
    description: 'Membros e estrutura organizacional',
    color: '#8B5CF6',
  },
  {
    href: '/admin/site/hosting-plans',
    icon: Server,
    label: 'Planos de Hospedagem',
    description: 'Planos e preços de hosting',
    color: '#EF4444',
  },
]

export default function SitePage() {
  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#F5B700]/10 flex items-center justify-center">
            <Monitor size={20} className="text-[#F5B700]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Gestão do Site</h1>
            <p className="text-gray-500 text-sm">Gerir conteúdo dinâmico do website público</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((mod) => {
          const Icon = mod.icon
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#F5B700]/40 hover:shadow-md transition-all group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}30` }}
              >
                <Icon size={22} style={{ color: mod.color }} />
              </div>
              <h2 className="font-black text-gray-900 text-lg mb-1 group-hover:text-[#F5B700] transition-colors">
                {mod.label}
              </h2>
              <p className="text-gray-500 text-sm">{mod.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
