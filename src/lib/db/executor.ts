import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
import { randomUUID, randomInt } from 'node:crypto'
import type { PoolConnection } from 'mysql2/promise'
import { schemaMeta } from './schema.generated'
import type { ColumnMeta, DbError, DbResult, Filter, OrderSpec, QueryDescriptor, TableMeta } from './types'
import { parseSelect, parseLogicTree, parseInList, type SelectNode, type ParsedCond } from './parse'
import { decodeValue, encodeFilterValue, encodeValue } from './codec'
import { getPool, withTransaction, type Conn } from './pool'
import { policyFor, type AuthCtx, type Frag } from './policies'

// ═══════════════════════════════════════════════════════════════════════════
// Executor: QueryDescriptor (API supabase-js) → SQL MariaDB parametrizado
// ═══════════════════════════════════════════════════════════════════════════

class DbFailure extends Error {
  constructor(public err: DbError, public status = 400) { super(err.message) }
}
const fail = (message: string, code = 'PGRST100', status = 400, details: string | null = null, hint: string | null = null): never => {
  throw new DbFailure({ message, code, details, hint }, status)
}

const qi = (s: string) => '`' + s.replace(/`/g, '``') + '`'

function tableMeta(table: string): TableMeta {
  const t = schemaMeta.tables[table]
  if (!t) fail(`Could not find the table 'public.${table}' in the schema cache`, 'PGRST205', 404)
  return t!
}

function columnMeta(table: string, column: string): ColumnMeta {
  const c = tableMeta(table).columns[column]
  if (!c || c.internal) fail(`column ${table}.${column} does not exist`, '42703')
  return c!
}

const visibleColumns = (t: TableMeta) => Object.entries(t.columns).filter(([, c]) => !c.internal).map(([n]) => n)

function pkOf(table: string): string {
  const pk = tableMeta(table).pk
  if (pk.length !== 1) fail(`Tabela ${table} sem chave primária simples`, 'PGRST000', 500)
  return pk[0]
}

// ── expressões de coluna (inclui caminhos JSON col->>chave) ───────────────
function colExpr(table: string, alias: string, ref: string): { sql: string; meta: ColumnMeta | undefined; jsonText: boolean } {
  const parts = ref.split(/(->>|->)/)
  const base = parts[0].trim()
  const meta = columnMeta(table, base)
  if (parts.length === 1) return { sql: `${alias}.${qi(base)}`, meta, jsonText: false }
  const path = ['$']
  let asText = false
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i + 1].trim().replace(/^'|'$/g, '')
    path.push(/^\d+$/.test(key) ? `[${key}]` : `.${JSON.stringify(key)}`)
    asText = parts[i] === '->>'
  }
  const p = path.join('').replace(/\$\.\[/g, '$[')
  const extract = `JSON_EXTRACT(${alias}.${qi(base)}, '${p.replace(/'/g, "''")}')`
  return { sql: asText ? `JSON_UNQUOTE(${extract})` : extract, meta: asText ? undefined : { type: 'json' }, jsonText: asText }
}

// ── compilação de condições ────────────────────────────────────────────────
function toJsonArray(v: unknown): string {
  if (Array.isArray(v)) return JSON.stringify(v)
  if (typeof v === 'string') {
    const s = v.trim()
    if (s.startsWith('{') && s.endsWith('}') && !s.includes(':')) return JSON.stringify(parseInList(`(${s.slice(1, -1)})`))
    return s
  }
  return JSON.stringify(v)
}

function compileCond(table: string, alias: string, column: string, op: string, value: unknown, negate: boolean, fromString: boolean): Frag {
  const { sql: c, meta } = colExpr(table, alias, column)
  const enc = (v: unknown) => encodeFilterValue(meta, v)
  let frag: Frag
  switch (op) {
    case 'eq':
      frag = value === null ? { sql: `${c} IS NULL`, params: [] } : { sql: `${c} = ?`, params: [enc(value)] }
      break
    case 'neq': frag = { sql: `${c} <> ?`, params: [enc(value)] }; break
    case 'gt': frag = { sql: `${c} > ?`, params: [enc(value)] }; break
    case 'gte': frag = { sql: `${c} >= ?`, params: [enc(value)] }; break
    case 'lt': frag = { sql: `${c} < ?`, params: [enc(value)] }; break
    case 'lte': frag = { sql: `${c} <= ?`, params: [enc(value)] }; break
    case 'like': {
      const pat = fromString ? String(value).replace(/\*/g, '%') : String(value)
      frag = { sql: `${c} LIKE BINARY ?`, params: [pat] }
      break
    }
    case 'ilike': {
      const pat = fromString ? String(value).replace(/\*/g, '%') : String(value)
      frag = { sql: `LOWER(${c}) LIKE LOWER(?)`, params: [pat] }
      break
    }
    case 'is': {
      const v = typeof value === 'string' ? value.toLowerCase() : value
      if (v === null || v === 'null') frag = { sql: `${c} IS NULL`, params: [] }
      else if (v === true || v === 'true') frag = { sql: `${c} IS TRUE`, params: [] }
      else if (v === false || v === 'false') frag = { sql: `${c} IS FALSE`, params: [] }
      else if (v === 'unknown') frag = { sql: `${c} IS NULL`, params: [] }
      else fail(`Valor inválido para is: ${String(value)}`)
      break
    }
    case 'in': {
      const list = Array.isArray(value) ? value : parseInList(String(value))
      frag = list.length === 0 ? { sql: 'FALSE', params: [] } : { sql: `${c} IN (${list.map(() => '?').join(', ')})`, params: list.map(enc) }
      break
    }
    case 'cs': frag = { sql: `JSON_CONTAINS(${c}, ?)`, params: [toJsonArray(value)] }; break
    case 'cd': frag = { sql: `JSON_CONTAINS(?, ${c})`, params: [toJsonArray(value)] }; break
    case 'ov': frag = { sql: `JSON_OVERLAPS(${c}, ?)`, params: [toJsonArray(value)] }; break
    default:
      frag = fail(`Operador não suportado: ${op}`)
  }
  return negate ? { sql: `NOT (${frag!.sql})`, params: frag!.params } : frag!
}

function compileTree(table: string, alias: string, node: ParsedCond): Frag {
  if (node.kind === 'cond') return compileCond(table, alias, node.column, node.op, node.value, node.negate, true)
  const parts = node.items.map((i) => compileTree(table, alias, i))
  if (!parts.length) return { sql: 'TRUE', params: [] }
  const sql = '(' + parts.map((p) => p.sql).join(node.logic === 'and' ? ' AND ' : ' OR ') + ')'
  return { sql: node.negate ? `NOT ${sql}` : sql, params: parts.flatMap((p) => p.params) }
}

/** Separa "rel.coluna" em filtros de embed. */
function splitFilters(filters: Filter[], embedNames: Set<string>) {
  const base: Filter[] = []
  const embeds = new Map<string, Filter[]>()
  const push = (path: string, f: Filter) => { if (!embeds.has(path)) embeds.set(path, []); embeds.get(path)!.push(f) }
  for (const f of filters) {
    if (f.kind === 'or') {
      if (f.referencedTable) push(f.referencedTable, { kind: 'or', expr: f.expr })
      else base.push(f)
      continue
    }
    const dot = f.column.lastIndexOf('.')
    if (dot > 0 && !f.column.includes('->') && embedNames.has(f.column.slice(0, dot))) {
      push(f.column.slice(0, dot), { ...f, column: f.column.slice(dot + 1) } as Filter)
    } else base.push(f)
  }
  return { base, embeds }
}

function compileFilters(table: string, alias: string, filters: Filter[]): Frag[] {
  const out: Frag[] = []
  for (const f of filters) {
    if (f.kind === 'op') out.push(compileCond(table, alias, f.column, f.op, f.value, !!f.negate, false))
    else if (f.kind === 'or') out.push(compileTree(table, alias, parseLogicTree(f.expr, 'or')))
    else if (f.kind === 'raw' || f.kind === 'not_raw') {
      let op = f.op
      let negate = f.kind === 'not_raw'
      if (op.startsWith('not.')) { negate = !negate; op = op.slice(4) }
      if (op === 'or' || op === 'and') { const t = parseLogicTree(String(f.value).replace(/^\(|\)$/g, ''), op); t.negate = negate; out.push(compileTree(table, alias, t)); continue }
      const fromString = typeof f.value === 'string'
      out.push(compileCond(table, alias, f.column, op, f.value, negate, fromString))
    }
  }
  return out
}

const policyFrag = (p: Frag | boolean): Frag => (p === true ? { sql: 'TRUE', params: [] } : p === false ? { sql: 'FALSE', params: [] } : p)

function where(frags: Frag[]): Frag {
  const fs = frags.filter((f) => f.sql !== 'TRUE')
  if (!fs.length) return { sql: '', params: [] }
  return { sql: ' WHERE ' + fs.map((f) => `(${f.sql})`).join(' AND '), params: fs.flatMap((f) => f.params) }
}

function orderSql(table: string, alias: string, orders: OrderSpec[]): string {
  if (!orders.length) return ''
  return ' ORDER BY ' + orders.map((o) => {
    const { sql } = colExpr(table, alias, o.column)
    const nullsFirst = o.nullsFirst ?? !o.ascending // padrão PostgreSQL
    return `(${sql} IS NULL) ${nullsFirst ? 'DESC' : 'ASC'}, ${sql} ${o.ascending ? 'ASC' : 'DESC'}`
  }).join(', ')
}

// ── relações (embeds) ──────────────────────────────────────────────────────
interface Relation { target: string; kind: 'm2o' | 'o2m'; local: string; remote: string; oneToOne: boolean }

function resolveRelation(parent: string, name: string, hint?: string): Relation {
  const pm = tableMeta(parent)
  let target = name
  if (!schemaMeta.tables[name]) {
    // embed pelo nome da coluna FK, ex.: plan_id(name)
    const fk = pm.fks.find((f) => f.columns[0] === name)
    if (fk) target = fk.refTable
    else fail(`Could not find a relationship between '${parent}' and '${name}' in the schema cache`, 'PGRST200')
  }
  const tm = tableMeta(target)
  const cands: Relation[] = []
  const matches = (fkName: string, cols: string[]) => !hint || hint === fkName || cols.includes(hint) || hint === target
  for (const fk of pm.fks) {
    if (fk.refTable === target && fk.columns.length === 1 && matches(fk.name, fk.columns) && (name === target || fk.columns[0] === name || true))
      cands.push({ target, kind: 'm2o', local: fk.columns[0], remote: fk.refColumns[0], oneToOne: true })
  }
  for (const fk of tm.fks) {
    if (fk.refTable === parent && fk.columns.length === 1 && matches(fk.name, fk.columns)) {
      const unique = tm.uniques.some((u) => u.length === 1 && u[0] === fk.columns[0]) || (tm.pk.length === 1 && tm.pk[0] === fk.columns[0])
      cands.push({ target, kind: 'o2m', local: fk.refColumns[0], remote: fk.columns[0], oneToOne: unique })
    }
  }
  if (!cands.length) {
    // ponte via auth_users: orders.user_id → auth_users ← profiles.id
    const tpk = tm.pk[0]
    const tToAuth = tm.fks.find((f) => f.refTable === 'auth_users' && f.columns[0] === tpk)
    for (const fk of pm.fks) if (tToAuth && fk.refTable === 'auth_users' && matches(fk.name, fk.columns))
      cands.push({ target, kind: 'm2o', local: fk.columns[0], remote: tpk, oneToOne: true })
    const ppk = pm.pk[0]
    const pToAuth = pm.fks.find((f) => f.refTable === 'auth_users' && f.columns[0] === ppk)
    for (const fk of tm.fks) if (pToAuth && fk.refTable === 'auth_users' && fk.columns[0] !== tpk && matches(fk.name, fk.columns))
      cands.push({ target, kind: 'o2m', local: ppk, remote: fk.columns[0], oneToOne: false })
  }
  if (!cands.length) fail(`Could not find a relationship between '${parent}' and '${name}' in the schema cache`, 'PGRST200')
  if (name !== target) return cands.find((c) => c.local === name) ?? cands[0]
  return cands[0]
}

// ── SELECT ─────────────────────────────────────────────────────────────────
interface SelCtx {
  ctx: AuthCtx
  conn: Conn
  embedFilters: Map<string, Filter[]>
  orders: OrderSpec[]
  embedLimits: Record<string, { limit?: number; offset?: number }>
}

const embedKey = (n: Extract<SelectNode, { type: 'embed' }>) => n.alias ?? n.name

function collectEmbedPaths(nodes: SelectNode[], prefix = '', out = new Set<string>()) {
  for (const n of nodes) if (n.type === 'embed') {
    const p = prefix ? `${prefix}.${embedKey(n)}` : embedKey(n)
    out.add(p)
    if (n.alias) out.add(prefix ? `${prefix}.${n.name}` : n.name)
    collectEmbedPaths(n.children, p, out)
  }
  return out
}

function neededColumns(table: string, nodes: SelectNode[]): string[] {
  const t = tableMeta(table)
  const cols = new Set<string>()
  for (const n of nodes) {
    if (n.type === 'star') visibleColumns(t).forEach((c) => cols.add(c))
    else if (n.type === 'col') { columnMeta(table, n.name); cols.add(n.name) }
    else if (n.type === 'embed') cols.add(resolveRelation(table, n.name, n.hint).local)
  }
  return [...cols]
}

function shapeRow(table: string, nodes: SelectNode[], raw: Record<string, unknown>, embeds: Record<string, unknown>): Record<string, unknown> {
  const t = tableMeta(table)
  const out: Record<string, unknown> = {}
  for (const n of nodes) {
    if (n.type === 'star') for (const c of visibleColumns(t)) out[c] = decodeValue(t.columns[c], raw[c])
    else if (n.type === 'col') {
      const key = n.alias ?? n.name
      let v = decodeValue(t.columns[n.name], raw[n.name])
      if (n.jsonPath) {
        for (const k of n.jsonPath.path) v = v == null ? null : (v as any)[k]
        if (n.jsonPath.asText && v != null && typeof v === 'object') v = JSON.stringify(v)
        else if (n.jsonPath.asText && v != null) v = String(v)
      }
      out[key] = v ?? null
    } else if (n.type === 'embed') out[embedKey(n)] = embeds[embedKey(n)]
    else if (n.type === 'count') out[n.alias ?? 'count'] = raw.__count
  }
  return out
}

function filtersFor(sc: SelCtx, path: string, n: Extract<SelectNode, { type: 'embed' }>, parentPath: string) {
  const alt = parentPath ? `${parentPath}.${n.name}` : n.name
  return [...(sc.embedFilters.get(path) ?? []), ...(path !== alt ? sc.embedFilters.get(alt) ?? [] : [])]
}

async function fetchEmbeds(table: string, nodes: SelectNode[], rawRows: Record<string, unknown>[], sc: SelCtx, parentPath: string): Promise<Record<string, unknown>[]> {
  const embedsPerRow: Record<string, unknown>[] = rawRows.map(() => ({}))
  for (const n of nodes) {
    if (n.type !== 'embed') continue
    const rel = resolveRelation(table, n.name, n.hint)
    const path = parentPath ? `${parentPath}.${embedKey(n)}` : embedKey(n)
    const keys = [...new Set(rawRows.map((r) => r[rel.local]).filter((v) => v !== null && v !== undefined))]
    const empty = rel.kind === 'm2o' || rel.oneToOne ? null : []
    if (!keys.length) { embedsPerRow.forEach((e) => (e[embedKey(n)] = empty)); continue }

    const alias = 'e0'
    const extra = compileFilters(rel.target, alias, filtersFor(sc, path, n, parentPath))
    const pol = policyFrag(policyFor(rel.target, 'select', alias, sc.ctx))
    const keyFrag: Frag = { sql: `${alias}.${qi(rel.remote)} IN (${keys.map(() => '?').join(', ')})`, params: keys }
    const w = where([keyFrag, ...extra, pol])

    const onlyCount = n.children.length > 0 && n.children.every((c) => c.type === 'count')
    const grouped = new Map<unknown, Record<string, unknown>[]>()
    if (onlyCount) {
      const [rows] = await sc.conn.query(`SELECT ${alias}.${qi(rel.remote)} AS k, COUNT(*) AS n FROM ${qi(rel.target)} ${alias}${w.sql} GROUP BY ${alias}.${qi(rel.remote)}`, w.params as any[])
      const counts = new Map((rows as any[]).map((r) => [String(r.k), Number(r.n)]))
      rawRows.forEach((r, i) => {
        const cnt = counts.get(String(r[rel.local])) ?? 0
        const obj = Object.fromEntries(n.children.map((c) => [(c as any).alias ?? 'count', cnt]))
        embedsPerRow[i][embedKey(n)] = rel.kind === 'm2o' || rel.oneToOne ? obj : [obj]
      })
      continue
    }

    const cols = new Set([...neededColumns(rel.target, n.children), rel.remote])
    const ord = sc.orders.filter((o) => o.referencedTable === path || o.referencedTable === n.name)
    const [rows] = await sc.conn.query(
      `SELECT ${[...cols].map((c) => `${alias}.${qi(c)}`).join(', ')} FROM ${qi(rel.target)} ${alias}${w.sql}${orderSql(rel.target, alias, ord)}`,
      w.params as any[],
    )
    const childRaw = rows as Record<string, unknown>[]
    const childEmbeds = await fetchEmbeds(rel.target, n.children, childRaw, sc, path)
    // !inner em níveis aninhados: descarta filhos sem correspondência
    const shaped = childRaw.map((r, i) => ({ k: r[rel.remote], v: shapeRow(rel.target, n.children, r, childEmbeds[i]), e: childEmbeds[i] }))
      .filter((x) => n.children.every((c) => c.type !== 'embed' || !c.inner || (x.e[embedKey(c)] != null && (!Array.isArray(x.e[embedKey(c)]) || (x.e[embedKey(c)] as unknown[]).length > 0))))
    for (const s of shaped) {
      const k = String(s.k)
      if (!grouped.has(k)) grouped.set(k, [])
      grouped.get(k)!.push(s.v)
    }
    const lim = sc.embedLimits[path] ?? sc.embedLimits[n.name]
    rawRows.forEach((r, i) => {
      let list = grouped.get(String(r[rel.local])) ?? []
      if (lim) list = list.slice(lim.offset ?? 0, (lim.offset ?? 0) + (lim.limit ?? list.length))
      embedsPerRow[i][embedKey(n)] = rel.kind === 'm2o' || rel.oneToOne ? list[0] ?? null : list
    })
  }
  return embedsPerRow
}

/** EXISTS(...) para embeds !inner de topo (filtra as linhas-mãe). */
function innerJoinFrags(table: string, alias: string, nodes: SelectNode[], sc: SelCtx): Frag[] {
  const out: Frag[] = []
  let i = 0
  for (const n of nodes) {
    if (n.type !== 'embed' || !n.inner) continue
    const rel = resolveRelation(table, n.name, n.hint)
    const a = `ij${i++}`
    const extra = compileFilters(rel.target, a, filtersFor(sc, embedKey(n), n, ''))
    const pol = policyFrag(policyFor(rel.target, 'select', a, sc.ctx))
    const w = where([{ sql: `${a}.${qi(rel.remote)} = ${alias}.${qi(rel.local)}`, params: [] }, ...extra, pol])
    out.push({ sql: `EXISTS (SELECT 1 FROM ${qi(rel.target)} ${a}${w.sql})`, params: w.params })
  }
  return out
}

async function runSelect(q: QueryDescriptor, ctx: AuthCtx, conn: Conn, pkRestrict?: unknown[], cmdForPolicy: 'select' = 'select'): Promise<{ rows: Record<string, unknown>[]; count: number | null }> {
  const table = q.table
  tableMeta(table)
  const nodes = parseSelect(q.select)
  const embedNames = collectEmbedPaths(nodes)
  const { base, embeds } = splitFilters(q.filters, embedNames)
  const sc: SelCtx = { ctx, conn, embedFilters: embeds, orders: q.orders, embedLimits: q.embedLimits ?? {} }
  const alias = 't0'
  const frags = [
    ...(pkRestrict ? [pkRestrict.length ? { sql: `${alias}.${qi(pkOf(table))} IN (${pkRestrict.map(() => '?').join(', ')})`, params: pkRestrict } : { sql: 'FALSE', params: [] }] : compileFilters(table, alias, base)),
    policyFrag(policyFor(table, cmdForPolicy, alias, ctx)),
    ...innerJoinFrags(table, alias, nodes, sc),
  ]
  const w = where(frags)

  let count: number | null = null
  if (q.count && !pkRestrict) {
    const [r] = await conn.query(`SELECT COUNT(*) AS c FROM ${qi(table)} ${alias}${w.sql}`, w.params as any[])
    count = Number((r as any[])[0].c)
  }
  if (q.head) return { rows: [], count }

  // select('count') no topo
  if (nodes.length && nodes.every((n) => n.type === 'count')) {
    const [r] = await conn.query(`SELECT COUNT(*) AS c FROM ${qi(table)} ${alias}${w.sql}`, w.params as any[])
    return { rows: [Object.fromEntries(nodes.map((n) => [(n as any).alias ?? 'count', Number((r as any[])[0].c)]))], count }
  }

  const cols = neededColumns(table, nodes)
  // a chave primária é sempre lida (ordenação do RETURNING); shapeRow só devolve o pedido
  if (!cols.includes(pkOf(table))) cols.push(pkOf(table))
  const baseOrders = q.orders.filter((o) => !o.referencedTable)
  let sqlText = `SELECT ${cols.map((c) => `${alias}.${qi(c)}`).join(', ')} FROM ${qi(table)} ${alias}${w.sql}${orderSql(table, alias, baseOrders)}`
  const params = [...w.params]
  if (!pkRestrict && q.limit !== undefined) { sqlText += ' LIMIT ?'; params.push(q.limit) }
  if (!pkRestrict && q.offset !== undefined) { if (q.limit === undefined) sqlText += ' LIMIT 18446744073709551615'; sqlText += ' OFFSET ?'; params.push(q.offset) }
  const [rows] = await conn.query(sqlText, params as any[])
  const raw = rows as Record<string, unknown>[]
  const emb = await fetchEmbeds(table, nodes, raw, sc, '')
  let out = raw.map((r, i) => shapeRow(table, nodes, r, emb[i]))
  if (pkRestrict) {
    // devolve pela ordem das chaves (ordem de inserção)
    const pk = pkOf(table)
    const idx = new Map(raw.map((r, i) => [String(r[pk]), i]))
    out = pkRestrict.map((k) => idx.get(String(k))).filter((i): i is number => i !== undefined).map((i) => out[i])
  }
  return { rows: out, count }
}

// ── escrita ────────────────────────────────────────────────────────────────
function prepareRow(table: string, row: Record<string, unknown>, forInsert: boolean): Record<string, unknown> {
  const t = tableMeta(table)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue
    const c = t.columns[k]
    if (!c || c.internal) fail(`Could not find the '${k}' column of '${table}' in the schema cache`, 'PGRST204')
    if (c!.generated) {
      if (forInsert && v !== null) fail(`cannot insert a non-DEFAULT value into column "${k}"`, '428C9')
      continue
    }
    out[k] = v
  }
  return out
}

function applyAppDefaults(table: string, row: Record<string, unknown>) {
  const t = tableMeta(table)
  for (const [k, c] of Object.entries(t.columns)) {
    if (row[k] !== undefined || c.generated) continue
    if (c.default === 'uuid') row[k] = randomUUID()
    else if (c.default === 'invoice_number') row[k] = `INV-${new Date().getUTCFullYear()}-${String(randomInt(0, 99999)).padStart(5, '0')}`
  }
}

/** Porta do trigger generate_ticket_number (VH-TKT-AAAA-NNNNNN). */
async function ticketNumber(conn: Conn): Promise<string> {
  const year = new Date().getUTCFullYear()
  const [r] = await conn.query("SELECT COUNT(*) AS c FROM `tickets` WHERE ticket_number LIKE ? FOR UPDATE", [`VH-TKT-${year}-%`])
  let seq = Number((r as any[])[0].c) + 1
  // evita colisão se houver números saltados
  for (;;) {
    const n = `VH-TKT-${year}-${String(seq).padStart(6, '0')}`
    const [e] = await conn.query('SELECT 1 FROM `tickets` WHERE ticket_number = ? LIMIT 1', [n])
    if (!(e as any[]).length) return n
    seq++
  }
}

/** Porta do trigger sync_invoice_proof_file (payments → invoices.proof_file). */
async function syncInvoiceProof(conn: Conn, pks: unknown[]) {
  if (!pks.length) return
  await conn.query(
    `UPDATE \`invoices\` i JOIN \`payments\` p ON p.invoice_id = i.id
       SET i.proof_file = p.proof_url, i.updated_at = UTC_TIMESTAMP(6)
     WHERE p.id IN (${pks.map(() => '?').join(', ')}) AND p.proof_url IS NOT NULL AND (i.proof_file IS NULL OR i.proof_file = '')`,
    pks as any[],
  )
}

async function afterWriteTriggers(table: string, conn: Conn, pks: unknown[], changed: Set<string>) {
  if (table === 'payments' && (changed.has('proof_url') || changed.has('*'))) await syncInvoiceProof(conn, pks)
}

async function verifyCheck(table: string, cmd: 'insert' | 'updateCheck', ctx: AuthCtx, conn: Conn, pks: unknown[]) {
  if (ctx.role === 'service' || !pks.length) return
  const p = policyFor(table, cmd, 't0', ctx)
  if (p === true) return
  if (p === false) fail(`new row violates row-level security policy for table "${table}"`, '42501', 403)
  const f = p as Frag
  const [r] = await conn.query(
    `SELECT COUNT(*) AS c FROM ${qi(table)} t0 WHERE t0.${qi(pkOf(table))} IN (${pks.map(() => '?').join(', ')}) AND (${f.sql})`,
    [...pks, ...f.params] as any[],
  )
  if (Number((r as any[])[0].c) !== pks.length) fail(`new row violates row-level security policy for table "${table}"`, '42501', 403)
}

async function lockMatching(table: string, cmd: 'update' | 'delete', q: QueryDescriptor, ctx: AuthCtx, conn: Conn): Promise<unknown[]> {
  const alias = 't0'
  const pk = pkOf(table)
  const w = where([...compileFilters(table, alias, q.filters.filter((f) => f.kind !== 'op' || !f.column.includes('.'))), policyFrag(policyFor(table, cmd, alias, ctx))])
  const [rows] = await conn.query(`SELECT ${alias}.${qi(pk)} AS k FROM ${qi(table)} ${alias}${w.sql} FOR UPDATE`, w.params as any[])
  return (rows as any[]).map((r) => r.k)
}

function setClause(table: string, values: Record<string, unknown>): Frag {
  const t = tableMeta(table)
  const parts: string[] = []
  const params: unknown[] = []
  for (const [k, v] of Object.entries(values)) { parts.push(`${qi(k)} = ?`); params.push(encodeValue(t.columns[k], v)) }
  if (t.autoUpdatedAt && t.columns.updated_at) {
    const i = parts.indexOf('`updated_at` = ?')
    if (i >= 0) { parts.splice(i, 1); params.splice(i, 1) }
    parts.push('`updated_at` = UTC_TIMESTAMP(6)')
  }
  return { sql: parts.join(', '), params }
}

async function insertRows(table: string, rows: Record<string, unknown>[], conn: PoolConnection): Promise<unknown[]> {
  const t = tableMeta(table)
  const pk = pkOf(table)
  const pks: unknown[] = []
  for (const row of rows) {
    if (table === 'tickets' && (row.ticket_number === undefined || row.ticket_number === null)) row.ticket_number = await ticketNumber(conn)
    const cols = Object.keys(row)
    if (!cols.length) { await conn.query(`INSERT INTO ${qi(table)} () VALUES ()`); continue }
    await conn.query(`INSERT INTO ${qi(table)} (${cols.map(qi).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => encodeValue(t.columns[c], row[c])) as any[])
    pks.push(row[pk])
  }
  return pks
}

async function runMutation(q: QueryDescriptor, ctx: AuthCtx): Promise<{ rows: Record<string, unknown>[] | null; count: number | null }> {
  const table = q.table
  const t = tableMeta(table)
  const pk = pkOf(table)
  const returningQuery = (pks: unknown[]) => runSelect({ ...q, op: 'select', filters: [], orders: q.orders, count: undefined, head: false }, ctx.role === 'service' ? ctx : ctx, getPool(), pks)

  if (q.op === 'insert' || q.op === 'upsert') {
    const input = Array.isArray(q.values) ? q.values : [q.values ?? {}]
    if (ctx.role !== 'service' && !policyFor(table, 'insert', 't0', ctx)) fail(`new row violates row-level security policy for table "${table}"`, '42501', 403)
    const prepared = input.map((r) => prepareRow(table, r as Record<string, unknown>, true))

    const pks = await withTransaction(async (conn) => {
      if (q.op === 'insert') {
        prepared.forEach((r) => applyAppDefaults(table, r))
        const ids = await insertRows(table, prepared, conn)
        await afterWriteTriggers(table, conn, ids, new Set(['*']))
        await verifyCheck(table, 'insert', ctx, conn, ids)
        return ids
      }
      // upsert
      const conflict = (q.onConflict ?? pk).split(',').map((s) => s.trim()).filter(Boolean)
      conflict.forEach((c) => columnMeta(table, c))
      const ids: unknown[] = []
      for (const row of prepared) {
        const hasConflictValues = conflict.every((c) => row[c] !== undefined)
        let existing: unknown = undefined
        if (hasConflictValues) {
          const [ex] = await conn.query(
            `SELECT ${qi(pk)} AS k FROM ${qi(table)} WHERE ${conflict.map((c) => `${qi(c)} <=> ?`).join(' AND ')} LIMIT 1 FOR UPDATE`,
            conflict.map((c) => encodeFilterValue(t.columns[c], row[c])) as any[],
          )
          existing = (ex as any[])[0]?.k
        }
        if (existing !== undefined) {
          if (q.ignoreDuplicates) { ids.push(existing); continue }
          if (ctx.role !== 'service') {
            const u = policyFrag(policyFor(table, 'update', 't0', ctx))
            const [ok] = await conn.query(`SELECT 1 FROM ${qi(table)} t0 WHERE t0.${qi(pk)} = ? AND (${u.sql})`, [existing, ...u.params] as any[])
            if (!(ok as any[]).length) fail(`new row violates row-level security policy (USING expression) for table "${table}"`, '42501', 403)
          }
          const vals = { ...row }
          delete vals[pk]
          if (Object.keys(vals).length || t.autoUpdatedAt) {
            const s = setClause(table, vals)
            if (s.sql) await conn.query(`UPDATE ${qi(table)} SET ${s.sql} WHERE ${qi(pk)} = ?`, [...s.params, existing] as any[])
          }
          await afterWriteTriggers(table, conn, [existing], new Set(Object.keys(row)))
          await verifyCheck(table, 'updateCheck', ctx, conn, [existing])
          ids.push(existing)
        } else {
          applyAppDefaults(table, row)
          const [id] = await insertRows(table, [row], conn)
          await afterWriteTriggers(table, conn, [id], new Set(['*']))
          await verifyCheck(table, 'insert', ctx, conn, [id])
          ids.push(id)
        }
      }
      return ids
    })
    return { rows: q.returning ? (await returningQuery(pks)).rows : null, count: q.count ? pks.length : null }
  }

  if (q.op === 'update') {
    const values = prepareRow(table, (q.values ?? {}) as Record<string, unknown>, false)
    const pks = await withTransaction(async (conn) => {
      const ids = await lockMatching(table, 'update', q, ctx, conn)
      if (!ids.length) return ids
      const s = setClause(table, values)
      if (s.sql) await conn.query(`UPDATE ${qi(table)} SET ${s.sql} WHERE ${qi(pk)} IN (${ids.map(() => '?').join(', ')})`, [...s.params, ...ids] as any[])
      await afterWriteTriggers(table, conn, ids, new Set(Object.keys(values)))
      await verifyCheck(table, 'updateCheck', ctx, conn, ids)
      return ids
    })
    return { rows: q.returning ? (await returningQuery(pks)).rows : null, count: q.count ? pks.length : null }
  }

  if (q.op === 'delete') {
    let returned: Record<string, unknown>[] | null = null
    const pks = await withTransaction(async (conn) => {
      const ids = await lockMatching(table, 'delete', q, ctx, conn)
      if (!ids.length) return ids
      if (q.returning) returned = (await runSelect({ ...q, op: 'select', filters: [], count: undefined, head: false }, { role: 'service' }, conn, ids)).rows
      await conn.query(`DELETE FROM ${qi(table)} WHERE ${qi(pk)} IN (${ids.map(() => '?').join(', ')})`, ids as any[])
      return ids
    })
    return { rows: q.returning ? returned ?? [] : null, count: q.count ? pks.length : null }
  }
  return fail(`Operação desconhecida: ${q.op}`)
}

// ── erros MariaDB → códigos PostgreSQL (o código existente verifica p.ex. 23505) ──
export function mapMysqlError(e: any): { err: DbError; status: number } {
  const msg = String(e?.sqlMessage ?? e?.message ?? e)
  switch (e?.errno) {
    case 1062: {
      const key = msg.match(/for key '(?:[^.']+\.)?([^']+)'/)?.[1] ?? ''
      return { err: { message: `duplicate key value violates unique constraint "${key}"`, code: '23505', details: msg, hint: null }, status: 409 }
    }
    case 1451: case 1452:
      return { err: { message: `insert or update violates foreign key constraint`, code: '23503', details: msg, hint: null }, status: 409 }
    case 1048: case 1364: {
      const col = msg.match(/'([^']+)'/)?.[1] ?? ''
      return { err: { message: `null value in column "${col}" violates not-null constraint`, code: '23502', details: msg, hint: null }, status: 400 }
    }
    case 4025: case 3819:
      return { err: { message: `new row violates check constraint`, code: '23514', details: msg, hint: null }, status: 400 }
    case 1406:
      return { err: { message: 'value too long for type', code: '22001', details: msg, hint: null }, status: 400 }
    case 1366: case 1292: case 3140:
      return { err: { message: `invalid input syntax: ${msg}`, code: '22P02', details: msg, hint: null }, status: 400 }
    default:
      return { err: { message: msg, code: e?.code ? `MYSQL_${e.code}` : 'XX000', details: null, hint: null }, status: 500 }
  }
}

// ── ponto de entrada ───────────────────────────────────────────────────────
export async function executeQuery(q: QueryDescriptor, ctx: AuthCtx): Promise<DbResult> {
  try {
    let rows: Record<string, unknown>[] | null
    let count: number | null
    if (q.op === 'select') ({ rows, count } = await runSelect(q, ctx, getPool()))
    else ({ rows, count } = await runMutation(q, ctx))

    if (q.op === 'select' && q.head) return { data: null, error: null, count, status: 200, statusText: 'OK' }
    if (q.single) {
      const list = rows ?? []
      if (list.length === 1) return { data: list[0], error: null, count, status: 200, statusText: 'OK' }
      if (list.length === 0 && q.single === 'maybe') return { data: null, error: null, count, status: 200, statusText: 'OK' }
      if (rows === null) return { data: null, error: null, count, status: 204, statusText: 'No Content' }
      return {
        data: null, count, status: 406, statusText: 'Not Acceptable',
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116', details: `The result contains ${list.length} rows`, hint: null },
      }
    }
    const status = q.op === 'insert' || q.op === 'upsert' ? 201 : rows === null ? 204 : 200
    return { data: rows, error: null, count, status, statusText: status === 201 ? 'Created' : status === 204 ? 'No Content' : 'OK' }
  } catch (e: any) {
    if (e instanceof DbFailure) return { data: null, error: e.err, count: null, status: e.status, statusText: 'Error' }
    const { err, status } = mapMysqlError(e)
    if (status >= 500) console.error('[db] erro MariaDB', q.table, q.op, e)
    return { data: null, error: err, count: null, status, statusText: 'Error' }
  }
}
