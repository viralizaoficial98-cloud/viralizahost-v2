import { NextRequest, NextResponse } from 'next/server'
import { getResellerSettings, updateResellerSettings } from '@/lib/reseller/settings'
import { adminGuard, fail, noStore } from '@/lib/reseller/http'

export const dynamic = 'force-dynamic'

// Revenda → Configurações: modo comercial, autorizações (venda automática / infraestrutura) e notificações.
export async function GET() {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  const env = { provisioning: process.env.RESELLER_PROVISIONING_ENABLED === '1', production: process.env.RESELLER_PRODUCTION_PROVISIONING === '1' }
  return NextResponse.json({ settings: await getResellerSettings(), env }, { headers: noStore })
}
export async function PUT(req: NextRequest) {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  const b = await req.json().catch(() => null)
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try { return NextResponse.json({ settings: await updateResellerSettings(g, b) }, { headers: noStore }) } catch (e) { return fail(e, 'admin/reseller/settings') }
}
