import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Database, Globe, Shield, Zap, Lock, RefreshCw, Gauge, Layers, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Gestão de Nameservers | ViralizaHost',
  description: 'Controle total dos nameservers para gerir o seu domínio como um profissional.',
}

const features = [
  { icon: Database, title: 'Nameservers Personalizados', desc: 'Defina os seus próprios nameservers facilmente' },
  { icon: Globe, title: 'Rede Distribuída', desc: 'Nameservers em múltiplas localizações globais' },
  { icon: Shield, title: 'Alta Disponibilidade', desc: '99.9% de uptime garantido nos nameservers' },
  { icon: Zap, title: 'Propagação Rápida', desc: 'Alterações propagadas em minutos' },
  { icon: Lock, title: 'DNSSEC Suportado', desc: 'Assinatura digital para máxima segurança' },
  { icon: RefreshCw, title: 'Actualização Simples', desc: 'Mude nameservers em segundos pelo painel' },
  { icon: Gauge, title: 'Performance Optimizada', desc: 'Servidores de resposta ultra-rápida' },
  { icon: Layers, title: 'Multi-domínio', desc: 'Gerencie nameservers de múltiplos domínios' },
  { icon: Activity, title: 'Monitorização Activa', desc: 'Alertas em tempo real sobre o estado dos nameservers' },
]

export default function NameserversPage() {
  return (
    <PageTemplate
      badge="Nameservers"
      titleHtml={`Gestão de <span style="color:#F5B700">Nameservers</span>`}
      title="Gestão de Nameservers"
      subtitle="Controle total dos nameservers para gerir o seu domínio como um profissional."
      features={features}
      ctaText="Gerir Nameservers"
      ctaHref="/register"
    />
  )
}
