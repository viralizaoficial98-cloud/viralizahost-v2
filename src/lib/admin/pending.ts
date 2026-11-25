import 'server-only'
import { getPool } from '@/lib/db/pool'

// «Acções pendentes» do painel: registos que exigem intervenção da equipa.
// Cada categoria é calculada à parte — uma falha numa não esconde as outras e
// é devolvida como erro (nunca como «0 pendências»).

/* eslint-disable @typescript-eslint/no-explicit-any */
const q = async <T = any>(sql: string, p: unknown[] = []) => (await getPool().query(sql, p))[0] as T[]

export interface PendingItem { id: string; ref: string; detail: string; status: string; since: string | null; href: string }
export interface PendingCategory { key: string; label: string; action: string; count: number | null; items: PendingItem[]; listHref: string; error?: string }

const LIMIT = 5
const enc = encodeURIComponent

async function proofs(): Promise<{ count: number; items: PendingItem[] }> {
  const where = `p.status IN ('under_review','proof_uploaded') AND o.status NOT IN ('rejected','cancelled') AND o.payment_status <> 'paid'`
  const [[c], rows] = await Promise.all([
    q(`SELECT COUNT(*) n FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${where}`),
    q(`SELECT p.id, o.order_number, o.id AS order_id, p.amount, p.created_at FROM payments p JOIN orders o ON o.id = p.order_id WHERE ${where} ORDER BY p.created_at LIMIT ${LIMIT}`),
  ])
  return { count: Number(c.n), items: rows.map(r => ({ id: r.id, ref: r.order_number ?? r.order_id.slice(0, 8), detail: `Kz ${Number(r.amount).toLocaleString('pt-PT').replace(/\s/g, ' ')}`, status: 'Comprovativo em análise', since: r.created_at, href: `/admin/orders?filtro=comprovativos&encomenda=${enc(r.order_number ?? r.order_id)}` })) }
}

async function domains() {
  const where = `oi.availability = 'confirm' AND o.status NOT IN ('rejected','cancelled')`
  const [[c], rows] = await Promise.all([
    q(`SELECT COUNT(*) n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${where}`),
    q(`SELECT oi.id, oi.domain_name, o.order_number, o.id AS order_id, o.created_at FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE ${where} ORDER BY o.created_at LIMIT ${LIMIT}`),
  ])
  return { count: Number(c.n), items: rows.map(r => ({ id: r.id, ref: r.order_number ?? r.order_id.slice(0, 8), detail: r.domain_name ?? '', status: 'Disponibilidade a confirmar', since: r.created_at, href: `/admin/orders?filtro=dominios&encomenda=${enc(r.order_number ?? r.order_id)}` })) }
}

const SVC: Record<string, string> = { pending: 'Activação por iniciar', manual_required: 'Activação manual pendente', failed: 'Activação falhada' }
async function activations() {
  const where = `o.payment_status = 'paid' AND s.status <> 'cancelled' AND s.provisioning_status IN ('pending','manual_required','failed')`
  const [[c], rows] = await Promise.all([
    q(`SELECT COUNT(*) n FROM services s JOIN orders o ON o.id = s.order_id WHERE ${where}`),
    q(`SELECT s.id, s.service_name, s.domain, s.service_type, s.provisioning_status, o.order_number, o.id AS order_id, COALESCE(o.paid_at, o.created_at) AS since
       FROM services s JOIN orders o ON o.id = s.order_id WHERE ${where} ORDER BY s.provisioning_status = 'failed' DESC, since LIMIT ${LIMIT}`),
  ])
  return { count: Number(c.n), items: rows.map(r => ({ id: r.id, ref: r.order_number ?? r.order_id.slice(0, 8), detail: [r.service_name, r.domain].filter(Boolean).join(' · '),
    status: r.service_type === 'domain' && r.provisioning_status === 'manual_required' ? 'Domínio pago, a aguardar registo' : (SVC[r.provisioning_status] ?? r.provisioning_status),
    since: r.since, href: `/admin/orders?filtro=activacao&encomenda=${enc(r.order_number ?? r.order_id)}` })) }
}

async function quotes() {
  const [[c], rows] = await Promise.all([
    q("SELECT COUNT(*) n FROM quote_requests WHERE status = 'new'"),
    q(`SELECT id, reference, product_name, name, created_at FROM quote_requests WHERE status = 'new' ORDER BY created_at LIMIT ${LIMIT}`),
  ])
  return { count: Number(c.n), items: rows.map(r => ({ id: r.id, ref: r.reference, detail: [r.product_name, r.name].filter(Boolean).join(' · '), status: 'Por responder', since: r.created_at, href: `/admin/quotes?estado=new&ref=${enc(r.reference)}` })) }
}

const RV: Record<string, string> = { submitted: 'Pedido recebido', under_review: 'Em análise', paid: 'Pago: autorizar activação', awaiting_confirmation: 'Confirmar ACL', failed: 'Falha na activação' }
async function resellerRequests() {
  const where = `status IN ('submitted','under_review','paid','awaiting_confirmation','failed')`
  const [[c], rows] = await Promise.all([
    q(`SELECT COUNT(*) n FROM reseller_requests WHERE ${where}`),
    q(`SELECT id, reference, full_name, domain, status, created_at FROM reseller_requests WHERE ${where} ORDER BY created_at LIMIT ${LIMIT}`),
  ])
  return { count: Number(c.n), items: rows.map(r => ({ id: r.id, ref: r.reference, detail: [r.full_name, r.domain].filter(Boolean).join(' · '), status: RV[r.status] ?? r.status, since: r.created_at, href: `/admin/reseller?pedido=${enc(r.reference)}` })) }
}

async function tickets() {
  // Por responder: aberto/em curso e sem resposta da equipa depois da última mensagem do cliente
  const base = `FROM tickets t
    LEFT JOIN (SELECT ticket_id, MAX(created_at) AS last_any, MAX(IF(is_staff = 1, created_at, NULL)) AS last_staff
               FROM ticket_messages WHERE is_internal = 0 GROUP BY ticket_id) m ON m.ticket_id = t.id
    WHERE t.status IN ('open','in_progress') AND (m.last_staff IS NULL OR m.last_staff < m.last_any)`
  const [[c], rows] = await Promise.all([
    q(`SELECT COUNT(*) n ${base}`),
    q(`SELECT t.id, t.ticket_number, t.subject, t.status, COALESCE(m.last_any, t.created_at) AS since ${base} ORDER BY since LIMIT ${LIMIT}`),
  ])
  return { count: Number(c.n), items: rows.map(r => ({ id: r.id, ref: r.ticket_number ?? r.id.slice(0, 8), detail: r.subject, status: r.status === 'open' ? 'Aberto, sem resposta' : 'Em curso, cliente aguarda resposta', since: r.since, href: `/admin/tickets/${enc(r.id)}` })) }
}

const CATEGORIES: { key: string; label: string; action: string; listHref: string; fn: () => Promise<{ count: number; items: PendingItem[] }> }[] = [
  { key: 'proofs', label: 'Comprovativos por validar', action: 'Rever comprovativo', listHref: '/admin/orders?filtro=comprovativos', fn: proofs },
  { key: 'domains', label: 'Domínios à espera de confirmação', action: 'Confirmar domínio', listHref: '/admin/orders?filtro=dominios', fn: domains },
  { key: 'activations', label: 'Encomendas pagas por activar', action: 'Abrir activação', listHref: '/admin/orders?filtro=activacao', fn: activations },
  { key: 'quotes', label: 'Pedidos de cotação por responder', action: 'Responder cotação', listHref: '/admin/quotes?estado=new', fn: quotes },
  { key: 'reseller', label: 'Pedidos de Revenda por tratar', action: 'Abrir pedido', listHref: '/admin/reseller', fn: resellerRequests },
  { key: 'tickets', label: 'Tickets por responder', action: 'Responder ticket', listHref: '/admin/tickets', fn: tickets },
]

export async function pendingActions(): Promise<PendingCategory[]> {
  return Promise.all(CATEGORIES.map(async ({ fn, ...meta }) => {
    try { return { ...meta, ...(await fn()) } }
    catch (e) { console.error('[admin/pending]', meta.key, (e as Error).message); return { ...meta, count: null, items: [], error: 'Falha ao carregar' } }
  }))
}
