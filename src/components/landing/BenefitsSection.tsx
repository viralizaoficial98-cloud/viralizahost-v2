import { Zap, Shield, Activity, Package, LayoutDashboard, Cpu } from 'lucide-react'

const benefits = [
  {
    icon: Activity,
    title: 'Uptime 99.9%',
    description: 'Garantia contratual de disponibilidade. Monitorização em tempo real 24/7 com alertas automáticos e infraestrutura redundante.',
    stat: '99.9%',
    statLabel: 'Disponibilidade',
    accent: '#10B981',
  },
  {
    icon: Shield,
    title: 'Proteção DDoS',
    description: 'Proteção avançada contra ataques DDoS de até 10 Tbps. Firewall de aplicação web (WAF) e filtragem de tráfego malicioso.',
    stat: '10 Tbps',
    statLabel: 'Proteção DDoS',
    accent: '#3B82F6',
  },
  {
    icon: Zap,
    title: 'LiteSpeed Enterprise',
    description: 'Servidor LiteSpeed Enterprise 10x mais rápido que Apache. Cache nativo, HTTP/3, QUIC e otimização automática de imagens.',
    stat: '10x',
    statLabel: 'Mais Rápido',
    accent: '#F5B700',
  },
  {
    icon: Package,
    title: 'Softaculous Premium',
    description: 'Instale WordPress, Joomla, Drupal e mais de 400 aplicações com um clique. Atualizações automáticas e backups integrados.',
    stat: '400+',
    statLabel: 'Aplicações',
    accent: '#8B5CF6',
  },
  {
    icon: LayoutDashboard,
    title: 'cPanel Premium',
    description: 'O painel de controle mais popular do mundo. Gestão completa de domínios, emails, bases de dados e ficheiros na ponta dos dedos.',
    stat: '#1',
    statLabel: 'Painel do Mundo',
    accent: '#EF4444',
  },
  {
    icon: Cpu,
    title: 'NVMe SSD Gen4',
    description: 'Armazenamento NVMe Gen4 de última geração, 7x mais rápido que SSDs SATA convencionais. Leitura de até 7.000 MB/s.',
    stat: '7GB/s',
    statLabel: 'Velocidade I/O',
    accent: '#06B6D4',
  },
]

export function BenefitsSection() {
  return (
    <section id="recursos" className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">Por que nos escolher</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Tecnologia de <span className="gradient-text">Última Geração</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto">
            Combinamos as melhores tecnologias do mercado para garantir máxima performance, segurança e facilidade de uso.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b) => {
            const Icon = b.icon
            return (
              <div key={b.title}
                className="group card-light p-8 hover-lift relative overflow-hidden"
              >
                {/* Yellow accent bar on hover */}
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-300 opacity-0 group-hover:opacity-100"
                  style={{ background: b.accent }} />

                {/* Icon & stat row */}
                <div className="flex items-start justify-between mb-6">
                  <div className="w-13 h-13 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{ background: `${b.accent}12`, border: `1px solid ${b.accent}20` }}>
                    <Icon size={24} style={{ color: b.accent }} />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black" style={{ color: b.accent }}>{b.stat}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{b.statLabel}</div>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[#0A0A0A] mb-3 group-hover:text-[#B88900] transition-colors">{b.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{b.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
