import { NextResponse } from 'next/server'
import { execute } from '@/lib/db/executor'
import { resolveContext } from '@/lib/db/server-client'
import type { QueryDescriptor } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

// Ponto de entrada das consultas feitas no navegador (substitui o PostgREST).
// Executa sempre com o utilizador da sessão (ou anónimo) e as políticas de acesso;
// nunca com privilégios de serviço.
const OPS = new Set(['select', 'insert', 'update', 'upsert', 'delete'])

export async function POST(req: Request) {
  let q: QueryDescriptor
  try { q = await req.json() } catch { return NextResponse.json({ data: null, error: { message: 'JSON inválido', code: 'PGRST102' } }, { status: 400 }) }
  if (!q || typeof q.table !== 'string' || !OPS.has(q.op) || !Array.isArray(q.conditions) || !Array.isArray(q.order)) {
    return NextResponse.json({ data: null, error: { message: 'Pedido inválido', code: 'PGRST100' } }, { status: 400 })
  }
  if (q.limit != null && (typeof q.limit !== 'number' || q.limit < 0)) q.limit = undefined
  const ctx = await resolveContext('session')
  const res = await execute(q, ctx)
  return NextResponse.json(res, { status: res.status === 204 ? 200 : res.status })
}
