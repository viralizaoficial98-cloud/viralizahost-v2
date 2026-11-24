import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { getPool } from '@/lib/db/pool'

// Carrinho guardado no servidor (shopping_carts). O navegador mantém a sua cópia (localStorage)
// e sincroniza-a aqui; o servidor é a referência para retomar a compra depois do login ou da
// verificação de e-mail (mesmo noutro separador/dispositivo) e para decidir o passo seguinte.
// Só guarda escolhas: nunca preços nem o código EPP.
//   - visitante: carrinho identificado pelo cookie vh_cart (aleatório; na base fica só o hash);
//   - cliente com sessão: o carrinho do cookie passa a ser dele; sem carrinho no cookie,
//     usa o mais recente da conta.

/* eslint-disable @typescript-eslint/no-explicit-any */
export const CART_COOKIE = 'vh_cart'
const CART_DAYS = 60
const MAX_LINES = 30
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
const CYCLES = ['monthly', '3months', '6months', '1year', '2years', '3years']

export type StoredLine = Record<string, unknown> & { key: string; type: 'product' | 'domain' | 'renewal' }

const opts = (v: unknown) => {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>, loc = str(o.location, 40), img = str(o.image, 40)
  return loc || img ? { ...(loc ? { location: loc } : {}), ...(img ? { image: img } : {}) } : null
}

/** Normaliza as linhas recebidas do navegador: só campos conhecidos, tamanhos limitados, sem EPP. */
export function sanitizeLines(raw: unknown): StoredLine[] {
  const out: StoredLine[] = []
  for (const l of (Array.isArray(raw) ? raw : []).slice(0, MAX_LINES)) {
    if (!l || typeof l !== 'object') continue
    const x = l as Record<string, unknown>
    const key = str(x.key, 64) || randomUUID()
    const flowId = str(x.flowId, 120)
    if (x.type === 'product' && str(x.slug, 120) && CYCLES.includes(String(x.cycle))) {
      out.push({ key, type: 'product', slug: str(x.slug, 120)!, cycle: String(x.cycle), quantity: Math.max(1, Math.min(1000, Math.floor(Number(x.quantity) || 1))),
        ...(str(x.domain, 253) ? { domain: str(x.domain, 253) } : {}), ...(['register', 'transfer', 'existing'].includes(String(x.domainMode)) ? { domainMode: String(x.domainMode) } : {}),
        ...(flowId ? { flowId } : {}), ...(opts(x.options) ? { options: opts(x.options) } : {}) })
    } else if (x.type === 'domain' && str(x.domain, 253) && ['register', 'transfer', 'renew'].includes(String(x.operation))) {
      const ns = x.nameservers as { useDefault?: unknown; ns?: unknown } | undefined
      out.push({ key, type: 'domain', domain: str(x.domain, 253)!.toLowerCase(), operation: String(x.operation),
        years: Math.max(1, Math.min(10, Math.floor(Number(x.years) || 1))),
        ...(ns && typeof ns === 'object' ? { nameservers: { useDefault: ns.useDefault !== false, ns: (Array.isArray(ns.ns) ? ns.ns : []).slice(0, 4).map(v => String(v).slice(0, 253)) } } : {}),
        ...(flowId ? { flowId } : {}) })
    } else if (x.type === 'renewal' && /^[0-9a-f-]{36}$/i.test(String(x.serviceId))) {
      out.push({ key, type: 'renewal', serviceId: String(x.serviceId), ...(str(x.label, 200) ? { label: str(x.label, 200) } : {}) })
    }
  }
  return out
}

const parse = (v: unknown): StoredLine[] => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : [] } catch { return [] } }

interface CartRow { id: string; profile_id: string | null; items: StoredLine[]; updated_at: string }

async function byToken(token: string | undefined): Promise<CartRow | null> {
  if (!token || token.length < 20) return null
  const [rows] = await getPool().query('SELECT id, profile_id, items, updated_at FROM shopping_carts WHERE token_hash = ?', [sha256(token)]) as any
  return rows[0] ? { ...rows[0], items: parse(rows[0].items) } : null
}

async function latestOfUser(userId: string): Promise<CartRow | null> {
  const [rows] = await getPool().query("SELECT id, profile_id, items, updated_at FROM shopping_carts WHERE profile_id = ? AND items <> '[]' ORDER BY updated_at DESC LIMIT 1", [userId]) as any
  return rows[0] ? { ...rows[0], items: parse(rows[0].items) } : null
}

/**
 * Carrinho em uso para este pedido (sem escrever cookies: serve também a páginas do servidor).
 * Com sessão, o carrinho anónimo do cookie é associado à conta.
 */
export async function resolveCart(userId: string | null): Promise<{ row: CartRow | null; own: CartRow | null }> {
  const jar = await cookies()
  let own = await byToken(jar.get(CART_COOKIE)?.value)
  if (!userId) { own = own && !own.profile_id ? own : null; return { row: own, own } }
  if (own && own.profile_id && own.profile_id !== userId) own = null  // cookie de outra conta: ignorado
  if (own && !own.profile_id) {
    await getPool().query('UPDATE shopping_carts SET profile_id = ? WHERE id = ? AND profile_id IS NULL', [userId, own.id])
    own.profile_id = userId
  }
  if (own?.items.length) return { row: own, own }
  return { row: (await latestOfUser(userId)) ?? own, own }
}

export async function loadCartLines(userId: string | null): Promise<StoredLine[]> {
  return (await resolveCart(userId)).row?.items ?? []
}

/** Grava o carrinho (rotas da API: pode criar o cookie). */
export async function saveCartLines(userId: string | null, raw: unknown): Promise<StoredLine[]> {
  const items = sanitizeLines(raw)
  const { row, own } = await resolveCart(userId)
  // Carrinho da conta vindo de outro dispositivo: passa para o cookie deste navegador e o anterior
  // fica vazio (não reaparece nem é encomendado duas vezes).
  if (row && own && row.id !== own.id) await getPool().query("UPDATE shopping_carts SET items = '[]' WHERE id = ?", [row.id])
  else if (row && !own) await getPool().query("UPDATE shopping_carts SET items = '[]' WHERE id = ?", [row.id])
  if (own) {
    await getPool().query('UPDATE shopping_carts SET items = ?, profile_id = COALESCE(profile_id, ?) WHERE id = ?', [JSON.stringify(items), userId, own.id])
    return items
  }
  const token = randomBytes(32).toString('base64url')
  await getPool().query('INSERT INTO shopping_carts (id, token_hash, profile_id, items) VALUES (?, ?, ?, ?)', [randomUUID(), sha256(token), userId, JSON.stringify(items)])
  const jar = await cookies()
  jar.set(CART_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: CART_DAYS * 86400 })
  return items
}

/** Associa o carrinho do cookie a uma conta acabada de criar (antes do e-mail de verificação). */
export async function claimCookieCart(userId: string) {
  const jar = await cookies()
  const token = jar.get(CART_COOKIE)?.value
  if (token) await getPool().query('UPDATE shopping_carts SET profile_id = ? WHERE token_hash = ? AND profile_id IS NULL', [userId, sha256(token)])
}

/** Depois da encomenda: o carrinho da conta fica vazio (o navegador também o esvazia). */
export async function clearUserCarts(userId: string) {
  await getPool().query("UPDATE shopping_carts SET items = '[]' WHERE profile_id = ?", [userId])
}

export async function userHasCart(userId: string): Promise<boolean> {
  return !!(await latestOfUser(userId))
}
