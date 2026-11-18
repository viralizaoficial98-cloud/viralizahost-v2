// Tokens assinados (HMAC-SHA256) para a sessão e para links de recuperação/confirmação.
// Sem dependências: funciona no proxy (runtime Node.js) e nos route handlers.
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'vh_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 dias

export interface TokenPayload {
  typ: 'session' | 'recovery' | 'confirm' | 'storage' | 'upload'
  sub: string
  /** session_version do utilizador (sessões) ou impressão digital do hash (recuperação) */
  v: string | number
  iat: number
  exp: number
  email?: string
}

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) throw new Error('AUTH_SECRET em falta ou com menos de 32 caracteres')
  return s
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

export function signToken(p: Omit<TokenPayload, 'iat' | 'exp'>, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000)
  const body = b64(JSON.stringify({ ...p, iat: now, exp: now + ttlSeconds }))
  const sig = b64(createHmac('sha256', secret()).update(`${p.typ}.${body}`).digest())
  return `${body}.${sig}`
}

export function verifyToken(token: string | undefined | null, typ: TokenPayload['typ']): TokenPayload | null {
  if (!token || typeof token !== 'string') return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  let expected: Buffer
  try { expected = createHmac('sha256', secret()).update(`${typ}.${body}`).digest() } catch { return null }
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload
    if (p.typ !== typ || typeof p.exp !== 'number' || p.exp < Math.floor(Date.now() / 1000)) return null
    return p
  } catch { return null }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
}
