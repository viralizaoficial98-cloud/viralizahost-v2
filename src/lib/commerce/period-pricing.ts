// Preços por período com desconto (E-mail Corporativo). Regra ÚNICA, usada pelo servidor ao gravar o
// catálogo, pelo painel (pré-visualização) e pelos cartões públicos:
//   mensal com desconto (por caixa) = arredondar ao kwanza( base × (100 − desconto) / 100 )
//   total do período (por caixa)    = mensal com desconto × meses
//   total da linha                  = total do período × caixas
// Exemplo: base 790, 70% e 36 meses → 237 Kz/mês por caixa → 8 532 Kz por 36 meses.
// Sem dependências de servidor.

export const EMAIL_PERIODS = [
  { cycle: 'monthly', months: 1, label: '1 mês' },
  { cycle: '1year', months: 12, label: '1 ano' },
  { cycle: '2years', months: 24, label: '2 anos' },
  { cycle: '3years', months: 36, label: '3 anos' },
] as const
export type EmailCycle = (typeof EMAIL_PERIODS)[number]['cycle']
export const MAX_DISCOUNT = 90

/** Mensal com desconto, em kwanzas inteiros (arredondamento ao kwanza mais próximo; 0,5 sobe). */
export function discountedMonthly(base: number, discountPct: number): number {
  const cents = Math.round(Number(base) * 100)
  return Math.round((cents * (100 - Number(discountPct))) / 10000)
}

export function periodTotal(base: number, months: number, discountPct: number): number {
  return discountedMonthly(base, discountPct) * months
}

/** Etiqueta do selector comum: «Poupe X%» se igual em todos os planos, «Até X%» se diferente, nada se 0. */
export function selectorBadge(discounts: number[]): string | null {
  const d = discounts.filter(n => Number.isFinite(n))
  if (!d.length) return null
  const max = Math.max(...d)
  if (max <= 0) return null
  return d.every(x => x === max) ? `Poupe ${max}%` : `Até ${max}%`
}

// ── Hospedagem Premium ──
// Mesmos 4 períodos públicos; regra monetária do projecto (cêntimos, 2 casas) aplicada ao TOTAL:
//   total do período = arredondar ao cêntimo( base × meses × (100 − desconto) / 100 )
//   equivalente mensal = total / meses
// Exemplo: base 4 200, 62% e 36 meses → 4 200 × 36 × 0,38 = Kz 57 456 (Kz 1 596/mês).
export const PLAN_PERIODS = EMAIL_PERIODS

export function exactPeriodTotal(base: number, months: number, discountPct: number): number {
  const cents = Math.round(Number(base) * 100)
  return Math.round((cents * months * (100 - Number(discountPct))) / 100) / 100
}

/** Desconto calculado a partir dos dados guardados: 100 × (1 − total / (base × meses)), arredondado; 0 sem base. */
export function impliedDiscount(price: number, base: number | null | undefined, months: number): number {
  if (base == null || !(Number(base) > 0) || !(months > 0)) return 0
  const d = Math.round(100 * (1 - Number(price) / (Number(base) * months)))
  return Math.max(0, Math.min(MAX_DISCOUNT, d))
}

/** O preço guardado corresponde exactamente à regra com este desconto? (senão é um preço personalizado) */
export function matchesRule(price: number, base: number, months: number, discountPct: number): boolean {
  return Math.round(Number(price) * 100) === Math.round(exactPeriodTotal(base, months, discountPct) * 100)
}
