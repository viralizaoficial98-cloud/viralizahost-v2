'use client'
import { EmailPlansSection } from '@/components/service/EmailPlansSection'

// Planos de e-mail da página inicial: o mesmo componente da página /email-corporativo
// (catálogo → product_prices, períodos de 1 mês a 3 anos, preço por caixa de correio).
export function EmailCorpSection() {
  return (
    <EmailPlansSection id="email-plans" tag="Comunicação Profissional"
      title={<>E-mails Corporativos <span className="gradient-text">Premium</span></>}
      subtitle="E-mail no seu domínio, com preço por caixa de correio." />
  )
}
