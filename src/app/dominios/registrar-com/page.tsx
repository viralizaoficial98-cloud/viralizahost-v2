import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Globe, Shield, Lock, Zap, Database, Search, RefreshCw, Gauge, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Registar Domínio .com | ViralizaHost',
  description: 'O domínio mais reconhecido do mundo para o seu negócio global.',
}

const features = [
  { icon: Globe, title: 'Reconhecimento Global', desc: 'O .com é a extensão mais confiável e reconhecida do mundo' },
  { icon: Shield, title: 'Proteção WHOIS', desc: 'Privacidade total dos seus dados de registo' },
  { icon: Lock, title: 'SSL Gratuito', desc: 'HTTPS activado automaticamente no seu domínio' },
  { icon: Zap, title: 'Registo Imediato', desc: 'Domínio disponível em minutos após a compra' },
  { icon: Database, title: 'DNS Avançado', desc: 'Gestão completa de registos A, CNAME, MX e mais' },
  { icon: Search, title: 'Pesquisa Rápida', desc: 'Encontre o .com ideal para a sua marca' },
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Garanta a continuidade do seu negócio online' },
  { icon: Gauge, title: 'DNS Premium', desc: 'Alta performance e disponibilidade garantida' },
  { icon: Layers, title: 'Subdomínios Ilimitados', desc: 'Organize múltiplos serviços num único domínio' },
]

export default function RegistrarComPage() {
  return (
    <PageTemplate
      badge="Domínio .com"
      titleHtml={`Registar Domínio <span style="color:#F5B700">.com</span>`}
      title="Registar Domínio .com"
      subtitle="O domínio mais reconhecido do mundo para o seu negócio global."
      features={features}
      ctaText="Registar .com"
      ctaHref="/register"
    />
  )
}
