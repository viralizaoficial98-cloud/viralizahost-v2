import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Shield, Lock, Globe, Zap, RefreshCw, Database, Gauge, Mail, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Perguntas Frequentes | ViralizaHost',
  description: 'As respostas para as dúvidas mais comuns sobre os nossos serviços.',
}

const features = [
  { icon: Shield, title: 'Hospedagem', desc: 'Perguntas sobre cPanel, WordPress e planos de hosting.' },
  { icon: Mail, title: 'E-mail', desc: 'Dúvidas sobre configuração e planos de e-mail corporativo.' },
  { icon: Globe, title: 'Domínios', desc: 'Tudo sobre registo, transferência e gestão de domínios.' },
  { icon: Zap, title: 'Pagamentos', desc: 'Métodos de pagamento, faturas e reembolsos.' },
  { icon: RefreshCw, title: 'Migração', desc: 'Como migrar o seu site ou e-mail para a ViralizaHost.' },
  { icon: Lock, title: 'Segurança', desc: 'SSL, firewalls e protecção do seu site.' },
  { icon: Database, title: 'Servidores VPS', desc: 'Perguntas sobre configuração e gestão de VPS.' },
  { icon: Gauge, title: 'Performance', desc: 'Optimização de velocidade e uptime do seu site.' },
  { icon: Activity, title: 'Cancelamentos', desc: 'Políticas de cancelamento e garantia de 30 dias.' },
]

export default function Page() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <section className="relative overflow-hidden pt-32 pb-20" style={{ background: 'linear-gradient(160deg,#090909 0%,#111 60%,#0d0d0d 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(245,183,0,0.18) 0%, transparent 70%)' }} />
          <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6" style={{ background: 'rgba(245,183,0,0.12)', border: '1px solid rgba(245,183,0,0.30)', color: '#F5B700' }}>
              FAQ
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
              Perguntas <span style={{ color: '#F5B700' }}>Frequentes</span>
            </h1>
            <p className="text-lg lg:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.60)' }}>
              As respostas para as dúvidas mais comuns sobre os nossos serviços.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/suporte/base-conhecimento" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200 shadow-[0_8px_30px_rgba(245,183,0,0.35)]" style={{ background: '#F5B700', color: '#090909' }}>
                Ver Base de Conhecimento →
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
            <Link href="/suporte/base-conhecimento" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200" style={{ background: '#F5B700', color: '#090909' }}>
              Ver Base de Conhecimento →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
