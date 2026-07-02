import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Globe, Shield, Lock, Zap, Database, Search, RefreshCw, Gauge, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Registar Domínio .com.br | ViralizaHost',
  description: 'O domínio oficial do Brasil para empresas e profissionais brasileiros.',
}

const features = [
  { icon: Globe, title: 'Identidade Brasileira', desc: 'O .com.br transmite confiança ao público brasileiro' },
  { icon: Shield, title: 'Proteção WHOIS', desc: 'Dados de registo protegidos e privados' },
  { icon: Lock, title: 'SSL Incluído', desc: 'Certificado HTTPS gratuito e automático' },
  { icon: Zap, title: 'Activação Rápida', desc: 'Domínio activo logo após a confirmação do registo' },
  { icon: Database, title: 'Gestão DNS', desc: 'Painel intuitivo para todos os registos DNS' },
  { icon: Search, title: 'Verificação Instantânea', desc: 'Saiba já se o seu .com.br está disponível' },
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Sem risco de perder o seu domínio brasileiro' },
  { icon: Gauge, title: 'Infraestrutura Premium', desc: 'Servidores de alta performance e disponibilidade' },
  { icon: Layers, title: 'Subdomínios Livres', desc: 'Crie quantos subdomínios precisar' },
]

export default function RegistrarComBrPage() {
  return (
    <PageTemplate
      badge="Domínio .com.br"
      titleHtml={`Registar Domínio <span style="color:#F5B700">.com.br</span>`}
      title="Registar Domínio .com.br"
      subtitle="O domínio oficial do Brasil para empresas e profissionais brasileiros."
      features={features}
      ctaText="Registar .com.br"
      ctaHref="/register"
    />
  )
}
