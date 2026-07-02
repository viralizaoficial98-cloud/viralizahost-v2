import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Search, Globe, Zap, Shield, Lock, Gauge } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Pesquisar Domínio | ViralizaHost',
  description: 'Verifique instantaneamente a disponibilidade do seu domínio e registe agora.',
}

const features = [
  { icon: Search, title: 'Pesquisa em Tempo Real', desc: 'Resultados instantâneos enquanto digita o seu domínio' },
  { icon: Globe, title: 'Múltiplas Extensões', desc: 'Verifique .com, .ao, .net, .org e muito mais' },
  { icon: Zap, title: 'Registo Imediato', desc: 'Registe o domínio disponível em segundos' },
  { icon: Shield, title: 'Protecção Incluída', desc: 'WHOIS protection gratuito em todos os domínios' },
  { icon: Lock, title: 'SSL Automático', desc: 'Certificado HTTPS activado automaticamente' },
  { icon: Gauge, title: 'DNS Premium', desc: 'Propagação ultrarrápida em todo o mundo' },
]

export default function PesquisarDominioPage() {
  return (
    <PageTemplate
      badge="Pesquisar Domínio"
      titleHtml={`Pesquisar <span style="color:#F5B700">Domínio</span>`}
      title="Pesquisar Domínio"
      subtitle="Verifique instantaneamente a disponibilidade do seu domínio e registe agora."
      features={features}
      ctaText="Pesquisar Agora"
      ctaHref="/register"
    />
  )
}
