import { NextRequest, NextResponse } from 'next/server'
import { reconcileOpenVps } from '@/lib/vps/provisioning'

// Concilia as compras de VPS em aberto (estado da VM na Hostinger; conclui /setup de VMs pagas; activa as «running»).
// Só leituras e /setup — nunca compra. Protegido por CRON_SECRET (como /api/cron/whm-sync).
//   curl -X POST https://…/api/cron/vps-sync -H "Authorization: Bearer $CRON_SECRET"
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 })
  const auth = req.headers.get('authorization') ?? ''
  if ((auth.startsWith('Bearer ') ? auth.slice(7) : auth) !== secret) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const results = await reconcileOpenVps()
  const { refreshOrderActivation } = await import('@/lib/commerce/provisioning')
  const { getPool } = await import('@/lib/db/pool')
  for (const r of results) { const [[s]] = await getPool().query('SELECT order_id FROM services WHERE id = ?', [r.serviceId]) as unknown as [[{ order_id: string } | undefined]]; if (s) await refreshOrderActivation(s.order_id) }
  return NextResponse.json({ ok: true, results })
}
export const GET = POST
