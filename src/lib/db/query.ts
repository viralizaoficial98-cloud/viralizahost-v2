/*
 * Construtor de consultas compatível com o subconjunto da API do supabase-js (PostgrestQueryBuilder)
 * usado pela aplicação. Só recolhe a consulta (DbQuery); quem a executa é injetado:
 *   - no servidor: executor MySQL com as políticas de acesso (executor.ts)
 *   - no browser:  pedido para /api/db (remote.ts)
 */
import type { DbQuery, DbResult, FilterOp } from './types'
import { parseIsValue, parseList } from './parse'

export type Executor = (q: DbQuery) => Promise<DbResult>

type SelectOpts = { count?: 'exact' | 'planned' | 'estimated' | null; head?: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- os dados não são tipados, como no supabase-js sem tipos gerados
export class QueryBuilder<T = any> implements PromiseLike<DbResult<T>> {
  private q: DbQuery
  private throwErrors = false

  constructor(table: string, private exec: Executor) {
    this.q = { table, action: 'select', filters: [], order: [] }
  }

  /* ── acções ──────────────────────────────────────────────────────────── */
  select(columns = '*', opts: SelectOpts = {}) {
    if (this.q.action === 'select') {
      this.q.columns = columns
      this.q.count = opts.count ?? null
      this.q.head = !!opts.head
    } else {
      this.q.returning = true
      this.q.columns = columns
      if (opts.count) this.q.count = opts.count
    }
    return this
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[], opts: { count?: 'exact'; defaultToNull?: boolean } = {}) {
    this.q.action = 'insert'; this.q.values = values
    this.q.defaultToNull = opts.defaultToNull ?? true
    if (opts.count) this.q.count = opts.count
    return this
  }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], opts: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact'; defaultToNull?: boolean } = {}) {
    this.q.action = 'upsert'; this.q.values = values
    this.q.onConflict = opts.onConflict; this.q.ignoreDuplicates = !!opts.ignoreDuplicates
    this.q.defaultToNull = opts.defaultToNull ?? true
    if (opts.count) this.q.count = opts.count
    return this
  }
  update(values: Record<string, unknown>, opts: { count?: 'exact' } = {}) {
    this.q.action = 'update'; this.q.values = values
    if (opts.count) this.q.count = opts.count
    return this
  }
  delete(opts: { count?: 'exact' } = {}) {
    this.q.action = 'delete'
    if (opts.count) this.q.count = opts.count
    return this
  }

  /* ── filtros ─────────────────────────────────────────────────────────── */
  private add(col: string, op: FilterOp, value: unknown, negate = false) {
    this.q.filters.push({ type: 'op', col, op, value, negate }); return this
  }
  eq(col: string, value: unknown) { return this.add(col, 'eq', value) }
  neq(col: string, value: unknown) { return this.add(col, 'neq', value) }
  gt(col: string, value: unknown) { return this.add(col, 'gt', value) }
  gte(col: string, value: unknown) { return this.add(col, 'gte', value) }
  lt(col: string, value: unknown) { return this.add(col, 'lt', value) }
  lte(col: string, value: unknown) { return this.add(col, 'lte', value) }
  like(col: string, pattern: string) { return this.add(col, 'like', pattern) }
  ilike(col: string, pattern: string) { return this.add(col, 'ilike', pattern) }
  in(col: string, values: readonly unknown[]) { return this.add(col, 'in', [...values]) }
  is(col: string, value: null | boolean) { return this.add(col, 'is', value) }
  contains(col: string, value: unknown) { return this.add(col, 'cs', value) }
  containedBy(col: string, value: unknown) { return this.add(col, 'cd', value) }
  match(obj: Record<string, unknown>) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this }
  not(col: string, op: string, value: unknown) { return this.filter(col, op, value, true) }
  filter(col: string, op: string, value: unknown, negate = false) {
    let o = op
    if (o.startsWith('not.')) { negate = !negate; o = o.slice(4) }
    const map: Record<string, FilterOp> = { eq: 'eq', neq: 'neq', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', like: 'like', ilike: 'ilike', in: 'in', is: 'is', cs: 'cs', cd: 'cd' }
    const f = map[o]
    if (!f) throw new Error(`Operador não suportado: ${op}`)
    let v = value
    if (f === 'in' && typeof v === 'string') v = parseList(v)
    if (f === 'is') v = parseIsValue(v)
    return this.add(col, f, v, negate)
  }
  or(expr: string, opts?: { foreignTable?: string; referencedTable?: string }) {
    void opts
    this.q.filters.push({ type: 'or', expr }); return this
  }

  /* ── modificadores ───────────────────────────────────────────────────── */
  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string; referencedTable?: string } = {}) {
    this.q.order.push({ col, ascending: opts.ascending ?? true, nullsFirst: opts.nullsFirst, foreignTable: opts.foreignTable ?? opts.referencedTable })
    return this
  }
  limit(n: number) { this.q.limit = n; return this }
  range(from: number, to: number) { this.q.offset = from; this.q.limit = to - from + 1; return this }
  single() { this.q.single = 'single'; return this as unknown as QueryBuilder<T extends (infer U)[] ? U : T> }
  maybeSingle() { this.q.single = 'maybe'; return this as unknown as QueryBuilder<T extends (infer U)[] ? U : T> }
  returns<R>() { return this as unknown as QueryBuilder<R> }
  abortSignal(signal: AbortSignal) { void signal; return this }
  throwOnError() { this.throwErrors = true; return this }

  /** Consulta recolhida (usado pelos testes e pelo executor remoto). */
  toJSON(): DbQuery { return this.q }

  then<A = DbResult<T>, B = never>(onOk?: ((v: DbResult<T>) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    const p = this.exec(this.q).then(r => {
      if (this.throwErrors && r.error) throw Object.assign(new Error(r.error.message), r.error)
      return r as DbResult<T>
    })
    return p.then(onOk, onErr)
  }
}

/** Resultado de rpc(): thenable simples ({ data, error }). */
export function rpcResult<T>(p: Promise<DbResult<T>>): PromiseLike<DbResult<T>> {
  return { then: (a, b) => p.then(a, b) }
}
