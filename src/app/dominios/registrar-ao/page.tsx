import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { Globe, Shield, Lock, Zap, Database, Search, RefreshCw, Gauge, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Registar Domínio .ao | ViralizaHost',
  description: 'Registe o seu domínio oficial de Angola e fortaleça a presença digital local.',
}

const features = [
  { icon: Globe, title: 'Domínio Oficial de Angola', desc: 'A extensão .ao representa a sua identidade angolana online' },
  { icon: Shield, title: 'Proteção WHOIS', desc: 'Os seus dados pessoais ficam protegidos e privados' },
  { icon: Lock, title: 'SSL Gratuito', desc: 'Certificado HTTPS incluído automaticamente' },
  { icon: Zap, title: 'Activação Rápida', desc: 'Domínio activo em minutos após o registo' },
  { icon: Database, title: 'DNS Gerido', desc: 'Painel completo para gestão de registos DNS' },
  { icon: Search, title: 'Verificação Instantânea', desc: 'Confirme a disponibilidade em segundos' },
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Nunca perca o seu domínio .ao' },
  { icon: Gauge, title: 'Performance Premium', desc: 'Servidores DNS de alta disponibilidade' },
  { icon: Layers, title: 'Subdomínios Incluídos', desc: 'Crie subdomínios ilimitados sem custo adicional' },
]

export default function RegistrarAoPage() {
  return (
    <PageTemplate
      badge="Domínio .ao"
      titleHtml={`Registar Domínio <span style="color:#F5B700">.ao</span>`}
      title="Registar Domínio .ao"
      subtitle="Registe o seu domínio oficial de Angola e fortaleça a presença digital local."
      features={features}
      ctaText="Registar .ao"
      ctaHref="/register"
    />
  )
}
