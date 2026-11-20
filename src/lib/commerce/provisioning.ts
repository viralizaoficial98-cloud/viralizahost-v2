import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool, type Queryable } from '@/lib/db/pool'
import { loadWhmConfig } from '@/lib/whm/config'
import { createAccount, getAccount } from '@/lib/whm/client'

// Activação de serviços depois do pagamento confirmado.
// Nunca cobra: só lê a encomenda paga e cria/associa o recurso no fornecedor.
// Repetível: um serviço já activo não é tocado; a conta WHM é procurada antes de criar.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export type ProvisionOutcome = { serviceId: string; status: 'active' | 'manual_required' | 'failed' | 'skipped'; message: string }

/** Erros do fornecedor sem credenciais/URLs (nunca registar tokens nem ligações temporárias). */
const safeError = (e: unknown) => String((e as Error)?.message ?? e).replace(/https?:\/\/\S+/g, '[url]').replace(/(token|password|pass|secret)=\S+/gi, '$1=[oculto]').slice(0, 300)

/** Utilizador cPanel derivado do domínio: minúsculas, começa por letra, máx. 16. */
export function cpanelUsername(domain: string, salt = '') {
  const base = domain.split('.')[0].replace(/[^a-z0-9]/g, '').replace(/^[0-9]+/, '') || 'vh'
  return (base.slice(0, 12 - salt.length) + salt).slice(0, 16)
}

async function setStatus(serviceId: string, status: string, message: string | null, extra: Record<string, unknown> = {}) {
  const sets = ['provisioning_status = ?', 'provisioning_error = ?']
  const params: unknown[] = [status, message]
  if (status === 'active') { sets.push("status = 'active'", 'provisioned_at = CURRENT_TIMESTAMP(6)', 'started_at = COALESCE(started_at, CURRENT_TIMESTAMP(6))') }
  for (const [k, v] of Object.entries(extra)) { sets.push(`\`${k}\` = ?`); params.push(v) }
  await getPool().query(`UPDATE services SET ${sets.join(', ')} WHERE id = ?`, [...params, serviceId])
}

function addMonths(months: number) {
  const d = new Date(); d.setUTCMonth(d.getUTCMonth() + (months || 12)); return d.toISOString().slice(0, 10)
}

export async function provisionService(serviceId: string): Promise<ProvisionOutcome> {
  const db = getPool()
  // Reserva atómica: impede duas activações simultâneas do mesmo serviço
  const [claim] = await db.query(
    "UPDATE services SET provisioning_status = 'in_progress', provisioning_attempts = provisioning_attempts + 1 WHERE id = ? AND provisioning_status IN ('pending','failed','manual_required')",
    [serviceId],
  ) as any
  if (!claim.affectedRows) return { serviceId, status: 'skipped', message: 'Já activo ou em curso.' }

  const [s] = await rows(db, `SELECT s.*, o.payment_status, oi.months, oi.domain_operation, p.provisioning, p.whm_package, p.slug
    FROM services s JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id LEFT JOIN products p ON p.id = s.product_id
    WHERE s.id = ?`, [serviceId])
  const done = async (status: ProvisionOutcome['status'], message: string, extra: Record<string, unknown> = {}) => {
    await setStatus(serviceId, status === 'skipped' ? 'pending' : status, status === 'active' ? null : message, extra)
    return { serviceId, status, message }
  }
  if (!s) return { serviceId, status: 'failed', message: 'Serviço inexistente.' }
  if (s.payment_status !== 'paid') return done('skipped', 'Pagamento ainda não confirmado.')

  const due = addMonths(Number(s.months ?? 12))
  try {
    if (s.renews_service_id) {
      // Renovação paga: serviços no nosso WHM prolongam já; os restantes dependem do fornecedor
      const [orig] = await rows(db, 'SELECT p.provisioning FROM services o LEFT JOIN products p ON p.id = o.product_id WHERE o.id = ?', [s.renews_service_id])
      if (orig?.provisioning === 'whm') {
        await extendService(db, s.renews_service_id, Number(s.months ?? 12))
        return await done('active', 'Renovação aplicada.', { next_due_date: null })
      }
      return await done('manual_required', 'Renovação paga: confirmar a renovação no fornecedor e marcar como concluída.')
    }
    if (s.service_type === 'domain') {
      return await done('manual_required', `${s.domain_operation === 'transfer' ? 'Transferência' : s.domain_operation === 'renew' ? 'Renovação' : 'Registo'} manual no registrador: integração de registrador não configurada.`)
    }
    if (s.provisioning !== 'whm') {
      return await done('manual_required', `Activação manual (${s.service_type}): sem API de fornecedor configurada para este serviço.`)
    }
    if (!s.whm_package) return await done('manual_required', `Defina o pacote WHM do produto ${s.slug} no painel para activar automaticamente.`)
    if (!s.domain) return await done('manual_required', 'Serviço sem domínio associado.')
    const cfg = await loadWhmConfig()
    if (!cfg) return await done('manual_required', 'WHM não configurado (Configurações → WHM).')

    // Já existe conta associada a este serviço?
    const [ha] = await rows(db, 'SELECT id, cpanel_username FROM hosting_accounts WHERE service_id = ?', [serviceId])
    if (ha) return await done('active', 'Conta já associada.', { external_ref: ha.cpanel_username, next_due_date: due })

    const [profile] = await rows(db, 'SELECT email FROM profiles WHERE id = ?', [s.profile_id])
    // Procura conta existente com o mesmo domínio no servidor (repetição após falha parcial)
    // Um utilizador cPanel já registado na base para OUTRO serviço nunca é reutilizado
    // (mesmo que tenha desaparecido do WHM): evita reatribuir a conta de outro cliente.
    const takenLocally = async (u: string) => (await rows(db,
      `SELECT 1 FROM hosting_accounts WHERE cpanel_username = ? AND (service_id IS NULL OR service_id <> ?)
       UNION SELECT 1 FROM whm_accounts WHERE whm_username = ? AND server_id = ? AND (service_id IS NULL OR service_id <> ?) LIMIT 1`,
      [u, serviceId, u, cfg.serverId, serviceId])).length > 0
    let username: string | null = null
    for (let i = 0; i < 8; i++) {
      const candidate = cpanelUsername(s.domain, i ? String(i + 1) : '')
      if (await takenLocally(candidate)) continue
      const acct = await getAccount(cfg.config, candidate)
      if (!acct) { username = candidate; break }
      if (acct.domain === s.domain) {
        // Conta criada numa tentativa anterior deste serviço — associa sem recriar
        await linkAccount(db, s, cfg.serverId, candidate, acct.domain, s.whm_package)
        return await done('active', 'Conta WHM existente associada.', { external_ref: candidate, next_due_date: due })
      }
    }
    if (!username) return await done('manual_required', 'Não foi possível escolher um utilizador cPanel livre: atribuir manualmente.')
    await createAccount(cfg.config, {
      username, domain: s.domain, plan: s.whm_package, email: profile?.email ?? '',
      // Sem senha: o WHM gera uma; o cliente entra por SSO (nunca guardada nem registada)
      password: '',
    })
    await linkAccount(db, s, cfg.serverId, username, s.domain, s.whm_package)
    return await done('active', 'Conta cPanel criada.', { external_ref: username, next_due_date: due })
  } catch (e) {
    return done('failed', `Falha na activação: ${safeError(e)}`)
  }
}

async function linkAccount(db: Queryable, s: any, serverId: string, username: string, domain: string, pkg: string) {
  await db.query(
    `INSERT INTO hosting_accounts (id, service_id, profile_id, server_id, cpanel_username, primary_domain, status, package_name)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
     ON DUPLICATE KEY UPDATE service_id = VALUES(service_id), profile_id = VALUES(profile_id), status = 'active'`,
    [randomUUID(), s.id, s.profile_id, serverId, username, domain, pkg],
  )
  await db.query(
    `INSERT INTO whm_accounts (id, server_id, whm_username, primary_domain, package_name, profile_id, service_id, status, link_status, requires_manual_link, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'linked', 0, 'synced')
     ON DUPLICATE KEY UPDATE profile_id = VALUES(profile_id), service_id = VALUES(service_id), link_status = 'linked', requires_manual_link = 0`,
    [randomUUID(), serverId, username, domain, pkg, s.profile_id, s.id],
  )
}

/** Activa todos os serviços de uma encomenda paga e actualiza o estado agregado. */
export async function provisionOrder(orderId: string) {
  const db = getPool()
  const services = await rows(db, 'SELECT id FROM services WHERE order_id = ? ORDER BY created_at', [orderId])
  const results: ProvisionOutcome[] = []
  for (const s of services) results.push(await provisionService(s.id))
  await refreshOrderActivation(orderId)
  return results
}

export async function refreshOrderActivation(orderId: string) {
  const db = getPool()
  const st = (await rows(db, 'SELECT provisioning_status AS s FROM services WHERE order_id = ?', [orderId])).map(r => r.s)
  if (!st.length) return
  const agg = st.every(x => x === 'active') ? 'active'
    : st.some(x => x === 'failed') ? 'failed'
    : st.some(x => x === 'manual_required') ? (st.some(x => x === 'active') ? 'partial' : 'manual_required')
    : st.some(x => x === 'in_progress') ? 'in_progress' : 'pending'
  await db.query(`UPDATE orders SET activation_status = ?, status = IF(? = 'active', 'active', status) WHERE id = ?`, [agg, agg, orderId])
}

/** Prolonga a data de vencimento do serviço original (a partir do vencimento actual ou de hoje). */
async function extendService(db: Queryable, serviceId: string, months: number) {
  await db.query(`UPDATE services SET next_due_date = DATE_ADD(GREATEST(COALESCE(next_due_date, CURRENT_DATE), CURRENT_DATE), INTERVAL ? MONTH),
    status = IF(status = 'expired', 'active', status) WHERE id = ?`, [months || 12, serviceId])
}

/** Activação manual concluída pelo administrador (ex.: domínio registado no registrador). */
export async function markServiceActive(serviceId: string, note: string | null, externalRef: string | null) {
  const db = getPool()
  const [s] = await rows(db, 'SELECT s.id, s.order_id, s.service_type, s.domain, s.profile_id, s.renews_service_id, s.provisioning_status, oi.months, o.payment_status FROM services s JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id WHERE s.id = ?', [serviceId])
  if (!s) throw new Error('Serviço inexistente.')
  if (s.payment_status !== 'paid') throw new Error('A encomenda ainda não está paga.')
  if (s.renews_service_id) {
    // Atómico: só a primeira confirmação prolonga o serviço original
    const [r] = await db.query("UPDATE services SET provisioning_status = 'active', provisioning_error = NULL, status = 'active', provisioned_at = CURRENT_TIMESTAMP(6), notes = ? WHERE id = ? AND provisioning_status <> 'active'", [note, serviceId]) as any
    if (r.affectedRows) await extendService(db, s.renews_service_id, Number(s.months ?? 12))
    await refreshOrderActivation(s.order_id)
    return
  }
  const due = addMonths(Number(s.months ?? 12))
  await setStatus(serviceId, 'active', null, { external_ref: externalRef, next_due_date: due, notes: note })
  if (s.service_type === 'domain' && s.domain) {
    await db.query(`UPDATE domains SET status = 'active', registered_at = COALESCE(registered_at, CURRENT_TIMESTAMP(6)),
      expires_at = GREATEST(COALESCE(expires_at, CURRENT_TIMESTAMP(6)), CURRENT_TIMESTAMP(6)) + INTERVAL 1 YEAR, service_id = COALESCE(service_id, ?)
      WHERE profile_id = ? AND CONCAT(name, extension) = ?`, [serviceId, s.profile_id, s.domain])
  }
  await refreshOrderActivation(s.order_id)
}
