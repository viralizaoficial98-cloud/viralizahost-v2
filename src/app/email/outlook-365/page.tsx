import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Monitor, Mail, Calendar, Users, Globe, Shield, Smartphone, Zap, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Outlook 365 — ViralizaHost',
  description: 'O cliente de e-mail premium da Microsoft para desktop, disponível com os nossos planos.',
}

export default function Outlook365Page() {
  const features = [
    { icon: Monitor, title: 'Outlook Desktop', desc: 'Cliente de e-mail completo para Windows e macOS com todas as funcionalidades premium.' },
    { icon: Mail, title: 'Gestão de E-mail', desc: 'Caixa de entrada focada, regras automáticas e categorização inteligente de mensagens.' },
    { icon: Calendar, title: 'Calendário Avançado', desc: 'Gestão de reuniões, convites e disponibilidade integrada com a agenda da equipa.' },
    { icon: Users, title: 'Contactos Sincronizados', desc: 'Lista de contactos partilhada e sincronizada em todos os dispositivos.' },
    { icon: Globe, title: 'Outlook na Web', desc: 'Aceda ao Outlook em qualquer browser quando não estiver no seu computador.' },
    { icon: Shield, title: 'Microsoft Defender', desc: 'Proteção integrada contra spam, phishing e anexos maliciosos.' },
    { icon: Smartphone, title: 'App Mobile', desc: 'App Outlook para iOS e Android com experiência nativa e sincronização instantânea.' },
    { icon: Zap, title: 'Integrações', desc: 'Integra com Teams, SharePoint e todo o ecossistema Microsoft 365.' },
    { icon: Lock, title: 'Segurança Enterprise', desc: 'Encriptação de ponta a ponta e conformidade com normas de segurança empresariais.' },
  ]
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <section className="relative overflow-hidden pt-32 pb-20" style={{ background: 'linear-gradient(160deg,#090909 0%,#111 60%,#0d0d0d 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(245,183,0,0.18) 0%, transparent 70%)' }} />
          <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6" style={{ background: 'rgba(245,183,0,0.12)', border: '1px solid rgba(245,183,0,0.30)', color: '#F5B700' }}>
              OUTLOOK 365
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
              Outlook <span style={{ color: '#F5B700' }}>365</span>
            </h1>
            <p className="text-lg lg:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.60)' }}>
              O cliente de e-mail premium da Microsoft para desktop, disponível com os nossos planos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200 shadow-[0_8px_30px_rgba(245,183,0,0.35)]" style={{ background: '#F5B700', color: '#090909' }}>
                Começar Agora →
              </Link>
              <Link href="/suporte/tickets" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold transition-all duration-200" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.14)' }}>
                Falar com Suporte
              </Link>
            </div>
          </div>
        </section>
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="group p-6 rounded-2xl border border-[#EBEBEB] hover:border-[#F5B700]/40 transition-all duration-200 hover:shadow-[0_4px_24px_rgba(245,183,0,0.10)]">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(245,183,0,0.10)' }}>
                    <Icon size={20} style={{ color: '#F5B700' }} />
                  </div>
                  <h3 className="text-[#0A0A0A] font-bold text-base mb-2">{title}</h3>
                  <p className="text-[#666] text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="py-20" style={{ background: 'linear-gradient(160deg,#090909,#111)' }}>
          <div className="container mx-auto px-4 lg:px-8 text-center max-w-2xl">
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">Pronto para <span style={{ color: '#F5B700' }}>começar</span>?</h2>
            <p className="text-base mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>Junte-se a milhares de empresas que confiam na ViralizaHost.</p>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200" style={{ background: '#F5B700', color: '#090909' }}>
              Começar Agora →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
