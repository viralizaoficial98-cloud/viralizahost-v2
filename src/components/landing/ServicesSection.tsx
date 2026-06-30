import { Globe, Mail, Lock, HardDrive, Cloud, Server, ArrowRight } from 'lucide-react'

const services = [
  {
    icon: Server,
    title: 'Hospedagem Web',
    description: 'Hospedagem compartilhada com LiteSpeed, NVMe SSD e cPanel Premium. Performance garantida para qualquer site.',
    features: ['LiteSpeed Cache', 'NVMe SSD', 'cPanel Premium'],
    accent: '#3B82F6',
    href: '#planos',
  },
  {
    icon: Globe,
    title: 'Domínios',
    description: 'Registe o seu domínio .com, .ao, .com.br e mais de 300 extensões com gestão completa de DNS.',
    features: ['.com, .ao, .com.br', 'DNS Manager', 'WHOIS Privacy'],
    accent: '#10B981',
    href: '#dominios',
  },
  {
    icon: Mail,
    title: 'Emails Corporativos',
    description: 'Crie emails profissionais com o seu domínio. Antispam avançado, webmail moderno e acesso mobile.',
    features: ['Antispam IA', 'Webmail Pro', 'IMAP/POP3/SMTP'],
    accent: '#F5B700',
    href: '#email-plans',
  },
  {
    icon: Lock,
    title: 'Certificados SSL',
    description: 'SSL grátis para todos os domínios com Let\'s Encrypt. Wildcard SSL e SSL premium disponíveis.',
    features: ['SSL Grátis', 'Wildcard SSL', 'Auto-renovação'],
    accent: '#8B5CF6',
    href: '#ssl',
  },
  {
    icon: HardDrive,
    title: 'Backup Automático',
    description: 'Backups diários automáticos com retenção de 30 dias. Restauração com um clique em segundos.',
    features: ['Backup Diário', '30 dias retenção', 'Restauração 1-click'],
    accent: '#EF4444',
    href: '#backup',
  },
  {
    icon: Cloud,
    title: 'Cloud Hosting',
    description: 'Infraestrutura cloud escalável com recursos dedicados. Alta disponibilidade e desempenho superior.',
    features: ['Recursos Dedicados', 'Auto-scaling', 'Alta Disponibilidade'],
    accent: '#06B6D4',
    href: '#cloud',
  },
]

export function ServicesSection() {
  return (
    <section id="servicos" className="py-24 bg-[#F8F8F8] relative overflow-hidden">
      {/* Top border */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />

      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">Nossos Serviços</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Tudo que Precisa em <span className="gradient-text">Um Só Lugar</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto">
            Do domínio ao email, do SSL ao backup — oferecemos uma solução completa para a sua presença digital.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = service.icon
            return (
              <a key={service.title} href={service.href}
                className="group card-light p-8 block hover-lift"
                style={{ '--card-accent': service.accent } as React.CSSProperties}
              >
                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${service.accent}15`, border: `1px solid ${service.accent}25` }}
                >
                  <Icon size={24} style={{ color: service.accent }} />
                </div>

                <h3 className="text-lg font-bold text-[#0A0A0A] mb-3 group-hover:text-[#B88900] transition-colors">
                  {service.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{service.description}</p>

                {/* Feature tags */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {service.features.map(f => (
                    <span key={f}
                      className="text-xs text-gray-600 bg-[#F8F8F8] border border-[#ECECEC] px-3 py-1.5 rounded-lg font-medium">
                      ✓ {f}
                    </span>
                  ))}
                </div>

                {/* Link */}
                <div className="flex items-center gap-2 text-sm font-semibold transition-all"
                  style={{ color: service.accent }}>
                  Saiba mais
                  <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
