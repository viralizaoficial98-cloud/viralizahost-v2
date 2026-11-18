/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
// Construtor de consultas com a mesma API que o cliente supabase-js/PostgREST
// (from().select().eq().order()...). É isomórfico: produz um QueryDescriptor e
// entrega-o a um executor — no servidor executa diretamente em MariaDB, no
// browser envia-o para /api/db, onde as regras de acesso (RLS) são aplicadas.
import type { DbResult, Filter, FilterOp, OrderSpec, QueryDescriptor } from './types'

export type Executor = (q: QueryDescriptor) => Promise<DbResult>

type Opts = { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }

/** Linha genérica (equivalente ao tipo usado pelo supabase-js sem Database tipada). */
export type Row = any
type Elem<T> = T extends (infer E)[] ? E : T

export class QueryBuilder<T = Row[]> implements PromiseLike<DbResult<T>> {
  protected q: QueryDescriptor
  private shouldThrow = false

  constructor(private exec: Executor, table: string) {
    this.q = { table, op: 'select', filters: [], orders: [] }
  }

  // ── operações ──────────────────────────────────────────────────────────
  select(columns = '*', opts: Opts = {}): this {
    if (this.q.op === 'select') {
      this.q.select = columns
      if (opts.count) this.q.count = opts.count
      if (opts.head) this.q.head = true
    } else {
      this.q.returning = true
      this.q.select = columns
      if (opts.count) this.q.count = opts.count
    }
    return this
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[], opts: { count?: Opts['count']; defaultToNull?: boolean } = {}): this {
    this.q.op = 'insert'
    this.q.values = values
    if (opts.count) this.q.count = opts.count
    return this
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], opts: { onConflict?: string; ignoreDuplicates?: boolean; count?: Opts['count'] } = {}): this {
    this.q.op = 'upsert'
    this.q.values = values
    if (opts.onConflict) this.q.onConflict = opts.onConflict
    if (opts.ignoreDuplicates) this.q.ignoreDuplicates = true
    if (opts.count) this.q.count = opts.count
    return this
  }

  update(values: Record<string, unknown>, opts: { count?: Opts['count'] } = {}): this {
    this.q.op = 'update'
    this.q.values = values
    if (opts.count) this.q.count = opts.count
    return this
  }

  delete(opts: { count?: Opts['count'] } = {}): this {
    this.q.op = 'delete'
    if (opts.count) this.q.count = opts.count
    return this
  }

  // ── filtros ────────────────────────────────────────────────────────────
  private op(column: string, op: FilterOp, value: unknown): this {
    this.q.filters.push({ kind: 'op', column, op, value })
    return this
  }
  eq(column: string, value: unknown) { return this.op(column, 'eq', value) }
  neq(column: string, value: unknown) { return this.op(column, 'neq', value) }
  gt(column: string, value: unknown) { return this.op(column, 'gt', value) }
  gte(column: string, value: unknown) { return this.op(column, 'gte', value) }
  lt(column: string, value: unknown) { return this.op(column, 'lt', value) }
  lte(column: string, value: unknown) { return this.op(column, 'lte', value) }
  like(column: string, pattern: string) { return this.op(column, 'like', pattern) }
  ilike(column: string, pattern: string) { return this.op(column, 'ilike', pattern) }
  is(column: string, value: null | boolean) { return this.op(column, 'is', value) }
  in(column: string, values: readonly unknown[]) { return this.op(column, 'in', [...values]) }
  contains(column: string, value: unknown) { return this.op(column, 'cs', value) }
  containedBy(column: string, value: unknown) { return this.op(column, 'cd', value) }
  overlaps(column: string, value: unknown) { return this.op(column, 'ov', value) }
  match(query: Record<string, unknown>) {
    for (const [k, v] of Object.entries(query)) this.op(k, 'eq', v)
    return this
  }
  not(column: string, operator: string, value: unknown): this {
    this.q.filters.push({ kind: 'not_raw', column, op: operator, value })
    return this
  }
  filter(column: string, operator: string, value: unknown): this {
    this.q.filters.push({ kind: 'raw', column, op: operator, value })
    return this
  }
  or(expr: string, opts: { referencedTable?: string; foreignTable?: string } = {}): this {
    const f: Filter = { kind: 'or', expr }
    const ref = opts.referencedTable ?? opts.foreignTable
    if (ref) f.referencedTable = ref
    this.q.filters.push(f)
    return this
  }

  // ── modificadores ──────────────────────────────────────────────────────
  order(column: string, opts: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string; foreignTable?: string } = {}): this {
    const o: OrderSpec = { column, ascending: opts.ascending ?? true }
    if (opts.nullsFirst !== undefined) o.nullsFirst = opts.nullsFirst
    const ref = opts.referencedTable ?? opts.foreignTable
    if (ref) o.referencedTable = ref
    this.q.orders.push(o)
    return this
  }
  limit(count: number, opts: { referencedTable?: string; foreignTable?: string } = {}): this {
    const ref = opts.referencedTable ?? opts.foreignTable
    if (ref) { (this.q.embedLimits ??= {})[ref] = { ...(this.q.embedLimits[ref] ?? {}), limit: count } }
    else this.q.limit = count
    return this
  }
  range(from: number, to: number, opts: { referencedTable?: string; foreignTable?: string } = {}): this {
    const ref = opts.referencedTable ?? opts.foreignTable
    if (ref) { (this.q.embedLimits ??= {})[ref] = { offset: from, limit: to - from + 1 } }
    else { this.q.offset = from; this.q.limit = to - from + 1 }
    return this
  }
  single<U = Elem<T>>(): QueryBuilder<U> { this.q.single = 'one'; return this as any }
  maybeSingle<U = Elem<T>>(): QueryBuilder<U | null> { this.q.single = 'maybe'; return this as any }
  abortSignal(_signal: AbortSignal): this { return this }
  returns<U>(): QueryBuilder<U> { return this as unknown as QueryBuilder<U> }
  throwOnError(): this { this.shouldThrow = true; return this }

  /** descritor serializável (usado pelo cliente do browser) */
  toDescriptor(): QueryDescriptor { return this.q }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.exec(this.q).then((res) => {
      if (this.shouldThrow && res.error) throw Object.assign(new Error(res.error.message), res.error)
      return res as DbResult<T>
    }).then(onfulfilled, onrejected)
  }
}

export function errorResult(message: string, code = 'PGRST000', status = 400, details: string | null = null, hint: string | null = null): DbResult {
  return { data: null, error: { message, code, details, hint }, count: null, status, statusText: status >= 500 ? 'Internal Server Error' : 'Bad Request' }
}
