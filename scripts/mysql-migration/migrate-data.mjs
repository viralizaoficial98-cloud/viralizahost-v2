#!/usr/bin/env node
/**
 * ViralizaHost — Migração de dados Supabase PostgreSQL (schema viralizahost) → MySQL/MariaDB.
 *
 * Comandos:
 *   check      Compara o schema de origem com o de destino (colunas, tipos, tamanhos, enums). Não escreve nada.
 *   import     Copia todas as tabelas em lotes. Idempotente: usa INSERT … ON DUPLICATE KEY UPDATE pela chave primária,
 *              por isso pode ser repetido ou retomado sem criar duplicados.
 *              --resume   continua cada tabela a partir da última chave importada (ver tabela _migration_state)
 *              --prune    remove do destino as linhas que já não existem na origem (sincronização final)
 *              --tables=a,b  limita a tabelas específicas
 *   validate   Compara contagens, conteúdo linha a linha (hash por chave primária), relações (órfãos) e totais financeiros.
 *              Sai com código 1 se houver diferenças.
 *   reverse    Copia de MySQL → PostgreSQL (rollback preservando registos criados depois da troca). Mesmas opções que import.
 *
 * Variáveis de ambiente:
 *   SOURCE_PG_URL   ligação PostgreSQL ao Supabase (Dashboard → Connect → Session pooler), ex.:
 *                   postgresql://postgres.<ref>:<password>@aws-0-<região>.pooler.supabase.com:5432/postgres
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE   (ou DATABASE_URL=mysql://…)
 *   BATCH_SIZE      (opcional, por defeito 500)
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import mysql from 'mysql2/promise'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCHEMA = JSON.parse(readFileSync(join(HERE, 'schema.json'), 'utf8'))
const PG_SCHEMA = 'viralizahost'
const BATCH = Number(process.env.BATCH_SIZE ?? 500)

const [cmd, ...rest] = process.argv.slice(2)
const flags = Object.fromEntries(rest.map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
const only = flags.tables ? String(flags.tables).split(',') : null

/* ─── Ligações ────────────────────────────────────────────────────────── */
// Valores em bruto do PostgreSQL (sem perder microssegundos nem casas decimais)
for (const oid of [1082, 1114, 1184, 1700, 20, 1083]) pg.types.setTypeParser(oid, v => v)

async function connectPg() {
  const url = process.env.SOURCE_PG_URL
  if (!url) throw new Error('Defina SOURCE_PG_URL')
  const c = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1|host=\//.test(url) ? false : { rejectUnauthorized: false } })
  await c.connect()
  await c.query(`SET TIME ZONE 'UTC'; SET search_path TO ${PG_SCHEMA}`)
  return c
}

async function connectMysql() {
  const cfg = process.env.DATABASE_URL?.startsWith('mysql')
    ? { uri: process.env.DATABASE_URL }
    : { host: process.env.MYSQL_HOST ?? 'localhost', port: Number(process.env.MYSQL_PORT ?? 3306), user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE, socketPath: process.env.MYSQL_SOCKET }
  const c = await mysql.createConnection({ ...cfg, charset: 'utf8mb4', timezone: 'Z', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, decimalNumbers: false, multipleStatements: false })
  await c.query("SET time_zone = '+00:00'")
  await c.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',STRICT_ALL_TABLES')")
  return c
}

/* ─── Normalização de valores ─────────────────────────────────────────── */
/** "2026-01-02 03:04:05.123456+01" → "2026-01-02 02:04:05.123456" (UTC, microssegundos preservados) */
function pgTsToUtc(s) {
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?([+-]\d{2})(?::?(\d{2}))?(?::?(\d{2}))?$/)
  if (!m) {
    const n = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/) // sem fuso (timestamp)
    if (!n) throw new Error(`Data inválida: ${s}`)
    return `${n[1]} ${n[2]}${(n[3] ?? '.0').padEnd(7, '0').slice(0, 7)}`
  }
  const [, d, hh, mm, ss, frac = '.0', oh, om = '00', os = '00'] = m
  const sign = oh.startsWith('-') ? -1 : 1
  const offsetSec = sign * (Math.abs(Number(oh)) * 3600 + Number(om) * 60 + Number(os))
  const base = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), +hh, +mm, +ss) - offsetSec * 1000
  const iso = new Date(base).toISOString() // YYYY-MM-DDTHH:MM:SS.000Z
  if (+d.slice(0, 4) < 1000) throw new Error(`Ano fora do intervalo suportado: ${s}`)
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}${frac.padEnd(7, '0').slice(0, 7)}`
}

/** Converte um valor lido do PostgreSQL para o formato de escrita no MySQL. */
function toMysql(kind, v) {
  if (v === null || v === undefined) return null
  switch (kind) {
    case 'bool': return v ? 1 : 0
    case 'json': return JSON.stringify(v)
    case 'array': return JSON.stringify(v)
    case 'datetime': return pgTsToUtc(v)
    default: return v
  }
}

/** Representação canónica para comparar origem e destino. */
function canon(kind, v, scale) {
  if (v === null || v === undefined) return null
  switch (kind) {
    case 'bool': return v === true || v === 1 || v === '1' || v === 't'
    case 'json': case 'array': return stableJson(typeof v === 'string' ? JSON.parse(v) : v)
    case 'datetime': return /[+-]\d{2}(:?\d{2})?$/.test(v) ? pgTsToUtc(v) : `${v.replace('T', ' ')}`.padEnd(26, '0').slice(0, 26)
    case 'decimal': return normDecimal(String(v), scale)
    case 'int': case 'bigint': return String(v)
    case 'float': return Number(v)
    case 'date': return String(v).slice(0, 10)
    default: return String(v)
  }
}
function normDecimal(s, scale) {
  if (!/^-?\d+(\.\d+)?$/.test(s)) return s
  if (scale == null) return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  const [i, f = ''] = s.split('.')
  return `${i}.${f.padEnd(scale, '0').slice(0, scale)}`.replace(/\.$/, '')
}
function stableJson(v) {
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']'
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}'
  return JSON.stringify(v)
}

const qi = s => '`' + s.replace(/`/g, '``') + '`'
const pqi = s => '"' + s.replace(/"/g, '""') + '"'
const writableCols = t => Object.entries(SCHEMA[t].columns).filter(([, c]) => !c.generated).map(([n]) => n)

/** Ordem de importação: pais antes de filhos (as FKs também ficam desligadas durante o lote, por segurança). */
function tableOrder() {
  const names = Object.keys(SCHEMA).filter(t => !only || only.includes(t))
  const deps = Object.fromEntries(names.map(t => [t, new Set(SCHEMA[t].fks.filter(f => !f.external && f.refTable !== t).map(f => f.refTable))]))
  const out = []; const seen = new Set()
  const visit = (t, stack = new Set()) => {
    if (seen.has(t) || stack.has(t)) return
    stack.add(t); for (const d of deps[t] ?? []) if (names.includes(d)) visit(d, stack)
    seen.add(t); out.push(t)
  }
  names.forEach(t => visit(t))
  return out
}

/* ─── check ───────────────────────────────────────────────────────────── */
async function check(src, dst) {
  let problems = 0
  const report = (msg) => { problems++; console.log('  ✗', msg) }
  const srcCols = (await src.query(`SELECT table_name, column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema = $1`, [PG_SCHEMA])).rows
  const srcTables = new Set(srcCols.map(r => r.table_name))
  const [dstRows] = await dst.query(`SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS dt, CHARACTER_MAXIMUM_LENGTH AS len, COLUMN_TYPE AS ct FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`)
  const dstCols = {}; for (const r of dstRows) (dstCols[r.t] ??= {})[r.c] = r

  for (const t of srcTables) if (!SCHEMA[t]) report(`tabela de origem sem correspondência no schema MySQL: ${t} (dados NÃO seriam migrados)`)
  for (const t of Object.keys(SCHEMA)) {
    if (!srcTables.has(t)) { report(`tabela ${t} não existe na origem (será ignorada)`); continue }
    if (!dstCols[t]) { report(`tabela ${t} não existe no MySQL — importe database/mysql/001_schema.sql primeiro`); continue }
    const sc = srcCols.filter(r => r.table_name === t)
    for (const r of sc) {
      if (!SCHEMA[t].columns[r.column_name]) report(`${t}.${r.column_name} existe na origem mas não no schema MySQL`)
      else if (!dstCols[t][r.column_name]) report(`${t}.${r.column_name} em falta no MySQL`)
    }
    for (const c of Object.keys(SCHEMA[t].columns)) if (!SCHEMA[t].columns[c].internal && !sc.some(r => r.column_name === c)) report(`${t}.${c} existe no MySQL mas não na origem`)
    // Tamanhos de VARCHAR e valores de ENUM
    for (const [c, m] of Object.entries(SCHEMA[t].columns)) {
      const d = dstCols[t]?.[c]; if (!d || m.generated || !sc.some(r => r.column_name === c)) continue
      if (d.dt === 'varchar' || d.dt === 'char') {
        const { rows } = await src.query(`SELECT max(char_length(${pqi(c)}::text)) AS m FROM ${pqi(t)}`)
        if (rows[0].m != null && Number(rows[0].m) > Number(d.len)) report(`${t}.${c}: valor com ${rows[0].m} caracteres > ${d.ct}`)
      }
      if (m.kind === 'enum') {
        const { rows } = await src.query(`SELECT DISTINCT ${pqi(c)}::text AS v FROM ${pqi(t)} WHERE ${pqi(c)} IS NOT NULL`)
        for (const r of rows) if (!m.values.includes(r.v)) report(`${t}.${c}: valor "${r.v}" não previsto no ENUM`)
      }
      if (m.kind === 'datetime') {
        const { rows } = await src.query(`SELECT count(*)::int AS n FROM ${pqi(t)} WHERE ${pqi(c)} < '1000-01-01' OR ${pqi(c)} > '9999-12-31'`)
        if (rows[0].n) report(`${t}.${c}: ${rows[0].n} datas fora do intervalo suportado pelo MySQL`)
      }
    }
  }
  console.log(problems ? `\n${problems} problema(s) encontrados.` : 'Schema compatível: nenhuma diferença.')
  return problems
}

/* ─── import ──────────────────────────────────────────────────────────── */
async function importTable(src, dst, t, { resume, prune }) {
  const meta = SCHEMA[t]
  const cols = writableCols(t)
  const pk = meta.pk
  if (!pk.length) throw new Error(`${t} não tem chave primária — não é possível importar de forma idempotente`)
  const [[state]] = await dst.query('SELECT rows_imported, checksum FROM `_migration_state` WHERE table_name = ?', [t])
  let lastKey = resume && state?.checksum && !state?.completed_at ? JSON.parse(state.checksum) : null
  let imported = resume && lastKey ? Number(state.rows_imported) : 0
  const { rows: [{ n: total }] } = await src.query(`SELECT count(*)::bigint AS n FROM ${pqi(t)}`)

  const updates = cols.filter(c => !pk.includes(c)).map(c => `${qi(c)} = VALUES(${qi(c)})`)
  const insertHead = `INSERT INTO ${qi(t)} (${cols.map(qi).join(', ')}) VALUES `
  const insertTail = updates.length ? ` ON DUPLICATE KEY UPDATE ${updates.join(', ')}` : ` ON DUPLICATE KEY UPDATE ${qi(pk[0])} = ${qi(pk[0])}`
  const pkOrder = pk.map(c => `${pqi(c)}::text`).join(', ')

  for (;;) {
    const params = []
    let where = ''
    if (lastKey) { where = `WHERE (${pk.map(c => `${pqi(c)}::text`).join(', ')}) > (${pk.map((_, i) => `$${i + 1}`).join(', ')})`; params.push(...lastKey) }
    const sel = cols.map(c => {
      const k = meta.columns[c].kind
      return k === 'datetime' ? `to_char(${pqi(c)} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS ${pqi(c)}`
        : k === 'enum' ? `${pqi(c)}::text AS ${pqi(c)}` : pqi(c)
    })
    const { rows } = await src.query(`SELECT ${sel.join(', ')} FROM ${pqi(t)} ${where} ORDER BY ${pkOrder} LIMIT ${BATCH}`, params)
    if (!rows.length) break
    const values = rows.map(r => cols.map(c => {
      const k = meta.columns[c].kind
      return k === 'datetime' ? r[c] : toMysql(k, r[c])
    }))
    await dst.beginTransaction()
    try {
      await dst.query('SET FOREIGN_KEY_CHECKS = 0')
      await dst.query(insertHead + values.map(v => `(${v.map(() => '?').join(', ')})`).join(', ') + insertTail, values.flat())
      lastKey = pk.map(c => String(rows[rows.length - 1][c]))
      imported += rows.length
      await dst.query(`INSERT INTO _migration_state (table_name, rows_imported, last_batch_at, completed_at, source_count, checksum)
        VALUES (?, ?, UTC_TIMESTAMP(6), NULL, ?, ?) ON DUPLICATE KEY UPDATE rows_imported = VALUES(rows_imported),
        last_batch_at = VALUES(last_batch_at), completed_at = NULL, source_count = VALUES(source_count), checksum = VALUES(checksum)`,
        [t, imported, total, JSON.stringify(lastKey)])
      await dst.commit()
    } catch (e) { await dst.rollback(); throw new Error(`${t}: ${e.message}`) } finally { await dst.query('SET FOREIGN_KEY_CHECKS = 1') }
    process.stdout.write(`\r  ${t}: ${imported}/${total}   `)
    if (rows.length < BATCH) break
  }

  let pruned = 0
  if (prune) {
    const { rows } = await src.query(`SELECT ${pk.map(c => `${pqi(c)}::text AS ${pqi(c)}`).join(', ')} FROM ${pqi(t)}`)
    const keep = new Set(rows.map(r => JSON.stringify(pk.map(c => r[c]))))
    const [dstKeys] = await dst.query(`SELECT ${pk.map(c => `CAST(${qi(c)} AS CHAR) AS ${qi(c)}`).join(', ')} FROM ${qi(t)}`)
    const gone = dstKeys.filter(r => !keep.has(JSON.stringify(pk.map(c => String(r[c])))))
    for (const r of gone) {
      await dst.query('SET FOREIGN_KEY_CHECKS = 0')
      await dst.query(`DELETE FROM ${qi(t)} WHERE ${pk.map(c => `${qi(c)} = ?`).join(' AND ')}`, pk.map(c => r[c]))
      await dst.query('SET FOREIGN_KEY_CHECKS = 1')
      pruned++
    }
  }
  await dst.query('UPDATE _migration_state SET completed_at = UTC_TIMESTAMP(6), checksum = NULL WHERE table_name = ?', [t])
  process.stdout.write(`\r  ${t}: ${imported}/${total}${prune ? ` · removidas ${pruned}` : ''}\n`)
}

/* ─── reverse (MySQL → PostgreSQL) ────────────────────────────────────── */
async function reverseTable(dst, src, t, { prune }) {
  const meta = SCHEMA[t]; const cols = writableCols(t); const pk = meta.pk
  const [rows] = await dst.query(`SELECT ${cols.map(c => meta.columns[c].kind === 'datetime' ? `DATE_FORMAT(${qi(c)}, '%Y-%m-%d %H:%i:%s.%f') AS ${qi(c)}` : qi(c)).join(', ')} FROM ${qi(t)}`)
  const { rows: typeRows } = await src.query(`SELECT column_name, CASE WHEN data_type = 'USER-DEFINED' THEN udt_schema || '.' || udt_name WHEN data_type = 'ARRAY' THEN 'text[]' ELSE data_type END AS t FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`, [PG_SCHEMA, t])
  const pgType = Object.fromEntries(typeRows.map(r => [r.column_name, r.t]))
  const conflict = cols.filter(c => !pk.includes(c)).map(c => `${pqi(c)} = EXCLUDED.${pqi(c)}`)
  await src.query('BEGIN')
  let disabledTriggers = false
  try {
    // Desliga os triggers durante a cópia (senão, p.ex., o número dos tickets seria recalculado).
    // session_replication_role exige superutilizador; no Supabase usa-se a alternativa do dono da tabela.
    await src.query('SAVEPOINT srr')
    try { await src.query("SET LOCAL session_replication_role = 'replica'") }
    catch {
      await src.query('ROLLBACK TO SAVEPOINT srr')
      await src.query(`ALTER TABLE ${pqi(t)} DISABLE TRIGGER USER`)
      disabledTriggers = true
    }
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH); const params = []
      const tuples = chunk.map(r => `(${cols.map(c => {
        const k = meta.columns[c].kind; let v = r[c]
        if (v !== null) {
          if (k === 'bool') v = v === 1 || v === '1' || v === true
          else if (k === 'json') v = typeof v === 'string' ? v : JSON.stringify(v)
          else if (k === 'array') v = typeof v === 'string' ? JSON.parse(v) : v
          else if (k === 'datetime') v = v + '+00'
        }
        params.push(v)
        return `$${params.length}::${pgType[c] ?? 'text'}`
      }).join(', ')})`)
      await src.query(`INSERT INTO ${pqi(t)} (${cols.map(pqi).join(', ')}) VALUES ${tuples.join(', ')} ON CONFLICT (${pk.map(pqi).join(', ')}) DO ${conflict.length ? 'UPDATE SET ' + conflict.join(', ') : 'NOTHING'}`, params)
    }
    if (prune) {
      const keys = rows.map(r => pk.map(c => String(r[c])))
      const { rowCount } = await src.query(`DELETE FROM ${pqi(t)} WHERE (${pk.map(c => `${pqi(c)}::text`).join(', ')}) NOT IN (SELECT * FROM unnest(${pk.map((_, i) => `$${i + 1}::text[]`).join(', ')}))`, pk.map((_, i) => keys.map(k => k[i])))
      if (rowCount) console.log(`    ${t}: removidas ${rowCount} linhas que já não existem no MySQL`)
    }
    if (disabledTriggers) await src.query(`ALTER TABLE ${pqi(t)} ENABLE TRIGGER USER`)
    await src.query('COMMIT')
  } catch (e) { await src.query('ROLLBACK'); throw new Error(`${t}: ${e.message}`) }
  console.log(`  ${t}: ${rows.length} linhas → PostgreSQL${disabledTriggers ? ' (triggers desligados com ALTER TABLE)' : ''}`)
}

/* ─── validate ────────────────────────────────────────────────────────── */
async function rowHashes(kind, conn, t) {
  const meta = SCHEMA[t]; const cols = writableCols(t); const pk = meta.pk
  const map = new Map()
  if (kind === 'pg') {
    const sel = cols.map(c => {
      const k = meta.columns[c].kind
      return k === 'datetime' ? `to_char(${pqi(c)} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS ${pqi(c)}`
        : k === 'enum' ? `${pqi(c)}::text AS ${pqi(c)}` : pqi(c)
    })
    const { rows } = await conn.query(`SELECT ${sel.join(', ')} FROM ${pqi(t)}`)
    for (const r of rows) map.set(pk.map(c => String(r[c])).join('|'), hashRow(meta, cols, r))
  } else {
    const [rows] = await conn.query(`SELECT ${cols.map(c => meta.columns[c].kind === 'datetime' ? `DATE_FORMAT(${qi(c)}, '%Y-%m-%d %H:%i:%s.%f') AS ${qi(c)}` : qi(c)).join(', ')} FROM ${qi(t)}`)
    for (const r of rows) map.set(pk.map(c => String(r[c])).join('|'), hashRow(meta, cols, r))
  }
  return map
}
function hashRow(meta, cols, r) {
  const h = createHash('sha256')
  for (const c of cols) h.update(c + '=' + JSON.stringify(canon(meta.columns[c].kind, r[c], meta.columns[c].scale)) + ';')
  return h.digest('hex')
}

async function validate(src, dst) {
  let diffs = 0
  const tables = tableOrder()
  console.log('Tabela'.padEnd(28), 'origem'.padStart(8), 'destino'.padStart(8), ' conteúdo')
  for (const t of tables) {
    const a = await rowHashes('pg', src, t); const b = await rowHashes('my', dst, t)
    const missing = [...a.keys()].filter(k => !b.has(k)); const extra = [...b.keys()].filter(k => !a.has(k))
    const changed = [...a.keys()].filter(k => b.has(k) && a.get(k) !== b.get(k))
    const ok = !missing.length && !extra.length && !changed.length
    if (!ok) diffs++
    console.log(t.padEnd(28), String(a.size).padStart(8), String(b.size).padStart(8), ok ? ' ✓ idêntico'
      : ` ✗ em falta ${missing.length}, a mais ${extra.length}, diferentes ${changed.length}${changed.length ? ' (ex.: ' + changed.slice(0, 3).join(', ') + ')' : ''}`)
  }

  console.log('\nRelações (registos órfãos no destino):')
  let orphans = 0
  for (const t of tables) for (const f of SCHEMA[t].fks.filter(f => !f.external)) {
    const on = f.cols.map((c, i) => `p.${qi(f.refCols[i])} = c.${qi(c)}`).join(' AND ')
    const [[{ n }]] = await dst.query(`SELECT count(*) AS n FROM ${qi(t)} c LEFT JOIN ${qi(f.refTable)} p ON ${on} WHERE ${f.cols.map(c => `c.${qi(c)} IS NOT NULL`).join(' AND ')} AND p.${qi(f.refCols[0])} IS NULL`)
    const { rows: [{ n: pn }] } = await src.query(`SELECT count(*)::int AS n FROM ${pqi(t)} c LEFT JOIN ${pqi(f.refTable)} p ON ${on.replace(/`/g, '"')} WHERE ${f.cols.map(c => `c.${pqi(c)} IS NOT NULL`).join(' AND ')} AND p.${pqi(f.refCols[0])} IS NULL`)
    if (Number(n) !== Number(pn)) { orphans++; console.log(`  ✗ ${t}.${f.cols} → ${f.refTable}: ${n} órfãos no destino (origem: ${pn})`) }
    else if (Number(n)) console.log(`  ! ${t}.${f.cols} → ${f.refTable}: ${n} órfãos (já existiam na origem)`)
  }
  if (!orphans) console.log('  ✓ todas as chaves estrangeiras resolvem como na origem')

  console.log('\nTotais financeiros:')
  let money = 0
  for (const t of tables) {
    const dec = Object.entries(SCHEMA[t].columns).filter(([, m]) => m.kind === 'decimal').map(([c]) => c)
    if (!dec.length) continue
    const groupCols = ['currency', 'status'].filter(c => SCHEMA[t].columns[c])
    const gSel = groupCols.map(c => `CAST(${qi(c)} AS CHAR) AS ${qi(c)}`); const gpSel = groupCols.map(c => `${pqi(c)}::text AS ${pqi(c)}`)
    const sumsMy = dec.map(c => `CAST(COALESCE(SUM(${qi(c)}), 0) AS CHAR) AS ${qi(c)}`)
    const sumsPg = dec.map(c => `COALESCE(SUM(${pqi(c)}), 0)::text AS ${pqi(c)}`)
    const [myRows] = await dst.query(`SELECT ${[...gSel, ...sumsMy].join(', ')} FROM ${qi(t)}${groupCols.length ? ' GROUP BY ' + groupCols.map(qi).join(', ') : ''}`)
    const { rows: pgRows } = await src.query(`SELECT ${[...gpSel, ...sumsPg].join(', ')} FROM ${pqi(t)}${groupCols.length ? ' GROUP BY ' + groupCols.map(pqi).join(', ') : ''}`)
    const key = r => groupCols.map(c => r[c] ?? '∅').join('/')
    const pgMap = new Map(pgRows.map(r => [key(r), r]))
    const myMap = new Map(myRows.map(r => [key(r), r]))
    for (const k of new Set([...pgMap.keys(), ...myMap.keys()])) for (const c of dec) {
      const a = normDecimal(String(pgMap.get(k)?.[c] ?? '0'), SCHEMA[t].columns[c].scale)
      const b = normDecimal(String(myMap.get(k)?.[c] ?? '0'), SCHEMA[t].columns[c].scale)
      if (a !== b) { money++; console.log(`  ✗ ${t}.${c}${groupCols.length ? ` [${k}]` : ''}: origem ${a} ≠ destino ${b}`) }
      else if (['invoices', 'payments', 'orders', 'invoice_items', 'order_items'].includes(t) && ['total', 'amount', 'amount_paid', 'subtotal', 'price', 'declared_amount'].includes(c) && a !== normDecimal('0', SCHEMA[t].columns[c].scale))
        console.log(`  ✓ ${t}.${c}${groupCols.length ? ` [${k}]` : ''}: ${a}`)
    }
  }
  if (!money) console.log('  ✓ todas as somas de colunas DECIMAL coincidem')

  const failed = diffs + orphans + money
  console.log(failed ? `\nVALIDAÇÃO FALHOU (${diffs} tabelas diferentes, ${orphans} relações, ${money} totais).` : '\nVALIDAÇÃO OK: origem e destino coincidem.')
  return failed
}

/* ─── main ────────────────────────────────────────────────────────────── */
const src = await connectPg()
const dst = await connectMysql()
let code = 0
try {
  if (cmd === 'check') code = (await check(src, dst)) ? 1 : 0
  else if (cmd === 'import') {
    if (!flags.force && (await check(src, dst))) throw new Error('Corrija as diferenças de schema (ou use --force).')
    console.log(`\nA importar ${tableOrder().length} tabelas (lotes de ${BATCH})…`)
    for (const t of tableOrder()) await importTable(src, dst, t, { resume: !!flags.resume, prune: !!flags.prune })
    console.log('Importação concluída. Execute "validate" para confirmar.')
  } else if (cmd === 'reverse') {
    console.log('A copiar MySQL → PostgreSQL…')
    for (const t of tableOrder()) await reverseTable(dst, src, t, { prune: !!flags.prune })
  } else if (cmd === 'validate') code = (await validate(src, dst)) ? 1 : 0
  else { console.log('Uso: node scripts/mysql-migration/migrate-data.mjs <check|import|validate|reverse> [--resume] [--prune] [--tables=a,b]'); code = 2 }
} catch (e) {
  console.error('\nERRO:', e.message); code = 1
} finally {
  await src.end(); await dst.end()
}
process.exit(code)
