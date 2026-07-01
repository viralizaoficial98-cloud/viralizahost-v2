'use client'
import { Mail, Globe, ShieldCheck, RefreshCw, Lock, Inbox } from 'lucide-react'

const features = [
  {
    icon: Inbox,
    title: 'Webmail Profissional',
    desc: 'Acesso via browser com interface moderna, segura e rápida. Compatível com todos os dispositivos.',
  },
  {
    icon: Mail,
    title: 'Microsoft 365 Outlook',
    desc: 'Suite completa Microsoft com Outlook, Teams, Word, Excel e OneDrive integrados.',
  },
  {
    icon: Globe,
    title: 'Google Workspace',
    desc: 'Gmail corporativo, Google Drive, Meet e todas as ferramentas Google para a sua equipa.',
  },
  {
    icon: ShieldCheck,
    title: 'Protecção AntiSpam',
    desc: 'Filtragem avançada de spam e malware com IA. Taxa de detecção superior a 99.9%.',
  },
  {
    icon: RefreshCw,
    title: 'Backup Automático',
    desc: 'Cópias de segurança diárias com restauração simples. Nunca perca um e-mail importante.',
  },
  {
    icon: Lock,
    title: 'SPF / DKIM / DMARC',
    desc: 'Autenticação de domínio completa para máxima entregabilidade e protecção da marca.',
  },
]

export function EmailCorpSection() {
  return (
    <section className="bg-white py-20 border-b border-[#F0F0F0]">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">

        {/* Heading */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#F5B700]" />
            <p className="text-[#F5B700] text-xs font-bold tracking-widest uppercase">Comunicação Profissional</p>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#F5B700]" />
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0A0A0A] leading-tight mb-4">
            E-mails Corporativos <span className="text-[#F5B700]">Premium</span>
          </h2>
          <p className="text-[#666] text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Soluções profissionais para Webmail, Microsoft 365 e Google Workspace.<br className="hidden md:block" />
            Segurança, sincronização e alta disponibilidade para a sua empresa.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group relative bg-white border border-[#EBEBEB] rounded-2xl p-7 transition-all duration-300 cursor-default"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.borderColor = '#F5B700'
                el.style.boxShadow = '0 8px 32px rgba(245,183,0,0.14)'
                el.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.borderColor = '#EBEBEB'
                el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'
                el.style.transform = 'translateY(0)'
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-300"
                style={{ background: '#FFF8E1' }}
              >
                <Icon size={22} style={{ color: '#F5B700' }} />
              </div>

              <h3 className="text-[#0A0A0A] font-bold text-lg mb-2 leading-tight">{title}</h3>
              <p className="text-[#777] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#email-plans"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm text-[#0A0A0A] transition-all duration-200"
            style={{ background: '#F5B700', boxShadow: '0 4px 20px rgba(245,183,0,0.30)' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.background = '#0A0A0A'
              el.style.color = '#F5B700'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.background = '#F5B700'
              el.style.color = '#0A0A0A'
            }}
          >
            Ver Planos de E-mail →
          </a>
          <a
            href="/tickets"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-sm text-[#444] border border-[#D0D0D0] hover:border-[#F5B700] hover:text-[#0A0A0A] transition-all duration-200"
          >
            Falar com Especialista
          </a>
        </div>

      </div>
    </section>
  )
}
