import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { VpsConfigError, loadVpsSettings, saveVpsSettings, testVpsConnection } from '@/lib/vps/settings'

export const dynamic = 'force-dynamic'

// Integrações → Hostinger VPS. Só administradores. O token nunca é devolvido (só «configurado: sim/não»).
async function guard(): Promise<NextResponse | string> {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}
export async function GET() {
  const g = await guard(); if (typeof g !== 'string') return g
  return NextResponse.json({ settings: await loadVpsSettings(), liveAllowed: process.env.VPS_LIVE_PURCHASES === '1' }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === 'test') return NextResponse.json({ result: await testVpsConnection(), settings: await loadVpsSettings() })
    return NextResponse.json({ ok: true, settings: await saveVpsSettings(body, adminId) })
  } catch (e) {
    if (e instanceof VpsConfigError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[hostinger-vps]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível guardar.' }, { status: 500 })
  }
}
