import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FloatingChat } from '@/components/layout/FloatingChat'
import { HeroSection } from '@/components/landing/HeroSection'
import { DomainSearchBar } from '@/components/landing/DomainSearchBar'
import { EmailCorpSection } from '@/components/landing/EmailCorpSection'
import { StatsSection } from '@/components/landing/StatsSection'
import { ServicesGridSection } from '@/components/landing/ServicesGridSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { GlobalPresenceSection } from '@/components/landing/GlobalPresenceSection'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { FAQSection } from '@/components/landing/FAQSection'
import { CTASection } from '@/components/landing/CTASection'

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        {/* 1 — Hero Banner */}
        <HeroSection />
        {/* 2 — Pesquisa de Domínios (wave LED + cards premium) */}
        <DomainSearchBar />
        {/* 3 — E-mails Corporativos Premium */}
        <EmailCorpSection />
        {/* 4 — Barra Preta de Métricas */}
        <StatsSection />
        {/* 5 — O que oferecemos */}
        <ServicesGridSection />
        {/* 6 — Planos de Hospedagem */}
        <PricingSection />
        {/* 7 — Presença Global */}
        <GlobalPresenceSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
      <FloatingChat />
    </>
  )
}
