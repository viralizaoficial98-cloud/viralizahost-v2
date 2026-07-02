import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { MoveRight, Globe, Zap, Shield, Lock, RefreshCw, Gauge, Database, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Redirecionamento de Domínios | ViralizaHost',
  description: 'Redirecione domínios com facilidade para qualquer URL com configuração simples.',
}

const features = [
  { icon: MoveRight, title: 'Redirecionamento Fácil', desc: 'Configure redirecionamentos em segundos pelo painel' },
  { icon: Globe, title: 'Qualquer Destino', desc: 'Redirecione para qualquer URL, subdomínio ou página' },
  { icon: Zap, title: 'Activação Imediata', desc: 'Redirecionamento activo em menos de 1 minuto' },
  { icon: Shield, title: 'Redirecionamento Seguro', desc: 'Suporte a HTTPS em origem e destino' },
  { icon: Lock, title: 'SSL Preservado', desc: 'Segurança mantida durante o redirecionamento' },
  { icon: RefreshCw, title: '301 e 302', desc: 'Escolha entre redirecionamento permanente ou temporário' },
  { icon: Gauge, title: 'Alta Performance', desc: 'Redirecionamentos sem latência adicional' },
  { icon: Database, title: 'Registo de Acessos', desc: 'Veja estatísticas de cliques nos redirecionamentos' },
  { icon: Layers, title: 'Multi-destino', desc: 'Gerencie múltiplos redirecionamentos por domínio' },
]

export default function RedirecionamentoPage() {
  return (
    <PageTemplate
      badge="Redirecionamento"
      titleHtml={`Redirecionamento <span style="color:#F5B700">de Domínios</span>`}
      title="Redirecionamento de Domínios"
      subtitle="Redirecione domínios com facilidade para qualquer URL com configuração simples."
      features={features}
      ctaText="Configurar Redirecionamento"
      ctaHref="/register"
    />
  )
}
