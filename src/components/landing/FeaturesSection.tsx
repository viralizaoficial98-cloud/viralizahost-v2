import { Server, Shield, Zap, Globe, Mail, BarChart, Clock, Headphones } from 'lucide-react'

const features = [
  { icon: Zap, title: 'NVMe SSD Ultra Rápido', description: 'Armazenamento NVMe até 10x mais rápido que SSDs convencionais para máxima performance.' },
  { icon: Shield, title: 'Segurança Avançada', description: 'Firewall de aplicação web, proteção DDoS e SSL grátis para todos os sites.' },
  { icon: Server, title: 'cPanel Incluído', description: 'Gerencie seus sites, emails e bases de dados com o painel de controle mais popular do mundo.' },
  { icon: Globe, title: 'CDN Global', description: 'Rede de distribuição de conteúdo para carregar seu site rapidamente em qualquer lugar do mundo.' },
  { icon: Mail, title: 'Email Profissional', description: 'Crie emails profissionais com o seu domínio. Antispam e antivírus incluídos.' },
  { icon: BarChart, title: 'Relatórios Detalhados', description: 'Acompanhe tráfego, uso de recursos e performance do seu site em tempo real.' },
  { icon: Clock, title: 'Backup Automático', description: 'Backups diários automáticos com retenção de 30 dias. Restauração com um clique.' },
  { icon: Headphones, title: 'Suporte 24/7', description: 'Equipa técnica disponível 24 horas por dia, 7 dias por semana via chat e ticket.' },
]

export function FeaturesSection() {
  return (
    <section id="recursos" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Por que escolher a ViralizaHost?</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">Tudo que você precisa para ter uma presença online profissional e de alta performance.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="group p-6 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                <Icon size={24} className="text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
