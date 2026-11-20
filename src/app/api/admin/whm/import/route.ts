import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/api/require-admin'
import { applyImport, planImport } from '@/lib/whm/import'

export const dynamic = 'force-dynamic'

// GET → pré-visualização (nada é gravado). POST → aplica (repetível, sem duplicados).
export async function GET() {
  const denied = await adminGuard(); if (denied) return denied
  try { return NextResponse.json({ plan: await planImport() }) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
export async function POST() {
  const denied = await adminGuard(); if (denied) return denied
  try { return NextResponse.json({ applied: true, plan: await applyImport() }) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
