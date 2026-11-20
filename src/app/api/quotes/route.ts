import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getPool } from '@/lib/db/pool'
import { createClient } from '@/lib/supabase/server'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Pedido de cotação para planos «sob consulta». Fica no painel (/admin/quotes).
// Devolve a referência para o visitante ver a confirmação.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(req: NextRequest) {
  if (!rateLimit(`quote:${clientIp(req)}`, 5, 10 * 60_000)) return NextResponse.json({ error: 'Demasiados pedidos. Tente dentro de alguns minutos.' }, { status: 429 })
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
  const name = str(b?.name, 255), email = str(b?.email, 255).toLowerCase(), phone = str(b?.phone, 60), company = str(b?.company, 255), message = str(b?.message, 3000)
  const slug = str(b?.product, 120)
  if (name.length < 2) return NextResponse.json({ error: 'Indique o seu nome.' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Indique um e-mail válido.' }, { status: 400 })
  const db = getPool()
  const [[prod]] = slug ? await db.query('SELECT id, slug, name FROM products WHERE slug = ?', [slug]) as any : [[null]]
  const { data: { user } } = await (await createClient()).auth.getUser()
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  for (let attempt = 0; attempt < 3; attempt++) {
    const [[c]] = await db.query('SELECT COUNT(*) + 1 + ? AS n FROM quote_requests WHERE reference LIKE ?', [attempt, `VH-COT-${ym}-%`]) as any
    const reference = `VH-COT-${ym}-${String(c.n).padStart(4, '0')}`
    try {
      await db.query(`INSERT INTO quote_requests (id, reference, product_id, product_slug, product_name, profile_id, name, email, phone, company, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), reference, prod?.id ?? null, prod?.slug ?? (slug || null), prod?.name ?? null, user?.id ?? null, name, email, phone || null, company || null, message || null])
      return NextResponse.json({ ok: true, reference })
    } catch (e) {
      if ((e as { errno?: number }).errno !== 1062) { console.error('[quotes]', (e as Error).message); return NextResponse.json({ error: 'Não foi possível registar o pedido.' }, { status: 500 }) }
    }
  }
  return NextResponse.json({ error: 'Não foi possível registar o pedido. Tente novamente.' }, { status: 500 })
}
