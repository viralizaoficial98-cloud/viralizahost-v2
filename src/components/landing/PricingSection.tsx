'use client'
import { HostingPlansSection } from '@/components/service/HostingPlansSection'
import { useLocale } from '@/hooks/useLocale'

// Hospedagem Premium na página inicial: o mesmo componente, os mesmos dados (catálogo) e os mesmos cálculos
// da página /hospedagem-de-sites (períodos de 1 mês a 3 anos, desconto e total do período).
export function PricingSection() {
  const { t } = useLocale()
  return (
    <HostingPlansSection id="planos" tag={`${t('plans.ssl')} · ${t('plans.cpanel')} · ${t('plans.backup')}`}
      title={<>{t('hosting.title') !== 'hosting.title' ? t('hosting.title') : 'Hospedagem'} <span className="gradient-text">Premium</span></>}
      subtitle={`${t('plans.ssl')}, ${t('plans.cpanel')}, ${t('plans.backup')}, ${t('plans.support247')}.`} />
  )
}
