// País de um centro de dados → código ISO 3166-1 alfa-2 em minúsculas (ficheiro /flags/<cc>.png), ou null.
// Usa SÓ o código de país que vem nos dados do centro (`location` da API da Hostinger, guardado em `country`), nunca o
// código técnico do centro (`bnk`, `fast`, `mum2`…). Linhas guardadas antes de existir `country` têm o código no fim
// do rótulo («Vilnius, lt» / «Vilnius (LT)»): é lido daí.
const ALIAS: Record<string, string> = { UK: 'GB' }

export function normalizeCountry(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const c = v.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return null
  return (ALIAS[c] ?? c).toLowerCase()
}

export function countryOf(row: { country?: string | null; label?: string | null }): string | null {
  const direct = normalizeCountry(row.country)
  if (direct) return direct
  const m = String(row.label ?? '').match(/(?:,\s*|\(\s*)([A-Za-z]{2})\s*\)?\s*$/)
  return m ? normalizeCountry(m[1]) : null
}
