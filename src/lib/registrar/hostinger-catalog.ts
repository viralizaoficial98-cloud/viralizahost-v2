// Selecção do produto e do preço de registo de domínio no catálogo da Hostinger.
// Sem dependências de servidor: é usada pelo fluxo de compra, pelos testes de regressão
// (scripts/registrar/hostinger-catalog.test.mjs) e pela consulta só de leitura do catálogo.
//
// O filtro do catálogo é por PREFIXO: GET /api/billing/v1/catalog?name=.COM* devolve também
// «.COM.BR Domain», «.COM.ES Domain», «.COMPANY Domain» (respostas reais). Por isso:
//   1. o produto escolhe-se pela extensão EXACTA do nome («.COM Domain» → .com), com comparação
//      normalizada e sem distinguir maiúsculas de minúsculas — nunca por prefixo nem pelo id;
//   2. só depois se escolhe UM preço para o período pedido;
//   3. moeda e valores em unidades menores (cêntimos) são preservados tal como vêm da API.
// Sem produto exacto, sem preço compatível ou com mais de um candidato válido → revisão manual.

export interface CatalogPriceLike { id: string; name?: string; currency: string; price: number; first_period_price?: number | null; period: number; period_unit: string }
export interface CatalogItemLike { id: string; name: string; category?: string; prices?: CatalogPriceLike[] }

/** «COM», «.com», « .Com.BR. » → «.com» / «.com.br» */
export function normalizeExtension(raw: string): string {
  const s = String(raw ?? '').normalize('NFKC').trim().toLowerCase().replace(/^\.+/, '').replace(/\.+$/, '')
  return s ? `.${s}` : ''
}

/** Extensão do produto de registo pelo nome («.COM.BR Domain» → «.com.br»). Outros produtos → null. */
export function productExtension(item: Pick<CatalogItemLike, 'name' | 'category'>): string | null {
  if (item.category && !/domain/i.test(item.category)) return null
  const name = String(item.name ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim()
  // Só «.<extensão> Domain»: exclui transferências, renovações e outros serviços com o mesmo prefixo
  const m = name.match(/^(\.[a-z0-9-]+(?:\.[a-z0-9-]+)*) domain$/i)
  return m ? normalizeExtension(m[1]) : null
}

/** Período de um preço em anos, ou null se não for um número inteiro de anos. */
export function periodYears(p: Pick<CatalogPriceLike, 'period' | 'period_unit'>): number | null {
  const n = Number(p.period)
  if (!Number.isInteger(n) || n <= 0) return null
  const u = String(p.period_unit ?? '').trim().toLowerCase()
  if (/^years?$/.test(u)) return n
  if (/^months?$/.test(u) && n % 12 === 0) return n / 12
  return null
}

export type PriceSelection =
  | { ok: true; item: CatalogItemLike; price: CatalogPriceLike; amountMinor: number; renewalMinor: number; currency: string }
  | { ok: false; reason: 'no_product' | 'ambiguous_product' | 'no_price' | 'ambiguous_price' | 'invalid_price'; issue: string; candidates: string[] }

const describe = (p: CatalogPriceLike) => `${p.id} (${p.period} ${p.period_unit}, ${p.first_period_price ?? p.price} ${p.currency})`

/** Produto exacto da extensão e o seu único preço para `years` anos. */
export function selectDomainPrice(items: CatalogItemLike[], ext: string, years: number): PriceSelection {
  const want = normalizeExtension(ext)
  const label = want.toUpperCase()
  const products = (Array.isArray(items) ? items : []).filter(i => productExtension(i) === want)
  if (!products.length) {
    const others = (items ?? []).map(i => i.name).filter(Boolean)
    return { ok: false, reason: 'no_product', issue: `O catálogo não tem o produto «${label} Domain»${others.length ? ` (devolveu: ${others.slice(0, 6).join(', ')})` : ''}.`, candidates: others }
  }
  if (products.length > 1) {
    return { ok: false, reason: 'ambiguous_product', issue: `Há ${products.length} produtos «${label} Domain» no catálogo: confirmar manualmente.`, candidates: products.map(p => `${p.name} [${p.id}]`) }
  }
  const item = products[0]
  const all = item.prices ?? []
  // Preços distintos para o período pedido (o mesmo id repetido conta uma vez)
  const byId = new Map<string, CatalogPriceLike>()
  for (const p of all) if (periodYears(p) === years) byId.set(String(p.id), p)
  const matches = [...byId.values()]
  if (!matches.length) {
    return { ok: false, reason: 'no_price', issue: `«${item.name}» não tem preço para ${years} ${years === 1 ? 'ano' : 'anos'} (períodos disponíveis: ${all.map(p => `${p.period} ${p.period_unit}`).join(', ') || 'nenhum'}).`, candidates: all.map(describe) }
  }
  if (matches.length > 1) {
    return { ok: false, reason: 'ambiguous_price', issue: `«${item.name}» tem ${matches.length} preços para ${years} ${years === 1 ? 'ano' : 'anos'}: confirmar manualmente.`, candidates: matches.map(describe) }
  }
  const price = matches[0]
  const amountMinor = Number(price.first_period_price ?? price.price)
  const renewalMinor = Number(price.price)
  const currency = String(price.currency ?? '').trim()
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || !Number.isInteger(renewalMinor) || renewalMinor <= 0 || !currency || !price.id) {
    return { ok: false, reason: 'invalid_price', issue: `Preço de «${item.name}» incompleto ou inválido.`, candidates: [describe(price)] }
  }
  return { ok: true, item, price, amountMinor, renewalMinor, currency }
}
