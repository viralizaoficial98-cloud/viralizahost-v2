import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Lock, Shield, Zap, Globe, RefreshCw, Gauge, Database, Layers, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Certificado SSL para Domínios | ViralizaHost',
  description: 'HTTPS gratuito e automático para todos os seus domínios registados na ViralizaHost.',
}

const features = [
  { icon: Lock, title: 'SSL Gratuito', desc: 'Certificado HTTPS incluído sem custo adicional' },
  { icon: Shield, title: 'Segurança Total', desc: 'Encriptação de 256 bits para proteger os seus visitantes' },
  { icon: Zap, title: 'Activação Automática', desc: 'SSL configurado automaticamente após o registo' },
  { icon: Globe, title: 'Reconhecido por Todos', desc: 'Compatível com todos os browsers modernos' },
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Certificado renovado antes de expirar, sempre' },
  { icon: Gauge, title: 'Sem Impacto na Velocidade', desc: 'SSL optimizado para não afetar o desempenho' },
  { icon: Database, title: 'Wildcard SSL', desc: 'Proteja o domínio e todos os subdomínios' },
  { icon: Layers, title: 'Multi-domínio', desc: 'Aplique SSL a múltiplos domínios facilmente' },
  { icon: Activity, title: 'Monitorização Activa', desc: 'Alertas automáticos sobre o estado do certificado' },
]

export default function SslPage() {
  return (
    <PageTemplate
      badge="SSL Grátis"
      titleHtml={`Certificado <span style="color:#F5B700">SSL</span> para Domínios`}
      title="Certificado SSL para Domínios"
      subtitle="HTTPS gratuito e automático para todos os seus domínios registados na ViralizaHost."
      features={features}
      ctaText="Activar SSL Grátis"
      ctaHref="/register"
    />
  )
}
