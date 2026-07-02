import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Headphones, Zap, Shield, Clock, Globe, Database, RefreshCw, Lock, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Suporte para Domínios | ViralizaHost',
  description: 'Equipa técnica especializada em domínios disponível 24/7 para si.',
}

const features = [
  { icon: Headphones, title: 'Suporte 24/7', desc: 'Equipa disponível a qualquer hora, todos os dias' },
  { icon: Zap, title: 'Resposta Rápida', desc: 'Tempo médio de resposta inferior a 1 hora' },
  { icon: Shield, title: 'Especialistas em Domínios', desc: 'Técnicos certificados para resolver qualquer problema' },
  { icon: Clock, title: 'Sem Tempo de Espera', desc: 'Suporte prioritário para questões urgentes' },
  { icon: Globe, title: 'Suporte Multi-canal', desc: 'Chat, email e tickets de suporte disponíveis' },
  { icon: Database, title: 'Apoio Técnico DNS', desc: 'Ajuda especializada na configuração de DNS' },
  { icon: RefreshCw, title: 'Assistência em Transferências', desc: 'Acompanhamento em todo o processo de transferência' },
  { icon: Lock, title: 'Suporte de Segurança', desc: 'Ajuda com SSL, DNSSEC e protecção de domínios' },
  { icon: Activity, title: 'Monitorização Proactiva', desc: 'Identificamos e resolvemos problemas antes que os note' },
]

export default function SuportePage() {
  return (
    <PageTemplate
      badge="Suporte"
      titleHtml={`Suporte para <span style="color:#F5B700">Domínios</span>`}
      title="Suporte para Domínios"
      subtitle="Equipa técnica especializada em domínios disponível 24/7 para si."
      features={features}
      ctaText="Contactar Suporte"
      ctaHref="/suporte/tickets"
    />
  )
}
