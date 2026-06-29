import { Zap, Shield, Activity, Package, LayoutDashboard, Cpu } from 'lucide-react'

const benefits = [
  {
    icon: Activity,
    title: 'Uptime 99.9%',
    description: 'Garantia contratual de disponibilidade. Monitorização em tempo real 24/7 com alertas automáticos e infraestrutura redundante.',
    stat: '99.9%',
    statLabel: 'Disponibilidade',
    color: 'indigo',
  },
  {
    icon: Shield,
    title: 'Proteção DDoS',
    description: 'Proteção avançada contra ataques DDoS de até 10 Tbps. Firewall de aplicação web (WAF) e filtragem de tráfego malicioso.',
    stat: '10 Tbps',
    statLabel: 'Proteção DDoS',
    color: 'green',
  },
  {
    icon: Zap,
    title: 'LiteSpeed Enterprise',
    description: 'Servidor LiteSpeed Enterprise 10x mais rápido que Apache. Cache nativo, HTTP/3, QUIC e otimização automática de imagens.',
    stat: '10x',
    statLabel: 'Mais Rápido',
    color: 'yellow',
  },
  {
    icon: Package,
    title: 'Softaculous Premium',
    description: 'Instale WordPress, Joomla, Drupal e mais de 400 aplicações com um clique. Atualizações automáticas e backups integrados.',
    stat: '400+',
    statLabel: 'Aplicações',
    color: 'purple',
  },
  {
    icon: LayoutDashboard,
    title: 'cPanel Premium',
    description: 'O painel de controle mais popular do mundo. Gestão completa de domínios, emails, bases de dados e ficheiros na ponta dos dedos.',
    stat: '#1',
    statLabel: 'Painel do Mundo',
    color: 'orange',
  },
  {
    icon: Cpu,
    title: 'NVMe SSD Gen4',
    description: 'Armazenamento NVMe Gen4 de última geração, 7x mais rápido que SSDs SATA convencionais. Leitura de até 7.000 MB/s.',
    stat: '7GB/s',
    statLabel: 'Velocidade I/O',
    color: 'pink',
  },
]

const colorMap: Record<string, { bg: string; text: string; border: string; glow: string; stat: string }> = {
  indigo: { bg: 'bg-indigo-950/50', text: 'text-indigo-400', border: 'border-indigo-800/50', glow: 'group-hover:shadow-indigo-500/20', stat: 'text-indigo-300' },
  green:  { bg: 'bg-green-950/50',  text: 'text-green-400',  border: 'border-green-800/50',  glow: 'group-hover:shadow-green-500/20',  stat: 'text-green-300' },
  yellow: { bg: 'bg-yellow-950/50', text: 'text-yellow-400', border: 'border-yellow-800/50', glow: 'group-hover:shadow-yellow-500/20', stat: 'text-yellow-300' },
  purple: { bg: 'bg-purple-950/50', text: 'text-purple-400', border: 'border-purple-800/50', glow: 'group-hover:shadow-purple-500/20', stat: 'text-purple-300' },
  orange: { bg: 'bg-orange-950/50', text: 'text-orange-400', border: 'border-orange-800/50', glow: 'group-hover:shadow-orange-500/20', stat: 'text-orange-300' },
  pink:   { bg: 'bg-pink-950/50',   text: 'text-pink-400',   border: 'border-pink-800/50',   glow: 'group-hover:shadow-pink-500/20',   stat: 'text-pink-300' },
}

export function BenefitsSection() {
  return (
    <section id="recursos" className="py-24 bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-20" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16">
          <span className="inline-block text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4 bg-indigo-950 px-4 py-2 rounded-full border border-indigo-800">
            Por que nos escolher
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-6">
            Tecnologia de <span className="gradient-text">Última Geração</span>
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            Combinamos as melhores tecnologias do mercado para garantir máxima performance, segurança e facilidade de uso.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b) => {
            const Icon = b.icon
            const c = colorMap[b.color]
            return (
              <div key={b.title}
                className={`group relative ${c.bg} border ${c.border} rounded-3xl p-8 card-hover hover:shadow-2xl ${c.glow} transition-all duration-300`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl ${c.bg} border ${c.border} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon size={26} className={c.text} />
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black ${c.stat}`}>{b.stat}</div>
                    <div className="text-slate-600 text-xs">{b.statLabel}</div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-3">{b.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{b.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
