/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
// Tipos partilhados pela camada de dados MariaDB (isomórficos: sem imports de servidor).

export type ColumnKind =
  | 'uuid' | 'text' | 'enum' | 'bool' | 'int' | 'number'
  | 'json' | 'array' | 'timestamp' | 'date'

export interface ColumnMeta {
  kind: ColumnKind
  values?: string[]
  nullable?: boolean
  hasDefault?: boolean
  appDefault?: string
  defaultUuid?: boolean
  autoUpdate?: boolean
  generated?: boolean
  hidden?: boolean
}

export interface RelationMeta {
  /** colunas nesta tabela */
  columns: string[]
  /** tabela relacionada */
  table: string
  /** colunas na tabela relacionada */
  refColumns: string[]
  name: string
  /** true = um-para-muitos (a FK está na tabela relacionada) */
  many?: boolean
}

export interface TableMeta {
  pk: string[]
  unique: string[][]
  columns: Record<string, ColumnMeta>
  relations: RelationMeta[]
}

export type SchemaMeta = Record<string, TableMeta>

/** Erro com a mesma forma do PostgrestError do supabase-js. */
export interface DbError {
  message: string
  code: string
  details: string | null
  hint: string | null
}

export interface DbResponse<T = any> {
  data: T
  error: DbError | null
  count: number | null
  status: number
  statusText: string
}

export type FilterOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'ilike' | 'is' | 'in' | 'cs' | 'cd'

export interface Filter {
  column: string
  op: FilterOp
  value: unknown
  negate?: boolean
}

/** Grupo OR (vindo de `.or('a.eq.1,b.ilike.%x%')`). */
export interface OrGroup {
  or: (Filter | OrGroup | AndGroup)[]
}
export interface AndGroup {
  and: (Filter | OrGroup | AndGroup)[]
}
export type Condition = Filter | OrGroup | AndGroup

export interface OrderSpec {
  column: string
  ascending: boolean
  nullsFirst?: boolean
  /** ordenação de um recurso embutido (referencedTable) */
  referencedTable?: string
}

export type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

/** Descrição serializável de um pedido — enviada do navegador para /api/db. */
export interface QueryDescriptor {
  table: string
  op: Operation
  select?: string
  returning?: boolean
  conditions: Condition[]
  order: OrderSpec[]
  limit?: number
  offset?: number
  single?: 'single' | 'maybe'
  count?: 'exact' | 'planned' | 'estimated'
  head?: boolean
  values?: Record<string, unknown> | Record<string, unknown>[]
  onConflict?: string
  ignoreDuplicates?: boolean
}
