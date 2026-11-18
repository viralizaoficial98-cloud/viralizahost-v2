import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isMysqlBackend } from '@/lib/db/backend'
import type { DbQuery } from '@/lib/db/types'

/*
 * POST /api/db — executa no servidor as consultas feitas pelos componentes do browser (createClient().from()).
 * Substitui o acesso direto do browser ao PostgREST. As regras são as mesmas: a consulta corre com a sessão
 * do utilizador e as políticas de acesso de src/lib/db/policies.ts; nunca com privilégios de serviço.
 */
const ident = z.string().regex(/^[a-z_][a-z0-9_]*$/i).max(64)
const filterSchema = z.union([
  z.object({ type: z.literal('op'), col: ident, op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'cs', 'cd']), value: z.unknown(), negate: z.boolean().optional() }),
  z.object({ type: z.literal('or'), expr: z.string().max(2000) }),
])
const querySchema = z.object({
  table: ident,
  action: z.enum(['select', 'insert', 'update', 'upsert', 'delete']),
  columns: z.string().max(2000).optional(),
  count: z.enum(['exact', 'planned', 'estimated']).nullable().optional(),
  head: z.boolean().optional(),
  filters: z.array(filterSchema).max(50),
  order: z.array(z.object({ col: ident, ascending: z.boolean(), nullsFirst: z.boolean().optional(), foreignTable: ident.optional() })).max(10),
  limit: z.number().int().min(0).max(10000).optional(),
  offset: z.number().int().min(0).optional(),
  single: z.enum(['single', 'maybe']).optional(),
  values: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown())).max(1000)]).optional(),
  onConflict: z.string().max(200).optional(),
  ignoreDuplicates: z.boolean().optional(),
  defaultToNull: z.boolean().optional(),
  returning: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  if (!isMysqlBackend()) return NextResponse.json({ error: 'Indisponível' }, { status: 404 })
  // Cabeçalho próprio obriga a um preflight CORS em pedidos de outros sites (proteção CSRF)
  if (req.headers.get('x-vh-db') !== '1') return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const parsed = querySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ data: null, count: null, status: 400, statusText: 'Bad Request', error: { message: 'Consulta inválida', code: 'PGRST100', details: parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message).join('; '), hint: null } }, { status: 200 })
  }
  // Cliente com a sessão do utilizador (contexto 'user': anon ou authenticated — nunca service)
  const supabase = await createClient()
  const result = await executeAsUser(supabase, parsed.data as DbQuery)
  return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}

async function executeAsUser(supabase: Awaited<ReturnType<typeof createClient>>, q: DbQuery) {
  // Reconstrói a consulta no construtor do servidor (mesmo caminho que o código do servidor usa)
  const b = supabase.from(q.table) as unknown as { toJSON(): DbQuery } & PromiseLike<unknown>
  Object.assign(b.toJSON(), q)
  return await b
}
