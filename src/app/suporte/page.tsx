import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Headphones, MessageCircle, BookOpen, Activity, Globe, Shield, Zap, RefreshCw, Users } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Central de Suporte — ViralizaHost',
  description: 'Estamos disponíveis 24 horas por dia, 7 dias por semana para ajudar o seu negócio.',
}

export default function SuportePage() {
  const features = [
    { icon: Headphones, title: 'Suporte 24/7', desc: 'Equipa técnica disponível todos os dias, incluindo fins de semana e feriados.' },
    { icon: MessageCircle, title: 'Chat em Tempo Real', desc: 'Converse diretamente com um técnico especialista pelo chat da plataforma.' },
    { icon: BookOpen, title: 'Base de Conhecimento', desc: 'Centenas de tutoriais e guias para resolver questões sem precisar de suporte.' },
    { icon: Activity, title: 'Status em Tempo Real', desc: 'Monitorize a disponibilidade de todos os serviços em tempo real.' },
    { icon: Globe, title: 'Suporte Multicanal', desc: 'Contacte-nos por ticket, chat, e-mail ou telefone conforme a sua preferência.' },
    { icon: Shield, title: 'Equipa Certificada', desc: 'Técnicos com certificações em cPanel, Linux, redes e segurança informática.' },
    { icon: Zap, title: 'Resposta Rápida', desc: 'Tempo médio de primeira resposta inferior a 2 horas em qualquer canal.' },
    { icon: RefreshCw, title: 'Acompanhamento', desc: 'Seguimos cada ticket até à resolução completa e confirmação da sua satisfação.' },
    { icon: Users, title: 'Comunidade', desc: 'Fórum de utilizadores para partilhar experiências e soluções com outros clientes.' },
  ]
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <section className="relative overflow-hidden pt-32 pb-20" style={{ background: 'linear-gradient(160deg,#090909 0%,#111 60%,#0d0d0d 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(245,183,0,0.18) 0%, transparent 70%)' }} />
          <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6" style={{ background: 'rgba(245,183,0,0.12)', border: '1px solid rgba(245,183,0,0.30)', color: '#F5B700' }}>
              SUPORTE 24/7
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
              Central de <span style={{ color: '#F5B700' }}>Suporte</span>
            </h1>
            <p className="text-lg lg:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.60)' }}>
              Estamos disponíveis 24 horas por dia, 7 dias por semana para ajudar o seu negócio.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/suporte/tickets" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200 shadow-[0_8px_30px_rgba(245,183,0,0.35)]" style={{ background: '#F5B700', color: '#090909' }}>
                Abrir Ticket →
              </Link>
              <Link href="/suporte/base-conhecimento" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold transition-all duration-200" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.14)' }}>
                Base de Conhecimento
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
            <Link href="/suporte/tickets" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200" style={{ background: '#F5B700', color: '#090909' }}>
              Abrir Ticket →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
