import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Layers, Globe, Zap, Shield, Lock, Database, RefreshCw, Gauge, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Subdomínios Ilimitados | ViralizaHost',
  description: 'Crie subdomínios ilimitados para organizar os seus serviços e aplicações.',
}

const features = [
  { icon: Layers, title: 'Subdomínios Ilimitados', desc: 'Crie quantos subdomínios precisar sem custo extra' },
  { icon: Globe, title: 'Organização Total', desc: 'Estruture os seus serviços com subdomínios dedicados' },
  { icon: Zap, title: 'Criação Instantânea', desc: 'Subdomínio activo em minutos após configuração' },
  { icon: Shield, title: 'Segurança Individual', desc: 'SSL e protecção disponíveis por subdomínio' },
  { icon: Lock, title: 'HTTPS em Todos', desc: 'Certificados SSL aplicáveis a cada subdomínio' },
  { icon: Database, title: 'DNS Independente', desc: 'Configure registos DNS únicos por subdomínio' },
  { icon: RefreshCw, title: 'Gestão Centralizada', desc: 'Controle todos os subdomínios num só lugar' },
  { icon: Gauge, title: 'Alta Performance', desc: 'Subdomínios com a mesma velocidade do domínio principal' },
  { icon: Activity, title: 'Monitorização', desc: 'Acompanhe o desempenho de cada subdomínio' },
]

export default function SubdominiosPage() {
  return (
    <PageTemplate
      badge="Subdomínios"
      titleHtml={`Subdomínios <span style="color:#F5B700">Ilimitados</span>`}
      title="Subdomínios Ilimitados"
      subtitle="Crie subdomínios ilimitados para organizar os seus serviços e aplicações."
      features={features}
      ctaText="Criar Subdomínio"
      ctaHref="/register"
    />
  )
}
