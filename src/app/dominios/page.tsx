import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Globe, Search, Shield, Lock, Zap, RefreshCw, Database, Layers, Gauge } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Domínios — Registe a sua identidade online | ViralizaHost',
  description: 'Pesquise e registe o domínio perfeito para a sua marca com segurança e rapidez.',
}

const features = [
  { icon: Search, title: 'Pesquisa Instantânea', desc: 'Verifique disponibilidade em segundos' },
  { icon: Globe, title: 'Registo .ao', desc: 'Domínio oficial de Angola' },
  { icon: Globe, title: 'Domínios .com', desc: 'O mais popular do mundo' },
  { icon: Shield, title: 'Proteção WHOIS', desc: 'Dados pessoais protegidos' },
  { icon: Lock, title: 'SSL Grátis', desc: 'HTTPS incluído no registo' },
  { icon: Zap, title: 'DNS Ultrarrápido', desc: 'Propagação em minutos' },
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Nunca perca o seu domínio' },
  { icon: Layers, title: 'Subdomínios Ilimitados', desc: 'Organize os seus serviços' },
  { icon: Gauge, title: 'Suporte 24/7', desc: 'Equipa especializada em domínios' },
]

export default function DominiosPage() {
  return (
    <PageTemplate
      badge="Domínios"
      titleHtml={`Domínios — Registe a sua <span style="color:#F5B700">identidade online</span>`}
      title="Domínios — Registe a sua identidade online"
      subtitle="Pesquise e registe o domínio perfeito para a sua marca com segurança e rapidez."
      features={features}
      ctaText="Pesquisar Domínio"
      ctaHref="/dominios/pesquisar"
    />
  )
}
