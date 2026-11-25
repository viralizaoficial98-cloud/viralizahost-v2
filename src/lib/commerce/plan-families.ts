// Planos editáveis em «Catálogo e Preços» para Revenda de Hospedagem, Criador de Sites e Construtor WordPress.
// Sem dependências de servidor: usado pelo painel, pelas páginas públicas, pela compra e pela cotação.
//   • preço: base mensal × meses × (1 − desconto/100) — a mesma regra da Hospedagem (period-pricing.ts);
//   • períodos de novas contratações POR FAMÍLIA (familyPeriods): Criador de Sites e Construtor WordPress em 1 mês,
//     1, 2 e 3 anos; Revenda em mensal, trimestral, semestral e anual. Os outros ciclos ficam guardados
//     (contratos, facturas e renovações antigas continuam a funcionar), mas deixam de ser vendidos.
import { PLAN_PERIODS } from './period-pricing'

export const PLAN_FAMILIES = {
  reseller: {
    key: 'reseller', category: 'reseller', subcategory: null, label: 'Revenda de Hospedagem', page: '/revenda-de-hospedagem', slugPrefix: 'reseller',
    // Novos planos: os mesmos valores dos planos existentes (a activação de cada produto existente nunca é alterada)
    serviceType: 'reseller', provisioning: 'manual',
  },
  'website-builder': {
    key: 'website-builder', category: 'website-builder', subcategory: null, label: 'Criador de Sites com IA', page: '/criador-de-sites', slugPrefix: 'ia',
    serviceType: 'hosting', provisioning: 'whm',
  },
  'wp-builder': {
    key: 'wp-builder', category: 'wordpress', subcategory: 'builder', label: 'Construtor WordPress', page: '/construtor-wordpress', slugPrefix: 'wp-builder',
    serviceType: 'hosting', provisioning: 'whm',
  },
} as const
export type PlanFamily = keyof typeof PLAN_FAMILIES
export const PLAN_FAMILY_KEYS = Object.keys(PLAN_FAMILIES) as PlanFamily[]
export const isPlanFamily = (v: unknown): v is PlanFamily => typeof v === 'string' && v in PLAN_FAMILIES

/** Família de um produto do catálogo (ou null se não for uma destas três). */
export function familyOf(category: string | null | undefined, subcategory: string | null | undefined): PlanFamily | null {
  for (const f of PLAN_FAMILY_KEYS) {
    const d = PLAN_FAMILIES[f]
    if (d.category === category && (d.subcategory ?? null) === (subcategory ?? null)) return f
  }
  return null
}

/** Períodos de Criador de Sites e Construtor WordPress (e por omissão). */
export const FAMILY_PERIODS = PLAN_PERIODS
/** Revenda de Hospedagem: mensal, trimestral, semestral e anual. */
export const RESELLER_PERIODS = [
  { cycle: 'monthly', months: 1, label: 'Mensal' },
  { cycle: '3months', months: 3, label: 'Trimestral' },
  { cycle: '6months', months: 6, label: 'Semestral' },
  { cycle: '1year', months: 12, label: 'Anual' },
] as const
export type FamilyPeriodDef = { readonly cycle: string; readonly months: number; readonly label: string }
/** Os únicos períodos para novas contratações de cada família. */
export const familyPeriods = (f: PlanFamily | null | undefined): readonly FamilyPeriodDef[] => (f === 'reseller' ? RESELLER_PERIODS : FAMILY_PERIODS)
export const isFamilyCycleForSale = (c: unknown, f: PlanFamily | null = null) => familyPeriods(f).some(p => p.cycle === c)
export const familyPeriodsText = (f: PlanFamily | null | undefined) => familyPeriods(f).map(p => p.label.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' ou $1')
export const familyCycleRetiredMsg = (f: PlanFamily | null | undefined) => `Este período deixou de estar disponível para novas contratações deste plano. Escolha ${familyPeriodsText(f)}.`
export const FAMILY_CYCLE_RETIRED_MSG = familyCycleRetiredMsg(null)
