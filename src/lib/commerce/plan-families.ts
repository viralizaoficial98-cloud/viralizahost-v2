// Planos editáveis em «Catálogo e Preços» para Revenda de Hospedagem, Criador de Sites e Construtor WordPress.
// Sem dependências de servidor: usado pelo painel, pelas páginas públicas, pela compra e pela cotação.
//   • preço: base mensal × meses × (1 − desconto/100) — a mesma regra da Hospedagem (period-pricing.ts);
//   • novas contratações SÓ em 1 mês, 1 ano, 2 anos e 3 anos (FAMILY_PERIODS). Os outros ciclos ficam guardados
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

/** Os únicos períodos para novas contratações destas famílias. */
export const FAMILY_PERIODS = PLAN_PERIODS
export const isFamilyCycleForSale = (c: unknown) => FAMILY_PERIODS.some(p => p.cycle === c)
export const FAMILY_CYCLE_RETIRED_MSG = 'Este período deixou de estar disponível para novas contratações deste plano. Escolha 1 mês, 1 ano, 2 anos ou 3 anos.'
