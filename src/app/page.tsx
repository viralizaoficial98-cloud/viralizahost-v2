import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/landing/HeroSection'
import { StatsSection } from '@/components/landing/StatsSection'
import { ServicesSection } from '@/components/landing/ServicesSection'
import { BenefitsSection } from '@/components/landing/BenefitsSection'
import { PricingSection } from '@/components/landing/PricingSection'
import { EmailPricingSection } from '@/components/landing/EmailPricingSection'
import { TestimonialsSection } from '@/components/landing/TestimonialsSection'
import { FAQSection } from '@/components/landing/FAQSection'
import { CTASection } from '@/components/landing/CTASection'

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <StatsSection />
        <ServicesSection />
        <BenefitsSection />
        <PricingSection />
        <EmailPricingSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
