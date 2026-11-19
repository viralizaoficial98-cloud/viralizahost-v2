/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
// Query builder com a mesma API encadeável do supabase-js/PostgREST usada no
// projecto (from().select().eq().order()...). Não executa SQL: monta um
// QueryDescriptor e entrega-o a um executor (servidor: MariaDB; navegador: /api/db).
// Isomórfico — não importar módulos de servidor aqui.

import type {
  Condition, DbResponse, Filter, FilterOp, Operation, QueryDescriptor,
} from './types'

export type Executor = (q: QueryDescriptor) => Promise<DbResponse>

const OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'cs', 'cd'])

/** Divide por vírgulas ao nível de topo (ignora vírgulas dentro de parênteses/aspas). */
function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0, quoted = false, cur = ''
  for (const ch of s) {
    if (ch === '"') quoted = !quoted
    if (!quoted && ch === '(') depth++
    if (!quoted && ch === ')') depth--
    if (!quoted && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur) out.push(cur)
  return out.map(x => x.trim()).filter(Boolean)
}

function parseValue(op: FilterOp, raw: string): unknown {
  const v = raw.replace(/^"(.*)"$/, '$1')
  if (op === 'is') return v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v
  if (op === 'in') return splitTopLevel(v.replace(/^\((.*)\)$/, '$1')).map(x => x.replace(/^"(.*)"$/, '$1'))
  if (op === 'like' || op === 'ilike') return v.replace(/\*/g, '%')
  return v
}

/** Analisa a sintaxe de filtros PostgREST: `col.op.value`, `not.col.op.value`, `or(...)`, `and(...)`. */
export function parseLogicTree(expr: string): Condition[] {
  return splitTopLevel(expr).map(part => {
    const group = part.match(/^(not\.)?(or|and)\(([\s\S]*)\)$/)
    if (group) {
      const inner = parseLogicTree(group[3])
      if (group[1]) throw new Error('not.or/not.and não suportado')
      return group[2] === 'or' ? { or: inner } : { and: inner }
    }
    const m = part.match(/^([\w]+)\.(not\.)?(\w+)\.([\s\S]*)$/)
    if (!m || !OPS.has(m[3])) throw new Error(`Filtro inválido: ${part}`)
    const op = m[3] as FilterOp
    return { column: m[1], op, value: parseValue(op, m[4]), negate: !!m[2] } as Filter
  })
}

export class QueryBuilder<T = any, R = T[]> implements PromiseLike<DbResponse<R>> {
  private q: QueryDescriptor

  constructor(private exec: Executor, table: string) {
    this.q = { table, op: 'select', conditions: [], order: [] }
  }

  // ── Operações ────────────────────────────────────────────────────────────
  select(columns = '*', opts: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean } = {}): this {
    if (this.q.op === 'select') {
      this.q.select = columns
      if (opts.count) this.q.count = opts.count
      if (opts.head) this.q.head = true
    } else {
      // insert/update/upsert/delete ... .select() → devolve as linhas afectadas
      this.q.returning = true
      this.q.select = columns
    }
    return this
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[], opts: { count?: 'exact' } = {}): this {
    return this.setOp('insert', values, opts)
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    opts: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' } = {},
  ): this {
    this.setOp('upsert', values, opts)
    if (opts.onConflict) this.q.onConflict = opts.onConflict
    if (opts.ignoreDuplicates) this.q.ignoreDuplicates = true
    return this
  }

  update(values: Record<string, unknown>, opts: { count?: 'exact' } = {}): this {
    return this.setOp('update', values, opts)
  }

  delete(opts: { count?: 'exact' } = {}): this {
    return this.setOp('delete', undefined, opts)
  }

  private setOp(op: Operation, values: QueryDescriptor['values'], opts: { count?: 'exact' }): this {
    this.q.op = op
    this.q.values = values
    if (opts.count) this.q.count = opts.count
    return this
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  private add(column: string, op: FilterOp, value: unknown, negate = false): this {
    this.q.conditions.push({ column, op, value, negate })
    return this
  }
  eq(c: string, v: unknown) { return this.add(c, 'eq', v) }
  neq(c: string, v: unknown) { return this.add(c, 'neq', v) }
  gt(c: string, v: unknown) { return this.add(c, 'gt', v) }
  gte(c: string, v: unknown) { return this.add(c, 'gte', v) }
  lt(c: string, v: unknown) { return this.add(c, 'lt', v) }
  lte(c: string, v: unknown) { return this.add(c, 'lte', v) }
  like(c: string, v: string) { return this.add(c, 'like', v) }
  ilike(c: string, v: string) { return this.add(c, 'ilike', v) }
  is(c: string, v: null | boolean) { return this.add(c, 'is', v) }
  in(c: string, v: readonly unknown[]) { return this.add(c, 'in', [...v]) }
  contains(c: string, v: unknown) { return this.add(c, 'cs', v) }
  containedBy(c: string, v: unknown) { return this.add(c, 'cd', v) }
  match(obj: Record<string, unknown>) {
    for (const [k, v] of Object.entries(obj)) this.add(k, 'eq', v)
    return this
  }
  not(c: string, op: string, v: unknown) {
    const fop = op as FilterOp
    return this.add(c, fop, typeof v === 'string' ? parseValue(fop, v) : v, true)
  }
  filter(c: string, op: string, v: unknown) {
    const neg = op.startsWith('not.')
    const fop = (neg ? op.slice(4) : op) as FilterOp
    if (!OPS.has(fop)) throw new Error(`Operador não suportado: ${op}`)
    return this.add(c, fop, typeof v === 'string' ? parseValue(fop, v) : v, neg)
  }
  or(expr: string, opts: { referencedTable?: string; foreignTable?: string } = {}) {
    if (opts.referencedTable || opts.foreignTable) throw new Error('or() em tabela referenciada não suportado')
    this.q.conditions.push({ or: parseLogicTree(expr) })
    return this
  }

  // ── Modificadores ────────────────────────────────────────────────────────
  order(column: string, opts: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string; foreignTable?: string } = {}) {
    this.q.order.push({
      column,
      ascending: opts.ascending !== false,
      nullsFirst: opts.nullsFirst,
      referencedTable: opts.referencedTable ?? opts.foreignTable,
    })
    return this
  }
  limit(n: number) { this.q.limit = n; return this }
  range(from: number, to: number) { this.q.offset = from; this.q.limit = to - from + 1; return this }
  single<X = T>() { this.q.single = 'single'; return this as unknown as QueryBuilder<X, X> }
  maybeSingle<X = T>() { this.q.single = 'maybe'; return this as unknown as QueryBuilder<X, X | null> }
  abortSignal() { return this }
  returns<X>() { return this as unknown as QueryBuilder<X, X> }

  /** Descrição do pedido (usado para enviar ao servidor). */
  toDescriptor(): QueryDescriptor { return structuredClone(this.q) }

  then<R1 = DbResponse<R>, R2 = never>(
    onfulfilled?: ((value: DbResponse<R>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.exec(this.toDescriptor()).then(onfulfilled as any, onrejected)
  }
}

export interface DbClient {
  from<T = any>(table: string): QueryBuilder<T>
  schema(name: string): DbClient
  rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<DbResponse<T>>
}
