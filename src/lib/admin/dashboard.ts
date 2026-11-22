import 'server-only'
import { getPool } from '@/lib/db/pool'

// Indicadores do painel calculados directamente na base (sem políticas de sessão),
// sempre com o erro separado do zero: um indicador que falha devolve { error }.

/* eslint-disable @typescript-eslint/no-explicit-any */
const q = async <T = any>(sql: string, p: unknown[] = []) => (await getPool().query(sql, p))[0] as T[]
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() } } catch (e) { console.error('[admin/dashboard]', (e as Error).message); return { ok: false, error: 'Falha ao carregar' } }
}

/** Limites do mês civil em Luanda (UTC+1, sem hora de Verão), em UTC — a base guarda UTC. */
export function luandaMonth(now = new Date()) {
  const local = new Date(now.getTime() + 3600_000)
  const y = local.getUTCFullYear(), m = local.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1) - 3600_000)
  const end = new Date(Date.UTC(y, m + 1, 1) - 3600_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')
  return { start: fmt(start), end: fmt(end), label: new Date(Date.UTC(y, m, 15)).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
}

export interface RevenueByCurrency { currency: string; gross: number; refunds: number; net: number; invoices: number }
export interface Revenue {
  month: string
  byCurrency: RevenueByCurrency[]
  excludedDuplicates: number        // valor pago acima do total da factura (pagamento em duplicado)
  excludedTest: { count: number; byCurrency: Record<string, number> }
  paidWithoutPayment: number        // facturas marcadas pagas sem movimento de pagamento aprovado
}

/**
 * Receita do mês = pagamentos APROVADOS cuja data de confirmação (payments.paid_at) cai no
 * mês (hora de Luanda), por moeda da factura, limitados ao total de cada factura
 * (duplicados excluídos), menos reembolsos do mês. Pendentes, em análise e rejeitados não contam.
 * Encomendas que a equipa marcou como teste aparecem à parte (não são apagadas nem alteradas).
 */
export async function monthRevenue(now = new Date()): Promise<Revenue> {
  const { start, end, label } = luandaMonth(now)
  const perInvoice = await q(`
    SELECT i.id, i.currency, i.total, SUM(p.amount) AS paid, MAX(o.review_flag = 'test') AS is_test
    FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN orders o ON o.id = i.order_id
    WHERE p.status = 'approved' AND p.paid_at >= ? AND p.paid_at < ?
    GROUP BY i.id, i.currency, i.total`, [start, end])
  // Facturas pagas no mês sem nenhum pagamento aprovado (dados antigos / marcação manual)
  const orphan = await q(`
    SELECT i.id, i.currency, i.total, i.total AS paid, MAX(o.review_flag = 'test') AS is_test
    FROM invoices i LEFT JOIN orders o ON o.id = i.order_id
    WHERE i.status = 'paid' AND i.paid_at >= ? AND i.paid_at < ?
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id AND p.status = 'approved')
    GROUP BY i.id, i.currency, i.total`, [start, end])
  const refunds = await q(`
    SELECT i.currency, SUM(p.amount) AS amount, MAX(o.review_flag = 'test') AS is_test
    FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN orders o ON o.id = i.order_id
    WHERE p.status = 'refunded' AND COALESCE(p.reviewed_at, p.paid_at) >= ? AND COALESCE(p.reviewed_at, p.paid_at) < ?
    GROUP BY i.currency`, [start, end])

  const map = new Map<string, RevenueByCurrency>()
  const get = (c: string) => map.get(c) ?? map.set(c, { currency: c, gross: 0, refunds: 0, net: 0, invoices: 0 }).get(c)!
  let excludedDuplicates = 0
  const excludedTest = { count: 0, byCurrency: {} as Record<string, number> }
  for (const r of [...perInvoice, ...orphan]) {
    const paid = Number(r.paid), total = Number(r.total)
    const counted = Math.min(paid, total)
    excludedDuplicates += Math.max(0, paid - total)
    if (Number(r.is_test)) { excludedTest.count++; excludedTest.byCurrency[r.currency] = (excludedTest.byCurrency[r.currency] ?? 0) + counted; continue }
    const c = get(r.currency); c.gross += counted; c.invoices++
  }
  for (const r of refunds) if (!Number(r.is_test)) get(r.currency).refunds += Number(r.amount)
  for (const c of map.values()) c.net = Math.round((c.gross - c.refunds) * 100) / 100
  return { month: label, byCurrency: [...map.values()].sort((a, b) => (a.currency === 'AKZ' ? -1 : b.currency === 'AKZ' ? 1 : a.currency.localeCompare(b.currency))), excludedDuplicates, excludedTest, paidWithoutPayment: orphan.length }
}

export interface ClientStats {
  registered: number            // contas de cliente (role client)
  buyersPaid: number            // contas com pelo menos uma encomenda paga
  staffOrders: number           // encomendas feitas com contas da equipa (admin)
  guestOrders: number           // encomendas sem conta (o checkout exige sessão: deve ser 0)
}
export async function clientStats(): Promise<ClientStats> {
  const [[a], [b], [c], [d]] = await Promise.all([
    q("SELECT COUNT(*) n FROM profiles WHERE role = 'client'"),
    q("SELECT COUNT(DISTINCT user_id) n FROM orders WHERE payment_status = 'paid' AND user_id IS NOT NULL"),
    q("SELECT COUNT(*) n FROM orders o JOIN profiles p ON p.id = o.user_id WHERE p.role = 'admin'"),
    q('SELECT COUNT(*) n FROM orders WHERE user_id IS NULL'),
  ])
  return { registered: Number(a.n), buyersPaid: Number(b.n), staffOrders: Number(c.n), guestOrders: Number(d.n) }
}

export interface RecentAccount { id: string; name: string; email: string; role: string; createdAt: string; lastOrder: string | null; lastOrderPaid: boolean; activeServices: number }
/** Clientes e compradores recentes: contas de cliente e qualquer conta que tenha encomendado. */
export async function recentAccounts(limit = 6): Promise<RecentAccount[]> {
  const rows = await q(`
    SELECT p.id, p.full_name, p.email, p.role, p.created_at,
      (SELECT o.order_number FROM orders o WHERE o.user_id = p.id ORDER BY o.created_at DESC LIMIT 1) AS last_order,
      (SELECT o.payment_status = 'paid' FROM orders o WHERE o.user_id = p.id ORDER BY o.created_at DESC LIMIT 1) AS last_paid,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = p.id) AS last_order_at,
      (SELECT COUNT(*) FROM services s WHERE s.profile_id = p.id AND s.status = 'active' AND s.provisioning_status = 'active' AND s.renews_service_id IS NULL) AS active_services
    FROM profiles p
    WHERE p.role = 'client' OR EXISTS (SELECT 1 FROM orders o WHERE o.user_id = p.id)
    ORDER BY GREATEST(p.created_at, COALESCE((SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = p.id), p.created_at)) DESC
    LIMIT ?`, [limit])
  return rows.map(r => ({ id: r.id, name: r.full_name || 'Sem nome', email: r.email, role: r.role, createdAt: r.created_at, lastOrder: r.last_order, lastOrderPaid: !!Number(r.last_paid), activeServices: Number(r.active_services) }))
}

export interface ActivePlans { total: number; byKind: Record<string, number> }
/** Serviços efectivamente activos (pagos e activados), sem contar renovações como serviços novos. */
export async function activePlans(): Promise<ActivePlans> {
  const rows = await q(`SELECT COALESCE(service_type, 'outro') t, COUNT(*) n FROM services
    WHERE status = 'active' AND provisioning_status = 'active' AND renews_service_id IS NULL GROUP BY t`)
  const kind = (t: string) => ['hosting', 'wordpress', 'website-builder', 'reseller'].includes(t) ? 'Alojamento' : t === 'email' ? 'E-mail' : t === 'domain' ? 'Domínios' : ['vps', 'dedicated', 'server'].includes(t) ? 'Servidores' : 'Outros'
  const byKind: Record<string, number> = {}
  for (const r of rows) byKind[kind(r.t)] = (byKind[kind(r.t)] ?? 0) + Number(r.n)
  return { total: Object.values(byKind).reduce((a, b) => a + b, 0), byKind }
}

export async function openTickets() {
  const [r] = await q("SELECT COUNT(*) n FROM tickets WHERE status IN ('open','in_progress')")
  return Number(r.n)
}

export async function whmServers() {
  return q(`SELECT id, name, hostname, is_active, whm_url IS NOT NULL AND whm_api_token IS NOT NULL AS has_whm FROM servers ORDER BY name = '__whm_config__' DESC, name`)
}

export const dashboard = { monthRevenue, clientStats, recentAccounts, activePlans, openTickets, whmServers, safe }
