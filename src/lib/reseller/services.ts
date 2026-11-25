import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool, type Queryable } from '@/lib/db/pool'
import { loadWhmConfig } from '@/lib/whm/config'
import { audit, getResellerSettings, ResellerError } from './settings'
import * as W from './whm'

// Revendedores activos: listagem (painel), área do revendedor (só o próprio), consumo, sessões temporárias,
// senha, suspensão e reactivação. Cada acesso do cliente valida a PROPRIEDADE (profile_id) no servidor.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
/** JSON da base: pode chegar como texto ou já como objecto (conforme o tipo devolvido pelo MariaDB). */
const asObj = (v: unknown) => { if (v == null) return null; if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch { return null } }

export async function listResellerServices(filter: { status?: string } = {}) {
  const args: unknown[] = []
  let where = ''
  if (filter.status && ['provisioning', 'awaiting_confirmation', 'active', 'suspended', 'failed', 'terminated'].includes(filter.status)) { where = 'WHERE rs.status = ?'; args.push(filter.status) }
  return rows(getPool(), `SELECT rs.id, rs.service_id, rs.whm_username, rs.domain, rs.status, rs.storage_mb, rs.bandwidth_mb, rs.max_accounts, rs.main_quota_mb, rs.acl_name, rs.activated_at, rs.suspended_reason,
      p.name plan_name, pr.full_name client_name, pr.email client_email, sv.name server_name, sv.hostname server_host, sv.environment, s.next_due_date, s.billing_cycle, r.reference,
      (SELECT JSON_OBJECT('disk', u.disk_used_mb, 'accounts', u.accounts_used, 'bw', u.bandwidth_used_mb, 'at', u.created_at) FROM reseller_usage_snapshots u WHERE u.reseller_service_id = rs.id ORDER BY u.created_at DESC LIMIT 1) last_usage
    FROM reseller_services rs JOIN products p ON p.id = rs.product_id JOIN profiles pr ON pr.id = rs.profile_id JOIN servers sv ON sv.id = rs.server_id
    JOIN services s ON s.id = rs.service_id LEFT JOIN reseller_requests r ON r.id = rs.request_id ${where} ORDER BY rs.created_at DESC LIMIT 200`, args).then(l => l.map(r => ({ ...r, last_usage: asObj(r.last_usage) })))
}

async function loadOwned(serviceId: string, profileId: string | null) {
  const db = getPool()
  const [rs] = await rows(db, `SELECT rs.*, p.name plan_name FROM reseller_services rs JOIN products p ON p.id = rs.product_id WHERE rs.service_id = ?${profileId ? ' AND rs.profile_id = ?' : ''}`, profileId ? [serviceId, profileId] : [serviceId])
  if (!rs) throw new ResellerError('not_found', 'Revenda inexistente.', 404)
  return rs
}
async function cfgFor(serverId: string) {
  const lc = await loadWhmConfig(serverId)
  if (!lc) throw new ResellerError('no_credentials', 'Serviço temporariamente indisponível (servidor sem credencial).', 503)
  return lc.config
}
const whmErr = (e: unknown) => new ResellerError('whm_error', e instanceof W.WhmCallError ? e.message : 'Falha na comunicação com o servidor.', 502)

/** Consumo actual (resellerstats + acctcounts), guardado no histórico. Só leitura no WHM. */
export async function syncUsage(serviceId: string, profileId: string | null) {
  const rs = await loadOwned(serviceId, profileId)
  if (!['active', 'suspended'].includes(rs.status) || !rs.whm_username) throw new ResellerError('not_active', 'Revenda ainda não activa.', 409)
  const cfg = await cfgFor(rs.server_id)
  try {
    const [stats, counts] = await Promise.all([W.resellerStats(cfg, rs.whm_username), W.acctCounts(cfg, rs.whm_username)])
    // Contas-filhas = contas cujo dono é o revendedor (nunca a lista de outros revendedores ou clientes)
    const children = stats.accounts.filter(a => a.owner === rs.whm_username && a.user !== rs.whm_username)
    await getPool().query(`INSERT INTO reseller_usage_snapshots (id, reseller_service_id, disk_used_mb, disk_allocated_mb, bandwidth_used_mb, bandwidth_allocated_mb, accounts_used, accounts_suspended, accounts_limit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [randomUUID(), rs.id, stats.diskUsedMb, stats.diskAllocMb, stats.bwUsedMb, stats.bwAllocMb, children.length, counts.suspended, counts.limit])
    return {
      diskUsedMb: stats.diskUsedMb, diskAllocMb: stats.diskAllocMb, diskLimitMb: Number(rs.storage_mb), bwUsedMb: stats.bwUsedMb, bwAllocMb: stats.bwAllocMb, bwLimitMb: Number(rs.bandwidth_mb),
      accountsUsed: children.length, accountsLimit: Number(rs.max_accounts), accountsSuspended: counts.suspended,
      clients: children.map(a => ({ user: a.user, domain: a.domain, plan: a.plan, suspended: a.suspended, diskUsedMb: a.diskusedMb, diskLimitMb: a.disklimitMb })),
    }
  } catch (e) { throw whmErr(e) }
}

/** Área do revendedor: serviços do próprio utilizador (com o último consumo guardado). */
export async function clientResellers(profileId: string) {
  const db = getPool()
  const s = await getResellerSettings(db)
  const list = await rows(db, `SELECT rs.service_id, rs.whm_username, rs.domain, rs.status, rs.storage_mb, rs.bandwidth_mb, rs.max_accounts, rs.main_quota_mb, rs.activated_at, rs.suspended_reason,
      p.name plan_name, p.slug plan_slug, sv.hostname server_host, sv.ip_address server_ip, s.next_due_date, s.billing_cycle, s.renewal_price, s.created_at contracted_at, s.order_id,
      (SELECT JSON_OBJECT('disk', u.disk_used_mb, 'accounts', u.accounts_used, 'bw', u.bandwidth_used_mb, 'at', u.created_at) FROM reseller_usage_snapshots u WHERE u.reseller_service_id = rs.id ORDER BY u.created_at DESC LIMIT 1) last_usage
    FROM reseller_services rs JOIN products p ON p.id = rs.product_id JOIN servers sv ON sv.id = rs.server_id JOIN services s ON s.id = rs.service_id
    WHERE rs.profile_id = ? AND rs.status IN ('awaiting_confirmation','active','suspended') ORDER BY rs.created_at DESC`, [profileId])
  const ns = s.defaultNameservers.length ? s.defaultNameservers : ['ns1.viralizahost.com', 'ns2.viralizahost.com']
  return list.map(r => ({ ...r, last_usage: asObj(r.last_usage), nameservers: ns, server_ip: r.status === 'active' ? r.server_ip : null }))
}

/** Sessão temporária no WHM do revendedor ou no cPanel da conta principal (create_user_session). */
export async function resellerSession(serviceId: string, profileId: string, target: 'whm' | 'cpanel') {
  const rs = await loadOwned(serviceId, profileId)
  if (rs.status !== 'active') throw new ResellerError('not_active', rs.status === 'suspended' ? 'Revenda suspensa: acesso indisponível.' : 'Revenda ainda não activa.', 409)
  const cfg = await cfgFor(rs.server_id)
  try {
    const sess = await W.userSession(cfg, rs.whm_username, target === 'whm' ? 'whostmgrd' : 'cpaneld')
    await audit(profileId, 'login', 'reseller_service', serviceId, `Sessão ${target === 'whm' ? 'WHM' : 'cPanel'} do revendedor ${rs.whm_username}`)
    return sess.url
  } catch (e) { throw whmErr(e) }
}

/** Senha da conta principal (passwd por POST). Política mínima verificada no servidor; nunca registada. */
export async function changeResellerPassword(serviceId: string, profileId: string, password: string) {
  const rs = await loadOwned(serviceId, profileId)
  if (rs.status !== 'active') throw new ResellerError('not_active', 'Revenda não activa.', 409)
  const p = String(password ?? '')
  if (p.length < 12 || p.length > 128 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p) || !/[^A-Za-z0-9]/.test(p)) throw new ResellerError('weak_password', 'A senha precisa de 12 a 128 caracteres, com maiúsculas, minúsculas, números e um símbolo.')
  if (p.toLowerCase().includes(String(rs.whm_username).toLowerCase())) throw new ResellerError('weak_password', 'A senha não pode conter o nome de utilizador.')
  const cfg = await cfgFor(rs.server_id)
  try { await W.changeAccountPassword(cfg, rs.whm_username, p) } catch (e) { throw whmErr(e) }
  await audit(profileId, 'update', 'reseller_service', serviceId, `Senha da conta principal do revendedor ${rs.whm_username} alterada (pelo cliente)`)
}

/** Suspensão / reactivação pelo administrador (suspendreseller / unsuspendreseller). */
export async function setSuspended(adminId: string, serviceId: string, suspend: boolean, reason: string) {
  const rs = await loadOwned(serviceId, null)
  if (suspend && rs.status !== 'active') throw new ResellerError('invalid_state', 'Só uma revenda activa pode ser suspensa.', 409)
  if (!suspend && rs.status !== 'suspended') throw new ResellerError('invalid_state', 'A revenda não está suspensa.', 409)
  if (suspend && reason.trim().length < 5) throw new ResellerError('reason_required', 'Indique o motivo da suspensão.')
  const lc = await loadWhmConfig(rs.server_id)
  if (!lc) throw new ResellerError('no_credentials', 'Servidor sem credencial WHM.', 409)
  const { writeGuard } = await import('./provisioning')
  const { getServer } = await import('./infra')
  const sv = await getServer(rs.server_id)
  const g = sv ? writeGuard(sv) : 'Servidor inexistente.'
  if (g) throw new ResellerError('write_disabled', g, 409)
  try { if (suspend) await W.suspendReseller(lc.config, rs.whm_username, reason); else await W.unsuspendReseller(lc.config, rs.whm_username) } catch (e) { throw whmErr(e) }
  const db = getPool()
  await db.query(`UPDATE reseller_services SET status = ?, suspended_reason = ? WHERE id = ?`, [suspend ? 'suspended' : 'active', suspend ? reason.trim().slice(0, 300) : null, rs.id])
  await db.query(`UPDATE services SET status = ? WHERE id = ?`, [suspend ? 'suspended' : 'active', serviceId])
  await audit(adminId, suspend ? 'suspend' : 'activate', 'reseller_service', serviceId, `Revendedor ${rs.whm_username} ${suspend ? `suspenso: ${reason.trim().slice(0, 200)}` : 'reactivado'} (contas-filhas incluídas)`)
  const { notifyClient } = await import('./notify')
  const [c] = await rows(db, 'SELECT email FROM profiles WHERE id = ?', [rs.profile_id])
  await notifyClient(rs.profile_id, c?.email ?? '', suspend ? 'Revenda suspensa' : 'Revenda reactivada', suspend ? `A revenda ${rs.domain} foi suspensa. Motivo: ${reason.trim()}` : `A revenda ${rs.domain} foi reactivada.`, '/revendedor', suspend ? 'warning' : 'success')
}
