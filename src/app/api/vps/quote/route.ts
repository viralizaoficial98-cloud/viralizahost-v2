import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase/server'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { quoteCart } from '@/lib/commerce/quote'
import { loadCloudSettings } from '@/lib/vps/cloud'

export const dynamic = 'force-dynamic'

// Configurador Cloud VPS: preço actualizado calculado NO SERVIDOR (catálogo, licença, extras, compatibilidade).
// Só cálculo (vpsValidateOnly): nunca cria encomenda nem contorna o modo comercial (a compra volta a passar pelo bloqueio).
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(req: NextRequest) {
  if (!rateLimit(`vps-quote:${clientIp(req)}`, Math.max(30, Number(process.env.QUOTE_RATE_LIMIT) || 120), 10 * 60_000)) return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })
  const b = await req.json().catch(() => null) as Record<string, any> | null
  if (!b?.plan || !b.cycle) return NextResponse.json({ error: 'Escolha o plano e o período.' }, { status: 400 })
  const { data: { user } } = await (await createAuthClient()).auth.getUser()
  const o = b.options ?? {}
  const q = await quoteCart([{ type: 'product', slug: String(b.plan), cycle: String(b.cycle) as never, options: { location: o.location, image: o.image, hostname: o.hostname, sshKey: o.sshKey, addons: Array.isArray(o.addons) ? o.addons : [] } }],
    { userId: user?.id ?? null, checkAvailability: false, vpsValidateOnly: true })
  const l = q.lines[0]
  const s = await loadCloudSettings()
  return NextResponse.json({
    mode: s.mode === 'automatic' ? 'automatic' : s.mode, loggedIn: !!user,
    line: l ? { error: l.error ?? null, unitPrice: l.unitPrice, lineTotal: l.lineTotal, renewalPrice: l.renewalPrice, months: l.months, listTotal: l.listTotal ?? null, discountPct: l.discountPct ?? 0, options: l.options ?? null, name: l.name } : null,
    subtotal: q.subtotal, tax: q.tax, taxLabel: q.taxLabel, total: q.total, valid: q.valid,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
