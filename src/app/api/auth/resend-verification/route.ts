import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { sendVerificationEmail } from '@/lib/auth/verification'

export const dynamic = 'force-dynamic'

// Reenviar o e-mail de verificação. A resposta é sempre a mesma (não revela se o endereço
// tem conta nem se já está verificado). Limites: 20 pedidos por IP e 3 por endereço por hora.
const PUBLIC = { ok: true, message: 'Se este endereço pertencer a uma conta por verificar, enviámos um novo link. Verifique também a pasta de spam. O link é válido durante 24 horas.' }

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string }
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Indique um e-mail válido.' }, { status: 400 })
  if (!rateLimit(`resend-verify:${clientIp(req)}`, 20, 60 * 60_000) || !rateLimit(`resend-verify:${email}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarde alguns minutos antes de pedir outro e-mail.' }, { status: 429 })
  }
  const [rows] = await getPool().query('SELECT id, email FROM auth_users WHERE email = ? AND email_confirmed_at IS NULL AND (banned_until IS NULL OR banned_until < CURRENT_TIMESTAMP(6)) LIMIT 1', [email]) as any
  if (rows[0]) await sendVerificationEmail(rows[0].id, rows[0].email)  // falhas ficam em auth_email_log
  return NextResponse.json(PUBLIC)
}
