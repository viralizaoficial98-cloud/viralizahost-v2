#!/usr/bin/env node
/**
 * ViralizaHost — Migração de dados Supabase (PostgreSQL) ⇄ MariaDB
 *
 * Comandos:
 *   preflight   Inventário da origem e do destino (schemas, tabelas, contagens, conteúdo já existente,
 *               duplicados que colidiriam na colação case-insensitive, colunas novas na origem).
 *   copy        Copia origem → destino. Idempotente e retomável: INSERT … ON DUPLICATE KEY UPDATE
 *               pela chave primária original (os IDs são preservados, nada é duplicado).
 *                 --tables a,b      só estas tabelas
 *                 --since ISO       só linhas criadas/alteradas desde ISO (sincronização incremental)
 *                 --sync-deletes    apaga no destino linhas que já não existem na origem
 *                 --batch N         linhas por lote (500)
 *   files       Descarrega os ficheiros do Supabase Storage para STORAGE_ROOT (retomável).
 *   verify      Compara contagens, somas financeiras, hash por linha e relações (FK órfãs).
 *   mark-cutover  Regista a hora da troca para MariaDB (a partir daí "copy --sync-deletes" é recusado,
 *               para não apagar registos criados no MariaDB; "reverse" usa esta hora por omissão).
 *   reverse     Plano de regresso: copia MariaDB → Supabase (upsert ON CONFLICT (id)) as linhas
 *               criadas/alteradas desde --since, incluindo contas (auth.users + identities) e ficheiros.
 *
 * Variáveis de ambiente (nunca em ficheiros versionados):
 *   SOURCE_DATABASE_URL        postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_SOCKET / MYSQL_DATABASE / MYSQL_USER / MYSQL_PASSWORD
 *   SUPABASE_URL               https://<ref>.supabase.co        (files / reverse de ficheiros)
 *   SUPABASE_SERVICE_ROLE_KEY  service role key                 (files / reverse de ficheiros)
 *   STORAGE_ROOT               /var/www/viralizahost-storage
 *   NEW_SITE_URL               https://viralizahost.com          (reescrita dos URLs públicos do Storage)
 */
import pg from 'pg'
import mysql from 'mysql2/promise'
import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync, createReadStream } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const cmd = argv[0]
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
const flag = (n) => argv.includes(n)
const SCHEMA = opt('--schema', 'viralizahost')
const BATCH = Number(opt('--batch', 500))
let SINCE = opt('--since')
const ONLY = opt('--tables')?.split(',').map((s) => s.trim())

const meta = JSON.parse(readFileSync(join(ROOT, 'src/lib/db/schema.generated.ts'), 'utf8').match(/export const schemaMeta: SchemaMeta = ([\s\S]+)\n$/)[1])

// Tabelas especiais (fora do schema da aplicação)
const AUTH_COLS = ['id', 'email', 'encrypted_password', 'email_confirmed_at', 'phone', 'raw_user_meta_data', 'raw_app_meta_data', 'last_sign_in_at', 'banned_until', 'created_at', 'updated_at', 'deleted_at']
const AUTH_META = { pk: ['id'], columns: { id: { type: 'uuid' }, email: { type: 'text' }, encrypted_password: { type: 'text' }, email_confirmed_at: { type: 'datetime' }, phone: { type: 'text' }, raw_user_meta_data: { type: 'json' }, raw_app_meta_data: { type: 'json' }, last_sign_in_at: { type: 'datetime' }, banned_until: { type: 'datetime' }, created_at: { type: 'datetime' }, updated_at: { type: 'datetime' }, deleted_at: { type: 'datetime' } }, fks: [] }
const STORAGE_META = { pk: ['id'], columns: { id: { type: 'uuid' }, bucket_id: { type: 'text' }, name: { type: 'text' }, owner: { type: 'uuid' }, mime_type: { type: 'text' }, size_bytes: { type: 'int' }, metadata: { type: 'json' }, created_at: { type: 'datetime' }, updated_at: { type: 'datetime' } }, fks: [] }

// Ordem: pais antes dos filhos (auth_users primeiro por causa de profiles.id → auth_users.id)
function orderedTables() {
  const names = Object.keys(meta.tables)
  const seen = new Set(), out = []
  const visit = (t, stack = new Set()) => {
    if (seen.has(t) || stack.has(t)) return
    stack.add(t)
    for (const fk of meta.tables[t].fks) if (fk.refTable !== t && meta.tables[fk.refTable]) visit(fk.refTable, stack)
    seen.add(t); out.push(t)
  }
  names.forEach((t) => visit(t))
  return ['auth_users', ...out, 'storage_objects']
}
const tmeta = (t) => (t === 'auth_users' ? AUTH_META : t === 'storage_objects' ? STORAGE_META : meta.tables[t])
const writableCols = (t) => Object.entries(tmeta(t).columns).filter(([, c]) => !c.generated && !c.internal).map(([n]) => n)

// ── ligações ────────────────────────────────────────────────────────────────
// datas, json e int8 chegam como texto exato (preserva microssegundos e precisão)
for (const oid of [1082, 1114, 1184, 114, 3802, 20, 1700]) pg.types.setTypeParser(oid, (v) => v)

async function pgConnect() {
  const url = process.env.SOURCE_DATABASE_URL
  if (!url) throw new Error('SOURCE_DATABASE_URL não definida')
  const c = new pg.Client({ connectionString: url, ssl: /supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : undefined })
  await c.connect()
  await c.query("SET TIME ZONE 'UTC'")
  AUTH_SRC_COLS = new Set((await c.query("select column_name from information_schema.columns where table_schema='auth' and table_name='users'")).rows.map((r) => r.column_name))
  return c
}
let AUTH_SRC_COLS = new Set()
async function myConnect() {
  if (process.env.MYSQL_PASSWORD === undefined) throw new Error('MYSQL_PASSWORD não definida')
  const c = await mysql.createConnection({
    host: process.env.MYSQL_SOCKET ? undefined : process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306),
    socketPath: process.env.MYSQL_SOCKET || undefined, database: process.env.MYSQL_DATABASE || 'viralizahost_viralizaHost',
    user: process.env.MYSQL_USER || 'viralizahost_userViralizaHost', password: process.env.MYSQL_PASSWORD,
    charset: 'utf8mb4_unicode_ci', timezone: 'Z', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, decimalNumbers: false,
  })
  await c.query("SET time_zone = '+00:00', sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")
  return c
}
const qi = (s) => '`' + s.replace(/`/g, '``') + '`'
const pq = (s) => '"' + s.replace(/"/g, '""') + '"'

function srcRef(t) {
  if (t === 'auth_users') return 'auth.users'
  if (t === 'storage_objects') return 'storage.objects'
  return `${pq(SCHEMA)}.${pq(t)}`
}
function srcSelect(t) {
  if (t === 'auth_users') {
    const c = (n) => (AUTH_SRC_COLS.has(n) ? pq(n) : `NULL AS ${pq(n)}`)
    return `SELECT id, lower(email) AS email, ${['encrypted_password', 'email_confirmed_at', 'phone', 'raw_user_meta_data', 'raw_app_meta_data', 'last_sign_in_at', 'banned_until', 'created_at', 'updated_at', 'deleted_at'].map(c).join(', ')} FROM auth.users`
  }
  if (t === 'storage_objects') return `SELECT id, bucket_id, name, owner, metadata->>'mimetype' AS mime_type, (metadata->>'size')::bigint AS size_bytes, metadata, created_at, updated_at FROM storage.objects`
  return `SELECT ${writableCols(t).map(pq).join(', ')} FROM ${srcRef(t)}`
}

// ── conversão PG → MariaDB ─────────────────────────────────────────────────
const OLD_STORAGE = process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/` : null
const NEW_STORAGE = `${(process.env.NEW_SITE_URL || 'https://viralizahost.com').replace(/\/$/, '')}/storage/v1/object/public/`
const rewrite = (s) => (OLD_STORAGE && typeof s === 'string' && s.includes(OLD_STORAGE) ? s.split(OLD_STORAGE).join(NEW_STORAGE) : s)

function pgTsToMy(v) {
  // '2026-07-01 10:00:00.123456+00' → '2026-07-01 10:00:00.123456'
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2}(?::?\d{2})?)?$/)
  if (!m) throw new Error(`timestamp inesperado: ${v}`)
  if (m[4] && !/^[+-]00(:?00)?$/.test(m[4])) throw new Error(`timestamp fora de UTC: ${v} (a sessão deve estar em UTC)`)
  return `${m[1]} ${m[2]}${(m[3] ?? '.0').padEnd(7, '0').slice(0, 7)}`
}
function toMy(col, v) {
  if (v === null || v === undefined) return null
  switch (col.type) {
    case 'datetime': return pgTsToMy(v)
    case 'date': return String(v).slice(0, 10)
    case 'bool': return v ? 1 : 0
    case 'json': return rewrite(typeof v === 'string' ? v : JSON.stringify(v))
    case 'array': return rewrite(JSON.stringify(v))
    default: return rewrite(v)
  }
}
// ── conversão MariaDB → PG (regresso) ──────────────────────────────────────
function toPg(col, v) {
  if (v === null || v === undefined) return null
  switch (col.type) {
    case 'datetime': return `${String(v).replace(' ', 'T')}Z`
    case 'bool': return v === 1 || v === '1' || v === true
    case 'array': return JSON.parse(v)
    case 'json': return typeof v === 'string' ? v : JSON.stringify(v)
    default: return v
  }
}

// forma canónica para comparar linhas entre as duas bases
function canon(col, v, side) {
  if (v === null || v === undefined) return null
  switch (col.type) {
    case 'datetime': return side === 'pg' ? pgTsToMy(v) : String(v).padEnd(26, '0')
    case 'date': return String(v).slice(0, 10)
    case 'bool': return side === 'pg' ? (v ? 1 : 0) : Number(v)
    case 'decimal': case 'float': case 'int': return String(Number(v))
    case 'json': { const o = typeof v === 'string' ? JSON.parse(side === 'pg' ? rewrite(v) : v) : v; return JSON.stringify(sortKeys(o)) }
    case 'array': return JSON.stringify(side === 'pg' ? JSON.parse(rewrite(JSON.stringify(v))) : JSON.parse(v))
    default: return side === 'pg' ? rewrite(String(v)) : String(v)
  }
}
const sortKeys = (o) => (Array.isArray(o) ? o.map(sortKeys) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, sortKeys(o[k])])) : o)
const rowHash = (t, r, side) => createHash('sha1').update(JSON.stringify(writableCols(t).map((c) => canon(tmeta(t).columns[c], r[c], side)))).digest('hex')

async function srcExists(pgc, t) {
  const [s, n] = t === 'auth_users' ? ['auth', 'users'] : t === 'storage_objects' ? ['storage', 'objects'] : [SCHEMA, t]
  return (await pgc.query('select 1 from information_schema.tables where table_schema=$1 and table_name=$2', [s, n])).rowCount > 0
}
async function srcColumns(pgc, t) {
  const [s, n] = t === 'auth_users' ? ['auth', 'users'] : t === 'storage_objects' ? ['storage', 'objects'] : [SCHEMA, t]
  return new Set((await pgc.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2', [s, n])).rows.map((r) => r.column_name))
}
function sinceClause(t, cols) {
  if (!SINCE) return ''
  const c = ['updated_at', 'created_at', 'last_synced_at'].filter((x) => cols.has(x))
  if (t === 'auth_users') c.push('last_sign_in_at')
  if (!c.length) return ''
  return ` WHERE (${c.map((x) => `${pq(x)} >= $1`).join(' OR ')})`
}

// ═══ preflight ═══════════════════════════════════════════════════════════════
async function preflight() {
  const pgc = await pgConnect(), my = await myConnect()
  console.log('── Origem (PostgreSQL) ──')
  const schemas = (await pgc.query(`select table_schema, count(*)::int n from information_schema.tables where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema') group by 1 order by 1`)).rows
  schemas.forEach((s) => console.log(`  schema ${s.table_schema}: ${s.n} tabelas`))
  const pub = (await pgc.query(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`)).rows.map((r) => r.table_name)
  if (pub.length) console.log(`  ⚠ tabelas em public (não usadas pela aplicação; ficam no backup pg_dump): ${pub.join(', ')}`)
  const srcTables = (await pgc.query(`select table_name from information_schema.tables where table_schema=$1 and table_type='BASE TABLE'`, [SCHEMA])).rows.map((r) => r.table_name)
  const missing = srcTables.filter((t) => !meta.tables[t])
  if (missing.length) console.log(`  ⚠ tabelas na origem sem destino no schema MariaDB: ${missing.join(', ')}`)
  const fns = (await pgc.query(`select n.nspname||'.'||p.proname f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public',$1) and p.prokind='f' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') order by 1`, [SCHEMA])).rows.map((r) => r.f)
  console.log(`  funções: ${fns.join(', ')}`)
  const hooks = await pgc.query(`select 1 from information_schema.tables where table_schema='supabase_functions' and table_name='hooks'`).then((r) => r.rowCount).catch(() => 0)
  if (hooks) console.log('  ⚠ existem Database Webhooks (supabase_functions.hooks) — rever no painel Supabase')
  const cron = await pgc.query(`select jobname, schedule, command from cron.job`).then((r) => r.rows).catch(() => [])
  cron.forEach((j) => console.log(`  ⚠ pg_cron: ${j.jobname} ${j.schedule} ${j.command}`))
  const buckets = await pgc.query('select id, public from storage.buckets').then((r) => r.rows).catch(() => [])
  console.log(`  buckets: ${buckets.map((b) => `${b.id}${b.public ? ' (público)' : ' (privado)'}`).join(', ')}`)

  console.log('\n── Tabela | origem | destino | observações ──')
  let issues = 0
  for (const t of orderedTables()) {
    const has = await srcExists(pgc, t)
    const src = has ? Number((await pgc.query(`select count(*) c from ${srcRef(t)}`)).rows[0].c) : null
    const dst = Number((await my.query(`SELECT COUNT(*) c FROM ${qi(t)}`))[0][0].c)
    const notes = []
    if (has && t !== 'auth_users' && t !== 'storage_objects') {
      const cols = await srcColumns(pgc, t)
      const extra = [...cols].filter((c) => !tmeta(t).columns[c])
      if (extra.length) { notes.push(`colunas só na origem: ${extra.join(',')}`); issues++ }
      // unicidade case-insensitive (colação utf8mb4_unicode_ci do destino)
      for (const u of meta.tables[t].uniques) {
        const textCols = u.filter((c) => ['text', 'enum'].includes(tmeta(t).columns[c]?.type))
        if (!textCols.length) continue
        const expr = u.map((c) => (textCols.includes(c) ? `lower(${pq(c)}::text)` : pq(c))).join(', ')
        const d = (await pgc.query(`select count(*) c from (select ${expr} from ${srcRef(t)} where ${u.map((c) => `${pq(c)} is not null`).join(' and ')} group by ${expr} having count(*) > 1) x`)).rows[0].c
        if (Number(d) > 0) { notes.push(`⚠ ${d} duplicado(s) ignorando maiúsculas em (${u.join(',')})`); issues++ }
      }
    }
    if (t === 'auth_users' && has) {
      const r = (await pgc.query(`select count(*) filter (where encrypted_password is null or encrypted_password='') sem_pw, count(*) filter (where encrypted_password !~ '^\\$2[aby]\\$') outro_hash from auth.users`)).rows[0]
      if (Number(r.sem_pw)) notes.push(`${r.sem_pw} conta(s) sem palavra-passe (OAuth/convite) → precisam de recuperar a palavra-passe`)
      if (Number(r.outro_hash) - Number(r.sem_pw) > 0) notes.push(`⚠ ${Number(r.outro_hash) - Number(r.sem_pw)} hash(es) não-bcrypt`)
      const ids = await pgc.query(`select provider, count(*) c from auth.identities group by 1`).then((x) => x.rows).catch(() => [])
      if (ids.length) notes.push(`identities: ${ids.map((i) => `${i.provider}=${i.c}`).join(' ')}`)
    }
    if (dst > 0) notes.push('destino já tem dados → serão atualizados por chave primária (sem duplicar)')
    console.log(`  ${t.padEnd(26)} ${String(src ?? '—').padStart(7)} ${String(dst).padStart(8)}  ${notes.join('; ')}`)
  }
  console.log(issues ? `\n${issues} aviso(s) a rever antes da importação.` : '\nSem bloqueios.')
  await pgc.end(); await my.end()
}

// ═══ copy ════════════════════════════════════════════════════════════════════
async function cutoverAt(my) {
  const [r] = await my.query("SELECT last_run_at FROM migration_state WHERE table_name = '__cutover__' AND direction = 'cutover'")
  return r[0]?.last_run_at ?? null
}

async function markCutover() {
  const my = await myConnect()
  await my.query("INSERT INTO migration_state (table_name, direction, last_run_at, notes) VALUES ('__cutover__', 'cutover', UTC_TIMESTAMP(6), 'troca Supabase → MariaDB') ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at)")
  console.log(`✔ troca registada em ${await cutoverAt(my)} UTC`)
  await my.end()
}

async function copy() {
  const pgc = await pgConnect(), my = await myConnect()
  const cut = await cutoverAt(my)
  if (cut && flag('--sync-deletes')) throw new Error(`a troca já foi feita (${cut} UTC): --sync-deletes apagaria registos criados no MariaDB. Recusado.`)
  if (cut && !flag('--force')) throw new Error(`a troca já foi feita (${cut} UTC): a cópia Supabase → MariaDB sobrescreveria alterações feitas no MariaDB. Use --force se tiver a certeza.`)
  await my.query('SET FOREIGN_KEY_CHECKS = 0')
  const tables = orderedTables().filter((t) => !ONLY || ONLY.includes(t))
  for (const t of tables) {
    if (!(await srcExists(pgc, t))) { console.log(`- ${t}: não existe na origem, ignorada`); continue }
    const m = tmeta(t)
    const srcCols = t === 'auth_users' || t === 'storage_objects' ? new Set(Object.keys(m.columns)) : await srcColumns(pgc, t)
    const cols = writableCols(t).filter((c) => srcCols.has(c))
    const pk = m.pk[0]
    const where = sinceClause(t, t === 'auth_users' ? new Set(['updated_at', 'created_at']) : srcCols)
    const params = SINCE ? [SINCE] : []
    const base = `SELECT * FROM (${srcSelect(t)}) s${where}`
    const total = Number((await pgc.query(`SELECT count(*) c FROM (${base}) x`, params)).rows[0].c)
    const upd = cols.filter((c) => c !== pk).map((c) => `${qi(c)} = VALUES(${qi(c)})`).join(', ') || `${qi(pk)} = ${qi(pk)}`
    const sqlIns = `INSERT INTO ${qi(t)} (${cols.map(qi).join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${upd}`
    let last = null, done = 0
    process.stdout.write(`- ${t}: 0/${total}`)
    for (;;) {
      const rows = (await pgc.query(`${base}${where ? ' AND' : ' WHERE'} ${last === null ? 'TRUE' : `${pq(pk)}::text > $${params.length + 1}`} ORDER BY ${pq(pk)}::text LIMIT ${BATCH}`, last === null ? params : [...params, last])).rows
      if (!rows.length) break
      const values = rows.map((r) => cols.map((c) => toMy(m.columns[c], r[c])))
      await my.beginTransaction()
      try { await my.query(sqlIns, [values]); await my.commit() } catch (e) { await my.rollback(); throw new Error(`${t}: ${e.message}`) }
      last = String(rows[rows.length - 1][pk]); done += rows.length
      process.stdout.write(`\r- ${t}: ${done}/${total}`)
    }
    if (flag('--sync-deletes')) {
      // apaga no destino o que já não existe na origem (necessário na sincronização final)
      const srcIds = new Set((await pgc.query(`SELECT ${pq(pk)}::text k FROM ${srcRef(t)}`)).rows.map((r) => r.k))
      const dstIds = (await my.query(`SELECT ${qi(pk)} k FROM ${qi(t)}`))[0].map((r) => String(r.k))
      const gone = dstIds.filter((k) => !srcIds.has(k))
      for (let i = 0; i < gone.length; i += 500) await my.query(`DELETE FROM ${qi(t)} WHERE ${qi(pk)} IN (?)`, [gone.slice(i, i + 500)])
      if (gone.length) process.stdout.write(` | ${gone.length} apagada(s) no destino`)
    }
    await my.query(`INSERT INTO migration_state (table_name, direction, last_run_at, last_watermark, rows_copied) VALUES (?, 'pg_to_mysql', UTC_TIMESTAMP(6), ?, ?)
      ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at), last_watermark = VALUES(last_watermark), rows_copied = rows_copied + VALUES(rows_copied)`, [t, SINCE ? SINCE.replace('T', ' ').replace(/Z$/, '') : null, done])
    process.stdout.write('\n')
  }
  await my.query('SET FOREIGN_KEY_CHECKS = 1')
  console.log('✔ cópia concluída. Execute "verify" a seguir.')
  await pgc.end(); await my.end()
}

// ═══ files ═══════════════════════════════════════════════════════════════════
async function files() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ''), key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  const root = process.env.STORAGE_ROOT || '/var/www/viralizahost-storage'
  const pgc = await pgConnect()
  const objs = (await pgc.query(`select bucket_id, name, (metadata->>'size')::bigint size from storage.objects order by bucket_id, name`)).rows
  let ok = 0, skip = 0, fail = 0
  for (const o of objs) {
    const dest = join(root, o.bucket_id, o.name)
    if (existsSync(dest) && (!o.size || statSync(dest).size === Number(o.size))) { skip++; continue }
    const res = await fetch(`${url}/storage/v1/object/authenticated/${o.bucket_id}/${o.name.split('/').map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } })
    if (!res.ok) { fail++; console.log(`  ✗ ${o.bucket_id}/${o.name}: HTTP ${res.status}`); continue }
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
    ok++
    if ((ok + skip) % 25 === 0) console.log(`  … ${ok + skip}/${objs.length}`)
  }
  console.log(`✔ ficheiros: ${ok} descarregado(s), ${skip} já existiam, ${fail} falha(s) → ${root}`)
  console.log('  Garanta: chown -R <utilizador do PM2> e chmod 750 no diretório.')
  await pgc.end()
  if (fail) process.exitCode = 1
}

// ═══ verify ══════════════════════════════════════════════════════════════════
async function verify() {
  const pgc = await pgConnect(), my = await myConnect()
  let bad = 0
  console.log('Tabela                      origem  destino  hash  observações')
  for (const t of orderedTables().filter((x) => !ONLY || ONLY.includes(x))) {
    if (!(await srcExists(pgc, t))) continue
    const m = tmeta(t)
    const notes = []
    const srcRows = (await pgc.query(srcSelect(t))).rows
    const dstRows = (await my.query(`SELECT * FROM ${qi(t)}`))[0]
    const pk = m.pk[0]
    // hash por linha (todas as colunas, forma canónica)
    const srcCols = t === 'auth_users' || t === 'storage_objects' ? null : await srcColumns(pgc, t)
    const cols = writableCols(t).filter((c) => !srcCols || srcCols.has(c))
    const h = (r, side) => createHash('sha1').update(JSON.stringify(cols.map((c) => canon(m.columns[c], r[c], side)))).digest('hex')
    const sMap = new Map(srcRows.map((r) => [String(r[pk]), h(r, 'pg')]))
    const dMap = new Map(dstRows.map((r) => [String(r[pk]), h(r, 'my')]))
    let diff = 0, missing = 0, extra = 0
    for (const [k, v] of sMap) { if (!dMap.has(k)) missing++; else if (dMap.get(k) !== v) diff++ }
    for (const k of dMap.keys()) if (!sMap.has(k)) extra++
    if (missing) notes.push(`${missing} em falta no destino`)
    if (diff) notes.push(`${diff} com conteúdo diferente`)
    if (extra) notes.push(`${extra} só no destino (criadas após a cópia?)`)
    // totais financeiros (todas as colunas DECIMAL), comparação exata
    for (const [c, cm] of Object.entries(m.columns)) {
      if (cm.type !== 'decimal' || (srcCols && !srcCols.has(c))) continue
      const s = (await pgc.query(`select coalesce(sum(${pq(c)}),0)::text v from ${srcRef(t)}`)).rows[0].v
      const d = String((await my.query(`SELECT COALESCE(SUM(${qi(c)}),0) v FROM ${qi(t)}`))[0][0].v)
      const nd = (x) => (x.includes('.') ? x.replace(/0+$/, '').replace(/\.$/, '') : x)
      if (nd(s) !== nd(d)) notes.push(`Σ${c} ${s} ≠ ${d}`)
      else if (['total', 'amount', 'amount_paid', 'price', 'subtotal', 'credit_balance', 'unit_price'].includes(c)) notes.push(`Σ${c}=${d}`)
    }
    // relações órfãs no destino
    for (const fk of m.fks ?? []) {
      const [r] = await my.query(`SELECT COUNT(*) c FROM ${qi(t)} x LEFT JOIN ${qi(fk.refTable)} p ON p.${qi(fk.refColumns[0])} = x.${qi(fk.columns[0])} WHERE x.${qi(fk.columns[0])} IS NOT NULL AND p.${qi(fk.refColumns[0])} IS NULL`)
      if (Number(r[0].c)) notes.push(`⚠ ${r[0].c} órfã(s) ${fk.columns[0]}→${fk.refTable}`)
    }
    const okRow = !missing && !diff && !notes.some((n) => n.includes('≠') || n.includes('órfã'))
    if (!okRow) bad++
    console.log(`${okRow ? '✔' : '✗'} ${t.padEnd(26)} ${String(srcRows.length).padStart(6)} ${String(dstRows.length).padStart(8)}  ${okRow ? 'igual' : 'DIF  '}  ${notes.join('; ')}`)
  }
  // acentos: amostra textual
  const [acc] = await my.query("SELECT COUNT(*) c FROM profiles WHERE full_name REGEXP '[ÀÁÂÃÇÉÊÍÓÔÕÚàáâãçéêíóôõú]'")
  console.log(`\nPerfis com acentos no destino: ${acc[0].c} (comparar com a origem; o hash acima já valida o texto exato).`)
  console.log(bad ? `\n✗ ${bad} tabela(s) com diferenças.` : '\n✔ Origem e destino coincidem.')
  if (bad) process.exitCode = 1
  await pgc.end(); await my.end()
}

// ═══ reverse (regresso ao Supabase) ══════════════════════════════════════════
async function reverse() {
  const pgc = await pgConnect(), my = await myConnect()
  if (!SINCE && !flag('--all')) {
    const cut = await cutoverAt(my)
    if (!cut) throw new Error('Indique --since <ISO> (ou execute mark-cutover na troca, ou use --all)')
    SINCE = `${String(cut).replace(' ', 'T').slice(0, 19)}Z`
    console.log(`→ a usar a hora da troca: ${SINCE}`)
  }
  await pgc.query('BEGIN')
  // Desativa triggers durante a carga se o papel o permitir; caso contrário a ordem pais→filhos
  // garante as FKs e os triggers do Supabase (updated_at, handle_new_user) são inofensivos.
  await pgc.query('SAVEPOINT srr')
  try { await pgc.query("SET LOCAL session_replication_role = 'replica'") } catch { await pgc.query('ROLLBACK TO SAVEPOINT srr'); console.log('  (sem permissão para session_replication_role — triggers ativos)') }
  try {
    for (const t of orderedTables().filter((x) => !ONLY || ONLY.includes(x))) {
      if (t === 'storage_objects') continue // ficheiros tratados abaixo, pela API do Storage
      if (!(await srcExists(pgc, t))) continue
      const m = tmeta(t)
      const pgCols = t === 'auth_users' ? new Set(AUTH_COLS.filter((c) => AUTH_SRC_COLS.has(c))) : await srcColumns(pgc, t)
      const cols = writableCols(t).filter((c) => pgCols.has(c))
      const tc = ['updated_at', 'created_at', 'last_synced_at'].filter((c) => m.columns[c])
      const where = SINCE && tc.length ? ` WHERE ${tc.map((c) => `${qi(c)} >= ?`).join(' OR ')}` : ''
      const rows = (await my.query(`SELECT ${cols.map(qi).join(', ')} FROM ${qi(t)}${where}`, SINCE ? tc.map(() => SINCE.replace('T', ' ').replace(/Z$/, '')) : []))[0]
      if (!rows.length) continue
      const target = t === 'auth_users' ? 'auth.users' : `${pq(SCHEMA)}.${pq(t)}`
      for (const r of rows) {
        const vals = cols.map((c) => (t === 'auth_users' && c === 'encrypted_password' && r[c] ? String(r[c]).replace(/^\$2b\$/, '$2a$') : toPg(m.columns[c], r[c])))
        const ph = cols.map((c, i) => {
          const ty = m.columns[c].type
          return ty === 'json' ? `$${i + 1}::jsonb` : `$${i + 1}`
        })
        const extraCols = t === 'auth_users' ? `, instance_id, aud, role` : ''
        const extraVals = t === 'auth_users' ? `, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'` : ''
        await pgc.query(`INSERT INTO ${target} (${cols.map(pq).join(', ')}${extraCols}) VALUES (${ph.join(', ')}${extraVals})
          ON CONFLICT (${pq(m.pk[0])}) DO UPDATE SET ${cols.filter((c) => c !== m.pk[0]).map((c) => `${pq(c)} = EXCLUDED.${pq(c)}`).join(', ')}`, vals)
        if (t === 'auth_users') {
          // o GoTrue exige uma identidade "email" para o login por palavra-passe
          await pgc.query(`INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
            SELECT gen_random_uuid(), $1::uuid, $1::text, 'email', jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true), now(), now(), now()
            WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = $1::uuid AND provider = 'email')`, [r.id, r.email])
        }
      }
      console.log(`- ${t}: ${rows.length} linha(s) enviadas para o Supabase`)
    }
    await pgc.query('COMMIT')
  } catch (e) { await pgc.query('ROLLBACK'); throw e }

  // ficheiros novos/alterados → Supabase Storage
  const url = process.env.SUPABASE_URL?.replace(/\/$/, ''), key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const root = process.env.STORAGE_ROOT || '/var/www/viralizahost-storage'
  if (url && key) {
    const objs = (await my.query(`SELECT bucket_id, name, mime_type FROM storage_objects${SINCE ? ' WHERE updated_at >= ?' : ''}`, SINCE ? [SINCE.replace('T', ' ').replace(/Z$/, '')] : []))[0]
    for (const o of objs) {
      const p = join(root, o.bucket_id, o.name)
      if (!existsSync(p)) continue
      const res = await fetch(`${url}/storage/v1/object/${o.bucket_id}/${o.name.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': o.mime_type || 'application/octet-stream', 'x-upsert': 'true' },
        body: readFileSync(p),
      })
      console.log(`  ${res.ok ? '✔' : '✗'} ficheiro ${o.bucket_id}/${o.name}${res.ok ? '' : ` HTTP ${res.status}`}`)
    }
  } else console.log('  (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não definidos: ficheiros não enviados)')
  console.log('✔ regresso concluído. Repor as variáveis Supabase e o código anterior, e reiniciar o PM2.')
  await pgc.end(); await my.end()
}

const cmds = { preflight, copy, files, verify, reverse, 'mark-cutover': markCutover }
if (!cmds[cmd]) {
  console.log('Uso: node scripts/mariadb/migrate-data.mjs <preflight|copy|files|verify|mark-cutover|reverse> [opções]')
  process.exit(1)
}
cmds[cmd]().catch((e) => { console.error('✗', e.message); process.exit(1) })
void createReadStream; void rowHash
