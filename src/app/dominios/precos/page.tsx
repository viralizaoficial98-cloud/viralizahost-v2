import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Globe, Zap, Shield, RefreshCw, Lock, Database, Layers, Gauge, Search } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Preços de Domínios | ViralizaHost',
  description: 'Tabela completa de preços para todos os tipos de domínios disponíveis.',
}

const features = [
  { icon: Globe, title: 'Preços Competitivos', desc: 'Os melhores preços do mercado para todos os TLDs' },
  { icon: Search, title: 'Tabela Completa', desc: 'Preços de registo, renovação e transferência' },
  { icon: Zap, title: 'Sem Taxas Ocultas', desc: 'Preço final transparente sem surpresas' },
  { icon: Shield, title: 'WHOIS Gratuito', desc: 'Protecção de privacidade incluída sem custo extra' },
  { icon: Lock, title: 'SSL Incluído', desc: 'Certificado HTTPS gratuito em todos os planos' },
  { icon: Database, title: 'DNS Premium Grátis', desc: 'Gestão DNS avançada sem custo adicional' },
  { icon: RefreshCw, title: 'Descontos de Renovação', desc: 'Poupe mais ao renovar por múltiplos anos' },
  { icon: Layers, title: 'Pacotes Multi-domínio', desc: 'Tarifas especiais para registar vários domínios' },
  { icon: Gauge, title: 'Pagamento Flexível', desc: 'Pague mensalmente ou anualmente com desconto' },
]

export default function PrecosPage() {
  return (
    <PageTemplate
      badge="Preços"
      titleHtml={`Preços de <span style="color:#F5B700">Domínios</span>`}
      title="Preços de Domínios"
      subtitle="Tabela completa de preços para todos os tipos de domínios disponíveis."
      features={features}
      ctaText="Ver Preços"
      ctaHref="/register"
    />
  )
}
