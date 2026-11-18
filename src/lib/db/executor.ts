/*
 * Executor MySQL das consultas (DbQuery) — só servidor.
 *
 * - SQL sempre parametrizado; nomes de tabelas/colunas validados contra o schema gerado.
 * - Políticas de acesso (policies.ts) aplicadas a contextos que não sejam 'service', também nas relações embutidas.
 * - Resultados no mesmo formato que o PostgREST devolvia (datas ISO com +00:00, números, booleanos, JSON).
 */
import { randomUUID } from 'node:crypto'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { getPool } from './pool'
import { SCHEMA } from './schema.generated'
import { policyFor, type Cond, type TablePolicy } from './policies'
import { parseSelect, parseLogic, ParseError, type SelectItem, type LogicNode } from './parse'
import { toDb, fromDb, ValueError } from './values'
import { HOOKS } from './hooks'
import type { DbContext, DbError, DbQuery, DbResult, Filter, FilterOp, OrderSpec, TableMeta } from './types'

type Row = Record<string, unknown>
type SqlPart = { sql: string; params: unknown[] }

export class DbFail extends Error {
  constructor(public code: string, message: string, public status = 400, public details: string | null = null, public hint: string | null = null) {
    super(message)
  }
}

const qi = (s: string) => '`' + s.replace(/`/g, '``') + '`'

function table(name: string): TableMeta {
  const t = SCHEMA[name]
  if (!t) throw new DbFail('PGRST205', `Could not find the table 'viralizahost.${name}' in the schema cache`, 404)
  return t
}
function column(tname: string, col: string) {
  const c = table(tname).columns[col]
  if (!c || c.internal) throw new DbFail('42703', `column ${tname}.${col} does not exist`, 400)
  return c
}

/* ─── Políticas ─────────────────────────────────────────────────────────── */
type Action = 'select' | 'update' | 'delete'

function policyCond(tname: string, ctx: DbContext, action: Action): SqlPart {
  if (ctx.role === 'service') return { sql: '1=1', params: [] }
  const p: TablePolicy = policyFor(tname)
  const fn = action === 'select' ? p.select : action === 'update' ? p.update : p.delete
  const c: Cond = fn ? fn(ctx) : false
  if (c === true) return { sql: '1=1', params: [] }
  if (c === false) return { sql: '1=0', params: [] }
  return c
}

function rlsError(tname: string, ctx: DbContext) {
  return new DbFail('42501', `new row violates row-level security policy for table "${tname}"`, ctx.role === 'anon' ? 401 : 403)
}

/* ─── WHERE ─────────────────────────────────────────────────────────────── */
function compileCond(tname: string, col: string, op: FilterOp, value: unknown, negate: boolean): SqlPart {
  const meta = column(tname, col)
  const c = `t.${qi(col)}`
  let part: SqlPart
  const conv = (v: unknown) => toDb(meta, v)
  switch (op) {
    case 'eq': case 'neq': case 'gt': case 'gte': case 'lt': case 'lte': {
      const sym = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]
      if (value === null || value === undefined) part = { sql: `${c} ${sym} NULL`, params: [] }
      else part = { sql: `${c} ${sym} ?`, params: [conv(value)] }
      break
    }
    case 'like': case 'ilike': {
      const pattern = String(value).replace(/\*/g, '%')
      part = op === 'like' ? { sql: `${c} LIKE ?`, params: [pattern] } : { sql: `LOWER(${c}) LIKE LOWER(?)`, params: [pattern] }
      break
    }
    case 'in': {
      const list = Array.isArray(value) ? value : [value]
      const vals = list.filter(v => v !== null && v !== undefined)
      if (!vals.length) part = { sql: list.length ? `${c} IS NULL AND 1=0` : '1=0', params: [] }
      else part = { sql: `${c} IN (${vals.map(() => '?').join(', ')})`, params: vals.map(conv) }
      break
    }
    case 'is': {
      if (value === null || value === 'unknown') part = { sql: `${c} IS NULL`, params: [] }
      else if (value === true) part = { sql: `${c} IS TRUE`, params: [] }
      else if (value === false) part = { sql: `${c} IS FALSE`, params: [] }
      else throw new DbFail('PGRST100', `"failed to parse filter (is.${String(value)})"`)
      break
    }
    case 'cs': case 'cd': {
      let v = value
      if (typeof v === 'string' && /^\{.*\}$/.test(v) && meta.kind === 'array') v = v.slice(1, -1).split(',').filter(Boolean)
      const json = typeof v === 'string' && meta.kind === 'json' ? v : JSON.stringify(v)
      part = op === 'cs' ? { sql: `JSON_CONTAINS(${c}, ?)`, params: [json] } : { sql: `JSON_CONTAINS(?, ${c})`, params: [json] }
      break
    }
    default: throw new DbFail('PGRST100', `operador não suportado: ${op}`)
  }
  return negate ? { sql: `NOT (${part.sql})`, params: part.params } : part
}

function compileLogic(tname: string, node: LogicNode): SqlPart {
  if (node.type === 'cond') return compileCond(tname, node.col, node.op, node.value, node.negate)
  const parts = node.children.map(ch => compileLogic(tname, ch))
  const sql = '(' + parts.map(p => `(${p.sql})`).join(node.type === 'or' ? ' OR ' : ' AND ') + ')'
  return { sql: node.negate ? `NOT ${sql}` : sql, params: parts.flatMap(p => p.params) }
}

function compileFilters(tname: string, filters: Filter[]): SqlPart[] {
  return filters.map(f => {
    if (f.type === 'or') return compileLogic(tname, parseLogic(f.expr, 'or'))
    if (f.col.includes('.')) throw new DbFail('PGRST100', `filtros sobre tabelas embutidas não são suportados: ${f.col}`)
    return compileCond(tname, f.col, f.op, f.value, !!f.negate)
  })
}

function joinWhere(parts: SqlPart[]): SqlPart {
  const real = parts.filter(p => p.sql && p.sql !== '1=1')
  if (!real.length) return { sql: '', params: [] }
  return { sql: ' WHERE ' + real.map(p => `(${p.sql})`).join(' AND '), params: real.flatMap(p => p.params) }
}

function compileOrder(tname: string, order: OrderSpec[]): string {
  const own = order.filter(o => !o.foreignTable)
  if (!own.length) return ''
  return ' ORDER BY ' + own.map(o => {
    column(tname, o.col)
    const c = `t.${qi(o.col)}`
    // PostgreSQL: ASC → NULLS LAST, DESC → NULLS FIRST (por omissão)
    const nullsFirst = o.nullsFirst ?? !o.ascending
    return `${c} IS NULL ${nullsFirst ? 'DESC' : 'ASC'}, ${c} ${o.ascending ? 'ASC' : 'DESC'}`
  }).join(', ')
}

/* ─── Relações (embedding) ──────────────────────────────────────────────── */
type Rel = { kind: 'm2o' | 'o2m'; local: string[]; remote: string[] }

function resolveRel(a: string, b: string, hint?: string): Rel {
  const A = table(a), B = table(b)
  const match = (f: { name?: string; cols: string[] }) => !hint || f.name === hint || f.cols[0] === hint
  let cands: Rel[] = [
    ...A.fks.filter(f => !f.external && f.refTable === b && match(f)).map(f => ({ kind: 'm2o' as const, local: f.cols, remote: f.refCols })),
    ...B.fks.filter(f => !f.external && f.refTable === a && match(f)).map(f => ({ kind: 'o2m' as const, local: f.refCols, remote: f.cols })),
  ]
  // FKs para auth.users: profiles.id = auth.users.id, por isso resolvem para profiles
  if (!cands.length && b === 'profiles') cands = A.fks.filter(f => f.external && f.refTable === 'auth.users' && match(f)).map(f => ({ kind: 'm2o', local: f.cols, remote: ['id'] }))
  if (!cands.length && a === 'profiles') cands = B.fks.filter(f => f.external && f.refTable === 'auth.users' && match(f)).map(f => ({ kind: 'o2m', local: ['id'], remote: f.cols }))
  if (!cands.length) throw new DbFail('PGRST200', `Could not find a relationship between '${a}' and '${b}' in the schema cache`, 400)
  if (cands.length > 1) throw new DbFail('PGRST201', `Could not embed because more than one relationship was found for '${a}' and '${b}'`, 300)
  return cands[0]
}

type SelectOpts = { order?: OrderSpec[]; limit?: number; offset?: number; allOrders?: OrderSpec[] }
type SelOut = { out: Row; raw: Row }

/** SELECT com relações embutidas. Devolve linhas formatadas + valores brutos (para agrupar nas relações). */
async function runSelect(conn: PoolConnection, ctx: DbContext, tname: string, items: SelectItem[], where: SqlPart[], opts: SelectOpts, extraCols: string[] = []): Promise<SelOut[]> {
  const T = table(tname)
  const needed = new Set<string>(extraCols)
  const outCols: { name: string; alias: string }[] = []
  const embeds: Extract<SelectItem, { type: 'embed' }>[] = []
  const counts: Extract<SelectItem, { type: 'count' }>[] = []
  for (const it of items) {
    if (it.type === 'star') for (const [n, m] of Object.entries(T.columns)) { if (!m.internal) { outCols.push({ name: n, alias: n }); needed.add(n) } }
    else if (it.type === 'column') { column(tname, it.name); outCols.push(it); needed.add(it.name) }
    else if (it.type === 'embed') embeds.push(it)
    else counts.push(it)
  }
  const rels = embeds.map(e => resolveRel(tname, e.table, e.hint))
  rels.forEach(r => r.local.forEach(c => needed.add(c)))
  if (!needed.size) T.pk.forEach(c => needed.add(c))

  const policy = policyCond(tname, ctx, 'select')
  const w = joinWhere([...where, policy])
  let sql = `SELECT ${[...needed].map(c => `t.${qi(c)}`).join(', ')} FROM ${qi(tname)} t${w.sql}${compileOrder(tname, opts.order ?? [])}`
  if (opts.limit !== undefined) sql += ` LIMIT ${Math.max(0, Math.floor(opts.limit))}`
  if (opts.offset) sql += `${opts.limit === undefined ? ' LIMIT 18446744073709551615' : ''} OFFSET ${Math.max(0, Math.floor(opts.offset))}`
  const [rawRows] = await conn.query<RowDataPacket[]>(sql, w.params)

  const result: SelOut[] = rawRows.map(r => {
    const raw: Row = {}
    for (const c of needed) raw[c] = fromDb(T.columns[c], r[c])
    const out: Row = {}
    for (const c of outCols) out[c.alias] = raw[c.name]
    return { out, raw }
  })
  if (counts.length) throw new DbFail('PGRST100', 'count() só é suportado dentro de uma relação embutida')

  // Relações embutidas
  for (let i = 0; i < embeds.length; i++) {
    const e = embeds[i], rel = rels[i]
    const childOrder = (opts.allOrders ?? []).filter(o => o.foreignTable === e.table || o.foreignTable === e.alias).map(o => ({ ...o, foreignTable: undefined }))
    const isCount = e.items.length === 1 && e.items[0].type === 'count'
    const keyOf = (row: Row, cols: string[]) => JSON.stringify(cols.map(c => row[c] ?? null))
    const keys = [...new Map(result.filter(r => rel.local.every(c => r.raw[c] != null)).map(r => [keyOf(r.raw, rel.local), rel.local.map(c => r.raw[c])])).values()]
    const keyFilter: SqlPart = !keys.length ? { sql: '1=0', params: [] }
      : rel.remote.length === 1
        ? { sql: `t.${qi(rel.remote[0])} IN (${keys.map(() => '?').join(', ')})`, params: keys.map(k => toDb(table(e.table).columns[rel.remote[0]], k[0])) }
        : { sql: `(${rel.remote.map(c => `t.${qi(c)}`).join(', ')}) IN (${keys.map(k => `(${k.map(() => '?').join(', ')})`).join(', ')})`, params: keys.flat() }

    if (isCount) {
      const cp = policyCond(e.table, ctx, 'select')
      const cw = joinWhere([keyFilter, cp])
      const [cr] = await conn.query<RowDataPacket[]>(`SELECT ${rel.remote.map(c => `t.${qi(c)}`).join(', ')}, COUNT(*) AS n FROM ${qi(e.table)} t${cw.sql} GROUP BY ${rel.remote.map(c => `t.${qi(c)}`).join(', ')}`, cw.params)
      const m = new Map(cr.map(r => [keyOf(Object.fromEntries(rel.remote.map(c => [c, fromDb(table(e.table).columns[c], r[c])])), rel.remote), Number(r.n)]))
      const alias = (e.items[0] as { alias: string }).alias
      for (const r of result) r.out[e.alias] = [{ [alias]: m.get(keyOf(r.raw, rel.local)) ?? 0 }]
      continue
    }

    const children = await runSelect(conn, ctx, e.table, e.items, [keyFilter], { order: childOrder, allOrders: opts.allOrders }, rel.remote)
    const grouped = new Map<string, Row[]>()
    for (const ch of children) {
      const k = keyOf(ch.raw, rel.remote)
      if (!grouped.has(k)) grouped.set(k, [])
      grouped.get(k)!.push(ch.out)
    }
    for (const r of result) {
      const list = grouped.get(keyOf(r.raw, rel.local)) ?? []
      r.out[e.alias] = rel.kind === 'm2o' ? (list[0] ?? null) : list
    }
    if (e.inner) for (let j = result.length - 1; j >= 0; j--) {
      const v = result[j].out[e.alias]
      if (v === null || (Array.isArray(v) && !v.length)) result.splice(j, 1)
    }
  }
  return result
}

/* ─── Escrita ──────────────────────────────────────────────────────────── */
function prepareRows(tname: string, values: Row | Row[], defaultToNull: boolean, ctx: DbContext): { cols: string[]; rows: Row[]; generatedPk: boolean } {
  const T = table(tname)
  const list = (Array.isArray(values) ? values : [values]).map(r => ({ ...r }))
  if (!list.length) throw new DbFail('PGRST100', 'Nenhum registo para inserir')
  const cols = new Set<string>()
  for (const r of list) for (const k of Object.keys(r)) {
    if (r[k] === undefined) { delete r[k]; continue }
    const meta = T.columns[k]
    if (!meta || meta.internal) throw new DbFail('PGRST204', `Could not find the '${k}' column of '${tname}' in the schema cache`, 400)
    if (meta.generated) throw new DbFail('428C9', `cannot insert a non-DEFAULT value into column "${k}"`, 400, `Column "${k}" is a generated column.`)
    cols.add(k)
  }
  // Chave primária UUID gerada pela aplicação (para poder devolver a linha — o MySQL não tem RETURNING)
  let generatedPk = false
  for (const pk of T.pk) if (T.appDefaults[pk] === 'uuid') {
    for (const r of list) if (r[pk] === undefined || r[pk] === null) { r[pk] = randomUUID(); generatedPk = true }
    cols.add(pk)
  }
  if (list.length > 1 && defaultToNull) for (const r of list) for (const c of cols) if (!(c in r)) r[c] = null
  void ctx
  return { cols: [...cols], rows: list, generatedPk }
}

function serializeRow(tname: string, cols: string[], row: Row): unknown[] {
  const T = table(tname)
  return cols.map(c => (c in row ? toDb(T.columns[c], row[c]) : undefined))
}

function insertSql(tname: string, cols: string[], rows: Row[]): SqlPart {
  const params: unknown[] = []
  const tuples = rows.map(r => {
    const vals = serializeRow(tname, cols, r)
    return '(' + vals.map(v => { if (v === undefined) return 'DEFAULT'; params.push(v); return '?' }).join(', ') + ')'
  })
  return { sql: `INSERT INTO ${qi(tname)} (${cols.map(qi).join(', ')}) VALUES ${tuples.join(', ')}`, params }
}

function pkFilter(tname: string, pks: unknown[][]): SqlPart {
  const T = table(tname)
  if (!pks.length) return { sql: '1=0', params: [] }
  if (T.pk.length === 1) return { sql: `t.${qi(T.pk[0])} IN (${pks.map(() => '?').join(', ')})`, params: pks.map(k => toDb(T.columns[T.pk[0]], k[0])) }
  return { sql: `(${T.pk.map(c => `t.${qi(c)}`).join(', ')}) IN (${pks.map(k => `(${k.map(() => '?').join(', ')})`).join(', ')})`, params: pks.flat() }
}

async function selectPks(conn: PoolConnection, tname: string, where: SqlPart[], lock = true): Promise<unknown[][]> {
  const T = table(tname)
  const w = joinWhere(where)
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT ${T.pk.map(c => `t.${qi(c)}`).join(', ')} FROM ${qi(tname)} t${w.sql}${lock ? ' FOR UPDATE' : ''}`, w.params)
  return rows.map(r => T.pk.map(c => fromDb(T.columns[c], r[c])))
}

async function checkInsert(conn: PoolConnection, tname: string, ctx: DbContext, rows: Row[]) {
  if (ctx.role === 'service') return
  const check = policyFor(tname).insert
  const lookup = async (sql: string, params: unknown[]) => { const [r] = await conn.query<RowDataPacket[]>(sql, params); return r.length > 0 }
  for (const row of rows) if (!check || !(await check(ctx, row, lookup))) throw rlsError(tname, ctx)
}

function checkColumns(tname: string, ctx: DbContext, cols: string[]) {
  if (ctx.role === 'service') return
  const allowed = policyFor(tname).writableColumns?.(ctx)
  if (!allowed) return
  const bad = cols.filter(c => !allowed.includes(c))
  if (bad.length) throw new DbFail('42501', `permission denied for table ${tname}`, 403, `Colunas não editáveis: ${bad.join(', ')}`)
}

/* ─── Erros MySQL → códigos PostgreSQL usados pela aplicação ───────────── */
function mapMysqlError(e: unknown): DbFail {
  if (e instanceof DbFail) return e
  if (e instanceof ParseError) return new DbFail(e.code, e.message, 400)
  if (e instanceof ValueError) return new DbFail(e.code, e.message, 400)
  const err = (e ?? {}) as { errno?: number; sqlMessage?: string; message?: string }
  const errno = err.errno
  const msg = String(err.sqlMessage ?? err.message ?? e)
  switch (errno) {
    case 1062: { const key = msg.match(/for key '([^']+)'/)?.[1]?.split('.').pop(); return new DbFail('23505', `duplicate key value violates unique constraint "${key ?? ''}"`, 409, msg) }
    case 1451: case 1452: return new DbFail('23503', 'insert or update on table violates foreign key constraint', 409, msg)
    case 3819: case 4025: return new DbFail('23514', 'new row violates check constraint', 400, msg)
    case 1048: case 1364: return new DbFail('23502', 'null value violates not-null constraint', 400, msg)
    case 1406: return new DbFail('22001', 'value too long for type', 400, msg)
    case 1265: case 1366: case 1292: return new DbFail('22P02', 'invalid input value', 400, msg)
    case 1054: return new DbFail('42703', msg, 400)
    default:
      console.error('[db] erro MySQL', errno, msg)
      return new DbFail('XX000', 'Erro na base de dados', 500, msg)
  }
}

const ok = (data: unknown, status: number, count: number | null = null): DbResult => ({ data, error: null, count, status, statusText: status === 201 ? 'Created' : status === 204 ? 'No Content' : 'OK' })
const fail = (e: DbFail): DbResult => ({ data: null, error: { message: e.message, code: e.code, details: e.details, hint: e.hint } as DbError, count: null, status: e.status, statusText: 'Error' })

/* ─── Ponto de entrada ─────────────────────────────────────────────────── */
export async function executeQuery(q: DbQuery, ctx: DbContext, outer?: PoolConnection): Promise<DbResult> {
  const conn = outer ?? await getPool().getConnection()
  const ownTx = !outer && q.action !== 'select'
  try {
    if (ownTx) await conn.beginTransaction()
    const res = await run(conn, q, ctx)
    if (ownTx) await conn.commit()
    return res
  } catch (e) {
    if (ownTx) await conn.rollback().catch(() => {})
    return fail(mapMysqlError(e))
  } finally {
    if (!outer) conn.release()
  }
}

async function run(conn: PoolConnection, q: DbQuery, ctx: DbContext): Promise<DbResult> {
  const T = table(q.table)
  const items = parseSelect(q.columns)
  const filters = compileFilters(q.table, q.filters ?? [])
  const finish = (rows: Row[], status: number, count: number | null) => {
    if (q.single) {
      if (rows.length === 1) return ok(rows[0], status, count)
      if (q.single === 'maybe' && rows.length === 0) return ok(null, status, count)
      throw new DbFail('PGRST116', 'JSON object requested, multiple (or no) rows returned', 406, `The result contains ${rows.length} rows`)
    }
    return ok(rows, status, count)
  }

  switch (q.action) {
    case 'select': {
      let count: number | null = null
      if (q.count) {
        const w = joinWhere([...filters, policyCond(q.table, ctx, 'select')])
        const [[r]] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${qi(q.table)} t${w.sql}`, w.params)
        count = Number(r.n)
      }
      if (q.head) return ok(null, 200, count)
      const rows = await runSelect(conn, ctx, q.table, items, filters, { order: q.order, limit: q.limit, offset: q.offset, allOrders: q.order })
      return finish(rows.map(r => r.out), 200, count)
    }

    case 'insert': {
      const { cols, rows } = prepareRows(q.table, q.values ?? {}, q.defaultToNull ?? true, ctx)
      await checkInsert(conn, q.table, ctx, rows)
      await HOOKS[q.table]?.beforeInsert?.(rows, conn)
      if (HOOKS[q.table]?.beforeInsert) for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k)
      const ins = insertSql(q.table, cols, rows)
      await conn.query(ins.sql, ins.params)
      const pks = await keysAfterInsert(conn, q.table, rows)
      await HOOKS[q.table]?.afterWrite?.(pks.map(k => k[0]), conn)
      if (!q.returning) return ok(null, 201, q.count ? rows.length : null)
      const out = await runSelect(conn, ctx, q.table, items, [pkFilter(q.table, pks)], {})
      return finish(out.map(r => r.out), 201, q.count ? rows.length : null)
    }

    case 'upsert': {
      const { cols, rows, generatedPk } = prepareRows(q.table, q.values ?? {}, q.defaultToNull ?? true, ctx)
      const conflict = (q.onConflict ?? T.pk.join(',')).split(',').map(s => s.trim()).filter(Boolean)
      conflict.forEach(c => column(q.table, c))
      // Linhas já existentes (pela chave de conflito) → também têm de passar a política de UPDATE
      const conflictFilter = (rs: Row[]): SqlPart => ({
        sql: rs.map(() => '(' + conflict.map(c => `t.${qi(c)} = ?`).join(' AND ') + ')').join(' OR ') || '1=0',
        params: rs.flatMap(r => conflict.map(c => toDb(T.columns[c], r[c]))),
      })
      const existing = await selectPks(conn, q.table, [conflictFilter(rows)])
      if (ctx.role !== 'service') {
        await checkInsert(conn, q.table, ctx, rows)
        if (existing.length && !q.ignoreDuplicates) {
          const allowed = await selectPks(conn, q.table, [conflictFilter(rows), policyCond(q.table, ctx, 'update')])
          if (allowed.length !== existing.length) throw rlsError(q.table, ctx)
          checkColumns(q.table, ctx, cols.filter(c => !conflict.includes(c) && !(generatedPk && T.pk.includes(c))))
        }
      }
      const updatable = cols.filter(c => !conflict.includes(c) && !(generatedPk && T.pk.includes(c)) && !T.columns[c].generated)
      const ins = insertSql(q.table, cols, rows)
      const tail = q.ignoreDuplicates || !updatable.length
        ? ` ON DUPLICATE KEY UPDATE ${qi(conflict[0])} = ${qi(conflict[0])}`
        : ` ON DUPLICATE KEY UPDATE ${updatable.map(c => `${qi(c)} = VALUES(${qi(c)})`).join(', ')}`
      await conn.query(ins.sql + tail, ins.params)
      const pks = await selectPks(conn, q.table, [conflictFilter(rows)], false)
      await HOOKS[q.table]?.afterWrite?.(pks.map(k => k[0]), conn)
      if (!q.returning) return ok(null, 201, q.count ? rows.length : null)
      const out = await runSelect(conn, ctx, q.table, items, [pkFilter(q.table, pks)], {})
      return finish(out.map(r => r.out), 201, q.count ? rows.length : null)
    }

    case 'update': {
      const values = { ...(q.values as Row ?? {}) }
      for (const k of Object.keys(values)) if (values[k] === undefined) delete values[k]
      const cols = Object.keys(values)
      for (const c of cols) {
        const m = column(q.table, c)
        if (m.generated) throw new DbFail('428C9', `column "${c}" can only be updated to DEFAULT`, 400)
      }
      checkColumns(q.table, ctx, cols)
      const pks = await selectPks(conn, q.table, [...filters, policyCond(q.table, ctx, 'update')])
      if (pks.length && cols.length) {
        const set = cols.map(c => `${qi(c)} = ?`).join(', ')
        const pf = pkFilter(q.table, pks)
        await conn.query(`UPDATE ${qi(q.table)} t SET ${set} WHERE ${pf.sql}`, [...cols.map(c => toDb(T.columns[c], values[c])), ...pf.params])
        if (ctx.role !== 'service') {
          const p = policyFor(q.table)
          const checkFn = p.updateCheck ?? p.update
          const cond: SqlPart = checkFn ? (() => { const c = checkFn(ctx); return c === true ? { sql: '1=1', params: [] } : c === false ? { sql: '1=0', params: [] } : c })() : { sql: '1=0', params: [] }
          const still = await selectPks(conn, q.table, [pf, cond], false)
          if (still.length !== pks.length) throw rlsError(q.table, ctx)
        }
        await HOOKS[q.table]?.afterWrite?.(pks.map(k => k[0]), conn)
      }
      if (!q.returning) return ok(null, 204, q.count ? pks.length : null)
      const out = await runSelect(conn, ctx, q.table, items, [pkFilter(q.table, pks)], {})
      return finish(out.map(r => r.out), 200, q.count ? pks.length : null)
    }

    case 'delete': {
      const pks = await selectPks(conn, q.table, [...filters, policyCond(q.table, ctx, 'delete')])
      let before: Row[] = []
      if (q.returning && pks.length) before = (await runSelect(conn, ctx, q.table, items, [pkFilter(q.table, pks)], {})).map(r => r.out)
      if (pks.length) {
        const pf = pkFilter(q.table, pks)
        await conn.query(`DELETE t FROM ${qi(q.table)} t WHERE ${pf.sql}`, pf.params)
      }
      if (!q.returning) return ok(null, 204, q.count ? pks.length : null)
      return finish(before, 200, q.count ? pks.length : null)
    }
  }
}

/** Chaves das linhas inseridas (sem RETURNING no MySQL). */
async function keysAfterInsert(conn: PoolConnection, tname: string, rows: Row[]): Promise<unknown[][]> {
  const T = table(tname)
  if (T.pk.every(c => rows.every(r => r[c] !== undefined && r[c] !== null))) return rows.map(r => T.pk.map(c => r[c]))
  // Chave com DEFAULT da base (ex.: site_home_hero.id = 1): procurar pelos valores inseridos
  const out: unknown[][] = []
  for (const r of rows) {
    const cols = Object.keys(r).filter(c => r[c] !== null && !['json', 'array'].includes(T.columns[c].kind))
    const w = joinWhere(cols.map(c => ({ sql: `t.${qi(c)} = ?`, params: [toDb(T.columns[c], r[c])] })))
    const [found] = await conn.query<RowDataPacket[]>(`SELECT ${T.pk.map(c => `t.${qi(c)}`).join(', ')} FROM ${qi(tname)} t${w.sql} LIMIT 1`, w.params)
    if (found[0]) out.push(T.pk.map(c => fromDb(T.columns[c], found[0][c])))
  }
  return out
}

/** Execução direta de SQL parametrizado (para as RPCs). */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const r = await fn(conn)
    await conn.commit()
    return r
  } catch (e) {
    await conn.rollback().catch(() => {})
    throw e
  } finally {
    conn.release()
  }
}

export { mapMysqlError, fail as failResult, ok as okResult }
