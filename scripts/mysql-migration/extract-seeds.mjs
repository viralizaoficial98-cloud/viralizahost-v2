#!/usr/bin/env node
/**
 * Extrai os dados semeados pelas funções PostgreSQL setup_product_catalog() e setup_banner_pages()
 * para JSON, para que as versões TypeScript (src/lib/db/rpc.ts) produzam exatamente o mesmo resultado.
 *
 * Requer uma base PostgreSQL LOCAL onde as funções já foram executadas sobre tabelas vazias:
 *   PG_URL=... FUNCTIONS_SQL=/caminho/functions.sql node scripts/mysql-migration/extract-seeds.mjs
 * (FUNCTIONS_SQL = pg_get_functiondef das funções, usado para ler as listas de colunas do INSERT/ON CONFLICT)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
for (const oid of [1700, 1082, 1184, 1114]) pg.types.setTypeParser(oid, v => v)
const c = new pg.Client({ connectionString: process.env.PG_URL }); await c.connect()
const fns = readFileSync(process.env.FUNCTIONS_SQL, 'utf8')
const body = name => fns.split(`=== public.${name}\n`)[1].split('\n=== ')[0]

// ── Catálogo de produtos ───────────────────────────────────────────────
const prodBody = body('setup_product_catalog')
const blocks = []
for (const m of prodBody.matchAll(/INSERT INTO viralizahost\.products\s*\(([^)]*)\)\s*VALUES(.*?)ON CONFLICT \(slug\) DO UPDATE SET(.*?);/gs)) {
  const insertCols = m[1].split(',').map(s => s.trim())
  const updateCols = m[3].split(/,\s*(?![^(]*\))/).filter(x => x.includes('=')).map(x => x.split('=')[0].trim()).filter(x => x !== 'updated_at')
  const slugs = [...m[2].matchAll(/\(\s*'([^']+)'/g)].map(x => x[1])
  const { rows } = await c.query(`SELECT ${insertCols.map(x => `"${x}"`).join(', ')} FROM viralizahost.products WHERE slug = ANY($1) ORDER BY array_position($1, slug)`, [slugs])
  blocks.push({ insertCols, updateCols, rows })
}
const featureSlugs = [...prodBody.matchAll(/DELETE FROM viralizahost\.product_features\s+WHERE product_id = \(SELECT id FROM viralizahost\.products WHERE slug='([^']+)'\)/g)].map(m => m[1])
const { rows: features } = await c.query(`SELECT p.slug, f.feature, f.included, f.position FROM viralizahost.product_features f JOIN viralizahost.products p ON p.id = f.product_id
  WHERE p.slug = ANY($1) ORDER BY p.slug, f.position`, [featureSlugs])

// ── Banners das páginas ────────────────────────────────────────────────
const bpBody = body('setup_banner_pages')
const bpCols = bpBody.match(/INSERT INTO viralizahost\.banner_pages\s*\(([^)]*)\)/s)[1].split(',').map(s => s.trim())
const { rows: bannerPages } = await c.query(`SELECT ${bpCols.map(x => `"${x}"`).join(', ')} FROM viralizahost.banner_pages ORDER BY page_slug`)

mkdirSync(join(ROOT, 'src/lib/db/seeds'), { recursive: true })
writeFileSync(join(ROOT, 'src/lib/db/seeds/product-catalog.json'), JSON.stringify({ blocks, featureSlugs, features }, null, 2) + '\n')
writeFileSync(join(ROOT, 'src/lib/db/seeds/banner-pages.json'), JSON.stringify({ columns: bpCols, rows: bannerPages }, null, 2) + '\n')
console.log(`produtos: ${blocks.reduce((n, b) => n + b.rows.length, 0)} em ${blocks.length} blocos · features: ${features.length} (${featureSlugs.join(', ')}) · banner_pages: ${bannerPages.length}`)
await c.end()
