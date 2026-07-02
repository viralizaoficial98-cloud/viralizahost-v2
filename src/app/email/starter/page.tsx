import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Mail, Shield, Lock, Globe, Zap, Archive, Smartphone, Gauge, Activity } from 'lucide-react'

export const metadata: Metadata = {
  title: 'E-mail Starter — 5 Contas | ViralizaHost',
  description: 'Plano de e-mail profissional com 5 contas, webmail premium, SSL e suporte 24/7.',
}

const features = [
  { icon: Mail,       title: '5 Contas de E-mail',     desc: 'Cinco endereços profissionais com o seu domínio.' },
  { icon: Globe,      title: 'Webmail Premium',         desc: 'Aceda ao seu e-mail em qualquer browser.' },
  { icon: Shield,     title: 'AntiSpam Incluído',       desc: 'Proteção básica contra spam e phishing.' },
  { icon: Lock,       title: 'SSL/TLS Ativado',         desc: 'Comunicação encriptada em todos os envios.' },
  { icon: Zap,        title: 'Configuração Rápida',     desc: 'Ative o seu e-mail em menos de 5 minutos.' },
  { icon: Smartphone, title: 'Sincronização Mobile',    desc: 'IMAP para iOS e Android.' },
  { icon: Archive,    title: 'Backup Semanal',          desc: 'Cópias de segurança automáticas semanais.' },
  { icon: Gauge,      title: 'Painel de Controlo',      desc: 'Gestão fácil de contas e reencaminhamentos.' },
  { icon: Activity,   title: 'Suporte 24/7',            desc: 'Equipa técnica disponível sempre que precisar.' },
]

export default function EmailStarterPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <section className="relative overflow-hidden pt-32 pb-20" style={{ background: 'linear-gradient(160deg,#090909 0%,#111 60%,#0d0d0d 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(245,183,0,0.18) 0%, transparent 70%)' }} />
          <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6" style={{ background: 'rgba(245,183,0,0.12)', border: '1px solid rgba(245,183,0,0.30)', color: '#F5B700' }}>
              Plano Starter
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
              E-mail Starter <span style={{ color: '#F5B700' }}>— 5 Contas</span>
            </h1>
            <p className="text-lg lg:text-xl leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.60)' }}>
              O plano ideal para pequenas empresas que querem e-mail profissional com domínio personalizado.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register?plan=webmail-start" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200 shadow-[0_8px_30px_rgba(245,183,0,0.35)]" style={{ background: '#F5B700', color: '#090909' }}>
                Contratar Starter →
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
            <p className="text-base mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>Ative o seu e-mail profissional hoje mesmo.</p>
            <Link href="/register?plan=webmail-start" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200" style={{ background: '#F5B700', color: '#090909' }}>
              Contratar Starter →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
