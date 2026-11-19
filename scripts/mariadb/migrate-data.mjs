#!/usr/bin/env node
/**
 * ViralizaHost — migração de dados Supabase (PostgreSQL) → MariaDB.
 *
 * Lê da origem (schema `viralizahost`, auth.users, storage.*) e escreve no destino
 * em lotes, pela ordem das dependências. Por omissão corre em SIMULAÇÃO.
 *
 *   node --env-file=.env.migration scripts/mariadb/migrate-data.mjs [opções]
 *
 * Opções:
 *   --execute               escreve no destino (sem isto: simulação, nada é escrito)
 *   --mode=insert-missing   (omissão) só insere linhas cuja PK não existe no destino;
 *                           linhas existentes e diferentes são CONFLITOS (não sobrescreve)
 *   --mode=sync             para a janela de corte: também actualiza linhas cuja versão
 *                           na origem é mais recente (updated_at maior); se o destino for
 *                           mais recente, regista conflito e não toca
 *   --apply-schema          aplica database/mariadb/schema.sql antes (idempotente)
 *   --tables=a,b            só estas tabelas
 *   --batch-size=500
 *   --skip-auth             não migra auth.users
 *   --skip-storage          não migra ficheiros
 *   --storage-source-dir=P  copia ficheiros de P/<bucket>/<nome> (cópia local) em vez de
 *                           descarregar da API do Supabase Storage
 *   --verify                só valida (contagens, amostras, totais, órfãos, ficheiros)
 *   --report-dir=DIR        (omissão ./migration-reports)
 *
 * Variáveis:
 *   SOURCE_DATABASE_URL                ligação PostgreSQL à origem (obrigatória)
 *   SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_ROLE_KEY   para descarregar ficheiros
 *   DB_HOST/DB_PORT/DB_SOCKET/DB_NAME/DB_USER/DB_PASSWORD   destino MariaDB
 *   STORAGE_DIR                        pasta de destino dos ficheiros
 *   STORAGE_PUBLIC_BASE_URL | NEXT_PUBLIC_SITE_URL   nova origem dos URLs públicos
 *
 * Os registos nunca incluem conteúdo das linhas (só tabela, PK e código de erro).
 */
import pg from 'pg'
import mysql from 'mysql2/promise'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat, copyFile, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCHEMA = process.env.SOURCE_SCHEMA || 'viralizahost'

// ── Argumentos ───────────────────────────────────────────────────────────────
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, ...v] = a.replace(/^--/, '').split('=')
  return [k, v.length ? v.join('=') : true]
}))
const EXECUTE = !!args.execute
const MODE = args.mode || 'insert-missing'
const BATCH = Number(args['batch-size'] || 500)
const ONLY = args.tables ? new Set(String(args.tables).split(',')) : null
const REPORT_DIR = resolve(String(args['report-dir'] || join(process.cwd(), 'migration-reports')))
if (!['insert-missing', 'sync'].includes(MODE)) fail(`--mode inválido: ${MODE}`)

function fail(msg) { console.error(`✗ ${msg}`); process.exit(2) }
const log = (...m) => console.log(...m)

/** Remove valores de mensagens de erro (ex.: "Duplicate entry 'x@y.com'"). */
const sanitize = msg => String(msg ?? '').replace(/'[^']*'/g, "'…'").replace(/"[^"]*"/g, '"…"').slice(0, 300)

// ── Ligações ─────────────────────────────────────────────────────────────────
if (!process.env.SOURCE_DATABASE_URL) fail('Defina SOURCE_DATABASE_URL')
if (!process.env.DB_NAME || !process.env.DB_USER) fail('Defina DB_NAME e DB_USER (destino MariaDB)')

// Valores PostgreSQL como texto (preserva microssegundos e precisão decimal)
for (const oid of [1082, 1114, 1184, 1700, 20]) pg.types.setTypeParser(oid, v => v)
const src = new pg.Client({ connectionString: process.env.SOURCE_DATABASE_URL, application_name: 'viralizahost-migration' })
await src.connect()
await src.query("SET TIME ZONE 'UTC'")
await src.query('SET default_transaction_read_only = on') // a origem nunca é alterada

const dst = await mysql.createConnection({
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306) }),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '',
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  dateStrings: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: true,
})
await dst.query("SET time_zone = '+00:00', sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")

const sq = async (sql, p = []) => (await src.query(sql, p)).rows
const dq = async (sql, p = []) => (await dst.query(sql, p))[0]
const qi = s => '`' + s.replace(/`/g, '``') + '`'

// ── Metadados do destino ─────────────────────────────────────────────────────
const metaSrc = await readFile(join(ROOT, 'src/lib/db/schema.generated.ts'), 'utf8')
const META = JSON.parse(metaSrc.slice(metaSrc.indexOf('= {') + 2))

const report = {
  started_at: new Date().toISOString(),
  mode: args.verify ? 'verify' : `${EXECUTE ? 'execute' : 'dry-run'}:${MODE}`,
  target: { database: process.env.DB_NAME },
  preflight: {}, tables: {}, auth: null, storage: null, verify: null, warnings: [], errors: [],
}

// ── Conversões ───────────────────────────────────────────────────────────────
function pgTs(v) {
  // '2026-07-01 12:00:00.123456+00' → '2026-07-01 12:00:00.123456'
  if (v == null) return null
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2}(?::?\d{2})?|Z)?$/)
  if (!m) return v
  let base = `${m[1]} ${m[2]}`
  const frac = (m[3] ?? '.').slice(1).padEnd(6, '0').slice(0, 6)
  if (m[4] && m[4] !== '+00' && m[4] !== 'Z' && m[4] !== '+00:00') {
    const d = new Date(`${m[1]}T${m[2]}${m[4].length === 3 ? m[4] + ':00' : m[4]}`)
    base = d.toISOString().slice(0, 19).replace('T', ' ')
  }
  return `${base}.${frac}`
}

const canon = v => {
  if (v === null || v === undefined) return null
  if (Array.isArray(v)) return v.map(canon)
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])]))
  return v
}

let urlFrom = null, urlTo = null
function rewriteUrls(s) {
  if (!urlFrom || typeof s !== 'string' || !s.includes(urlFrom)) return s
  return s.split(urlFrom).join(urlTo)
}
let rewrites = 0

/** Valor da origem → valor para o MariaDB. */
function toTarget(kind, v) {
  if (v === null || v === undefined) return null
  switch (kind) {
    case 'bool': return v ? 1 : 0
    case 'json':
    case 'array': {
      const s = JSON.stringify(v)
      const r = rewriteUrls(s)
      if (r !== s) rewrites++
      return r
    }
    case 'timestamp': return pgTs(v)
    case 'date': return String(v).slice(0, 10)
    case 'text': {
      const r = rewriteUrls(v)
      if (r !== v) rewrites++
      return r
    }
    default: return typeof v === 'object' ? JSON.stringify(v) : String(v)
  }
}

/** Valor lido do MariaDB → forma canónica comparável. */
function normTarget(kind, v) {
  if (v === null || v === undefined) return null
  switch (kind) {
    case 'bool': return Number(v) ? '1' : '0'
    case 'json': case 'array': try { return JSON.stringify(canon(typeof v === 'string' ? JSON.parse(v) : v)) } catch { return String(v) }
    case 'number': return String(Number(v))
    case 'int': return String(v)
    case 'timestamp': return String(v).padEnd(26, '0').slice(0, 26)
    default: return String(v)
  }
}
function normSource(kind, converted) {
  if (converted === null) return null
  switch (kind) {
    case 'json': case 'array': return JSON.stringify(canon(JSON.parse(converted)))
    case 'number': return String(Number(converted))
    default: return String(converted)
  }
}

// ── Ordem de dependências ────────────────────────────────────────────────────
function topoOrder(tables) {
  const deps = Object.fromEntries(tables.map(t => [t, new Set(
    (META[t]?.relations ?? []).filter(r => !r.many && r.table !== t && tables.includes(r.table)).map(r => r.table),
  )]))
  const out = [], seen = new Set(), stack = new Set()
  const visit = t => {
    if (seen.has(t)) return
    if (stack.has(t)) return // ciclo: resolvido com foreign_key_checks = 0
    stack.add(t)
    for (const d of deps[t]) visit(d)
    stack.delete(t); seen.add(t); out.push(t)
  }
  tables.sort().forEach(visit)
  return out
}

// ── Pré-verificação ──────────────────────────────────────────────────────────
async function preflight() {
  const srcTables = (await sq(
    `select table_schema as s, table_name as t from information_schema.tables
     where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog','information_schema')
     order by 1, 2`)).map(r => `${r.s}.${r.t}`)
  const appTables = srcTables.filter(t => t.startsWith(`${SCHEMA}.`)).map(t => t.split('.')[1])
  const other = srcTables.filter(t => !t.startsWith(`${SCHEMA}.`) && !/^(auth|storage|realtime|supabase_functions|supabase_migrations|vault|graphql|graphql_public|net|pgsodium|pgsodium_masks|extensions|cron|_realtime|_analytics)\./.test(t))
  const otherCounts = {}
  for (const t of other) {
    const [s, n] = t.split('.')
    try { otherCounts[t] = Number((await sq(`select count(*)::int as n from "${s}"."${n}"`))[0].n) } catch { otherCounts[t] = 'sem acesso' }
  }
  report.preflight.other_schemas = otherCounts
  if (Object.values(otherCounts).some(n => n !== 0)) {
    report.warnings.push('Existem tabelas com dados fora do schema da aplicação (ver preflight.other_schemas). O código não as usa; não são migradas.')
  }
  const missingInTarget = appTables.filter(t => !META[t])
  const missingInSource = Object.keys(META).filter(t => !appTables.includes(t))
  report.preflight.tables_only_in_source = missingInTarget
  report.preflight.tables_only_in_target = missingInSource
  if (missingInTarget.length) report.warnings.push(`Tabelas da origem sem equivalente no destino: ${missingInTarget.join(', ')} — gere de novo o schema (generate-schema.mjs).`)

  const dstTables = new Set((await dq('SHOW TABLES')).map(r => Object.values(r)[0]))
  const existing = {}
  for (const t of Object.keys(META)) {
    if (!dstTables.has(t)) { existing[t] = 'em falta'; continue }
    const [{ n }] = await dq(`SELECT COUNT(*) AS n FROM ${qi(t)}`)
    if (Number(n)) existing[t] = Number(n)
  }
  report.preflight.target_nonempty_or_missing = existing
  const missingDst = Object.entries(existing).filter(([, v]) => v === 'em falta').map(([k]) => k)
  if (missingDst.length && !args['apply-schema']) fail(`Tabelas em falta no destino: ${missingDst.join(', ')}. Importe database/mariadb/schema.sql ou use --apply-schema.`)
  const nonEmpty = Object.entries(existing).filter(([t, n]) => typeof n === 'number' && (!ONLY || ONLY.has(t)))
  if (!args.verify && nonEmpty.length) {
    report.warnings.push(`Destino já tem dados em ${nonEmpty.length} tabela(s) (${nonEmpty.map(([t, n]) => `${t}=${n}`).join(', ')}). Linhas com a mesma PK são comparadas; diferentes = conflito (não sobrescritas${MODE === 'sync' ? ', salvo origem mais recente' : ''}).`)
  }

  // Colunas: origem vs destino
  const srcCols = await sq(`select table_name as t, column_name as c from information_schema.columns where table_schema = $1`, [SCHEMA])
  const drift = {}
  for (const t of appTables.filter(t => META[t])) {
    const s = new Set(srcCols.filter(r => r.t === t).map(r => r.c))
    const d = Object.entries(META[t].columns).filter(([, m]) => !m.generated).map(([c]) => c)
    const onlySrc = [...s].filter(c => !META[t].columns[c])
    const onlyDst = d.filter(c => !s.has(c))
    if (onlySrc.length || onlyDst.length) drift[t] = { only_in_source: onlySrc, only_in_target: onlyDst }
  }
  report.preflight.column_drift = drift
  if (Object.values(drift).some(d => d.only_in_source.length)) {
    report.errors.push('Há colunas na origem que não existem no destino (ver preflight.column_drift). Os dados dessas colunas perder-se-iam: regenere o schema a partir da produção antes de executar.')
  }
  return appTables.filter(t => META[t] && (!ONLY || ONLY.has(t)))
}

// ── Conteúdo da Gestão do Site ───────────────────────────────────────────────
// Quando uma tabela site_* está vazia, o site público mostra valores de reserva
// do código (HeroCarousel FALLBACK_SLIDES, PricingSection FALLBACK_PLANS, etc.).
// Compara os registos da origem com os dados-semente de /api/admin/seed-site para
// detectar registos em falta, sem os criar (preserva o comportamento actual).
async function siteContentAudit() {
  const seedSrc = await readFile(join(ROOT, 'src/app/api/admin/seed-site/route.ts'), 'utf8').catch(() => '')
  const KEYS = { site_banners: ['seedBanners', 'position'], site_domains: ['seedDomains', 'extension'], site_email_plans: ['seedEmailPlans', 'slug'], site_hosting_plans: ['seedHostingPlans', 'slug'], site_team: ['seedTeam', 'name'] }
  const out = {}
  for (const [table, [constName, key]] of Object.entries(KEYS)) {
    const block = seedSrc.match(new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\n\\]`))?.[1] ?? ''
    const seedKeys = [...block.matchAll(new RegExp(`\\b${key}:\\s*(?:'([^']*)'|(\\d+))`, 'g'))].map(m => m[1] ?? m[2])
    const rows = await sq(`select "${key}"::text as k, ${table === 'site_team' || table === 'site_banners' || table === 'site_domains' || table.endsWith('plans') ? 'active' : 'true'} as active from "${SCHEMA}"."${table}"`)
    const have = new Set(rows.map(r => r.k))
    out[table] = {
      source_rows: rows.length,
      active_rows: rows.filter(r => r.active).length,
      site_uses_code_fallback: rows.filter(r => r.active).length === 0,
      seed_records_missing_in_source: seedKeys.filter(k => !have.has(k)),
    }
  }
  const hero = (await sq(`select mode, video_url, video_storage_path from "${SCHEMA}".site_home_hero where id = 1`))[0]
  out.site_home_hero = hero ? { mode: hero.mode, video_in_storage: !!hero.video_storage_path, video_url_is_supabase: /supabase\.co/.test(hero.video_url ?? '') } : { mode: 'carousel (sem linha → reserva)' }
  for (const t of ['banner_pages', 'products', 'product_features', 'plans', 'company_billing_settings', 'currency_rates']) {
    out[t] = { source_rows: Number((await sq(`select count(*)::int as n from "${SCHEMA}"."${t}"`))[0].n) }
  }
  const supabaseUrls = {}
  for (const [t, m] of Object.entries(META)) {
    const textCols = Object.entries(m.columns).filter(([, c]) => ['text', 'json', 'array'].includes(c.kind) && !c.generated).map(([c]) => c)
    if (!textCols.length) continue
    const [{ n }] = await sq(`select count(*)::int as n from "${SCHEMA}"."${t}" where ${textCols.map(c => `"${c}"::text like '%supabase.co/storage/%'`).join(' or ')}`).catch(() => [{ n: 0 }])
    if (n) supabaseUrls[t] = n
  }
  out.rows_with_supabase_storage_urls = supabaseUrls
  report.site_content = out
}

// ── Cópia de uma tabela ──────────────────────────────────────────────────────
async function copyTable(table) {
  const meta = META[table]
  const srcColsSet = new Set((await sq(`select column_name as c from information_schema.columns where table_schema = $1 and table_name = $2`, [SCHEMA, table])).map(r => r.c))
  const cols = Object.entries(meta.columns).filter(([c, m]) => !m.generated && srcColsSet.has(c)).map(([c]) => c)
  const pk = meta.pk
  const kinds = Object.fromEntries(cols.map(c => [c, meta.columns[c].kind]))
  const stats = { source: 0, inserted: 0, updated: 0, identical: 0, conflicts: 0, errors: 0, conflict_ids: [], error_samples: [] }
  const pkKey = r => pk.map(c => String(r[c])).join('|')

  let last = null
  for (;;) {
    const where = last ? `where (${pk.map(c => `"${c}"`).join(',')}) > (${pk.map((_, i) => `$${i + 1}`).join(',')})` : ''
    const batch = await sq(
      `select ${cols.map(c => `"${c}"`).join(', ')} from "${SCHEMA}"."${table}" ${where} order by ${pk.map(c => `"${c}"`).join(', ')} limit ${BATCH}`,
      last ? pk.map(c => last[c]) : [],
    )
    if (!batch.length) break
    last = batch[batch.length - 1]
    stats.source += batch.length

    const rows = batch.map(r => Object.fromEntries(cols.map(c => [c, toTarget(kinds[c], r[c])])))
    // Linhas já existentes no destino (mesma PK)
    const existing = new Map()
    const pkCond = pk.length === 1
      ? `${qi(pk[0])} IN (${rows.map(() => '?').join(',')})`
      : rows.map(() => '(' + pk.map(c => `${qi(c)} = ?`).join(' AND ') + ')').join(' OR ')
    for (const r of await dq(`SELECT ${cols.map(qi).join(', ')} FROM ${qi(table)} WHERE ${pkCond}`, rows.flatMap(r => pk.map(c => r[c])))) {
      existing.set(pkKey(r), r)
    }

    const toInsert = [], toUpdate = []
    for (const r of rows) {
      const cur = existing.get(pkKey(r))
      if (!cur) { toInsert.push(r); continue }
      const differing = cols.filter(c => normSource(kinds[c], r[c]) !== normTarget(kinds[c], cur[c]))
      if (!differing.length) { stats.identical++; continue }
      if (MODE === 'sync' && 'updated_at' in r && r.updated_at && cur.updated_at) {
        if (String(r.updated_at) > String(cur.updated_at)) { toUpdate.push(r); continue }
      }
      stats.conflicts++
      if (stats.conflict_ids.length < 50) stats.conflict_ids.push(`${pkKey(r)} (difere: ${differing.slice(0, 5).join(', ')})`)
    }

    if (EXECUTE) {
      await dst.beginTransaction()
      try {
        await dst.query('SET foreign_key_checks = 0')
        if (toInsert.length) {
          try {
            await dst.query(`INSERT INTO ${qi(table)} (${cols.map(qi).join(', ')}) VALUES ?`, [toInsert.map(r => cols.map(c => r[c]))])
            stats.inserted += toInsert.length
          } catch (e) {
            if (e.errno !== 1062) throw e
            // Colisão numa chave única: linha a linha para isolar os conflitos
            for (const r of toInsert) {
              try {
                await dst.query(`INSERT INTO ${qi(table)} (${cols.map(qi).join(', ')}) VALUES (?)`, [cols.map(c => r[c])])
                stats.inserted++
              } catch (e2) {
                if (e2.errno === 1062) {
                  stats.conflicts++
                  if (stats.conflict_ids.length < 50) stats.conflict_ids.push(`${pkKey(r)} (chave única: ${sanitize(e2.sqlMessage).replace(/.*for key /, '')})`)
                } else throw e2
              }
            }
          }
        }
        for (const r of toUpdate) {
          const set = cols.filter(c => !pk.includes(c))
          await dst.query(`UPDATE ${qi(table)} SET ${set.map(c => `${qi(c)} = ?`).join(', ')} WHERE ${pk.map(c => `${qi(c)} = ?`).join(' AND ')}`,
            [...set.map(c => r[c]), ...pk.map(c => r[c])])
          stats.updated++
        }
        await dst.query('SET foreign_key_checks = 1')
        await dst.commit()
      } catch (e) {
        await dst.rollback()
        await dst.query('SET foreign_key_checks = 1')
        stats.errors += toInsert.length + toUpdate.length
        if (stats.error_samples.length < 10) stats.error_samples.push(`errno ${e.errno ?? '?'}: ${sanitize(e.sqlMessage ?? e.message)}`)
      }
    } else {
      stats.inserted += toInsert.length // "seriam inseridas"
      stats.updated += toUpdate.length
      // Simulação: verificar colisões em chaves únicas (PK diferente, mesmo valor único)
      for (const uk of meta.unique ?? []) {
        if (!uk.every(c => cols.includes(c)) || !toInsert.length) continue
        const cand = toInsert.filter(r => uk.every(c => r[c] != null))
        if (!cand.length) continue
        const cond = cand.map(() => '(' + uk.map(c => `${qi(c)} = ?`).join(' AND ') + ')').join(' OR ')
        const hits = await dq(`SELECT ${[...new Set([...pk, ...uk])].map(qi).join(', ')} FROM ${qi(table)} WHERE ${cond}`, cand.flatMap(r => uk.map(c => r[c])))
        for (const h of hits) {
          const r = cand.find(x => uk.every(c => String(x[c]).toLowerCase() === String(h[c]).toLowerCase()))
          if (r && pkKey(r) !== pkKey(h)) {
            stats.conflicts++
            stats.inserted--
            if (stats.conflict_ids.length < 50) stats.conflict_ids.push(`${pkKey(r)} (chave única ${uk.join('+')} já usada pela linha ${pkKey(h)})`)
          }
        }
      }
    }
  }
  return stats
}

// ── Auth ─────────────────────────────────────────────────────────────────────
async function migrateAuth() {
  const users = await sq(`select id::text, lower(email) as email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
                                 banned_until, last_sign_in_at, created_at, updated_at, deleted_at
                          from auth.users order by id`)
  const stats = { source: users.length, inserted: 0, identical: 0, updated: 0, conflicts: 0, without_password: 0, bcrypt: 0, other_hash: 0, deleted_skipped: 0, conflict_ids: [] }
  for (const u of users) {
    if (u.deleted_at) { stats.deleted_skipped++; continue }
    const hash = u.encrypted_password || null
    if (!hash) stats.without_password++
    else if (/^\$2[aby]\$\d{2}\$/.test(hash)) stats.bcrypt++
    else stats.other_hash++
    const row = [u.id, u.email ?? `sem-email+${u.id}@invalid`, hash, pgTs(u.email_confirmed_at),
      JSON.stringify(u.raw_user_meta_data ?? {}), JSON.stringify(u.raw_app_meta_data ?? {}),
      hash && /^\$2[aby]\$/.test(hash) ? 0 : 1, pgTs(u.banned_until), pgTs(u.last_sign_in_at), pgTs(u.created_at), pgTs(u.updated_at)]
    const [cur] = await dq('SELECT id, email, encrypted_password, updated_at FROM auth_users WHERE id = ? OR email = ?', [u.id, row[1]])
    if (cur) {
      if (cur.id !== u.id) { stats.conflicts++; stats.conflict_ids.push(`${u.id} (e-mail já usado por outro id)`); continue }
      if (cur.encrypted_password === hash && cur.email === row[1]) { stats.identical++; continue }
      if (MODE === 'sync' && String(row[10]) > String(cur.updated_at)) {
        if (EXECUTE) await dq(`UPDATE auth_users SET email = ?, encrypted_password = ?, email_confirmed_at = ?, raw_user_meta_data = ?, raw_app_meta_data = ?,
                                password_reset_required = ?, banned_until = ?, last_sign_in_at = ?, updated_at = ? WHERE id = ?`, [...row.slice(1, 7), row[7], row[8], row[10], u.id])
        stats.updated++
      } else { stats.conflicts++; stats.conflict_ids.push(u.id) }
      continue
    }
    if (EXECUTE) {
      await dq(`INSERT INTO auth_users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
                password_reset_required, banned_until, last_sign_in_at, created_at, updated_at) VALUES (?)`, [row])
    }
    stats.inserted++
  }
  if (stats.without_password || stats.other_hash) {
    report.warnings.push(`${stats.without_password + stats.other_hash} conta(s) sem hash bcrypt (ex.: login social/magic link) ficam com password_reset_required=1: terão de usar "Esqueci a senha".`)
  }
  return stats
}

// ── Storage ──────────────────────────────────────────────────────────────────
function localPath(root, bucket, name) {
  const base = resolve(root, bucket)
  const full = resolve(base, name)
  if (!full.startsWith(base + sep)) throw new Error('caminho inválido')
  return full
}

async function migrateStorage() {
  const storageDir = process.env.STORAGE_DIR
  if (!storageDir) { report.warnings.push('STORAGE_DIR não definido — ficheiros não migrados.'); return null }
  const buckets = await sq('select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id')
  const objects = await sq(`select bucket_id, name, metadata, owner::text as owner, created_at, updated_at from storage.objects where name not like '%.emptyFolderPlaceholder' order by bucket_id, name`)
  const stats = { buckets: buckets.length, objects: objects.length, copied: 0, identical: 0, missing_in_source: 0, failed: 0, bytes: 0, failures: [] }
  const srcDir = args['storage-source-dir'] ? resolve(String(args['storage-source-dir'])) : null
  const api = process.env.SOURCE_SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY
  if (!srcDir && (!api || !key)) { report.warnings.push('Sem SOURCE_SUPABASE_URL/SERVICE_ROLE_KEY nem --storage-source-dir: ficheiros não descarregados (só metadados verificados).') }

  if (EXECUTE) for (const b of buckets) {
    await dq('INSERT INTO storage_buckets (id, public, file_size_limit, allowed_mime_types) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE public = VALUES(public), file_size_limit = VALUES(file_size_limit), allowed_mime_types = VALUES(allowed_mime_types)',
      [b.id, b.public ? 1 : 0, b.file_size_limit ?? null, b.allowed_mime_types ? JSON.stringify(b.allowed_mime_types) : null])
  }
  for (const o of objects) {
    const size = Number(o.metadata?.size ?? o.metadata?.contentLength ?? -1)
    const mime = o.metadata?.mimetype ?? o.metadata?.contentType ?? null
    let dest
    try { dest = localPath(storageDir, o.bucket_id, o.name) } catch { stats.failed++; stats.failures.push(`${o.bucket_id}/(nome inválido)`); continue }
    const [cur] = await dq('SELECT size, sha256 FROM storage_objects WHERE bucket_id = ? AND name = ?', [o.bucket_id, o.name])
    if (cur && existsSync(dest) && (size < 0 || Number(cur.size) === size)) { stats.identical++; continue }
    if (!EXECUTE) { stats.copied++; continue }
    let buf = null
    try {
      if (srcDir) {
        const p = localPath(srcDir, o.bucket_id, o.name)
        if (!existsSync(p)) { stats.missing_in_source++; continue }
        buf = await readFile(p)
      } else if (api && key) {
        const res = await fetch(`${api}/storage/v1/object/${o.bucket_id}/${o.name.split('/').map(encodeURIComponent).join('/')}`, {
          headers: { Authorization: `Bearer ${key}`, apikey: key },
        })
        if (res.status === 404 || res.status === 400) { stats.missing_in_source++; continue }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        buf = Buffer.from(await res.arrayBuffer())
      } else continue
      if (size >= 0 && buf.length !== size) throw new Error(`tamanho difere (${buf.length} ≠ ${size})`)
      await mkdir(dirname(dest), { recursive: true })
      const tmp = `${dest}.part`
      await writeFile(tmp, buf)
      await rename(tmp, dest)
      const sha = createHash('sha256').update(buf).digest('hex')
      await dq(`INSERT INTO storage_objects (id, bucket_id, name, owner, mime_type, size, sha256, created_at, updated_at) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE size = VALUES(size), sha256 = VALUES(sha256), mime_type = VALUES(mime_type)`,
        [o.bucket_id, o.name, o.owner, mime, buf.length, sha, pgTs(o.created_at), pgTs(o.updated_at)])
      stats.copied++; stats.bytes += buf.length
    } catch (e) {
      stats.failed++
      if (stats.failures.length < 20) stats.failures.push(`${o.bucket_id}/…${o.name.slice(-24)}: ${sanitize(e.message)}`)
    }
  }
  return stats
}

// ── Validação ────────────────────────────────────────────────────────────────
async function verify(tables) {
  const v = { counts: {}, samples: {}, financial: {}, orphans: {}, storage: null, ok: true }
  for (const t of tables) {
    const [{ n: s }] = await sq(`select count(*)::int as n from "${SCHEMA}"."${t}"`)
    const [{ n: d }] = await dq(`SELECT COUNT(*) AS n FROM ${qi(t)}`)
    v.counts[t] = { source: Number(s), target: Number(d), match: Number(s) === Number(d) }
    if (Number(s) !== Number(d)) v.ok = false
    // amostra aleatória por ID
    const meta = META[t]
    const pk = meta.pk
    const srcColsSet = new Set((await sq(`select column_name as c from information_schema.columns where table_schema = $1 and table_name = $2`, [SCHEMA, t])).map(r => r.c))
    const cols = Object.entries(meta.columns).filter(([c, m]) => !m.generated && srcColsSet.has(c)).map(([c]) => c)
    const sample = await sq(`select ${cols.map(c => `"${c}"`).join(', ')} from "${SCHEMA}"."${t}" order by random() limit 20`)
    let diff = 0
    const diffCols = new Set()
    for (const r of sample) {
      const conv = Object.fromEntries(cols.map(c => [c, toTarget(meta.columns[c].kind, r[c])]))
      const [cur] = await dq(`SELECT ${cols.map(qi).join(', ')} FROM ${qi(t)} WHERE ${pk.map(c => `${qi(c)} = ?`).join(' AND ')}`, pk.map(c => conv[c]))
      if (!cur) { diff++; continue }
      for (const c of cols) if (normSource(meta.columns[c].kind, conv[c]) !== normTarget(meta.columns[c].kind, cur[c])) { diff++; diffCols.add(c); break }
    }
    v.samples[t] = { checked: sample.length, different: diff, columns: [...diffCols] }
    if (diff) v.ok = false
    // órfãos (FK sem linha-mãe)
    for (const r of meta.relations.filter(x => !x.many)) {
      const [{ n }] = await dq(`SELECT COUNT(*) AS n FROM ${qi(t)} c LEFT JOIN ${qi(r.table)} p ON p.${qi(r.refColumns[0])} = c.${qi(r.columns[0])} WHERE c.${qi(r.columns[0])} IS NOT NULL AND p.${qi(r.refColumns[0])} IS NULL`)
      if (Number(n)) { v.orphans[`${t}.${r.columns[0]} → ${r.table}`] = Number(n); v.ok = false }
    }
  }
  if (META.profiles) {
    const [{ n }] = await dq('SELECT COUNT(*) AS n FROM profiles p LEFT JOIN auth_users u ON u.id = p.id WHERE u.id IS NULL')
    if (Number(n)) { v.orphans['profiles.id → auth_users'] = Number(n); v.ok = false }
  }
  // Totais financeiros por estado e moeda
  const fin = [
    ['invoices', 'status, currency', 'sum(total) as total, sum(amount_paid) as paid, sum(subtotal) as subtotal'],
    ['payments', 'status, currency', 'sum(amount) as total'],
    ['orders', 'status', 'sum(amount) as total'],
    ['invoice_items', "'*' as k", 'sum(subtotal) as total'],
    ['clients', "'*' as k", 'sum(credit_balance) as total'],
  ]
  for (const [t, grp, agg] of fin) {
    if (!META[t] || (ONLY && !ONLY.has(t))) continue
    try {
      const g = grp.includes(' as ') ? '' : `group by ${grp}`
      const s = await sq(`select ${grp.includes(' as ') ? grp : grp.split(',').map(x => x.trim() + '::text').join(', ')}, ${agg.replace(/sum\((\w+)\)/g, 'coalesce(sum($1),0)::text')} from "${SCHEMA}"."${t}" ${g} order by 1`)
      const d = await dq(`SELECT ${grp}, ${agg.replace(/sum\((\w+)\)/g, 'CAST(COALESCE(SUM($1),0) AS CHAR)')} FROM ${qi(t)} ${g} ORDER BY 1`)
      const key = r => Object.values(r).map(x => (x == null ? '' : /^-?\d+(\.\d+)?$/.test(String(x)) ? Number(x).toFixed(2) : String(x))).join('|')
      const sk = s.map(key).sort(), dk = d.map(key).sort()
      const match = JSON.stringify(sk) === JSON.stringify(dk)
      v.financial[t] = { match, groups: s.length }
      if (!match) { v.financial[t].source = sk; v.financial[t].target = dk; v.ok = false }
    } catch (e) {
      v.financial[t] = { error: sanitize(e.message) }
    }
  }
  // Ficheiros
  if (process.env.STORAGE_DIR) {
    const objs = await dq('SELECT bucket_id, name, size FROM storage_objects')
    const srcObjs = Number((await sq(`select count(*)::int as n from storage.objects where name not like '%.emptyFolderPlaceholder'`))[0].n)
    let missing = 0, badSize = 0
    for (const o of objs) {
      try {
        const st = await stat(localPath(process.env.STORAGE_DIR, o.bucket_id, o.name))
        if (st.size !== Number(o.size)) badSize++
      } catch { missing++ }
    }
    v.storage = { source_objects: srcObjs, target_objects: objs.length, files_missing: missing, size_mismatch: badSize }
    if (missing || badSize || srcObjs !== objs.length) v.ok = false
  }
  // Auth
  const [{ n: su }] = await sq('select count(*)::int as n from auth.users where deleted_at is null')
  const [{ n: du }] = await dq('SELECT COUNT(*) AS n FROM auth_users')
  v.counts.auth_users = { source: Number(su), target: Number(du), match: Number(su) === Number(du) }
  if (Number(su) !== Number(du)) v.ok = false
  return v
}

// ── Execução ─────────────────────────────────────────────────────────────────
try {
  log(`ViralizaHost — migração ${report.mode} → ${process.env.DB_NAME}`)
  if (args['apply-schema']) {
    if (!EXECUTE) log('• --apply-schema ignorado em simulação (use com --execute)')
    else {
      await dst.query(await readFile(join(ROOT, 'database/mariadb/schema.sql'), 'utf8'))
      log('✓ schema aplicado')
    }
  }
  const tables = topoOrder(await preflight())
  await siteContentAudit()
  if (report.errors.length && EXECUTE && !args.force) {
    throw new Error(report.errors.join(' | ') + ' (use --force para continuar mesmo assim)')
  }

  // Origem dos URLs públicos do Storage → novo domínio
  if (process.env.SOURCE_SUPABASE_URL) {
    urlFrom = `${process.env.SOURCE_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/`
    urlTo = `${(process.env.STORAGE_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://viralizahost.com').replace(/\/$/, '')}/storage/v1/object/public/`
    report.url_rewrite = { from: urlFrom.replace(/\/\/([^.]+)\./, '//<projecto>.'), to: urlTo }
  } else {
    report.warnings.push('SOURCE_SUPABASE_URL não definido: URLs públicos do Supabase Storage nas tabelas não serão reescritos.')
  }

  if (args.verify) {
    report.verify = await verify(tables)
    log(report.verify.ok ? '✓ validação sem diferenças' : '✗ validação encontrou diferenças (ver relatório)')
  } else {
    if (!args['skip-auth'] && (!ONLY || ONLY.has('auth_users'))) {
      report.auth = await migrateAuth()
      log(`• auth_users: ${report.auth.source} origem, ${report.auth.inserted} ${EXECUTE ? 'inseridas' : 'a inserir'}, ${report.auth.identical} iguais, ${report.auth.conflicts} conflitos`)
    }
    for (const t of tables) {
      const s = await copyTable(t)
      report.tables[t] = s
      log(`• ${t.padEnd(26)} ${String(s.source).padStart(6)} origem | ${EXECUTE ? 'inseridas' : 'a inserir'} ${s.inserted} | actualizadas ${s.updated} | iguais ${s.identical} | conflitos ${s.conflicts} | erros ${s.errors}`)
    }
    report.urls_rewritten = rewrites
    if (!args['skip-storage']) {
      report.storage = await migrateStorage()
      if (report.storage) log(`• storage: ${report.storage.objects} objectos | ${EXECUTE ? 'copiados' : 'a copiar'} ${report.storage.copied} | iguais ${report.storage.identical} | em falta na origem ${report.storage.missing_in_source} | falhas ${report.storage.failed}`)
    }
  }
} catch (e) {
  report.errors.push(sanitize(e.message))
  process.exitCode = 1
} finally {
  report.finished_at = new Date().toISOString()
  await mkdir(REPORT_DIR, { recursive: true })
  const file = join(REPORT_DIR, `migracao-${report.started_at.replace(/[:.]/g, '-')}.json`)
  await writeFile(file, JSON.stringify(report, null, 2))
  try {
    if (EXECUTE || args.verify) {
      const summary = { tables: Object.fromEntries(Object.entries(report.tables).map(([t, s]) => [t, { i: s.inserted, u: s.updated, c: s.conflicts, e: s.errors }])), ok: report.verify?.ok, errors: report.errors.length }
      await dq('INSERT INTO vh_migration_runs (mode, finished_at, summary) VALUES (?, CURRENT_TIMESTAMP(6), ?)', [report.mode, JSON.stringify(summary)])
    }
  } catch {}
  for (const w of report.warnings) log(`⚠ ${w}`)
  for (const e of report.errors) log(`✗ ${e}`)
  const conflicts = Object.values(report.tables).reduce((a, s) => a + s.conflicts, 0) + (report.auth?.conflicts ?? 0)
  const errors = Object.values(report.tables).reduce((a, s) => a + s.errors, 0)
  if (conflicts) log(`⚠ ${conflicts} conflito(s) — linhas não sobrescritas (IDs no relatório).`)
  if (errors) { log(`✗ ${errors} linha(s) com erro.`); process.exitCode = 1 }
  log(`Relatório: ${file}`)
  if (!EXECUTE && !args.verify) log('Simulação: nada foi escrito. Use --execute para aplicar.')
  await src.end()
  await dst.end()
}
