import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { loadWhmConfig } from './config'
import { ELIGIBLE_SQL } from './link'
import { listAccountsFull, type WHMAccountFull } from './client'

// Importação de contas WHM (cPanel) — conta de hospedagem ≠ cliente ViralizaHost.
//
// Identificador estável: (servidor, utilizador cPanel). Repetir actualiza, nunca duplica.
// Associação a um cliente:
//   • automática SÓ se a conta já pertence a um serviço da ViralizaHost
//     (hosting_accounts com o mesmo servidor + utilizador);
//   • e-mail de contacto igual ao de um cliente → apenas «candidata», pendente de
//     validação pelo administrador (o e-mail do WHM não está confirmado);
//   • caso contrário fica «por associar».
// Nunca cria clientes nem importa senhas.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export type ImportAction = 'new' | 'update' | 'unchanged'
export type LinkState = 'linked' | 'pending_validation' | 'unlinked'

export interface ImportItem {
  username: string
  domain: string
  package: string
  suspended: boolean
  diskUsedMb: number
  diskLimitMb: number | null
  action: ImportAction
  link: LinkState
  linkedProfile?: string | null
  candidateProfile?: string | null
  candidateReason?: string | null
  conflicts: string[]
}

export interface ImportPlan {
  serverId: string
  found: number
  new: number
  updated: number
  unchanged: number
  alreadyLinked: number
  autoLinked: number
  pendingValidation: number
  unlinked: number
  missingFromWhm: string[]
  conflicts: { username: string; message: string }[]
  items: ImportItem[]
}

const mb = (v: unknown): number => { const s = String(v ?? '').replace(/[,\s]/g, ''); if (!s || /^unlim/i.test(s)) return 0; const n = parseFloat(s); return isNaN(n) ? 0 : Math.round(n) }
const mbLimit = (v: unknown): number | null => { const n = mb(v); return n > 0 ? n : null }
const email = (v: unknown) => { const e = String(v ?? '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.startsWith('root@') ? e : null }

export async function planImport(accountsOverride?: WHMAccountFull[]): Promise<ImportPlan> {
  const cfg = await loadWhmConfig()
  if (!cfg) throw new Error('WHM não configurado (Configurações → WHM/cPanel API).')
  const accounts = accountsOverride ?? await listAccountsFull(cfg.config)
  const db = getPool()
  const existing = new Map((await rows(db, 'SELECT * FROM whm_accounts WHERE server_id = ?', [cfg.serverId])).map(r => [r.whm_username, r]))
  const hosting = new Map((await rows(db, 'SELECT cpanel_username, profile_id, primary_domain FROM hosting_accounts WHERE server_id = ? OR server_id IS NULL', [cfg.serverId])).map(r => [r.cpanel_username, r]))
  // Candidatas por e-mail: só clientes elegíveis (contas administrativas e não confirmadas excluídas)
  const profilesByEmail = new Map((await rows(db, `SELECT p.id, p.email FROM profiles p LEFT JOIN auth_users u ON u.id = p.id WHERE ${ELIGIBLE_SQL}`)).map(r => [String(r.email).toLowerCase(), r.id]))
  const domainOwners = await rows(db, 'SELECT profile_id, CONCAT(name, extension) AS d FROM domains')
  const domainCount = new Map<string, number>()
  for (const a of accounts) domainCount.set(a.domain, (domainCount.get(a.domain) ?? 0) + 1)

  const plan: ImportPlan = { serverId: cfg.serverId, found: accounts.length, new: 0, updated: 0, unchanged: 0, alreadyLinked: 0, autoLinked: 0, pendingValidation: 0, unlinked: 0, missingFromWhm: [], conflicts: [], items: [] }
  for (const a of accounts) {
    const cur = existing.get(a.user)
    const ha = hosting.get(a.user)
    const item: ImportItem = {
      username: a.user, domain: a.domain, package: a.plan, suspended: a.suspended,
      diskUsedMb: mb(a.diskused), diskLimitMb: mbLimit(a.disklimit),
      action: 'new', link: 'unlinked', conflicts: [],
    }
    if (cur) {
      const changed = cur.primary_domain !== a.domain || cur.package_name !== a.plan || !!cur.is_suspended !== a.suspended || Number(cur.disk_used_mb ?? 0) !== item.diskUsedMb || (cur.disk_limit_mb ?? null) !== item.diskLimitMb
      item.action = changed ? 'update' : 'unchanged'
    }
    // Associação
    if (cur?.profile_id && cur.link_status === 'linked') { item.link = 'linked'; item.linkedProfile = cur.profile_id; plan.alreadyLinked++ }
    else if (ha?.profile_id) { item.link = 'linked'; item.linkedProfile = ha.profile_id; plan.autoLinked++ }
    else {
      const e = email(a.email)
      const cand = e ? profilesByEmail.get(e) : null
      if (cand) { item.link = 'pending_validation'; item.candidateProfile = cand; item.candidateReason = 'E-mail de contacto no WHM igual ao de um cliente (não confirmado)'; plan.pendingValidation++ }
      else plan.unlinked++
    }
    // Conflitos
    if ((domainCount.get(a.domain) ?? 0) > 1) item.conflicts.push(`Domínio ${a.domain} aparece em mais de uma conta WHM`)
    if (ha && ha.primary_domain && ha.primary_domain !== a.domain) item.conflicts.push(`Serviço associado tem domínio ${ha.primary_domain}, no WHM é ${a.domain}`)
    const owner = domainOwners.find(d => d.d === a.domain)
    const linkedTo = item.linkedProfile ?? item.candidateProfile
    if (owner && linkedTo && owner.profile_id !== linkedTo) item.conflicts.push(`Domínio ${a.domain} pertence a outro cliente na ViralizaHost`)
    for (const c of item.conflicts) plan.conflicts.push({ username: a.user, message: c })
    if (item.conflicts.length && item.link === 'linked' && !cur?.profile_id) { item.link = 'pending_validation'; item.candidateProfile = item.linkedProfile; item.linkedProfile = null; plan.autoLinked--; plan.pendingValidation++ }
    plan[item.action === 'new' ? 'new' : item.action === 'update' ? 'updated' : 'unchanged']++
    plan.items.push(item)
  }
  const seen = new Set(accounts.map(a => a.user))
  plan.missingFromWhm = [...existing.keys()].filter(u => !seen.has(u))
  return plan
}

/** Aplica o plano numa transacção. Repetível: actualiza as mesmas linhas (servidor + utilizador). */
export async function applyImport(accountsOverride?: WHMAccountFull[]) {
  const cfg = await loadWhmConfig()
  if (!cfg) throw new Error('WHM não configurado.')
  const accounts = accountsOverride ?? await listAccountsFull(cfg.config)
  const plan = await planImport(accounts)
  const byUser = new Map(accounts.map(a => [a.user, a]))
  await withTransaction(async conn => {
    for (const it of plan.items) {
      const a = byUser.get(it.username)!
      const status = a.suspended ? 'suspended' : 'active'
      const linkStatus = it.link === 'linked' ? 'linked' : it.link === 'pending_validation' ? 'pending_validation' : 'unlinked'
      await conn.query(
        `INSERT INTO whm_accounts (id, server_id, whm_username, primary_domain, contact_email, package_name, ip_address, owner, \`partition\`, disk_used_mb, disk_limit_mb,
           unix_startdate, is_suspended, suspension_reason, theme, php_version, max_pop, max_sub, max_sql, max_ftp, profile_id, status, last_synced_at, sync_status,
           requires_manual_link, link_status, link_candidate_profile_id, link_candidate_reason, whm_uuid, raw_metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), 'synced', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE primary_domain = VALUES(primary_domain), contact_email = VALUES(contact_email), package_name = VALUES(package_name),
           ip_address = VALUES(ip_address), disk_used_mb = VALUES(disk_used_mb), disk_limit_mb = VALUES(disk_limit_mb), is_suspended = VALUES(is_suspended),
           suspension_reason = VALUES(suspension_reason), php_version = VALUES(php_version), max_pop = VALUES(max_pop), max_sub = VALUES(max_sub),
           max_sql = VALUES(max_sql), max_ftp = VALUES(max_ftp), status = VALUES(status), last_synced_at = CURRENT_TIMESTAMP(6), sync_status = 'synced',
           whm_uuid = COALESCE(VALUES(whm_uuid), whm_uuid), raw_metadata = VALUES(raw_metadata),
           profile_id = IF(link_status = 'linked', profile_id, VALUES(profile_id)),
           link_status = IF(link_status = 'linked', link_status, VALUES(link_status)),
           requires_manual_link = IF(link_status = 'linked', 0, VALUES(requires_manual_link)),
           link_candidate_profile_id = IF(link_status = 'linked', NULL, VALUES(link_candidate_profile_id)),
           link_candidate_reason = IF(link_status = 'linked', NULL, VALUES(link_candidate_reason))`,
        [randomUUID(), cfg.serverId, a.user, a.domain, email(a.email), a.plan, a.ip || null, a.owner, a.partition, it.diskUsedMb, it.diskLimitMb,
          a.unix_startdate || null, a.suspended ? 1 : 0, a.suspendreason || null, a.theme || null, a.phpversion || null,
          String(a.maxpop), String(a.maxsub), String(a.maxsql), String(a.maxftp),
          it.link === 'linked' ? it.linkedProfile : null, status,
          it.link === 'linked' ? 0 : 1, linkStatus, it.candidateProfile ?? null, it.candidateReason ?? null, (a as any).uuid ?? null,
          JSON.stringify({ plan: a.plan, owner: a.owner, theme: a.theme })],
      )
      // Uso e limites no serviço já associado (mesmo servidor + utilizador)
      await conn.query(
        `UPDATE hosting_accounts SET disk_used_mb = ?, disk_limit_mb = ?, package_name = ?, ip_address = ?, php_version = ?,
           status = ?, suspension_reason = ?, last_synced_at = CURRENT_TIMESTAMP(6) WHERE cpanel_username = ? AND (server_id = ? OR server_id IS NULL)`,
        [it.diskUsedMb, it.diskLimitMb, a.plan, a.ip || null, a.phpversion || null, status, a.suspendreason || null, a.user, cfg.serverId],
      )
    }
    if (plan.missingFromWhm.length) {
      await conn.query(`UPDATE whm_accounts SET sync_status = 'missing_from_whm', last_synced_at = CURRENT_TIMESTAMP(6) WHERE server_id = ? AND whm_username IN (${plan.missingFromWhm.map(() => '?').join(',')})`, [cfg.serverId, ...plan.missingFromWhm])
    }
  })
  return plan
}

/** O administrador recusa a candidata sugerida (a confirmação usa a rota de associação existente). */
export async function resolveCandidate(whmAccountId: string, approve: false) {
  void approve
  const db = getPool()
  const [w] = await rows(db, 'SELECT id FROM whm_accounts WHERE id = ?', [whmAccountId])
  if (!w) throw new Error('Conta WHM inexistente.')
  await db.query("UPDATE whm_accounts SET link_status = 'unlinked', link_candidate_profile_id = NULL, link_candidate_reason = NULL, requires_manual_link = 1 WHERE id = ? AND link_status <> 'linked'", [whmAccountId])
  return { linked: false }
}
