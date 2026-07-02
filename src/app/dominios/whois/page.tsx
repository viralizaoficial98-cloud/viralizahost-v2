import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Search, Shield, Lock, Globe, Database, RefreshCw, Layers, Zap, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Consulta e Proteção WHOIS | ViralizaHost',
  description: 'Consulte dados de qualquer domínio e proteja a sua privacidade online.',
}

const features = [
  { icon: Search, title: 'Consulta WHOIS', desc: 'Pesquise informações de qualquer domínio em segundos' },
  { icon: Shield, title: 'Protecção de Privacidade', desc: 'Os seus dados pessoais ficam ocultos do público' },
  { icon: Lock, title: 'Dados Protegidos', desc: 'Nome, endereço e contactos não expostos' },
  { icon: Globe, title: 'Qualquer Domínio', desc: 'Consulte .com, .ao, .net, .org e centenas de extensões' },
  { icon: Database, title: 'Histórico de Registos', desc: 'Aceda ao histórico de propriedade dos domínios' },
  { icon: RefreshCw, title: 'Dados Actualizados', desc: 'Informações em tempo real directamente dos registos' },
  { icon: Layers, title: 'WHOIS em Lote', desc: 'Consulte múltiplos domínios de uma só vez' },
  { icon: Zap, title: 'Resposta Imediata', desc: 'Resultados disponíveis instantaneamente' },
  { icon: AlertCircle, title: 'Alertas de Expiração', desc: 'Monitorize quando domínios de interesse expiram' },
]

export default function WhoisPage() {
  return (
    <PageTemplate
      badge="WHOIS"
      titleHtml={`Consulta e Proteção <span style="color:#F5B700">WHOIS</span>`}
      title="Consulta e Proteção WHOIS"
      subtitle="Consulte dados de qualquer domínio e proteja a sua privacidade online."
      features={features}
      ctaText="Consultar WHOIS"
      ctaHref="/register"
    />
  )
}
