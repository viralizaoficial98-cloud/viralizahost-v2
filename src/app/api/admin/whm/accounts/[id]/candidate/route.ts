import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/api/require-admin'
import { resolveCandidate } from '@/lib/whm/import'

export const dynamic = 'force-dynamic'

// Recusa a candidata sugerida pela importação (a confirmação usa /link com o profile_id).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard(); if (denied) return denied
  const { id } = await params
  try { return NextResponse.json(await resolveCandidate(id, false)) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
