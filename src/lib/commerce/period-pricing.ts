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
