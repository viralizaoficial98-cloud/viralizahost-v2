import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { sendVerificationEmail } from '@/lib/auth/verification'

export const dynamic = 'force-dynamic'

// Administrador reenvia o e-mail de verificação de um cliente por verificar.
// Devolve se o Resend aceitou o pedido (aceite ≠ entregue: ver Integrações → E-mail).
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e) { const s = (e as { status?: number })?.status === 403 ? 403 : 401; return NextResponse.json({ error: 'Sem permissão.' }, { status: s }) }
  const { id } = await params
  const db = getPool()
  const [[u]] = await db.query('SELECT u.id, u.email, u.email_confirmed_at, p.role FROM auth_users u JOIN profiles p ON p.id = u.id WHERE u.id = ?', [id]) as any
  if (!u) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 })
  if (u.email_confirmed_at) return NextResponse.json({ error: 'Este e-mail já está verificado.' }, { status: 409 })
  const r = await sendVerificationEmail(u.id, u.email)
  await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'profile', ?, ?)", [adminId, id, `resend_verification: ${r.ok ? 'aceite pelo Resend' : 'falhou'}`]).catch(() => {})
  return r.ok
    ? NextResponse.json({ ok: true, message: 'Pedido aceite pelo Resend. A entrega pode ser confirmada em Integrações → E-mail transaccional.' })
    : NextResponse.json({ ok: false, error: `O envio falhou: ${r.error ?? 'erro desconhecido'}. Veja Integrações → E-mail transaccional.` }, { status: 502 })
}
