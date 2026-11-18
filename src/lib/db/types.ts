/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
// Tipos partilhados pela camada de acesso MariaDB (isomórficos: servidor e browser).

export type ColumnKind =
  | 'uuid' | 'text' | 'int' | 'float' | 'decimal' | 'bool'
  | 'datetime' | 'date' | 'json' | 'array' | 'enum'

export interface ColumnMeta {
  type: ColumnKind
  nullable?: boolean
  enumValues?: string[]
  /** default calculado pela aplicação ('uuid' | 'now' | 'today' | 'now+7d' | 'invoice_number') ou literal */
  default?: string | { value: unknown }
  generated?: boolean
  /** coluna auxiliar (ex.: índice único parcial) — nunca é devolvida à aplicação */
  internal?: boolean
}

export interface ForeignKeyMeta {
  name: string
  columns: string[]
  refTable: string
  refColumns: string[]
}

export interface TableMeta {
  columns: Record<string, ColumnMeta>
  pk: string[]
  uniques: string[][]
  fks: ForeignKeyMeta[]
  /** havia um trigger BEFORE UPDATE que fazia updated_at = now() */
  autoUpdatedAt?: boolean
}

export interface SchemaMeta {
  tables: Record<string, TableMeta>
}

// ── Descritor de consulta (serializável — viaja do browser para /api/db) ──
export type FilterOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike'
  | 'is' | 'in' | 'cs' | 'cd' | 'ov' | 'match'

export type Filter =
  | { kind: 'op'; column: string; op: FilterOp; value: unknown; negate?: boolean }
  | { kind: 'or'; expr: string; referencedTable?: string }
  | { kind: 'not_raw'; column: string; op: string; value: unknown }
  | { kind: 'raw'; column: string; op: string; value: unknown }

export interface OrderSpec {
  column: string
  ascending: boolean
  nullsFirst?: boolean
  referencedTable?: string
}

export type QueryOp = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

export interface QueryDescriptor {
  table: string
  op: QueryOp
  select?: string
  returning?: boolean
  count?: 'exact' | 'planned' | 'estimated'
  head?: boolean
  filters: Filter[]
  orders: OrderSpec[]
  limit?: number
  offset?: number
  embedLimits?: Record<string, { limit?: number; offset?: number }>
  values?: Record<string, unknown> | Record<string, unknown>[]
  onConflict?: string
  ignoreDuplicates?: boolean
  single?: 'one' | 'maybe'
}

export interface DbError {
  message: string
  code: string
  details: string | null
  hint: string | null
}

// União discriminada como no supabase-js: depois de `if (error) return`, `data` deixa de ser null.
export type DbResult<T = any> =
  | { data: T; error: null; count: number | null; status: number; statusText: string }
  | { data: null; error: DbError; count: number | null; status: number; statusText: string }
