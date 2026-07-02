import type { Metadata } from 'next'
import { PageTemplate } from '@/components/shared/PageTemplate'
import { MoveRight, Shield, RefreshCw, Clock, Globe, Zap, Lock, Database, Headphones } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Transferir Domínio | ViralizaHost',
  description: 'Transfira o seu domínio para a ViralizaHost com segurança e sem perda de dados.',
}

const features = [
  { icon: MoveRight, title: 'Transferência Simples', desc: 'Processo guiado passo a passo sem complicações' },
  { icon: Shield, title: 'Transferência Segura', desc: 'Protocolo de segurança em todas as etapas' },
  { icon: RefreshCw, title: 'Renovação Incluída', desc: 'A transferência inclui 1 ano extra de registo' },
  { icon: Clock, title: 'Sem Interrupções', desc: 'O seu site permanece online durante todo o processo' },
  { icon: Globe, title: 'Todas as Extensões', desc: 'Transferimos .com, .ao, .net, .org e muito mais' },
  { icon: Zap, title: 'Processo Rápido', desc: 'Conclusão em 5 a 7 dias úteis' },
  { icon: Lock, title: 'SSL Mantido', desc: 'Certificados de segurança preservados na transferência' },
  { icon: Database, title: 'DNS Preservado', desc: 'Todos os registos DNS migrados automaticamente' },
  { icon: Headphones, title: 'Suporte Dedicado', desc: 'Equipa especializada para acompanhar a transferência' },
]

export default function TransferirDominioPage() {
  return (
    <PageTemplate
      badge="Transferência"
      titleHtml={`Transferir <span style="color:#F5B700">Domínio</span>`}
      title="Transferir Domínio"
      subtitle="Transfira o seu domínio para a ViralizaHost com segurança e sem perda de dados."
      features={features}
      ctaText="Iniciar Transferência"
      ctaHref="/register"
    />
  )
}
