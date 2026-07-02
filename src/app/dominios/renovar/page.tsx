import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { RefreshCw, Shield, Bell, Zap, Globe, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Renovar Domínio | ViralizaHost',
  description: 'Renove o seu domínio antes do prazo e garanta a continuidade da sua presença online.',
}

const features = [
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Active a renovação automática e esqueça os prazos' },
  { icon: Shield, title: 'Domínio Protegido', desc: 'Evite que o seu domínio expire e seja registado por terceiros' },
  { icon: Bell, title: 'Alertas de Expiração', desc: 'Notificações automáticas antes do vencimento' },
  { icon: Zap, title: 'Renovação Imediata', desc: 'Processo rápido e sem burocracia' },
  { icon: Globe, title: 'Todas as Extensões', desc: 'Renove .com, .ao, .net e outras extensões' },
  { icon: Lock, title: 'SSL Renovado', desc: 'Certificado de segurança actualizado automaticamente' },
]

export default function RenovarDominioPage() {
  return (
    <PageTemplate
      badge="Renovação"
      titleHtml={`Renovar <span style="color:#F5B700">Domínio</span>`}
      title="Renovar Domínio"
      subtitle="Renove o seu domínio antes do prazo e garanta a continuidade da sua presença online."
      features={features}
      ctaText="Renovar Agora"
      ctaHref="/register"
    />
  )
}
