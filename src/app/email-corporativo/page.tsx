import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { EmailPlansSection } from '@/components/service/EmailPlansSection'
import { Mail, Shield, Lock, Calendar, Smartphone, Globe, Zap, Archive, Activity } from 'lucide-react'
import { PageLinksSection } from '@/components/site/PageLinksSection'
import { BannerHero } from '@/components/service/BannerHero'
import { pagesInSection } from '@/lib/site/pages'

// Página de E-mail Corporativo (link directo no menu): planos, períodos e compra (EmailPlansSection) e, em secções,
// as opções do antigo submenu (planos e Microsoft 365, segurança, produtividade).
const cards = (section: string, cta: string) => pagesInSection(section).map(p => ({ href: p.path, title: p.title, desc: p.desc, icon: p.icon, cta }))

export const metadata: Metadata = {
  title: 'E-mail Corporativo Profissional',
  description: 'Comunicação empresarial segura com domínio personalizado e alta disponibilidade.',
}

export const dynamic = 'force-dynamic'

export default function EmailCorporativoPage() {
  const features = [
    { icon: Mail, title: 'Domínio Personalizado', desc: 'Utilize o seu domínio próprio: nome@suaempresa.com para uma imagem profissional.' },
    { icon: Shield, title: 'AntiSpam Avançado', desc: 'Filtros inteligentes que bloqueiam spam e phishing antes de chegarem à sua caixa.' },
    { icon: Lock, title: 'SPF / DKIM / DMARC', desc: 'Autenticação profissional para melhorar a entregabilidade e evitar falsificações.' },
    { icon: Calendar, title: 'Calendário Partilhado', desc: 'Agenda sincronizada entre todos os colaboradores para melhor organização.' },
    { icon: Smartphone, title: 'Sync Mobile', desc: 'Aceda ao seu e-mail em iOS e Android com IMAP e ActiveSync nativo.' },
    { icon: Globe, title: 'Webmail Moderno', desc: 'Interface web intuitiva acessível em qualquer browser, em qualquer lugar.' },
    { icon: Zap, title: 'Alta Performance', desc: 'Infraestrutura otimizada para entrega rápida e receção instantânea de e-mails.' },
    { icon: Archive, title: 'Backup Automático', desc: 'Cópias de segurança diárias dos seus e-mails para nunca perder dados importantes.' },
    { icon: Activity, title: 'Uptime 99.9%', desc: 'Infraestrutura redundante com SLA garantido para máxima disponibilidade.' },
  ]

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* Hero: Painel → Site → Banners de páginas, slug «email-corporativo» (único H1) */}
        <BannerHero slug="email-corporativo" testId="email-hero" defaults={{
          breadcrumb: 'E-mail Corporativo', tag: 'E-mail Corporativo', title: 'E-mail Corporativo Profissional',
          subtitle: 'Comunicação empresarial segura com domínio personalizado e alta disponibilidade.',
          cta: 'Ver Planos de E-mail', ctaHref: '#planos', ctaSecondary: 'Falar com Suporte', ctaSecondaryHref: '/suporte/tickets',
          bgImage: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=1920&q=80&auto=format&fit=crop', bgColor: '#080d1a',
          highlights: [], guarantee: false,
        }} />
        {/* Atalhos para as secções da página (logo abaixo da hero) */}
        <nav className="bg-[#0A0A0A] border-t border-white/10 px-4 py-4" aria-label="Secções de e-mail" data-testid="email-actions">
          <div className="container mx-auto flex flex-wrap justify-center gap-2">
            {[['#planos', 'Planos e preços'], ['#planos-detalhe', 'Microsoft 365'], ['#seguranca', 'Segurança'], ['#produtividade', 'Produtividade']].map(([h, l]) => (
              <Link key={h} href={h} className="px-4 py-2 rounded-xl text-sm font-bold border border-white/15 text-white hover:border-[#F5B700] hover:text-[#F5B700]">{l}</Link>
            ))}
          </div>
        </nav>

        <EmailPlansSection
          title="Planos de e-mail corporativo"
          subtitle="Preço por caixa de correio. Escolha o plano, depois o domínio, o número de caixas e a duração." />

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

        <PageLinksSection id="planos-detalhe" tag="Planos" title="Detalhe dos planos e Microsoft 365" subtitle="Compare cada plano em detalhe ou escolha o Microsoft 365 com Outlook, Teams e OneDrive." items={cards('email-planos', 'Ver detalhes')} />
        <PageLinksSection id="seguranca" tag="Segurança" title="Segurança e entregabilidade" items={cards('email-seguranca', 'Saber mais')} dark />
        <PageLinksSection id="produtividade" tag="Produtividade" title="Produtividade e migração" items={cards('email-produtividade', 'Saber mais')} />

        <section className="py-20" style={{ background: 'linear-gradient(160deg,#090909,#111)' }}>
          <div className="container mx-auto px-4 lg:px-8 text-center max-w-2xl">
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">
              Pronto para <span style={{ color: '#F5B700' }}>começar</span>?
            </h2>
            <p className="text-base mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Junte-se a milhares de empresas que confiam na ViralizaHost.
            </p>
            <Link href="#planos" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all duration-200" style={{ background: '#F5B700', color: '#090909' }}>
              Ver Planos de E-mail →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
