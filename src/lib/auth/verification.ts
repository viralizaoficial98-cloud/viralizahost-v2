import 'server-only'
import { createHash } from 'node:crypto'
import { getPool } from '@/lib/db/pool'
import { issueToken, siteUrl } from './server'
import { sendAuthEmail } from './email'

// Verificação do e-mail da conta: emissão do link (uso único, expira em 24 h) e estado de um link.

/* eslint-disable @typescript-eslint/no-explicit-any */
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/**
 * Envia (ou reenvia) o e-mail de verificação. Os links anteriores ainda não usados deixam de
 * valer: só o mais recente confirma a conta. A conta continua por verificar se o envio falhar.
 */
export async function sendVerificationEmail(userId: string, email: string) {
  await getPool().query("UPDATE auth_tokens SET expires_at = LEAST(expires_at, CURRENT_TIMESTAMP(6)) WHERE user_id = ? AND type = 'signup' AND used_at IS NULL", [userId])
  const token = await issueToken(userId, 'signup', '/dashboard')
  return sendAuthEmail('signup', email, `${siteUrl()}/api/auth/verify?type=signup&token_hash=${encodeURIComponent(token)}`, userId)
}

export type LinkState = 'used' | 'expired' | 'invalid'

/** Motivo pelo qual um link já não é válido (para mostrar uma mensagem útil). */
export async function linkState(token: string, type: string): Promise<{ state: LinkState; confirmed: boolean }> {
  const [rows] = await getPool().query(
    `SELECT t.used_at, t.expires_at < CURRENT_TIMESTAMP(6) AS expired, u.email_confirmed_at FROM auth_tokens t LEFT JOIN auth_users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.type = ? LIMIT 1`, [sha256(token), type]) as any
  const t = rows[0]
  if (!t) return { state: 'invalid', confirmed: false }
  return { state: t.used_at ? 'used' : Number(t.expired) ? 'expired' : 'invalid', confirmed: !!t.email_confirmed_at }
}
