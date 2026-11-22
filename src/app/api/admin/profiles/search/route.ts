import { NextRequest, NextResponse } from 'next/server'
import { adminGuard } from '@/lib/api/require-admin'
import { searchClients } from '@/lib/whm/link'

export const dynamic = 'force-dynamic'

// Pesquisa de clientes (nome ou e-mail) para associar a contas WHM.
// Contas administrativas nunca aparecem; clientes não elegíveis vêm com o motivo.
export async function GET(req: NextRequest) {
  const denied = await adminGuard(); if (denied) return denied
  const q = req.nextUrl.searchParams.get('q') ?? ''
  try { return NextResponse.json({ data: await searchClients(q) }) }
  catch (e) { console.error('[profiles/search]', (e as Error).message); return NextResponse.json({ error: 'Erro na pesquisa.' }, { status: 500 }) }
}
