import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Zap, Globe, Shield, Gauge, Database, RefreshCw, Layers, Lock, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'DNS Premium | ViralizaHost',
  description: 'Propagação ultrarrápida, fiável e segura para todos os seus domínios.',
}

const features = [
  { icon: Zap, title: 'Propagação Ultrarrápida', desc: 'DNS activo em minutos em todo o mundo' },
  { icon: Globe, title: 'Rede Global', desc: 'Servidores distribuídos pelos 5 continentes' },
  { icon: Shield, title: 'DNS Seguro', desc: 'Protecção contra ataques DDoS e DNS spoofing' },
  { icon: Gauge, title: 'Alta Performance', desc: 'Latência mínima para os seus visitantes' },
  { icon: Database, title: 'Registos Completos', desc: 'Suporte para A, AAAA, CNAME, MX, TXT, SRV e mais' },
  { icon: RefreshCw, title: 'TTL Personalizável', desc: 'Controle o tempo de cache dos seus registos' },
  { icon: Layers, title: 'Gestão Multi-domínio', desc: 'Gerencie todos os seus domínios num único painel' },
  { icon: Lock, title: 'DNSSEC', desc: 'Assinatura digital para maior segurança' },
  { icon: Activity, title: 'Monitorização 24/7', desc: 'Alertas imediatos em caso de falha de DNS' },
]

export default function DnsPremiumPage() {
  return (
    <PageTemplate
      badge="DNS Premium"
      titleHtml={`DNS <span style="color:#F5B700">Premium</span>`}
      title="DNS Premium"
      subtitle="Propagação ultrarrápida, fiável e segura para todos os seus domínios."
      features={features}
      ctaText="Activar DNS Premium"
      ctaHref="/register"
    />
  )
}
