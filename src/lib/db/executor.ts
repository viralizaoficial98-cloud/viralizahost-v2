import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
import { randomUUID } from 'node:crypto'
import { getPool, withTransaction, type Queryable } from './pool'
import { SCHEMA_META } from './schema.generated'
import { parseSelect, type SelectTree } from './select-parser'
import { POLICIES, type AuthContext, type RowFilter, type SqlFragment } from './policies'
import { fromDb, toDb } from './values'
import { beforeInsert, afterWrite, AFTER_WRITE_TABLES } from './hooks'
import type { Condition, DbError, DbResponse, Filter, OrderSpec, QueryDescriptor, TableMeta, RelationMeta } from './types'

type Row = Record<string, any>
const qi = (s: string) => '`' + s.replace(/`/g, '``') + '`'

// ── Erros (mesma forma e códigos do PostgREST/PostgreSQL) ────────────────────
export class DbFailure extends Error {
  constructor(public code: string, message: string, public status = 400, public details: string | null = null, public hint: string | null = null) {
    super(message)
  }
}

const MYSQL_TO_PG: Record<number, [string, number]> = {
  1062: ['23505', 409], // duplicate key
  1451: ['23503', 409], // FK: linha referenciada
  1452: ['23503', 409], // FK: referência inexistente
  1048: ['23502', 400], // NOT NULL
  1364: ['23502', 400], // campo sem default
  4025: ['23514', 400], // CHECK
  3819: ['23514', 400],
  1265: ['22P02', 400], // valor inválido (ENUM/trunc)
  1366: ['22P02', 400],
  1292: ['22007', 400], // data inválida
  1406: ['22001', 400], // valor demasiado longo
  1146: ['42P01', 404], // tabela inexistente
  1054: ['42703', 400], // coluna inexistente
  1213: ['40P01', 409], // deadlock
  1205: ['55P03', 409], // lock timeout
}

export function toDbError(e: unknown): { error: DbError; status: number } {
  if (e instanceof DbFailure) return { error: { message: e.message, code: e.code, details: e.details, hint: e.hint }, status: e.status }
  const err = e as { errno?: number; sqlMessage?: string; message?: string; pgCode?: string }
  if (err?.pgCode) return { error: { message: err.message ?? 'erro', code: err.pgCode, details: null, hint: null }, status: 400 }
  const mapped = err?.errno ? MYSQL_TO_PG[err.errno] : undefined
  if (mapped) {
    let message = err.sqlMessage ?? err.message ?? 'erro'
    if (mapped[0] === '23505') {
      const key = message.match(/for key '(?:[^.']*\.)?([^']+)'/)?.[1]
      message = `duplicate key value violates unique constraint "${key ?? 'unique'}"`
    }
    return { error: { message, code: mapped[0], details: err.sqlMessage ?? null, hint: null }, status: mapped[1] }
  }
  // Erros de ligação/infra: mensagem genérica (não expor detalhes de configuração)
  console.error('[db] erro inesperado:', err?.errno ?? '', err?.message ?? e)
  return { error: { message: 'Erro na base de dados', code: 'DB000', details: null, hint: null }, status: 500 }
}

// ── Metadados ────────────────────────────────────────────────────────────────
function tableMeta(table: string): TableMeta {
  const m = (SCHEMA_META as Record<string, TableMeta>)[table]
  if (!m) throw new DbFailure('PGRST205', `Could not find the table 'viralizahost.${table}' in the schema cache`, 404)
  return m
}

function colMeta(table: string, meta: TableMeta, col: string) {
  const c = meta.columns[col]
  if (!c || c.hidden) throw new DbFailure('42703', `column ${table}.${col} does not exist`)
  return c
}

function visibleColumns(meta: TableMeta) {
  return Object.entries(meta.columns).filter(([, c]) => !c.hidden).map(([n]) => n)
}

// ── Políticas ────────────────────────────────────────────────────────────────
function policyFilter(table: string, op: 'select' | 'update' | 'delete', ctx: AuthContext, alias: string): SqlFragment | null {
  if (ctx.kind === 'service') return null
  const rule: RowFilter | undefined = POLICIES[table]?.[op]
  const res = rule ? rule(ctx) : false
  if (res === true) return null
  if (res === false) return { sql: '0 = 1', params: [] }
  return { sql: res.sql.replace(/\$t\./g, `${alias}.`), params: res.params }
}

async function checkInsert(table: string, ctx: AuthContext, rows: Row[], db: Queryable) {
  if (ctx.kind === 'service') return
  const rule = POLICIES[table]?.insert
  const lookup = async (sql: string, params: unknown[]) => (await db.query(sql, params))[0] as unknown[]
  for (const row of rows) {
    if (!rule || !(await rule(ctx, row, lookup))) {
      throw new DbFailure('42501', `new row violates row-level security policy for table "${table}"`, 403)
    }
  }
}

// ── WHERE ────────────────────────────────────────────────────────────────────
function compileCondition(table: string, meta: TableMeta, alias: string, c: Condition, params: unknown[]): string {
  if ('or' in c) return '(' + (c.or.map(x => compileCondition(table, meta, alias, x, params)).join(' OR ') || '0 = 1') + ')'
  if ('and' in c) return '(' + (c.and.map(x => compileCondition(table, meta, alias, x, params)).join(' AND ') || '1 = 1') + ')'
  const f = c as Filter
  const cm = colMeta(table, meta, f.column)
  const col = `${alias}.${qi(f.column)}`
  const val = (v: unknown) => {
    if (cm.kind === 'json' || cm.kind === 'array') return typeof v === 'string' ? v : JSON.stringify(v)
    return toDb(cm, v)
  }
  let expr: string
  switch (f.op) {
    case 'eq': expr = `${col} = ?`; params.push(val(f.value)); break
    case 'neq': expr = `${col} <> ?`; params.push(val(f.value)); break
    case 'gt': expr = `${col} > ?`; params.push(val(f.value)); break
    case 'gte': expr = `${col} >= ?`; params.push(val(f.value)); break
    case 'lt': expr = `${col} < ?`; params.push(val(f.value)); break
    case 'lte': expr = `${col} <= ?`; params.push(val(f.value)); break
    case 'like': expr = `${col} LIKE ? COLLATE utf8mb4_bin`; params.push(String(f.value)); break
    case 'ilike': expr = `${col} LIKE ?`; params.push(String(f.value)); break
    case 'is':
      expr = f.value === null || f.value === 'null' ? `${col} IS NULL`
        : f.value === true || f.value === 'true' ? `${col} IS TRUE` : `${col} IS FALSE`
      break
    case 'in': {
      const list = Array.isArray(f.value) ? f.value : [f.value]
      if (!list.length) { expr = '0 = 1'; break }
      expr = `${col} IN (${list.map(() => '?').join(', ')})`
      params.push(...list.map(v => val(v)))
      break
    }
    case 'cs': {
      let v = f.value
      if (typeof v === 'string' && cm.kind === 'array') v = v.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
      expr = `JSON_CONTAINS(${col}, ?)`
      params.push(typeof v === 'string' ? v : JSON.stringify(v))
      break
    }
    case 'cd': {
      expr = `JSON_CONTAINS(?, ${col})`
      params.push(typeof f.value === 'string' ? f.value : JSON.stringify(f.value))
      break
    }
    default: throw new DbFailure('PGRST100', `operador não suportado: ${f.op}`)
  }
  return f.negate ? `NOT (${expr})` : expr
}

function buildWhere(table: string, meta: TableMeta, alias: string, conds: Condition[], policy: SqlFragment | null, extra: SqlFragment[] = []) {
  const params: unknown[] = []
  const parts = conds.map(c => compileCondition(table, meta, alias, c, params))
  for (const x of [policy, ...extra]) if (x) { parts.push(`(${x.sql})`); params.push(...x.params) }
  return { sql: parts.length ? ' WHERE ' + parts.join(' AND ') : '', params }
}

function buildOrder(table: string, meta: TableMeta, alias: string, order: OrderSpec[]) {
  if (!order.length) return ''
  return ' ORDER BY ' + order.map(o => {
    colMeta(table, meta, o.column)
    const col = `${alias}.${qi(o.column)}`
    // PostgreSQL: ASC → NULLS LAST, DESC → NULLS FIRST (por omissão)
    const nullsFirst = o.nullsFirst ?? !o.ascending
    return `(${col} IS NULL) ${nullsFirst ? 'DESC' : 'ASC'}, ${col} ${o.ascending ? 'ASC' : 'DESC'}`
  }).join(', ')
}

// ── Leitura com embeds ───────────────────────────────────────────────────────
function convertRow(meta: TableMeta, raw: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(raw)) out[k] = fromDb(meta.columns[k], v)
  return out
}

function resolveRelation(table: string, meta: TableMeta, relation: string, hint?: string): RelationMeta {
  let cands = meta.relations.filter(r => r.table === relation)
  if (!cands.length) {
    // `alias:fk_column(...)` — embed pelo nome da coluna FK
    cands = meta.relations.filter(r => !r.many && r.columns.length === 1 && r.columns[0] === relation)
  }
  if (hint) cands = cands.filter(r => r.name === hint || r.columns.includes(hint) || r.refColumns.includes(hint))
  if (!cands.length) {
    throw new DbFailure('PGRST200', `Could not find a relationship between '${table}' and '${relation}' in the schema cache`)
  }
  if (cands.length > 1) {
    throw new DbFailure('PGRST201', `Could not embed because more than one relationship was found for '${table}' and '${relation}'`, 300)
  }
  return cands[0]
}

interface FetchOpts {
  conditions: Condition[]
  order: OrderSpec[]
  limit?: number
  offset?: number
  extra?: SqlFragment[]
  embedOrders?: OrderSpec[]
}

async function fetchRows(db: Queryable, ctx: AuthContext, table: string, tree: SelectTree, opts: FetchOpts): Promise<Row[]> {
  const meta = tableMeta(table)
  const alias = 't0'
  const outCols = new Map<string, string>() // alias → coluna
  if (tree.star) for (const c of visibleColumns(meta)) outCols.set(c, c)
  for (const c of tree.columns) { colMeta(table, meta, c.name); outCols.set(c.alias, c.name) }

  const embeds = tree.embeds.map(e => {
    const rel = resolveRelation(table, meta, e.relation, e.hint)
    const childTable = rel.table
    return { ...e, rel, childTable }
  })
  const needed = new Set<string>(outCols.values())
  for (const e of embeds) for (const c of e.rel.columns) needed.add(c)

  const selectList = [...needed].map(c => `${alias}.${qi(c)}`).join(', ') || '1'
  const where = buildWhere(table, meta, alias, opts.conditions, policyFilter(table, 'select', ctx, alias), opts.extra)
  let sql = `SELECT ${selectList} FROM ${qi(table)} AS ${alias}${where.sql}${buildOrder(table, meta, alias, opts.order)}`
  const params = [...where.params]
  if (opts.limit != null) { sql += ' LIMIT ?'; params.push(opts.limit) }
  if (opts.offset != null) { if (opts.limit == null) sql += ' LIMIT 18446744073709551615'; sql += ' OFFSET ?'; params.push(opts.offset) }

  const [rawRows] = await db.query(sql, params)
  let rows = (rawRows as Row[]).map(r => convertRow(meta, r))

  for (const e of embeds) {
    const childMeta = tableMeta(e.childTable)
    const localCol = e.rel.columns[0]
    const remoteCol = e.rel.refColumns[0]
    const keys = [...new Set(rows.map(r => r[localCol]).filter(v => v != null))]
    const childOrder = (opts.embedOrders ?? []).filter(o => o.referencedTable === e.alias || o.referencedTable === e.relation)
    const oneToOne = e.rel.many && (childMeta.pk.join() === remoteCol || childMeta.unique.some(u => u.length === 1 && u[0] === remoteCol))
    let grouped = new Map<unknown, Row[]>()
    if (keys.length) {
      if (e.tree.countOnly) {
        const cAlias = 't0'
        const w = buildWhere(e.childTable, childMeta, cAlias, [{ column: remoteCol, op: 'in', value: keys }], policyFilter(e.childTable, 'select', ctx, cAlias))
        const [cnt] = await db.query(`SELECT ${cAlias}.${qi(remoteCol)} AS k, COUNT(*) AS count FROM ${qi(e.childTable)} AS ${cAlias}${w.sql} GROUP BY ${cAlias}.${qi(remoteCol)}`, w.params)
        for (const r of cnt as Row[]) grouped.set(r.k, [{ count: Number(r.count) }])
      } else {
        const childTree: SelectTree = { ...e.tree, columns: [...e.tree.columns] }
        const hasRemote = childTree.star || childTree.columns.some(c => c.name === remoteCol && c.alias === remoteCol)
        if (!hasRemote) childTree.columns.push({ name: remoteCol, alias: `__k_${remoteCol}` })
        const childRows = await fetchRows(db, ctx, e.childTable, childTree, {
          conditions: [{ column: remoteCol, op: 'in', value: keys }],
          order: childOrder,
          embedOrders: opts.embedOrders,
        })
        const keyField = hasRemote ? remoteCol : `__k_${remoteCol}`
        grouped = new Map()
        for (const cr of childRows) {
          const k = cr[keyField]
          if (!hasRemote) delete cr[keyField]
          if (!grouped.has(k)) grouped.set(k, [])
          grouped.get(k)!.push(cr)
        }
      }
    }
    for (const r of rows) {
      const list = r[localCol] == null ? [] : grouped.get(r[localCol]) ?? []
      if (e.tree.countOnly) r[e.alias] = list.length ? list : [{ count: 0 }]
      else if (!e.rel.many || oneToOne) r[e.alias] = list[0] ?? null
      else r[e.alias] = list
    }
    if (e.inner) rows = rows.filter(r => (Array.isArray(r[e.alias]) ? r[e.alias].length > 0 : r[e.alias] != null))
  }

  // Projecção final: aliases pedidos + embeds (remove colunas só usadas para joins)
  return rows.map(r => {
    const o: Row = {}
    for (const [a, c] of outCols) o[a] = r[c]
    for (const [k, v] of Object.entries(r)) if (k.startsWith('__k_')) o[k] = v
    for (const e of embeds) o[e.alias] = r[e.alias]
    return o
  })
}

async function countRows(db: Queryable, ctx: AuthContext, table: string, conds: Condition[], extra: SqlFragment[] = []) {
  const meta = tableMeta(table)
  const w = buildWhere(table, meta, 't0', conds, policyFilter(table, 'select', ctx, 't0'), extra)
  const [r] = await db.query(`SELECT COUNT(*) AS n FROM ${qi(table)} AS t0${w.sql}`, w.params)
  return Number((r as Row[])[0].n)
}

// ── Escrita ──────────────────────────────────────────────────────────────────
function prepareRow(table: string, meta: TableMeta, input: Row): Row {
  const row: Row = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue
    const cm = meta.columns[k]
    if (!cm || cm.hidden) throw new DbFailure('PGRST204', `Could not find the '${k}' column of '${table}' in the schema cache`)
    if (cm.generated) continue
    row[k] = v
  }
  return row
}

function fillDefaults(meta: TableMeta, row: Row) {
  for (const pk of meta.pk) {
    if (row[pk] == null && meta.columns[pk]?.defaultUuid) row[pk] = randomUUID()
  }
}

function pkFilter(meta: TableMeta, rows: Row[]): SqlFragment {
  if (!rows.length) return { sql: '0 = 1', params: [] }
  if (meta.pk.length === 1) {
    return { sql: `t0.${qi(meta.pk[0])} IN (${rows.map(() => '?').join(', ')})`, params: rows.map(r => r[meta.pk[0]]) }
  }
  return {
    sql: rows.map(() => '(' + meta.pk.map(c => `t0.${qi(c)} = ?`).join(' AND ') + ')').join(' OR '),
    params: rows.flatMap(r => meta.pk.map(c => r[c])),
  }
}

async function insertRows(db: Queryable, table: string, meta: TableMeta, rows: Row[], conflict?: { cols: string[]; ignore: boolean }) {
  // Agrupa por conjunto de colunas (cada grupo usa os DEFAULTs das colunas omitidas)
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const key = Object.keys(r).sort().join(',')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  for (const [key, group] of groups) {
    const cols = key ? key.split(',') : []
    const params: unknown[] = []
    const values = group.map(r => {
      for (const c of cols) params.push(toDb(meta.columns[c], r[c]))
      return '(' + cols.map(() => '?').join(', ') + ')'
    })
    let sql = cols.length
      ? `INSERT INTO ${qi(table)} (${cols.map(qi).join(', ')}) VALUES ${values.join(', ')}`
      : `INSERT INTO ${qi(table)} () VALUES ${group.map(() => '()').join(', ')}`
    if (conflict) {
      const updatable = cols.filter(c => !conflict.cols.includes(c) && !meta.pk.includes(c))
      const set = conflict.ignore || !updatable.length
        ? `${qi(meta.pk[0])} = ${qi(meta.pk[0])}`
        : updatable.map(c => `${qi(c)} = VALUES(${qi(c)})`).join(', ')
      sql += ` ON DUPLICATE KEY UPDATE ${set}`
    }
    await db.query(sql, params)
  }
}

/** Selecciona PKs (e linhas completas) que satisfazem filtros + política, bloqueando-as. */
async function lockTargets(db: Queryable, ctx: AuthContext, table: string, meta: TableMeta, op: 'update' | 'delete', conds: Condition[], limit?: number) {
  const w = buildWhere(table, meta, 't0', conds, policyFilter(table, op, ctx, 't0'))
  // Também é preciso poder ver a linha (PostgREST aplica USING de SELECT nas linhas devolvidas)
  let sql = `SELECT ${meta.pk.map(c => 't0.' + qi(c)).join(', ')} FROM ${qi(table)} AS t0${w.sql}`
  const params = [...w.params]
  if (limit != null) { sql += ' LIMIT ?'; params.push(limit) }
  const [rows] = await db.query(sql + ' FOR UPDATE', params)
  return rows as Row[]
}

// ── Execução ─────────────────────────────────────────────────────────────────
function respond(data: unknown, status: number, count: number | null = null): DbResponse {
  return { data, error: null, count, status, statusText: status === 201 ? 'Created' : status === 204 ? 'No Content' : 'OK' }
}

function applySingle(q: QueryDescriptor, rows: Row[], status: number, count: number | null): DbResponse {
  if (!q.single) return respond(rows, status, count)
  if (rows.length === 1) return respond(rows[0], status, count)
  if (rows.length === 0 && q.single === 'maybe') return respond(null, status, count)
  throw new DbFailure('PGRST116', 'JSON object requested, multiple (or no) rows returned', 406,
    `The result contains ${rows.length} rows`)
}

export async function execute(q: QueryDescriptor, ctx: AuthContext, conn?: Queryable): Promise<DbResponse> {
  try {
    const meta = tableMeta(q.table)
    const tree = parseSelect(q.select)
    const embedOrders = q.order.filter(o => o.referencedTable)
    const order = q.order.filter(o => !o.referencedTable)

    if (q.op === 'select') {
      const db = conn ?? getPool()
      const count = q.count ? await countRows(db, ctx, q.table, q.conditions) : null
      if (q.head) return respond(null, 200, count)
      let limit = q.limit
      if (q.single && limit == null) limit = 2
      const rows = await fetchRows(db, ctx, q.table, tree, { conditions: q.conditions, order, limit, offset: q.offset, embedOrders })
      return applySingle(q, rows, 200, count)
    }

    const run = async (db: Queryable): Promise<DbResponse> => {
      let affected: Row[] = [] // linhas identificadas pela PK

      if (q.op === 'insert' || q.op === 'upsert') {
        const input = Array.isArray(q.values) ? q.values : [q.values ?? {}]
        const rows = input.map(r => prepareRow(q.table, meta, r))
        rows.forEach(r => fillDefaults(meta, r))
        const conflictCols = q.op === 'upsert' ? (q.onConflict ? q.onConflict.split(',').map(s => s.trim()) : meta.pk) : []
        for (const c of conflictCols) colMeta(q.table, meta, c)

        if (q.op === 'upsert' && ctx.kind !== 'service') {
          // Linhas existentes têm de satisfazer a política de UPDATE
          for (const r of rows) {
            const conds: Condition[] = conflictCols.map(c => ({ column: c, op: 'eq', value: r[c] }))
            const exists = await countRows(db, { kind: 'service' }, q.table, conds)
            if (exists) {
              const allowed = await lockTargets(db, ctx, q.table, meta, 'update', conds)
              if (!allowed.length) throw new DbFailure('42501', `new row violates row-level security policy (USING expression) for table "${q.table}"`, 403)
            }
          }
        }
        if (q.op === 'insert') await beforeInsert(q.table, rows, db)
        await checkInsert(q.table, ctx, rows, db)
        await insertRows(db, q.table, meta, rows, q.op === 'upsert' ? { cols: conflictCols, ignore: !!q.ignoreDuplicates } : undefined)

        if (q.op === 'upsert') {
          // Localiza as linhas finais pelas colunas de conflito (a PK pode ser a já existente)
          const lookup = rows.map(r => ({ and: conflictCols.map(c => ({ column: c, op: 'eq' as const, value: r[c] })) }))
          const [found] = await db.query(
            `SELECT ${meta.pk.map(c => 't0.' + qi(c)).join(', ')} FROM ${qi(q.table)} AS t0${buildWhere(q.table, meta, 't0', [{ or: lookup }], null).sql}`,
            buildWhere(q.table, meta, 't0', [{ or: lookup }], null).params,
          )
          affected = found as Row[]
        } else {
          affected = rows.map(r => Object.fromEntries(meta.pk.map(c => [c, r[c]])))
        }
      } else {
        // update / delete
        affected = await lockTargets(db, ctx, q.table, meta, q.op as 'update' | 'delete', q.conditions)
        if (q.op === 'update' && affected.length) {
          const values = prepareRow(q.table, meta, (q.values ?? {}) as Row)
          const cols = Object.keys(values)
          if (cols.length) {
            const pk = pkFilter(meta, affected)
            const set = cols.map(c => `t0.${qi(c)} = ?`).join(', ')
            await db.query(`UPDATE ${qi(q.table)} AS t0 SET ${set} WHERE ${pk.sql}`,
              [...cols.map(c => toDb(meta.columns[c], values[c])), ...pk.params])
          }
        }
      }

      let returned: Row[] | null = null
      const needFull = q.returning || AFTER_WRITE_TABLES.has(q.table)
      if (needFull && affected.length) {
        const pk = pkFilter(meta, affected)
        if (AFTER_WRITE_TABLES.has(q.table) && q.op !== 'delete') {
          const full = await fetchRows(db, { kind: 'service' }, q.table, { star: true, columns: [], embeds: [], countOnly: false }, { conditions: [], order: [], extra: [pk] })
          await afterWrite(q.table, full, db)
        }
        if (q.returning) {
          const visible = await fetchRows(db, ctx, q.table, tree, { conditions: [], order, extra: [pk], embedOrders })
          // preserva a ordem de entrada
          const key = (r: Row) => meta.pk.map(c => String(r[c])).join('|')
          const pos = new Map(affected.map((r, i) => [key(r), i]))
          const hasPk = meta.pk.every(c => tree.star || tree.columns.some(x => x.name === c))
          returned = hasPk ? visible.sort((a, b) => (pos.get(key(a)) ?? 0) - (pos.get(key(b)) ?? 0)) : visible
        }
      }

      if (q.op === 'delete' && affected.length) {
        if (q.returning && !returned) returned = []
        const pk = pkFilter(meta, affected)
        await db.query(`DELETE t0 FROM ${qi(q.table)} AS t0 WHERE ${pk.sql}`, pk.params)
      }

      const count = q.count ? affected.length : null
      const status = q.op === 'insert' || q.op === 'upsert' ? 201 : q.returning ? 200 : 204
      if (!q.returning) return respond(null, status, count)
      return applySingle(q, returned ?? [], status, count)
    }

    // Escritas: transacção própria, salvo se já estivermos dentro de uma.
    return conn ? await run(conn) : await withTransaction(c => run(c))
  } catch (e) {
    const { error, status } = toDbError(e)
    return { data: null, error, count: null, status, statusText: 'Error' }
  }
}


// Para RPCs e módulos de servidor que precisam de SQL directo
export { fetchRows as _fetchRows }
