import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { emailConfig, recentEmails, recipientStatus, refreshDeliveryEvents, senderDnsRecords, senderDomainStatus, sendTestEmail } from '@/lib/admin/email-status'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Integrações → E-mail transaccional (só administradores). Nunca devolve chaves nem links.
async function admin() { try { return await requireAdminRole() } catch (e) { return { status: (e as { status?: number })?.status === 403 ? 403 : 401 } } }

export async function GET() {
  const a = await admin(); if (typeof a !== 'string') return NextResponse.json({ error: 'Sem permissão.' }, { status: a.status })
  return NextResponse.json({ config: emailConfig(), recent: await recentEmails() })
}

export async function POST(req: NextRequest) {
  const a = await admin(); if (typeof a !== 'string') return NextResponse.json({ error: 'Sem permissão.' }, { status: a.status })
  const body = await req.json().catch(() => ({})) as { action?: string; to?: string }
  if (body.action === 'domain') return NextResponse.json({ ...(await senderDomainStatus()), dns: await senderDnsRecords() })
  if (body.action === 'recipient') {
    const to = String(body.to ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: 'Indique um e-mail válido.' }, { status: 400 })
    return NextResponse.json(await recipientStatus(to))
  }
  if (body.action === 'refresh') return NextResponse.json({ ...(await refreshDeliveryEvents()), recent: await recentEmails() })
  if (body.action === 'test') {
    const to = String(body.to ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: 'Indique um e-mail de destino válido.' }, { status: 400 })
    if (!rateLimit(`email-test:${clientIp(req)}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Demasiados testes. Aguarde.' }, { status: 429 })
    const r = await sendTestEmail(to)
    return NextResponse.json({ ok: r.ok, id: r.id ?? null, error: r.error ?? null, recent: await recentEmails() })
  }
  return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
}
