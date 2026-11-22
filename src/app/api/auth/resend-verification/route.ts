import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { sendVerificationEmail } from '@/lib/auth/verification'
import { record } from '@/lib/auth/email'

export const dynamic = 'force-dynamic'

// Reenviar o e-mail de verificação. A resposta é sempre a mesma (não revela se o endereço
// tem conta nem se já está verificado). Limites: 20 pedidos por IP e 3 por endereço por hora.
const PUBLIC = { ok: true, message: 'Se este endereço pertencer a uma conta por verificar, enviámos um novo link. Verifique também a pasta de spam. O link é válido durante 24 horas.' }

/* eslint-disable @typescript-eslint/no-explicit-any */
const mask = (e: string) => { const [u, d] = e.split('@'); return `${u.slice(0, 2)}***@${d}` }

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string }
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Indique um e-mail válido.' }, { status: 400 })
  if (!rateLimit(`resend-verify:${clientIp(req)}`, 20, 60 * 60_000) || !rateLimit(`resend-verify:${email}`, 3, 60 * 60_000)) {
    // Registo interno no máximo uma vez por endereço e por hora (não deixa encher a tabela)
    console.warn(`[auth/resend-verification] limite atingido para ${mask(email)}`)
    if (rateLimit(`resend-verify-log:${email}`, 1, 60 * 60_000)) await record('signup', email, null, 'rate_limited', null, 'Limite de reenvios atingido (3 por endereço / 20 por IP por hora)')
    return NextResponse.json({ error: 'Demasiados pedidos. Aguarde alguns minutos antes de pedir outro e-mail.' }, { status: 429 })
  }
  const [rows] = await getPool().query('SELECT id, email, email_confirmed_at, banned_until > CURRENT_TIMESTAMP(6) AS banned FROM auth_users WHERE email = ? LIMIT 1', [email]) as any
  const u = rows[0]
  // Resposta pública sempre igual; o motivo fica só no registo interno (Integrações → E-mail)
  if (!u) await record('signup', email, null, 'skipped', null, 'Sem conta com este endereço exacto')
  else if (u.email_confirmed_at) await record('signup', email, u.id, 'skipped', null, 'E-mail já verificado')
  else if (Number(u.banned)) await record('signup', email, u.id, 'skipped', null, 'Acesso ao portal suspenso')
  else await sendVerificationEmail(u.id, u.email)  // aceite, recusa ou domínio sem correio ficam registados
  return NextResponse.json(PUBLIC)
}
