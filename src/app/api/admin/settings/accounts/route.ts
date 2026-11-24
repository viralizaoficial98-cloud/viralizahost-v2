import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getAccountSettings, setEmailConfirmationRequired } from '@/lib/auth/account-settings'

export const dynamic = 'force-dynamic'

// Configurações → Contas. Leitura e alteração só para administradores (verificado aqui, no servidor);
// cada alteração fica em activity_logs. Entra em vigor no pedido seguinte (sem reiniciar).
async function guard(): Promise<string | NextResponse> {
  try { return await requireAdminRole() } catch (e) {
    const status = (e as { status?: number }).status === 403 ? 403 : 401
    return NextResponse.json({ error: status === 403 ? 'Sem permissão para alterar as configurações de contas.' : 'Não autenticado.' }, { status })
  }
}

export async function GET() {
  const g = await guard(); if (typeof g !== 'string') return g
  return NextResponse.json({ settings: await getAccountSettings() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => null) as { emailConfirmationRequired?: unknown } | null
  if (!body || typeof body.emailConfirmationRequired !== 'boolean') return NextResponse.json({ error: 'Indique emailConfirmationRequired (true/false).' }, { status: 400 })
  return NextResponse.json({ settings: await setEmailConfirmationRequired(body.emailConfirmationRequired, adminId) })
}
