import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FloatingChat } from '@/components/layout/FloatingChat'
import { HeroSection } from '@/components/landing/HeroSection'
import { DomainSearchBar } from '@/components/landing/DomainSearchBar'
import { ServicesGridSection } from '@/components/landing/ServicesGridSection'
import { StatsSection } from '@/components/landing/StatsSection'
import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { EmailPricingSection } from '@/components/landing/EmailPricingSection'
import { GlobalPresenceSection } from '@/components/landing/GlobalPresenceSection'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { FAQSection } from '@/components/landing/FAQSection'
import { CTASection } from '@/components/landing/CTASection'

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <DomainSearchBar />
        <ServicesGridSection />
        <StatsSection />
        <BenefitsSection />
        <PricingSection />
        <EmailPricingSection />
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
