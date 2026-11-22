import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { WHM_CONFIG_NAME } from './config'

// Associação MANUAL de uma conta WHM importada a um cliente do portal.
//   * Só clientes elegíveis: papel 'client', conta activa e e-mail confirmado no portal.
//     Contas administrativas (role 'admin') nunca são candidatas nem seleccionáveis.
//   * O e-mail de contacto do WHM (ex.: comercial@…) fica como veio: não precisa de
//     coincidir com o e-mail do cliente — a titularidade é confirmada pelo administrador.
//   * Uma conta WHM só pode ter um titular: a linha é bloqueada (FOR UPDATE) e um
//     vínculo existente diferente é devolvido como conflito, nunca substituído.
//   * Sem serviço associado, cria o serviço de alojamento importado (sem preço nem
//     cobrança) e a conta de alojamento — é por aí que a Área do Cliente e o SSO a encontram.
//   * Serviços, facturas e cobranças existentes não são alterados.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export class LinkError extends Error {
  constructor(public code: string, message: string, public status = 400, public details: Record<string, unknown> = {}) { super(message) }
}

/** Condição SQL de cliente elegível (alias p = profiles, u = auth_users). */
export const ELIGIBLE_SQL = `p.role = 'client' AND p.is_active = 1 AND u.email_confirmed_at IS NOT NULL`

export interface ClientOption { id: string; full_name: string; email: string; eligible: boolean; reason: string | null }

/**
 * Pesquisa de clientes por nome ou e-mail. Contas administrativas são excluídas.
 * Clientes ainda não elegíveis (inactivos ou e-mail por confirmar) aparecem com o motivo,
 * sem poderem ser seleccionados.
 */
export async function searchClients(q: string, limit = 10): Promise<ClientOption[]> {
  const term = q.trim().toLowerCase()
  if (term.length < 2) return []
  const like = `%${term.replace(/[\\%_]/g, m => '\\' + m)}%`
  const found = await rows(getPool(), `
    SELECT p.id, p.full_name, p.email, p.is_active, u.email_confirmed_at
    FROM profiles p LEFT JOIN auth_users u ON u.id = p.id
    WHERE p.role = 'client' AND (LOWER(p.email) LIKE ? OR LOWER(p.full_name) LIKE ?)
    ORDER BY (p.is_active = 1 AND u.email_confirmed_at IS NOT NULL) DESC, p.full_name
    LIMIT ?`, [like, like, limit])
  return found.map(r => {
    const reason = !Number(r.is_active) ? 'Conta inactiva' : !r.email_confirmed_at ? 'E-mail ainda não confirmado no portal' : null
    return { id: r.id, full_name: r.full_name || '', email: r.email, eligible: !reason, reason }
  })
}

async function eligibleClient(db: Queryable, profileId: string) {
  const [p] = await rows(db, `SELECT p.id, p.full_name, p.email, p.role, p.is_active, u.email_confirmed_at FROM profiles p LEFT JOIN auth_users u ON u.id = p.id WHERE p.id = ?`, [profileId])
  if (!p) throw new LinkError('client_not_found', 'Cliente não encontrado.', 404)
  if (p.role !== 'client') throw new LinkError('client_not_eligible', 'Só contas de cliente podem ser titulares de uma hospedagem (contas administrativas excluídas).', 422)
  if (!Number(p.is_active)) throw new LinkError('client_not_eligible', 'A conta do cliente está inactiva.', 422)
  if (!p.email_confirmed_at) throw new LinkError('client_not_eligible', 'O cliente ainda não confirmou o e-mail no portal.', 422)
  return p
}

export interface LinkResult { whmAccountId: string; profileId: string; serviceId: string; hostingAccountId: string; created: boolean; alreadyLinked?: boolean }

export async function linkWhmAccount(input: { whmAccountId: string; profileId: string; adminId: string; confirmed: boolean }): Promise<LinkResult> {
  if (!input.confirmed) throw new LinkError('confirmation_required', 'Confirme que verificou a titularidade antes de associar.', 400)
  return withTransaction(async conn => {
    // Bloqueia a conta WHM: dois administradores a gravar ao mesmo tempo → o segundo vê o vínculo do primeiro
    const [w] = await rows(conn, 'SELECT * FROM whm_accounts WHERE id = ? FOR UPDATE', [input.whmAccountId])
    if (!w) throw new LinkError('whm_not_found', 'Conta WHM não encontrada.', 404)
    const client = await eligibleClient(conn, input.profileId)

    const ownerOf = async (id: string | null) => id ? (await rows(conn, 'SELECT id, full_name, email FROM profiles WHERE id = ?', [id]))[0] ?? { id } : null
    if (w.profile_id && w.profile_id !== client.id) {
      throw new LinkError('already_linked', 'Esta conta WHM já está associada a outro cliente.', 409, { currentClient: await ownerOf(w.profile_id), serviceId: w.service_id })
    }

    // Conta de alojamento existente para o mesmo utilizador cPanel (chave única)
    const [ha] = await rows(conn, 'SELECT * FROM hosting_accounts WHERE cpanel_username = ? FOR UPDATE', [w.whm_username])
    if (ha && ha.profile_id !== client.id) {
      throw new LinkError('hosting_conflict', `O utilizador cPanel ${w.whm_username} já está ligado a um serviço de outro cliente.`, 409, { currentClient: await ownerOf(ha.profile_id), serviceId: ha.service_id })
    }
    if (ha && ha.server_id && ha.server_id !== w.server_id) {
      throw new LinkError('hosting_conflict', `O utilizador cPanel ${w.whm_username} já existe noutro servidor no portal.`, 409, { serviceId: ha.service_id })
    }
    // Domínio registado na ViralizaHost em nome de outro cliente
    const [dom] = await rows(conn, "SELECT profile_id FROM domains WHERE CONCAT(name, extension) = ? AND status <> 'cancelled' AND profile_id <> ? LIMIT 1", [w.primary_domain, client.id])
    if (dom) throw new LinkError('domain_conflict', `O domínio ${w.primary_domain} pertence a outro cliente na ViralizaHost.`, 409, { currentClient: await ownerOf(dom.profile_id) })

    if (w.profile_id === client.id && w.link_status === 'linked' && ha && w.hosting_account_id === ha.id) {
      return { whmAccountId: w.id, profileId: client.id, serviceId: ha.service_id, hostingAccountId: ha.id, created: false, alreadyLinked: true }
    }

    let serviceId: string, hostingId: string, created = false
    const status = Number(w.is_suspended) || w.status === 'suspended' ? 'suspended' : 'active'
    if (ha) {
      serviceId = ha.service_id; hostingId = ha.id
      const [svc] = await rows(conn, 'SELECT id, profile_id FROM services WHERE id = ?', [serviceId])
      if (svc && svc.profile_id !== client.id) throw new LinkError('service_conflict', 'O serviço desta hospedagem pertence a outro cliente.', 409, { currentClient: await ownerOf(svc.profile_id), serviceId })
      await conn.query('UPDATE hosting_accounts SET server_id = COALESCE(server_id, ?) WHERE id = ?', [w.server_id, ha.id])
    } else {
      // Serviço do alojamento importado: activo no WHM, sem preço, sem renovação automática nem factura
      const [prod] = await rows(conn, "SELECT id, name FROM products WHERE whm_package = ? AND (whm_server_id = ? OR whm_server_id IS NULL) AND provisioning = 'whm' ORDER BY whm_server_id IS NULL LIMIT 1", [w.package_name ?? '', w.server_id])
      serviceId = randomUUID(); hostingId = randomUUID(); created = true
      await conn.query(
        `INSERT INTO services (id, profile_id, product_id, service_type, service_name, status, currency, price, renewal_price, billing_cycle, auto_renew,
           domain, provisioning_status, provisioned_at, started_at, external_ref, activation_source, activated_by, notes)
         VALUES (?, ?, ?, 'hosting', ?, ?, 'AKZ', 0, NULL, 'monthly', 0, ?, 'active', CURRENT_TIMESTAMP(6), COALESCE(?, CURRENT_TIMESTAMP(6)), ?, 'import', ?, ?)`,
        [serviceId, client.id, prod?.id ?? null, prod?.name ? `${prod.name} (importado)` : `Alojamento importado — ${w.primary_domain}`, status, w.primary_domain,
          w.account_created_at ?? null, w.whm_username, input.adminId, `Conta WHM importada (pacote ${w.package_name ?? '—'}). Sem cobrança associada: renovação a definir pela equipa.`],
      )
      await conn.query(
        `INSERT INTO hosting_accounts (id, service_id, profile_id, server_id, cpanel_username, primary_domain, status, package_name, disk_used_mb, disk_limit_mb, ip_address, php_version, suspension_reason, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IFNULL(?, DEFAULT(php_version)), ?, ?)`,
        [hostingId, serviceId, client.id, w.server_id, w.whm_username, w.primary_domain, status, w.package_name ?? null, Number(w.disk_used_mb ?? 0), w.disk_limit_mb ?? null,
          w.ip_address ?? null, w.php_version ?? null, w.suspension_reason ?? null, w.last_synced_at ?? null],
      )
    }
    const method = w.link_candidate_profile_id === client.id ? 'candidate' : 'manual'
    await conn.query(
      `UPDATE whm_accounts SET profile_id = ?, service_id = ?, hosting_account_id = ?, link_status = 'linked', requires_manual_link = 0,
         link_candidate_profile_id = NULL, link_candidate_reason = NULL, linked_by = ?, linked_at = CURRENT_TIMESTAMP(6), link_method = ?, updated_at = CURRENT_TIMESTAMP(6)
       WHERE id = ?`, [client.id, serviceId, hostingId, input.adminId, method, w.id])
    await conn.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'whm_account', ?, ?)",
      [input.adminId, w.id, `whm_link: ${w.whm_username} (${w.primary_domain}) → cliente ${client.email} [${method}]${created ? ' · serviço importado criado' : ''}`])
    return { whmAccountId: w.id, profileId: client.id, serviceId, hostingAccountId: hostingId, created }
  })
}

/** Resumo para a confirmação no painel (domínio, utilizador, servidor, contacto WHM, titular actual). */
export async function linkPreview(whmAccountId: string) {
  const [w] = await rows(getPool(), `SELECT w.id, w.whm_username, w.primary_domain, w.contact_email, w.package_name, w.profile_id, w.service_id, w.link_status,
      w.link_candidate_profile_id, w.linked_at, s.name AS server_name, s.hostname AS server_host
    FROM whm_accounts w LEFT JOIN servers s ON s.id = w.server_id WHERE w.id = ?`, [whmAccountId])
  if (!w) return null
  return { ...w, server: w.server_name === WHM_CONFIG_NAME ? w.server_host : (w.server_name ?? w.server_host ?? '—') }
}
