import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { BookOpen, Search, Globe, Shield, Database, Zap, RefreshCw, Layers, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Base de Conhecimento Domínios | ViralizaHost',
  description: 'Guias, tutoriais e respostas para todas as suas dúvidas sobre domínios.',
}

const features = [
  { icon: BookOpen, title: 'Guias Detalhados', desc: 'Tutoriais passo a passo para todas as operações' },
  { icon: Search, title: 'Pesquisa Avançada', desc: 'Encontre respostas rapidamente na nossa base de conhecimento' },
  { icon: Globe, title: 'Registar Domínios', desc: 'Como registar .com, .ao, .net e outras extensões' },
  { icon: Shield, title: 'Segurança', desc: 'Guias sobre WHOIS, DNSSEC e protecção de domínios' },
  { icon: Database, title: 'Configurar DNS', desc: 'Como configurar registos A, CNAME, MX e mais' },
  { icon: Zap, title: 'Resolução Rápida', desc: 'Artigos para resolver problemas comuns rapidamente' },
  { icon: RefreshCw, title: 'Transferências', desc: 'Como transferir domínios entre registos' },
  { icon: Layers, title: 'Subdomínios', desc: 'Criar e gerir subdomínios ilimitados' },
  { icon: Activity, title: 'Monitorização', desc: 'Como monitorizar a saúde e uptime do seu domínio' },
]

export default function BaseConhecimentoPage() {
  return (
    <PageTemplate
      badge="Conhecimento"
      titleHtml={`Base de Conhecimento <span style="color:#F5B700">Domínios</span>`}
      title="Base de Conhecimento Domínios"
      subtitle="Guias, tutoriais e respostas para todas as suas dúvidas sobre domínios."
      features={features}
      ctaText="Explorar Guias"
      ctaHref="/register"
    />
  )
}
