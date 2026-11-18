/* Tipos partilhados pela camada de dados MySQL (servidor e browser). */

export type ColumnKind =
  | 'uuid' | 'text' | 'enum' | 'json' | 'array' | 'bool' | 'int' | 'bigint'
  | 'decimal' | 'float' | 'datetime' | 'date' | 'time'

export type ColumnMeta = {
  kind: ColumnKind
  nullable: boolean
  values?: string[]
  scale?: number | null
  generated?: boolean
  hasDefault?: boolean
  /** Coluna técnica do MySQL (ex.: chave gerada para índices únicos parciais) — nunca exposta. */
  internal?: boolean
}

export type FkMeta = {
  name?: string
  cols: string[]
  refTable: string
  refCols: string[]
  /** FK para fora do schema (ex.: auth.users) — não existe no MySQL. */
  external?: boolean
}

export type TableMeta = {
  pk: string[]
  columns: Record<string, ColumnMeta>
  fks: FkMeta[]
  generated: string[]
  appDefaults: Record<string, string>
}

export type DbSchema = Record<string, TableMeta>

/* ─── Consulta serializável (o browser envia isto para /api/db) ───────── */

export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'cs' | 'cd'

export type Filter =
  | { type: 'op'; col: string; op: FilterOp; value: unknown; negate?: boolean }
  /** Expressão lógica no formato PostgREST, ex.: "email.ilike.%x%,full_name.ilike.%x%" */
  | { type: 'or'; expr: string }

export type OrderSpec = { col: string; ascending: boolean; nullsFirst?: boolean; foreignTable?: string }

export type DbQuery = {
  table: string
  action: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  columns?: string
  count?: 'exact' | 'planned' | 'estimated' | null
  head?: boolean
  filters: Filter[]
  order: OrderSpec[]
  limit?: number
  offset?: number
  single?: 'single' | 'maybe'
  values?: Record<string, unknown> | Record<string, unknown>[]
  onConflict?: string
  ignoreDuplicates?: boolean
  defaultToNull?: boolean
  returning?: boolean
}

export type DbError = { message: string; details: string | null; hint: string | null; code: string }

export type DbResult<T = unknown> = {
  data: T | null
  error: DbError | null
  count: number | null
  status: number
  statusText: string
}

/** Contexto de autorização — equivalente ao papel/JWT que o PostgREST usava para o RLS. */
export type DbContext =
  | { role: 'service' }
  | { role: 'anon' }
  | { role: 'authenticated'; uid: string; isAdmin: boolean; isStaff: boolean }
