#!/usr/bin/env node
/**
 * Catálogo ViralizaHost a partir das referências de preço (repetível).
 *
 *   node --env-file=.env.local scripts/commerce/build-catalog.mjs [--apply] [--update-prices] [--refs=FICHEIRO]
 *
 * Sem --apply: só calcula e escreve docs/precos-catalogo.md (nada na base).
 * --apply: cria produtos em falta (novo UUID; slugs e IDs existentes preservados),
 *          define estado comercial/activação e insere preços em falta.
 * --update-prices: também substitui preços já existentes (por omissão, preços editados
 *          no painel não são tocados).
 *
 * Regra: preço ViralizaHost = referência × factor (2), convertido para AKZ com a taxa
 * de referência do BNA e arredondado para cima à centena.
 */
import mysql from 'mysql2/promise'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true] }))
const REFS_FILE = args.refs || join(ROOT, 'database/mariadb/pricing/references-2026-11-20.json')
const R = JSON.parse(await readFile(REFS_FILE, 'utf8'))
const RATE = R.exchange_rate.usd_aoa
const F = R.markup_factor
const ceil100 = v => Math.ceil(v / 100) * 100
const akz = (v, cur) => ceil100((cur === 'USD' ? v * RATE : v) * F)

export const CYCLES = [['monthly', 1], ['3months', 3], ['6months', 6], ['1year', 12], ['2years', 24], ['3years', 36]]

// Produtos que ainda não existem na base (anunciados nas páginas). Família → dados.
const NEW_PRODUCTS = {
  'wp-builder-start': { category: 'wordpress', subcategory: 'builder', name: 'Builder Start' },
  'wp-builder-pro': { category: 'wordpress', subcategory: 'builder', name: 'Builder Pro' },
  'wp-builder-turbo': { category: 'wordpress', subcategory: 'builder', name: 'Builder Turbo' },
  'vps-n8n-start': { category: 'vps', subcategory: 'n8n', name: 'n8n Start' },
  'vps-n8n-pro': { category: 'vps', subcategory: 'n8n', name: 'n8n Pro' },
  'vps-n8n-scale': { category: 'vps', subcategory: 'n8n', name: 'n8n Scale' },
  'vps-openclaw-start': { category: 'vps', subcategory: 'openclaw', name: 'OpenClaw Start' },
  'vps-openclaw-pro': { category: 'vps', subcategory: 'openclaw', name: 'OpenClaw Pro' },
  'vps-openclaw-scale': { category: 'vps', subcategory: 'openclaw', name: 'OpenClaw Scale' },
  'vps-evolution-start': { category: 'vps', subcategory: 'evolution', name: 'Evolution Start' },
  'vps-evolution-pro': { category: 'vps', subcategory: 'evolution', name: 'Evolution Pro' },
  'vps-evolution-scale': { category: 'vps', subcategory: 'evolution', name: 'Evolution Scale' },
  'vps-ai-cloud-start': { category: 'vps', subcategory: 'ai-cloud', name: 'AI Cloud Start' },
  'vps-ai-cloud-pro': { category: 'vps', subcategory: 'ai-cloud', name: 'AI Cloud Pro' },
  'vps-ai-cloud-enterprise': { category: 'vps', subcategory: 'ai-cloud', name: 'AI Cloud Enterprise' },
}

// Tipo de serviço e forma de activação por categoria
const BY_CATEGORY = {
  hosting: { service_type: 'hosting', provisioning: 'whm' },
  wordpress: { service_type: 'hosting', provisioning: 'whm' },
  'website-builder': { service_type: 'hosting', provisioning: 'whm' },
  email: { service_type: 'email', provisioning: 'whm', quantity_unit: 'caixa', max_quantity: 100 },
  vps: { service_type: 'vps', provisioning: 'manual' },
  dedicated: { service_type: 'dedicated', provisioning: 'manual' },
  'dedicated-windows': { service_type: 'dedicated', provisioning: 'manual' },
  reseller: { service_type: 'reseller', provisioning: 'manual' },
  ssl: { service_type: 'other', provisioning: 'manual' },
  backup: { service_type: 'other', provisioning: 'manual' },
  protection: { service_type: 'other', provisioning: 'manual' },
}

// ── Cálculo ──────────────────────────────────────────────────────────────────
const offers = []
for (const ref of R.products) {
  const monthly = akz(ref.renewal_monthly, ref.currency)
  for (const slug of ref.applies_to) {
    offers.push({
      slug, ref, monthly,
      cycles: CYCLES.map(([cycle, months]) => ({ cycle, months, price: monthly * months, renewal: monthly * months })),
    })
  }
}
const onRequest = R.on_request.flatMap(o => o.slugs.map(slug => ({ slug, reason: o.reason })))
const domainRows = []
for (const [scope, block] of Object.entries({ international: R.domains.international, national: R.domains.national })) {
  for (const row of block.rows) {
    for (const op of ['register', 'renew', 'transfer']) {
      domainRows.push({
        ext: row.ext, op, scope, provider: block.provider, url: block.url, currency: block.currency,
        ref: row[op], price: akz(row[op], block.currency), promo: op === 'register' ? row.promo_first_year ?? null : null,
        promoNote: row.promo_note ?? null, verbatim: row.verbatim,
      })
    }
  }
}
const domainOnRequest = R.domains.on_request

// ── Relatório (docs/precos-catalogo.md) ─────────────────────────────────────
const fmt = n => n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ /g, ' ')
const usd = n => (n == null ? '—' : `US$ ${n.toFixed(2)}`)
let md = `# Catálogo e preços ViralizaHost\n\n`
md += `Gerado por \`scripts/commerce/build-catalog.mjs\` a partir de \`${REFS_FILE.replace(ROOT + '/', '')}\`.\n\n`
md += `- **Consulta das fontes:** ${R.consulted_at}\n- **Regra:** preço ViralizaHost = referência × ${F}\n`
md += `- **Câmbio:** 1 USD = ${fmt(RATE)} AKZ — ${R.exchange_rate.source}, ${R.exchange_rate.date} (${R.exchange_rate.api_url})\n`
md += `- **Arredondamento:** ${R.rounding}\n- **Impostos:** ${R.tax_note}\n- **Referência:** ${R.reference_rule}\n\n`
md += `## Serviços recorrentes\n\n| Plano ViralizaHost | Referência (fornecedor, plano) | Promo publicada | Renovação publicada (referência) | Cálculo | Preço/mês | Anual (12 meses) | Renovação anual |\n|---|---|---|---|---|---|---|---|\n`
for (const o of offers) {
  const r = o.ref
  md += `| \`${o.slug}\` | [${r.provider} ${r.plan}](${r.url}) | ${usd(r.promo_monthly)}/mês (pré-pago ${r.promo_term_months} meses: ${usd(r.billed_total_promo)}) | ${usd(r.renewal_monthly)}/mês | ${r.renewal_monthly} × ${F} × ${RATE} = ${fmt(r.renewal_monthly * F * RATE)} → ${fmt(o.monthly)} | **${fmt(o.monthly)} Kz** | ${fmt(o.monthly * 12)} Kz | ${fmt(o.monthly * 12)} Kz |\n`
}
md += `\nTodos os ciclos (mensal, trimestral, 6 meses, 1, 2 e 3 anos) cobram preço/mês × meses; a renovação comunicada é igual ao valor do ciclo.\n\n`
md += `## Sob consulta\n\n| Planos | Motivo |\n|---|---|\n`
for (const o of R.on_request) md += `| ${o.slugs.map(s => `\`${s}\``).join(', ')} | ${o.reason} |\n`
md += `\n## Domínios (1 ano)\n\n| Extensão | Operação | Fonte | Referência | Promo 1.º ano (só registo) | Cálculo | Preço ViralizaHost |\n|---|---|---|---|---|---|---|\n`
const OPN = { register: 'Registo', renew: 'Renovação', transfer: 'Transferência' }
for (const d of domainRows) {
  const refTxt = d.currency === 'USD' ? usd(d.ref) : `${fmt(d.ref)} Kz`
  const calc = d.currency === 'USD' ? `${d.ref} × ${F} × ${RATE} = ${fmt(d.ref * F * RATE)}` : `${fmt(d.ref)} × ${F}`
  md += `| ${d.ext} | ${OPN[d.op]} | [${d.provider}](${d.url}) | ${refTxt} | ${d.promo != null ? `${usd(d.promo)}${d.promoNote ? ` (${d.promoNote})` : ''}` : '—'} | ${calc} | **${fmt(d.price)} Kz** |\n`
}
for (const d of domainOnRequest) md += `| ${d.ext} | — | — | — | — | Sob consulta: ${d.reason} | Sob consulta |\n`
md += `\nNota: a AngoWeb publica a transferência de domínios nacionais a 0 Kz; com a regra ×${F} o valor mantém-se 0 Kz.\n`
await writeFile(join(ROOT, 'docs/precos-catalogo.md'), md)
console.log(`✓ docs/precos-catalogo.md (${offers.length} planos com preço, ${onRequest.length} sob consulta, ${domainRows.length} preços de domínio)`)

if (!args.apply) {
  for (const o of offers) console.log(`  ${o.slug.padEnd(26)} ${String(o.monthly).padStart(7)} Kz/mês`)
  process.exit(0)
}

// ── Aplicação na base ───────────────────────────────────────────────────────
const conn = await mysql.createConnection({
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306) }),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD ?? '', charset: 'utf8mb4_unicode_ci',
})
const q = async (sql, p = []) => (await conn.query(sql, p))[0]
const stats = { produtos_criados: 0, produtos_actualizados: 0, precos_inseridos: 0, precos_actualizados: 0, precos_mantidos: 0, dominios: 0 }
try {
  const [[{ db }]] = await conn.query('SELECT DATABASE() AS db')
  console.log(`Base: ${db}`)
  await conn.beginTransaction()
  const ensureProduct = async (slug) => {
    let [p] = await q('SELECT id, category FROM products WHERE slug = ?', [slug])
    if (!p) {
      const d = NEW_PRODUCTS[slug]
      if (!d) throw new Error(`Produto ${slug} não existe e não tem definição`)
      const id = randomUUID()
      await q('INSERT INTO products (id, slug, category, subcategory, name, active, position, currency) VALUES (?, ?, ?, ?, ?, 1, 0, ?)', [id, slug, d.category, d.subcategory, d.name, 'AOA'])
      stats.produtos_criados++
      p = { id, category: d.category }
    }
    return p
  }
  for (const o of offers) {
    const p = await ensureProduct(o.slug)
    const c = BY_CATEGORY[p.category] ?? { service_type: 'other', provisioning: 'manual' }
    await q(`UPDATE products SET sale_status = 'active', service_type = ?, provisioning = ?, quantity_unit = ?, max_quantity = ?,
             pricing_note = ? WHERE id = ?`,
      [c.service_type, c.provisioning, c.quantity_unit ?? null, c.max_quantity ?? 1,
        `Referência: ${o.ref.provider} ${o.ref.plan} — renovação ${usd(o.ref.renewal_monthly)}/mês × ${F} × ${RATE} (BNA ${R.exchange_rate.date}). Consulta ${R.consulted_at.slice(0, 10)}.`, p.id])
    stats.produtos_actualizados++
    for (const cy of o.cycles) {
      const reference = JSON.stringify({ provider: o.ref.provider, plan: o.ref.plan, url: o.ref.url, consulted_at: R.consulted_at, ref_monthly: o.ref.renewal_monthly, ref_currency: o.ref.currency, promo_monthly: o.ref.promo_monthly, promo_term_months: o.ref.promo_term_months, rate: RATE, rate_date: R.exchange_rate.date, factor: F })
      const [cur] = await q('SELECT id FROM product_prices WHERE product_id = ? AND cycle = ?', [p.id, cy.cycle])
      if (!cur) {
        await q('INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, reference) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
          [randomUUID(), p.id, cy.cycle, cy.months, cy.price, cy.renewal, 'AKZ', reference]); stats.precos_inseridos++
      } else if (args['update-prices']) {
        await q('UPDATE product_prices SET months = ?, price = ?, renewal_price = ?, reference = ?, active = 1 WHERE id = ?', [cy.months, cy.price, cy.renewal, reference, cur.id]); stats.precos_actualizados++
      } else stats.precos_mantidos++
    }
    // colunas de apresentação (valor mensal equivalente por ciclo) — sempre derivadas de product_prices
    {
      const [m] = await q("SELECT price FROM product_prices WHERE product_id = ? AND cycle = 'monthly'", [p.id])
      const pm = id => q(`SELECT ROUND(price / months, 2) AS v FROM product_prices WHERE product_id = ? AND cycle = ?`, [p.id, id]).then(r => r[0]?.v ?? null)
      await q('UPDATE products SET price_monthly = ?, price_6months = ?, price_1year = ?, price_2years = ?, price_3years = ?, currency = ? WHERE id = ?',
        [m?.price ?? null, await pm('6months'), await pm('1year'), await pm('2years'), await pm('3years'), 'AOA', p.id])
    }
  }
  for (const o of onRequest) {
    const [p] = await q('SELECT id, category FROM products WHERE slug = ?', [o.slug])
    if (!p) continue
    const c = BY_CATEGORY[p.category] ?? { service_type: 'other', provisioning: 'manual' }
    await q(`UPDATE products SET sale_status = 'on_request', service_type = ?, provisioning = ?, pricing_note = ? WHERE id = ?`, [c.service_type, c.provisioning, o.reason, p.id])
    await q('UPDATE product_prices SET active = 0 WHERE product_id = ?', [p.id])
    stats.produtos_actualizados++
  }
  // Produtos à venda sem preço no catálogo (legado ou sem referência pública) → rascunho, fora do site
  const unpriced = await q(`SELECT p.id, p.slug FROM products p WHERE p.sale_status = 'active'
    AND NOT EXISTS (SELECT 1 FROM product_prices pp WHERE pp.product_id = p.id AND pp.active = 1)`)
  for (const p of unpriced) {
    await q("UPDATE products SET sale_status = 'draft', pricing_note = COALESCE(pricing_note, 'Sem preço de referência no catálogo (rascunho).') WHERE id = ?", [p.id])
  }
  if (unpriced.length) { stats.rascunhos = unpriced.length; console.warn('! sem preço → rascunho:', unpriced.map(p => p.slug).join(', ')) }
  for (const d of domainRows) {
    const reference = JSON.stringify({ provider: d.provider, url: d.url, consulted_at: R.consulted_at, ref: d.ref, ref_currency: d.currency, promo_first_year: d.promo, rate: d.currency === 'USD' ? RATE : null, factor: F, verbatim: d.verbatim })
    const [cur] = await q('SELECT id FROM domain_prices WHERE extension = ? AND operation = ? AND years = 1', [d.ext, d.op])
    if (!cur) await q("INSERT INTO domain_prices (id, extension, operation, years, price, currency, status, reference) VALUES (?, ?, ?, 1, ?, 'AKZ', 'active', ?)", [randomUUID(), d.ext, d.op, d.price, reference])
    else if (args['update-prices']) await q("UPDATE domain_prices SET price = ?, status = 'active', reference = ? WHERE id = ?", [d.price, reference, cur.id])
    stats.dominios++
  }
  for (const d of domainOnRequest) {
    for (const op of ['register', 'renew', 'transfer']) {
      await q("INSERT INTO domain_prices (id, extension, operation, years, price, currency, status, reference) VALUES (?, ?, ?, 1, NULL, 'AKZ', 'on_request', ?) ON DUPLICATE KEY UPDATE status = IF(price IS NULL, 'on_request', status)",
        [randomUUID(), d.ext, op, JSON.stringify({ reason: d.reason, consulted_at: R.consulted_at })])
    }
  }
  // site_domains (listagem pública): preço anual = registo de 1 ano
  let pos = 0
  for (const ext of [...new Set(domainRows.map(d => d.ext))]) {
    pos++
    const [reg] = await q("SELECT price FROM domain_prices WHERE extension = ? AND operation = 'register' AND years = 1", [ext])
    const [s] = await q('SELECT id FROM site_domains WHERE extension = ?', [ext])
    if (!s) await q("INSERT INTO site_domains (id, extension, price_monthly, price_annual, currency, popular, active, position) VALUES (?, ?, ?, ?, 'AOA', ?, 1, ?)",
      [randomUUID(), ext, Math.round(reg.price / 12), reg.price, ext === '.ao' || ext === '.com' ? 1 : 0, pos])
    else if (args['update-prices']) await q('UPDATE site_domains SET price_monthly = ?, price_annual = ? WHERE id = ?', [Math.round(reg.price / 12), reg.price, s.id])
  }
  // site_email_plans (secção de e-mail da página inicial): mesmo preço do catálogo, sem desconto anual
  for (const ep of await q('SELECT e.id, e.slug, pp.price FROM site_email_plans e JOIN products p ON p.slug = e.slug JOIN product_prices pp ON pp.product_id = p.id AND pp.cycle = \'monthly\' AND pp.active = 1')) {
    await q('UPDATE site_email_plans SET price_monthly = ?, price_annual = ?, discount_annual = 0 WHERE id = ?', [ep.price, ep.price, ep.id]); stats.planos_email_site = (stats.planos_email_site ?? 0) + 1
  }
  const orphan = await q('SELECT e.slug FROM site_email_plans e LEFT JOIN products p ON p.slug = e.slug WHERE e.active = 1 AND p.id IS NULL')
  if (orphan.length) console.warn('! site_email_plans sem produto no catálogo (o checkout não os vende):', orphan.map(o => o.slug).join(', '))
  // Recursos dos planos de e-mail alinhados com a referência (preço por caixa). Só com
  // --sync-email-features (substitui as funcionalidades desses 3 produtos); sem a opção, só mostra a diferença.
  const EMAIL_FEATURES = {
    'email-starter': ['Preço por caixa de correio', '5 GB por caixa', '5 aliases por caixa', '5 regras de reencaminhamento', 'Webmail, IMAP e SMTP'],
    'email-standard': ['Preço por caixa de correio', '20 GB por caixa', 'Webmail, IMAP e SMTP'],
    'email-premium': ['Preço por caixa de correio', '50 GB por caixa', '30 aliases por caixa', '50 regras de reencaminhamento', 'Webmail, IMAP e SMTP'],
  }
  for (const [slug, feats] of Object.entries(EMAIL_FEATURES)) {
    const [p] = await q('SELECT id FROM products WHERE slug = ?', [slug])
    if (!p) continue
    const cur = (await q('SELECT feature FROM product_features WHERE product_id = ? AND included = 1 ORDER BY position', [p.id])).map(r => r.feature)
    if (JSON.stringify(cur) === JSON.stringify(feats)) continue
    if (args['sync-email-features']) {
      await q('DELETE FROM product_features WHERE product_id = ?', [p.id])
      for (const [i, f] of feats.entries()) await q('INSERT INTO product_features (id, product_id, feature, included, position) VALUES (?, ?, ?, 1, ?)', [randomUUID(), p.id, f, i + 1])
      stats.recursos_email_alinhados = (stats.recursos_email_alinhados ?? 0) + 1
    } else {
      console.warn(`! ${slug}: recursos diferentes da referência (usar --sync-email-features para alinhar)\n    actual: ${cur.join(' | ') || '—'}\n    referência: ${feats.join(' | ')}`)
    }
  }
  await conn.commit()
  console.log('✓', JSON.stringify(stats))
} catch (e) {
  await conn.rollback()
  console.error(`✗ ${e.code ?? ''} ${e.sqlMessage ?? e.message}`)
  process.exitCode = 1
} finally {
  await conn.end()
}
