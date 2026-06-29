import { Globe, Mail, Lock, HardDrive, Cloud, Server } from 'lucide-react'

const services = [
  {
    icon: Server,
    title: 'Hospedagem Web',
    description: 'Hospedagem compartilhada com LiteSpeed, NVMe SSD e cPanel Premium. Performance garantida para qualquer site.',
    features: ['LiteSpeed Cache', 'NVMe SSD', 'cPanel Premium'],
    color: 'from-indigo-500 to-blue-600',
    glow: 'shadow-indigo-500/20',
    href: '#planos',
  },
  {
    icon: Globe,
    title: 'Domínios',
    description: 'Registe o seu domínio .com, .ao, .com.br e mais de 300 extensões com gestão completa de DNS.',
    features: ['.com, .ao, .com.br', 'DNS Manager', 'WHOIS Privacy'],
    color: 'from-cyan-500 to-teal-600',
    glow: 'shadow-cyan-500/20',
    href: '#dominios',
  },
  {
    icon: Mail,
    title: 'Emails Corporativos',
    description: 'Crie emails profissionais com o seu domínio. Antispam avançado, webmail moderno e acesso mobile.',
    features: ['Antispam IA', 'Webmail Pro', 'IMAP/POP3/SMTP'],
    color: 'from-purple-500 to-violet-600',
    glow: 'shadow-purple-500/20',
    href: '#emails',
  },
  {
    icon: Lock,
    title: 'Certificados SSL',
    description: 'SSL grátis para todos os domínios com Let\'s Encrypt. Wildcard SSL e SSL premium disponíveis.',
    features: ['SSL Grátis', 'Wildcard SSL', 'Auto-renovação'],
    color: 'from-green-500 to-emerald-600',
    glow: 'shadow-green-500/20',
    href: '#ssl',
  },
  {
    icon: HardDrive,
    title: 'Backup Automático',
    description: 'Backups diários automáticos com retenção de 30 dias. Restauração com um clique em segundos.',
    features: ['Backup Diário', '30 dias retenção', 'Restauração 1-click'],
    color: 'from-orange-500 to-amber-600',
    glow: 'shadow-orange-500/20',
    href: '#backup',
  },
  {
    icon: Cloud,
    title: 'Cloud Hosting',
    description: 'Infraestrutura cloud escalável com recursos dedicados. Alta disponibilidade e desempenho superior.',
    features: ['Recursos Dedicados', 'Auto-scaling', 'Alta Disponibilidade'],
    color: 'from-pink-500 to-rose-600',
    glow: 'shadow-pink-500/20',
    href: '#cloud',
  },
]

export function ServicesSection() {
  return (
    <section id="servicos" className="py-24 bg-slate-900 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block text-purple-400 text-sm font-semibold tracking-widest uppercase mb-4 bg-purple-950/50 px-4 py-2 rounded-full border border-purple-800/50">
            Nossos Serviços
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-6">
            Tudo que Precisa em <span className="gradient-text">Um Só Lugar</span>
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            Do domínio ao email, do SSL ao backup — oferecemos uma solução completa para a sua presença digital.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = service.icon
            return (
              <a key={service.title} href={service.href}
                className={`group relative bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 card-hover hover:shadow-2xl ${service.glow} overflow-hidden cursor-pointer block`}
              >
                {/* Hover gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500 rounded-3xl`} />

                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={26} className="text-white" />
                </div>

                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-indigo-300 transition-colors">{service.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">{service.description}</p>

                <div className="flex flex-wrap gap-2">
                  {service.features.map(f => (
                    <span key={f} className="text-xs text-slate-400 bg-slate-700/60 border border-slate-600/50 px-3 py-1.5 rounded-lg font-medium">
                      ✓ {f}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-2 text-indigo-400 text-sm font-semibold group-hover:gap-3 transition-all">
                  Saiba mais <span>→</span>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
