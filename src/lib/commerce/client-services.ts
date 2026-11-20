import 'server-only'
import { getPool } from '@/lib/db/pool'

// Serviços da Área do Cliente — sempre filtrados pelo utilizador da sessão.
// Renovações (services.renews_service_id) e renovações de domínio aparecem como
// histórico do serviço original, não como serviços novos.

/* eslint-disable @typescript-eslint/no-explicit-any */
const q = async <T = any>(sql: string, p: unknown[] = []) => (await getPool().query(sql, p))[0] as T[]

export type ServiceKind = 'hosting' | 'email' | 'domain' | 'server' | 'other'

export interface ClientService {
  id: string
  name: string
  kind: ServiceKind
  serviceType: string
  provisioning: string | null
  status: string
  provisioningStatus: string
  provisioningMessage: string | null
  domain: string | null
  cycle: string | null
  price: number
  renewalPrice: number | null
  nextDueDate: string | null
  createdAt: string
  order: { id: string; number: string | null; paymentStatus: string } | null
  hosting: { username: string; status: string; package: string | null; diskUsedMb: number; diskLimitMb: number | null; bandwidthMb: number; emailCount: number; dbCount: number; php: string | null; lastSynced: string | null } | null
  domainInfo: { status: string; expiresAt: string | null; nameservers: string[]; registrar: string | null } | null
  invoices: { id: string; number: string; status: string; total: number; dueDate: string | null }[]
  history: { id: string; label: string; date: string; orderId: string | null; orderNumber: string | null; paymentStatus: string | null; status: string }[]
  renewalPending: { orderId: string; orderNumber: string } | null
}

const kindOf = (t: string | null): ServiceKind => {
  const s = (t ?? '').toLowerCase()
  if (['hosting', 'wordpress', 'website-builder', 'reseller'].includes(s)) return 'hosting'
  if (s === 'email') return 'email'
  if (s === 'domain') return 'domain'
  if (['vps', 'dedicated', 'server'].includes(s)) return 'server'
  return 'other'
}
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null)

export async function listClientServices(userId: string): Promise<ClientService[]> {
  const all = await q(`SELECT s.*, p.provisioning, o.order_number, o.payment_status AS order_payment, oi.domain_operation
    FROM services s LEFT JOIN products p ON p.id = s.product_id LEFT JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id
    WHERE s.profile_id = ? ORDER BY s.created_at DESC`, [userId])
  if (!all.length) return []

  const isHistory = (s: any) => !!s.renews_service_id || (s.service_type === 'domain' && s.domain_operation === 'renew')
  const main = all.filter(s => !isHistory(s) && s.status !== 'cancelled')
  const ids = main.map(s => s.id)
  const marks = ids.map(() => '?').join(',')

  const [hosting, domains, invoices] = await Promise.all([
    q(`SELECT * FROM hosting_accounts WHERE profile_id = ? AND service_id IN (${marks})`, [userId, ...ids]),
    q('SELECT * FROM domains WHERE profile_id = ?', [userId]),
    q('SELECT id, invoice_number, status, total, due_date, order_id, service_id FROM invoices WHERE profile_id = ? ORDER BY created_at DESC', [userId]),
  ])

  return main.map(s => {
    const kind = kindOf(s.service_type)
    const ha = hosting.find(h => h.service_id === s.id)
    const dom = s.domain ? domains.find(d => `${d.name}${d.extension}` === s.domain || d.full_domain === s.domain) : null
    const ns = (() => { try { const v = typeof dom?.nameservers === 'string' ? JSON.parse(dom.nameservers) : dom?.nameservers; return Array.isArray(v) ? v.map(String) : [] } catch { return [] } })()
    const renewals = all.filter(r => r.renews_service_id === s.id || (kind === 'domain' && r.id !== s.id && r.service_type === 'domain' && r.domain === s.domain && r.domain_operation === 'renew'))
    const orderIds = new Set([s.order_id, ...renewals.map(r => r.order_id)].filter(Boolean))
    const pend = renewals.find(r => r.order_payment && r.order_payment !== 'paid' && r.status === 'pending')
    return {
      id: s.id,
      name: s.service_name ?? 'Serviço',
      kind,
      serviceType: s.service_type ?? 'other',
      provisioning: s.provisioning ?? (ha ? 'whm' : null),
      status: s.status,
      provisioningStatus: s.provisioning_status,
      provisioningMessage: s.provisioning_status === 'active' ? null : s.provisioning_error,
      domain: s.domain ?? ha?.primary_domain ?? null,
      cycle: s.billing_cycle ?? null,
      price: Number(s.price ?? 0),
      renewalPrice: s.renewal_price != null ? Number(s.renewal_price) : null,
      nextDueDate: s.next_due_date ? String(iso(s.next_due_date)).slice(0, 10) : null,
      createdAt: String(iso(s.created_at)),
      order: s.order_id ? { id: s.order_id, number: s.order_number, paymentStatus: s.order_payment } : null,
      hosting: ha ? {
        username: ha.cpanel_username, status: ha.status, package: ha.package_name, diskUsedMb: Number(ha.disk_used_mb ?? 0),
        diskLimitMb: ha.disk_limit_mb != null ? Number(ha.disk_limit_mb) : null, bandwidthMb: Number(ha.bandwidth_used_mb ?? 0),
        emailCount: Number(ha.email_count ?? 0), dbCount: Number(ha.db_count ?? 0), php: ha.php_version ?? null, lastSynced: iso(ha.last_synced_at),
      } : null,
      domainInfo: dom ? { status: dom.status, expiresAt: iso(dom.expires_at), nameservers: ns, registrar: dom.registrar ?? null } : null,
      invoices: invoices.filter(i => orderIds.has(i.order_id) || i.service_id === s.id)
        .map(i => ({ id: i.id, number: i.invoice_number, status: i.status, total: Number(i.total), dueDate: i.due_date ? String(iso(i.due_date)).slice(0, 10) : null })),
      history: [
        { id: `${s.id}-c`, label: s.order_id ? 'Encomenda inicial' : 'Serviço associado', date: String(iso(s.created_at)), orderId: s.order_id ?? null, orderNumber: s.order_number ?? null, paymentStatus: s.order_payment ?? null, status: s.provisioning_status },
        ...(s.provisioned_at ? [{ id: `${s.id}-a`, label: 'Activado', date: String(iso(s.provisioned_at)), orderId: null, orderNumber: null, paymentStatus: null, status: 'active' }] : []),
        ...renewals.map(r => ({ id: r.id, label: 'Renovação', date: String(iso(r.created_at)), orderId: r.order_id, orderNumber: r.order_number, paymentStatus: r.order_payment, status: r.provisioning_status })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
      renewalPending: pend ? { orderId: pend.order_id, orderNumber: pend.order_number } : null,
    }
  })
}
