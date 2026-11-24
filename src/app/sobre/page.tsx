import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { TeamSection } from '@/components/landing/TeamSection'
import { GlobalPresenceSection } from '@/components/landing/GlobalPresenceSection'
import { Headphones, Mail, MapPin, Phone, Server, ShieldCheck, Wallet } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sobre nós',
  description: 'A ViralizaHost: alojamento, domínios, e-mail corporativo e servidores com preços em kwanzas e suporte em português.',
}

// Empresa → Sobre nós. Equipa e presença global reutilizam as secções do site (geridas no painel); contactos reais
// do projecto (os mesmos do rodapé).
const values = [
  { icon: Server, title: 'Infraestrutura de qualidade', desc: 'LiteSpeed, discos NVMe e cPanel nos planos de alojamento; VPS e servidores dedicados para projectos exigentes.' },
  { icon: Wallet, title: 'Preços em kwanzas', desc: 'Preços claros em Kz, pagamento por transferência bancária e factura em cada encomenda.' },
  { icon: Headphones, title: 'Suporte em português', desc: 'Equipa de suporte disponível por ticket, e-mail e telefone.' },
  { icon: ShieldCheck, title: 'Segurança por defeito', desc: 'SSL gratuito, cópias de segurança e protecção incluídos nos serviços de alojamento.' },
]
const contacts = [
  { icon: Mail, label: 'E-mail', value: 'suporte@viralizahost.com', href: 'mailto:suporte@viralizahost.com' },
  { icon: Phone, label: 'Telefone', value: '+244 951 008 653', href: 'tel:+244951008653' },
  { icon: MapPin, label: 'Escritórios', value: 'Luanda, Angola · São Paulo, Brasil', href: null },
]

export default function SobrePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white" data-testid="page-sobre">
        <section className="relative overflow-hidden pt-32 pb-20" style={{ background: 'linear-gradient(160deg,#090909 0%,#111 60%,#0d0d0d 100%)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(245,183,0,0.18) 0%, transparent 70%)' }} />
          <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center max-w-4xl">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6" style={{ background: 'rgba(245,183,0,0.12)', border: '1px solid rgba(245,183,0,0.30)', color: '#F5B700' }}>EMPRESA</span>
            <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">Sobre a <span style={{ color: '#F5B700' }}>ViralizaHost</span></h1>
            <p className="text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Alojamento de sites, domínios, e-mail corporativo e servidores para empresas e profissionais — com preços em kwanzas e suporte em português.
            </p>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-6xl grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map(({ icon: I, title, desc }) => (
              <div key={title} className="rounded-2xl border border-[#EBEBEB] p-6">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(245,183,0,0.10)' }}><I size={20} className="text-[#D9A300]" aria-hidden /></span>
                <h2 className="font-bold text-[#0A0A0A]">{title}</h2>
                <p className="text-sm text-[#666] mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <GlobalPresenceSection />
        <TeamSection />

        <section className="py-16 bg-[#F8F8F8]" aria-labelledby="contactos-title" data-testid="sobre-contactos">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 id="contactos-title" className="text-2xl md:text-3xl font-black text-[#0A0A0A]">Fale connosco</h2>
            <div className="grid sm:grid-cols-3 gap-3 mt-8 text-left">
              {contacts.map(({ icon: I, label, value, href }) => (
                <div key={label} className="rounded-2xl bg-white border border-[#E8E8E8] p-5">
                  <I size={18} className="text-[#D9A300]" aria-hidden />
                  <p className="text-xs text-[#888] mt-2">{label}</p>
                  {href ? <a href={href} className="font-bold text-sm text-[#0A0A0A] hover:underline break-words">{value}</a> : <p className="font-bold text-sm text-[#0A0A0A]">{value}</p>}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link href="/suporte/contactar" className="px-6 py-3 rounded-xl text-sm font-black bg-[#F5B700] text-[#0A0A0A]">Contactar a equipa</Link>
              <Link href="/parcerias" className="px-6 py-3 rounded-xl text-sm font-bold border border-[#E0E0E0] text-[#0A0A0A] bg-white">Programa de parceria</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
