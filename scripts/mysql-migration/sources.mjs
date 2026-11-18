/*
 * Fontes de dados da migração.
 *
 *   PgSource        ligação direta ao PostgreSQL do Supabase (SOURCE_PG_URL — requer a senha da base)
 *   SnapshotSource  ficheiros JSON gerados por exportRest() — requer apenas o URL do Supabase e a
 *                   SUPABASE_SERVICE_ROLE_KEY que o site já usa (.env.local). O snapshot serve também de backup.
 *
 * Ambas devolvem os valores no mesmo formato normalizado:
 *   datetime → "YYYY-MM-DD HH:MM:SS.ffffff" em UTC · numeric/bigint → texto exato · enum → texto · json/array → objetos
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { SCHEMA, PG_SCHEMA, pgTsToUtc, sumDecimals, pqi, qi, writableCols, hashRow } from './common.mjs'

const keyOf = (row, cols) => JSON.stringify(cols.map(c => (row[c] === null || row[c] === undefined ? null : String(row[c]))))
const cmpKeys = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1 } return 0 }

/* ─── PostgreSQL direto ─────────────────────────────────────────────────── */
export class PgSource {
  kind = 'pg'
  constructor(client) { this.c = client }
  async q(sql, params = []) { return (await this.c.query(sql, params)).rows }
  sel(t, cols) {
    return cols.map(c => {
      const k = SCHEMA[t].columns[c].kind
      return k === 'datetime' ? `to_char(${pqi(c)} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS ${pqi(c)}`
        : k === 'enum' ? `${pqi(c)}::text AS ${pqi(c)}` : pqi(c)
    }).join(', ')
  }
  async columns() {
    return (await this.q('SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1', [PG_SCHEMA]))
  }
  async count(t) { return Number((await this.q(`SELECT count(*)::bigint AS n FROM ${pqi(t)}`))[0].n) }
  async maxCharLen(t, c) { const r = await this.q(`SELECT max(char_length(${pqi(c)}::text)) AS m FROM ${pqi(t)}`); return r[0].m == null ? null : Number(r[0].m) }
  async distinct(t, c) { return (await this.q(`SELECT DISTINCT ${pqi(c)}::text AS v FROM ${pqi(t)} WHERE ${pqi(c)} IS NOT NULL`)).map(r => r.v) }
  async datesOutOfRange(t, c) { return Number((await this.q(`SELECT count(*)::int AS n FROM ${pqi(t)} WHERE ${pqi(c)} < '1000-01-01' OR ${pqi(c)} > '9999-12-31'`))[0].n) }
  async batch(t, cols, lastKey, limit) {
    const pk = SCHEMA[t].pk
    const params = []; let where = ''
    if (lastKey) { where = `WHERE (${pk.map(c => `${pqi(c)}::text`).join(', ')}) > (${pk.map((_, i) => `$${i + 1}`).join(', ')})`; params.push(...lastKey) }
    return this.q(`SELECT ${this.sel(t, cols)} FROM ${pqi(t)} ${where} ORDER BY ${pk.map(c => `${pqi(c)}::text`).join(', ')} LIMIT ${limit}`, params)
  }
  async pkList(t) { const pk = SCHEMA[t].pk; return (await this.q(`SELECT ${pk.map(c => `${pqi(c)}::text AS ${pqi(c)}`).join(', ')} FROM ${pqi(t)}`)).map(r => pk.map(c => r[c])) }
  async allRows(t, cols) { return this.q(`SELECT ${this.sel(t, cols)} FROM ${pqi(t)}`) }
  async orphans(t, f) {
    const on = f.cols.map((c, i) => `p.${pqi(f.refCols[i])} = c.${pqi(c)}`).join(' AND ')
    return Number((await this.q(`SELECT count(*)::int AS n FROM ${pqi(t)} c LEFT JOIN ${pqi(f.refTable)} p ON ${on} WHERE ${f.cols.map(c => `c.${pqi(c)} IS NOT NULL`).join(' AND ')} AND p.${pqi(f.refCols[0])} IS NULL`))[0].n)
  }
  async sums(t, dec, groupCols) {
    const sel = [...groupCols.map(c => `${pqi(c)}::text AS ${pqi(c)}`), ...dec.map(c => `COALESCE(SUM(${pqi(c)}), 0)::text AS ${pqi(c)}`)]
    return this.q(`SELECT ${sel.join(', ')} FROM ${pqi(t)}${groupCols.length ? ' GROUP BY ' + groupCols.map(pqi).join(', ') : ''}`)
  }
  async end() { await this.c.end() }
}

/* ─── Snapshot JSON (exportado pela API REST do Supabase) ──────────────── */
function normalizeRestRow(t, row) {
  const out = {}
  for (const [c, v] of Object.entries(row)) {
    const m = SCHEMA[t]?.columns[c]
    if (!m || v === null || v === undefined) { out[c] = v ?? null; continue }
    if (m.kind === 'datetime') out[c] = pgTsToUtc(String(v))
    else if (['decimal', 'bigint'].includes(m.kind)) out[c] = String(v)
    else out[c] = v
  }
  return out
}

export class SnapshotSource {
  kind = 'snapshot'
  constructor(dir) {
    if (!existsSync(join(dir, 'manifest.json'))) throw new Error(`Snapshot inválido: ${dir}/manifest.json não existe (execute primeiro "export")`)
    this.dir = dir
    this.manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
    this.cache = new Map()
  }
  rows(t) {
    if (!this.cache.has(t)) {
      const f = join(this.dir, `${t}.json`)
      const raw = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : []
      const pk = SCHEMA[t].pk
      const rows = raw.map(r => normalizeRestRow(t, r))
      rows.sort((a, b) => cmpKeys(pk.map(c => String(a[c])), pk.map(c => String(b[c]))))
      this.cache.set(t, rows)
    }
    return this.cache.get(t)
  }
  async columns() {
    return Object.entries(this.manifest.tables).flatMap(([t, info]) => info.columns.map(c => ({ table_name: t, column_name: c })))
      .concat((this.manifest.extraTables ?? []).map(t => ({ table_name: t, column_name: '?' })))
  }
  async count(t) { return this.rows(t).length }
  async maxCharLen(t, c) {
    let m = null
    for (const r of this.rows(t)) if (r[c] != null) { const n = [...(typeof r[c] === 'object' ? JSON.stringify(r[c]) : String(r[c]))].length; if (m === null || n > m) m = n }
    return m
  }
  async distinct(t, c) { return [...new Set(this.rows(t).map(r => r[c]).filter(v => v != null).map(String))] }
  async datesOutOfRange(t, c) { return this.rows(t).filter(r => r[c] != null && !/^[1-9]\d{3}-/.test(r[c])).length }
  async batch(t, cols, lastKey, limit) {
    const pk = SCHEMA[t].pk
    const all = this.rows(t)
    const start = lastKey ? all.findIndex(r => cmpKeys(pk.map(c => String(r[c])), lastKey) > 0) : 0
    if (start < 0) return []
    return all.slice(start, start + limit).map(r => Object.fromEntries(cols.map(c => [c, r[c] ?? null])))
  }
  async pkList(t) { const pk = SCHEMA[t].pk; return this.rows(t).map(r => pk.map(c => String(r[c]))) }
  async allRows(t, cols) { return this.rows(t).map(r => Object.fromEntries(cols.map(c => [c, r[c] ?? null]))) }
  async orphans(t, f) {
    if (!this.manifest.tables[f.refTable]) return 0
    const parents = new Set(this.rows(f.refTable).map(r => keyOf(r, f.refCols)))
    return this.rows(t).filter(r => f.cols.every(c => r[c] != null) && !parents.has(keyOf(r, f.cols))).length
  }
  async sums(t, dec, groupCols) {
    const groups = new Map()
    for (const r of this.rows(t)) {
      const k = JSON.stringify(groupCols.map(c => r[c] ?? null))
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(r)
    }
    return [...groups.entries()].map(([k, rs]) => {
      const g = JSON.parse(k); const out = {}
      groupCols.forEach((c, i) => { out[c] = g[i] })
      for (const c of dec) out[c] = sumDecimals(rs.map(r => r[c]), SCHEMA[t].columns[c].scale)
      return out
    })
  }
  async end() {}
}

/* ─── API REST do Supabase (PostgREST) ──────────────────────────────────── */
export function restConfig() {
  const base = process.env.SUPABASE_REST_URL ?? (process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/rest/v1` : null)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (estão no .env.local do site).')
  return { base, key }
}

async function rest(cfg, path, init = {}) {
  const headers = { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Accept-Profile': PG_SCHEMA, 'Content-Profile': PG_SCHEMA, ...(init.headers ?? {}) }
  for (let attempt = 1; ; attempt++) {
    let res
    try { res = await fetch(`${cfg.base}${path}`, { ...init, headers }) }
    catch (e) { if (attempt < 4) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue } throw new Error(`Falha de rede (${path}): ${e.message}`) }
    if (res.status >= 500 && attempt < 4) { await new Promise(r => setTimeout(r, 1000 * attempt)); continue }
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}: ${(await res.text()).slice(0, 300)}`)
    return res
  }
}

/** Exporta todas as tabelas do schema viralizahost para <dir>/*.json (+ manifest.json). */
export async function exportRest(dir, only) {
  const cfg = restConfig()
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  // Colunas existentes na origem (definições OpenAPI do PostgREST)
  let defs = {}
  try { defs = (await (await rest(cfg, '/', { headers: { Accept: 'application/openapi+json' } })).json()).definitions ?? {} }
  catch (e) { console.warn('  aviso: não foi possível ler a descrição da API (OpenAPI):', e.message) }
  const manifest = { exportedAt: new Date().toISOString(), source: new URL(cfg.base).host, schema: PG_SCHEMA, tables: {}, extraTables: Object.keys(defs).filter(t => !SCHEMA[t]) }
  const tables = Object.keys(SCHEMA).filter(t => !only || only.includes(t))
  for (const t of tables) {
    const meta = SCHEMA[t]
    let srcCols = defs[t] ? Object.keys(defs[t].properties ?? {}) : null
    if (!srcCols) {
      const probe = await (await rest(cfg, `/${t}?select=*&limit=1`)).json().catch(() => [])
      srcCols = probe[0] ? Object.keys(probe[0]) : Object.keys(meta.columns).filter(c => !meta.columns[c].internal)
    }
    // Valores exatos: numeric e bigint pedidos como texto
    const select = srcCols.map(c => (['decimal', 'bigint'].includes(meta.columns[c]?.kind) ? `${c}::text` : c)).join(',')
    const head = await rest(cfg, `/${t}?select=${meta.pk[0]}`, { headers: { Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' } })
    const expected = Number((head.headers.get('content-range') ?? '*/0').split('/')[1])
    const pk = meta.pk[0]
    const rows = []; let last = null
    for (;;) {
      const filter = last === null ? '' : `&${pk}=gt.${encodeURIComponent(last)}`
      const page = await (await rest(cfg, `/${t}?select=${select}&order=${pk}.asc${filter}&limit=1000`)).json()
      rows.push(...page)
      process.stdout.write(`\r  ${t}: ${rows.length}/${expected}   `)
      if (page.length < 1000) break
      last = page[page.length - 1][pk]
    }
    writeFileSync(join(dir, `${t}.json`), JSON.stringify(rows), { mode: 0o600 })
    manifest.tables[t] = { count: rows.length, expected, columns: srcCols }
    process.stdout.write(`\r  ${t}: ${rows.length} linhas${rows.length !== expected ? ` (a API indicava ${expected} — houve escritas durante a exportação)` : ''}\n`)
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 })
  const total = Object.values(manifest.tables).reduce((n, x) => n + x.count, 0)
  console.log(`Exportação concluída: ${total} linhas em ${tables.length} tabelas → ${dir}`)
  if (manifest.extraTables.length) console.log(`  aviso: tabelas na origem que não fazem parte do schema MySQL: ${manifest.extraTables.join(', ')}`)
}

/** Lê todas as linhas de uma tabela pela API (paginado pela chave primária), já normalizadas. */
async function fetchAllRest(cfg, t, cols) {
  const meta = SCHEMA[t]; const pk = meta.pk[0]
  const select = cols.map(c => (['decimal', 'bigint'].includes(meta.columns[c]?.kind) ? `${c}::text` : c)).join(',')
  const rows = []; let last = null
  for (;;) {
    const page = await (await rest(cfg, `/${t}?select=${select}&order=${pk}.asc${last === null ? '' : `&${pk}=gt.${encodeURIComponent(last)}`}&limit=1000`)).json()
    rows.push(...page); if (page.length < 1000) break; last = page[page.length - 1][pk]
  }
  return rows.map(r => normalizeRestRow(t, r))
}

/**
 * Rollback: copia MySQL → Supabase pela API REST. Só envia linhas novas ou alteradas (os triggers do Supabase
 * não podem ser desligados pela API: enviar tudo mudaria o updated_at de todos os registos). Linhas novas são
 * enviadas por ordem de created_at, para que o trigger dos tickets atribua os mesmos números que o MySQL.
 * --prune apaga no Supabase as linhas que já não existem no MySQL.
 */
export async function reverseRest(dst, t, { prune, batch = 500 }) {
  const cfg = restConfig()
  const meta = SCHEMA[t]; const cols = writableCols(t).filter(c => !meta.columns[c].internal); const pk = meta.pk
  const [myRows] = await dst.query(`SELECT ${cols.map(c => meta.columns[c].kind === 'datetime' ? `DATE_FORMAT(${qi(c)}, '%Y-%m-%d %H:%i:%s.%f') AS ${qi(c)}` : qi(c)).join(', ')} FROM ${qi(t)}`)
  const remote = await fetchAllRest(cfg, t, cols)
  const remoteHash = new Map(remote.map(r => [String(r[pk[0]]), hashRow(meta, cols, r)]))
  const changed = myRows.filter(r => remoteHash.get(String(r[pk[0]])) !== hashRow(meta, cols, r))
  const isNew = r => !remoteHash.has(String(r[pk[0]]))
  if (cols.includes('created_at')) changed.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  const toPg = r => Object.fromEntries(cols.map(c => {
    const k = meta.columns[c].kind; let v = r[c]
    if (v !== null && v !== undefined) {
      if (k === 'bool') v = Number(v) === 1
      else if (k === 'json' || k === 'array') v = typeof v === 'string' ? JSON.parse(v) : v
      else if (k === 'datetime') v = v.replace(' ', 'T') + '+00:00'
      else if (k === 'int') v = Number(v)
    }
    return [c, v ?? null]
  }))
  // novas uma a uma por ordem de criação (numeração dos tickets); alteradas em lotes
  const news = changed.filter(isNew), updates = changed.filter(r => !isNew(r))
  for (const r of news) await rest(cfg, `/${t}`, { method: 'POST', body: JSON.stringify(toPg(r)), headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' } })
  for (let i = 0; i < updates.length; i += batch) {
    await rest(cfg, `/${t}?on_conflict=${pk.join(',')}`, {
      method: 'POST', body: JSON.stringify(updates.slice(i, i + batch).map(toPg)),
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    })
  }
  let removed = 0
  if (prune) {
    const keep = new Set(myRows.map(r => String(r[pk[0]])))
    const gone = remote.map(r => String(r[pk[0]])).filter(k => !keep.has(k))
    for (let i = 0; i < gone.length; i += 100) {
      const list = gone.slice(i, i + 100).map(v => `"${v.replace(/"/g, '\\"')}"`).join(',')
      await rest(cfg, `/${t}?${pk[0]}=in.(${encodeURIComponent(list)})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    }
    removed = gone.length
  }
  if (news.length || updates.length || removed) console.log(`  ${t}: novas ${news.length}, alteradas ${updates.length}${prune ? `, removidas ${removed}` : ''}`)
  return { news: news.length, updates: updates.length, removed }
}
