import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'
import { encryptSecret } from '@/lib/crypto'
import { loadWhmConfig, WHM_CONFIG_NAME } from '@/lib/whm/config'
import { listAllAccounts, listResellers, whmVersion, WhmCallError } from './whm'
import { audit, ResellerError } from './settings'

// Infraestrutura → Servidores (tabela `servers` existente, alargada na migração 23).
// Capacidade = armazenamento + compromissos existentes + licenciamento + reservas operacionais — nunca só o uso actual.
//   espaço livre seguro  = total − reserva operacional − quotas comprometidas (sincronização) − reservas activas
//   contas licenciadas   = limite da licença − contas existentes − contas reservadas
// Indeterminada (aprovação BLOQUEADA) quando falta o total de espaço, o limite da licença, uma sincronização recente,
// ou há contas sem quota (ilimitadas) sem uma quota assumida configurada.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
export const SERVER_CATEGORIES = { hosting: 'Hospedagem de sites', wordpress: 'Hospedagem WordPress', email: 'E-mail corporativo', reseller: 'Revenda de hospedagem' } as const
export type ServerCategory = keyof typeof SERVER_CATEGORIES
export const SYNC_MAX_AGE_H = Math.max(1, Number(process.env.RESELLER_SYNC_MAX_AGE_HOURS) || 24)

const parseJson = <T>(v: unknown, d: T): T => { if (v == null) return d; if (typeof v !== 'string') return v as T; try { return JSON.parse(v) as T } catch { return d } }

export interface InfraServer {
  id: string; name: string; label: string; primary: boolean; provider: string | null; hostname: string; ip: string; port: number
  credentialRef: string | null; hasToken: boolean; type: string; os: string | null; cpuCores: number | null; ramMb: number | null
  storageTotalMb: number | null; storageReserveMb: number; storageUsedMb: number | null
  licenseName: string | null; licenseAccountLimit: number | null; accountsExisting: number | null; accountsUnlimited: number | null
  quotaCommittedMb: number | null; unlimitedAssumedMb: number | null; resellersExisting: number | null
  state: 'active' | 'maintenance' | 'disabled'; lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncMessage: string | null
  services: ServerCategory[]; environment: 'test' | 'production'; resellerAuthorized: boolean; resellerAuthorizedAt: string | null; resellerAuthorizationNote: string | null
  protectedAccounts: string[]
  capacity: Capacity
}
export interface Capacity {
  determinable: boolean; reasons: string[]
  storageFreeMb: number | null; accountsFree: number | null
  reservedStorageMb: number; reservedAccounts: number
}

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null)
const n = (v: unknown) => (v == null ? null : Number(v))

function computeCapacity(s: any, reservedStorageMb: number, reservedAccounts: number): Capacity {
  const reasons: string[] = []
  if (s.storage_total_mb == null) reasons.push('Armazenamento total do servidor por indicar.')
  if (s.license_account_limit == null) reasons.push('Limite de contas da licença cPanel por indicar.')
  if (!s.last_sync_at || s.last_sync_status !== 'ok') reasons.push('Servidor ainda não sincronizado com sucesso.')
  else if (Date.now() - new Date(s.last_sync_at).getTime() > SYNC_MAX_AGE_H * 3600_000) reasons.push(`Última sincronização com mais de ${SYNC_MAX_AGE_H} h: sincronize de novo.`)
  if (Number(s.accounts_unlimited ?? 0) > 0 && s.unlimited_assumed_mb == null) reasons.push(`${s.accounts_unlimited} conta(s) sem quota (ilimitadas): indique a quota assumida por conta ilimitada.`)
  const committed = s.quota_committed_mb == null ? null : Number(s.quota_committed_mb) + Number(s.accounts_unlimited ?? 0) * Number(s.unlimited_assumed_mb ?? 0)
  const storageFree = s.storage_total_mb == null || committed == null ? null : Number(s.storage_total_mb) - Number(s.storage_reserve_mb ?? 0) - committed - reservedStorageMb
  const accountsFree = s.license_account_limit == null || s.accounts_existing == null ? null : Number(s.license_account_limit) - Number(s.accounts_existing) - reservedAccounts
  return { determinable: reasons.length === 0, reasons, storageFreeMb: storageFree, accountsFree, reservedStorageMb, reservedAccounts }
}

/** Reservas ainda não reflectidas na última sincronização (reservadas, ou comprometidas depois dela). */
async function reservationsFor(db: Queryable, serverIds: string[]) {
  if (!serverIds.length) return new Map<string, { mb: number; accts: number }>()
  const r = await rows(db, `SELECT c.server_id, SUM(c.storage_mb) mb, SUM(c.accounts) accts FROM capacity_reservations c JOIN servers s ON s.id = c.server_id
    WHERE c.server_id IN (${serverIds.map(() => '?').join(',')}) AND (c.status = 'reserved' OR (c.status = 'committed' AND (s.last_sync_at IS NULL OR c.updated_at > s.last_sync_at)))
    GROUP BY c.server_id`, serverIds)
  return new Map(r.map(x => [x.server_id, { mb: Number(x.mb ?? 0), accts: Number(x.accts ?? 0) }]))
}

function mapServer(s: any, res?: { mb: number; accts: number }): InfraServer {
  const primary = s.name === WHM_CONFIG_NAME
  return {
    id: s.id, name: s.name, label: primary ? `${s.hostname} (WHM principal)` : s.name, primary, provider: s.provider ?? null, hostname: s.hostname, ip: s.ip_address, port: Number(s.port ?? 2087),
    credentialRef: s.credential_ref ?? null, hasToken: !!s.whm_api_token, type: s.server_type ?? 'cpanel_whm', os: s.os_name ?? null, cpuCores: n(s.cpu_cores), ramMb: n(s.ram_mb),
    storageTotalMb: n(s.storage_total_mb), storageReserveMb: Number(s.storage_reserve_mb ?? 0), storageUsedMb: n(s.storage_used_mb),
    licenseName: s.license_name ?? null, licenseAccountLimit: n(s.license_account_limit), accountsExisting: n(s.accounts_existing), accountsUnlimited: n(s.accounts_unlimited),
    quotaCommittedMb: n(s.quota_committed_mb), unlimitedAssumedMb: n(s.unlimited_assumed_mb), resellersExisting: n(s.resellers_existing),
    state: s.operational_state ?? 'active', lastSyncAt: iso(s.last_sync_at), lastSyncStatus: s.last_sync_status ?? null, lastSyncMessage: s.last_sync_message ?? null,
    services: parseJson<string[]>(s.services_allowed, []).filter(x => x in SERVER_CATEGORIES) as ServerCategory[],
    environment: s.environment === 'test' ? 'test' : 'production', resellerAuthorized: !!Number(s.reseller_authorized), resellerAuthorizedAt: iso(s.reseller_authorized_at), resellerAuthorizationNote: s.reseller_authorization_note ?? null,
    protectedAccounts: parseJson<string[]>(s.protected_accounts, []).map(String),
    capacity: computeCapacity(s, res?.mb ?? 0, res?.accts ?? 0),
  }
}

export async function listServers(db: Queryable = getPool()): Promise<InfraServer[]> {
  const list = await rows(db, 'SELECT * FROM servers ORDER BY name = ? DESC, name', [WHM_CONFIG_NAME])
  const res = await reservationsFor(db, list.map(s => s.id))
  return list.map(s => mapServer(s, res.get(s.id)))
}
export async function getServer(id: string, db: Queryable = getPool()): Promise<InfraServer | null> {
  const [s] = await rows(db, 'SELECT * FROM servers WHERE id = ?', [id])
  if (!s) return null
  return mapServer(s, (await reservationsFor(db, [id])).get(id))
}

/** Necessidade de um plano de revenda: espaço (contas-filhas + conta principal) e contas licenciadas (1 + contas-filhas). */
export const planNeed = (p: { storage_mb: number; main_quota_mb: number; max_accounts: number }) => ({ storageMb: Number(p.storage_mb) + Number(p.main_quota_mb), accounts: 1 + Number(p.max_accounts) })

/** Servidor elegível para um novo revendedor? Devolve os motivos de bloqueio (lista vazia = elegível). */
export function eligibility(s: InfraServer, need: { storageMb: number; accounts: number }, opts: { mode: string; planServerIds: string[] }): string[] {
  const why: string[] = []
  if (s.state !== 'active') why.push(`Servidor em estado «${s.state}».`)
  if (!s.services.includes('reseller')) why.push('Servidor não associado à categoria «Revenda de hospedagem».')
  if (!s.resellerAuthorized) why.push('Servidor NÃO autorizado para aprovisionamento comercial de revenda (Infraestrutura → Servidores).')
  if (!s.hasToken) why.push('Servidor sem credencial WHM configurada.')
  if (opts.planServerIds.length && !opts.planServerIds.includes(s.id)) why.push('Servidor não compatível com este plano (perfil técnico).')
  if (opts.mode === 'test' && s.environment !== 'test') why.push('Modo de teste: só servidores de ambiente «teste».')
  if (!s.capacity.determinable) why.push(...s.capacity.reasons.map(r => `Capacidade indeterminada: ${r}`))
  else {
    if ((s.capacity.storageFreeMb ?? 0) < need.storageMb) why.push(`Espaço seguro insuficiente: livre ${Math.max(0, s.capacity.storageFreeMb ?? 0)} MB, necessário ${need.storageMb} MB.`)
    if ((s.capacity.accountsFree ?? 0) < need.accounts) why.push(`Licença cPanel insuficiente: ${Math.max(0, s.capacity.accountsFree ?? 0)} conta(s) livre(s), necessárias ${need.accounts} (conta principal + contas-filhas).`)
  }
  return why
}

// ── Edição (Infraestrutura → Servidores) ──
const txt = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
const optInt = (v: unknown, label: string, min = 0, max = 2_000_000_000): number | null => {
  if (v === '' || v === null || v === undefined) return null
  const x = Number(v); if (!Number.isInteger(x) || x < min || x > max) throw new ResellerError('invalid', `${label}: número inteiro entre ${min} e ${max}.`)
  return x
}

/** Cria ou actualiza um servidor. O token é só de escrita (cifrado; nunca devolvido). */
export async function saveServer(adminId: string, input: Record<string, any>): Promise<string> {
  const db = getPool()
  const id = input.id ? String(input.id) : null
  const cur = id ? (await rows(db, 'SELECT * FROM servers WHERE id = ?', [id]))[0] : null
  if (id && !cur) throw new ResellerError('not_found', 'Servidor inexistente.', 404)
  const name = cur?.name === WHM_CONFIG_NAME ? WHM_CONFIG_NAME : txt(input.name, 80)
  if (name.length < 2) throw new ResellerError('invalid', 'Indique o nome do servidor.')
  const hostname = txt(input.hostname ?? cur?.hostname, 191).toLowerCase()
  if (!/^([a-z0-9-]+\.)*[a-z0-9-]+$/.test(hostname)) throw new ResellerError('invalid', 'Hostname inválido.')
  const ip = txt(input.ip ?? cur?.ip_address, 45)
  if (!/^[0-9a-f:.]{3,45}$/i.test(ip)) throw new ResellerError('invalid', 'Endereço IP inválido.')
  const port = optInt(input.port ?? cur?.port ?? 2087, 'Porta', 1, 65535) ?? 2087
  const services = (Array.isArray(input.services) ? input.services : parseJson<string[]>(cur?.services_allowed, [])).map(String).filter((x: string) => x in SERVER_CATEGORIES)
  const env = input.environment === 'test' ? 'test' : input.environment === 'production' ? 'production' : (cur?.environment ?? 'production')
  const state = ['active', 'maintenance', 'disabled'].includes(input.state) ? input.state : (cur?.operational_state ?? 'active')
  const protectedAccounts = (Array.isArray(input.protectedAccounts) ? input.protectedAccounts : parseJson<string[]>(cur?.protected_accounts, ['vhreslab']))
    .map((x: unknown) => String(x).trim().toLowerCase()).filter((x: string) => /^[a-z0-9_-]{1,32}$/.test(x))
  if (!protectedAccounts.includes('vhreslab') && cur?.name === WHM_CONFIG_NAME) protectedAccounts.push('vhreslab') // laboratório: nunca uso comercial
  const fields: Record<string, unknown> = {
    name, hostname, ip_address: ip, port, provider: txt(input.provider ?? cur?.provider, 120) || null, server_type: txt(input.type ?? cur?.server_type ?? 'cpanel_whm', 40) || 'cpanel_whm',
    os_name: txt(input.os ?? cur?.os_name, 80) || null, cpu_cores: optInt(input.cpuCores ?? cur?.cpu_cores, 'vCPU', 0, 1024), ram_mb: optInt(input.ramMb ?? cur?.ram_mb, 'RAM (MB)'),
    storage_total_mb: optInt(input.storageTotalMb ?? cur?.storage_total_mb, 'Armazenamento total (MB)'), storage_reserve_mb: optInt(input.storageReserveMb ?? cur?.storage_reserve_mb ?? 0, 'Reserva operacional (MB)') ?? 0,
    license_name: txt(input.licenseName ?? cur?.license_name, 80) || null, license_account_limit: optInt(input.licenseAccountLimit ?? cur?.license_account_limit, 'Limite de contas da licença', 0, 1_000_000),
    unlimited_assumed_mb: optInt(input.unlimitedAssumedMb ?? cur?.unlimited_assumed_mb, 'Quota assumida por conta ilimitada (MB)'),
    services_allowed: JSON.stringify(services), environment: env, operational_state: state, protected_accounts: JSON.stringify([...new Set(protectedAccounts)]),
  }
  if (input.whmUrl !== undefined && input.whmUrl !== '') {
    let u: URL; try { u = new URL(String(input.whmUrl)) } catch { throw new ResellerError('invalid', 'URL do WHM inválida.') }
    if (u.protocol !== 'https:') throw new ResellerError('invalid', 'O WHM tem de usar HTTPS.')
    fields.whm_url = u.origin
  }
  if (input.whmUsername) fields.whm_username = txt(input.whmUsername, 32)
  if (input.token) {
    if ((process.env.WHM_ENCRYPTION_KEY?.length ?? 0) < 64) throw new ResellerError('no_key', 'Cifra não configurada (WHM_ENCRYPTION_KEY): o token não pode ser guardado.', 503)
    fields.whm_api_token = encryptSecret(String(input.token).trim()); fields.credential_ref = 'db:servers.whm_api_token'
  }
  const cols = Object.keys(fields)
  if (cur) await db.query(`UPDATE servers SET ${cols.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => fields[c]), id])
  else {
    const nid = crypto.randomUUID()
    await db.query(`INSERT INTO servers (id, location, ${cols.map(c => `\`${c}\``).join(', ')}) VALUES (?, 'AO', ${cols.map(() => '?').join(', ')})`, [nid, ...cols.map(c => fields[c])])
    await audit(adminId, 'create', 'server', nid, `Servidor ${name} registado (${env})`)
    return nid
  }
  await audit(adminId, 'update', 'server', id, `Servidor ${name} actualizado (${env}, ${state}, categorias: ${services.join(', ') || '—'})${input.token ? '; token substituído' : ''}`)
  return id!
}

/** Autorização técnica expressa do servidor para revenda comercial (nunca automática). */
export async function setResellerAuthorization(adminId: string, id: string, authorize: boolean, note: string, confirmText: string) {
  const db = getPool()
  const s = await getServer(id, db)
  if (!s) throw new ResellerError('not_found', 'Servidor inexistente.', 404)
  if (authorize) {
    if (note.trim().length < 10) throw new ResellerError('note_required', 'Descreva a validação técnica feita (mín. 10 caracteres).')
    if (s.environment === 'production' && confirmText.trim().toUpperCase() !== 'AUTORIZO REVENDA') throw new ResellerError('confirm_required', 'Servidor de produção: escreva «AUTORIZO REVENDA» para confirmar a autorização técnica.')
    if (!s.services.includes('reseller')) throw new ResellerError('category_required', 'Associe primeiro o servidor à categoria «Revenda de hospedagem».')
    await db.query('UPDATE servers SET reseller_authorized = 1, reseller_authorized_by = ?, reseller_authorized_at = CURRENT_TIMESTAMP(6), reseller_authorization_note = ? WHERE id = ?', [adminId, note.trim().slice(0, 500), id])
  } else await db.query('UPDATE servers SET reseller_authorized = 0, reseller_authorized_by = NULL, reseller_authorized_at = NULL, reseller_authorization_note = ? WHERE id = ?', [note.trim().slice(0, 500) || null, id])
  await audit(adminId, 'update', 'server', id, `Servidor ${s.label}: revenda ${authorize ? 'AUTORIZADA' : 'retirada'} — ${note.trim().slice(0, 200)}`)
}

/** Sincronização só de leitura (version, listaccts, listresellers): contas, quotas comprometidas e revendedores. */
export async function syncServer(adminId: string | null, id: string) {
  const db = getPool()
  const cfg = await loadWhmConfig(id)
  const fail = async (msg: string) => {
    await db.query("UPDATE servers SET last_sync_at = CURRENT_TIMESTAMP(6), last_sync_status = 'error', last_sync_message = ? WHERE id = ?", [msg.slice(0, 500), id])
    await audit(adminId, 'update', 'server', id, `Sincronização falhou: ${msg.slice(0, 200)}`)
    return { ok: false, message: msg }
  }
  if (!cfg) return fail('Credencial WHM em falta ou ilegível.')
  try {
    const version = await whmVersion(cfg.config)
    const accts = await listAllAccounts(cfg.config)
    const resellers = await listResellers(cfg.config)
    const finite = accts.filter(a => a.disklimitMb != null)
    const committed = finite.reduce((t, a) => t + (a.disklimitMb ?? 0), 0)
    const used = accts.reduce((t, a) => t + (a.diskusedMb ?? 0), 0)
    await db.query(`UPDATE servers SET last_sync_at = CURRENT_TIMESTAMP(6), last_sync_status = 'ok', last_sync_message = ?, accounts_existing = ?, accounts_unlimited = ?,
      quota_committed_mb = ?, storage_used_mb = ?, resellers_existing = ? WHERE id = ?`,
      [`WHM ${version}: ${accts.length} conta(s), ${resellers.length} revendedor(es)`, accts.length, accts.length - finite.length, committed, Math.round(used), resellers.length, id])
    await audit(adminId, 'update', 'server', id, `Sincronização: ${accts.length} contas, ${resellers.length} revendedores, ${committed} MB comprometidos`)
    return { ok: true, message: `${accts.length} conta(s), ${resellers.length} revendedor(es), ${accts.length - finite.length} sem quota.` }
  } catch (e) {
    return fail(e instanceof WhmCallError ? e.message : 'Erro inesperado na sincronização.')
  }
}
