import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/executor'
import { ctxFromJar } from '@/lib/db/server-client'
import type { QueryDescriptor } from '@/lib/db/types'

/**
 * POST /api/db — executa consultas enviadas pelos componentes do browser.
 * O papel (anon/authenticated) vem SEMPRE do cookie de sessão; as regras de
 * acesso por linha (src/lib/db/policies.ts) são aplicadas no executor.
 */
const MAX_ROWS = 1000 // igual ao "max rows" por omissão do PostgREST/Supabase

export async function POST(req: NextRequest) {
  let body: { q?: QueryDescriptor }
  try { body = await req.json() } catch { return NextResponse.json(err('Pedido inválido'), { status: 400 }) }
  const q = body?.q
  if (!q || typeof q.table !== 'string' || !['select', 'insert', 'update', 'upsert', 'delete'].includes(q.op) || !Array.isArray(q.filters) || !Array.isArray(q.orders)) {
    return NextResponse.json(err('Consulta inválida'), { status: 400 })
  }
  if (q.op === 'select' && !q.head) q.limit = Math.min(q.limit ?? MAX_ROWS, MAX_ROWS)
  if ((q.op === 'update' || q.op === 'delete') && q.filters.length === 0) {
    return NextResponse.json(err('UPDATE/DELETE requer um filtro (WHERE)', '21000'), { status: 400 })
  }
  const ctx = await ctxFromJar({ get: (n) => req.cookies.get(n) })
  const result = await executeQuery(q, ctx)
  return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}

function err(message: string, code = 'PGRST100') {
  return { data: null, error: { message, code, details: null, hint: null }, count: null, status: 400, statusText: 'Bad Request' }
}
