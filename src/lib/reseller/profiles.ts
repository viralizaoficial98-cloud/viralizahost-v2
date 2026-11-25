import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'
import { loadWhmConfig } from '@/lib/whm/config'
import { listPackages } from '@/lib/whm/client'
import { listAcls, WhmCallError } from './whm'
import { audit, ResellerError } from './settings'

// Perfil técnico de cada plano de revenda (Catálogo e Preços → Revenda → «Perfil técnico»): limites reais aplicados
// no WHM, ACL, pacote da conta principal, pacotes autorizados e servidores compatíveis. Preço e características
// continuam no editor de planos (family-plans.ts) — nada é duplicado.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
const parseJson = <T>(v: unknown, d: T): T => { if (v == null) return d; if (typeof v !== 'string') return v as T; try { return JSON.parse(v) as T } catch { return d } }

/** Privilégios WHM que um revendedor comercial NUNCA recebe (root, recursos ilimitados, quotas arbitrárias,
 *  reinícios de serviços, configuração global, shell). A ACL escolhida é auditada contra esta lista. */
export const FORBIDDEN_PRIVILEGES = [
  'all', 'allow-unlimited-disk-pkgs', 'allow-unlimited-bw-pkgs', 'allow-unlimited-pkgs', 'allow-shell', 'add-pkg-shell', 'add-pkg-ip',
  'quota', 'edit-account', 'limit-bandwidth', 'rearrange-accts', 'restart', 'clustering', 'demo-setup', 'resftp', 'news',
] as const
/** Privilégios para gerir pacotes próprios: preparados, só com validação técnica e comercial (allow_own_packages). */
export const OWN_PACKAGE_PRIVILEGES = ['add-pkg', 'edit-pkg'] as const
/** ACL de referência do laboratório (viraliza_reseller_lab_acl), validada manualmente no servidor. */
export const LAB_ACL_REFERENCE = ['acct-summary', 'basic-system-info', 'basic-whm-functions', 'cpanel-api', 'create-acct', 'create-user-session', 'digest-auth', 'generate-email-config', 'list-accts', 'list-pkgs', 'mysql-info', 'passwd', 'public-contact', 'show-bandwidth', 'ssl', 'ssl-info', 'suspend-acct', 'track-email']

export function auditAcl(privileges: string[], allowOwnPackages: boolean) {
  const forbidden = privileges.filter(p => (FORBIDDEN_PRIVILEGES as readonly string[]).includes(p))
  const ownPkg = privileges.filter(p => (OWN_PACKAGE_PRIVILEGES as readonly string[]).includes(p))
  const problems = [...forbidden.map(p => `privilégio proibido: ${p}`), ...(!allowOwnPackages ? ownPkg.map(p => `gestão de pacotes próprios sem autorização: ${p}`) : [])]
  return { ok: problems.length === 0, problems, extra: privileges.filter(p => !LAB_ACL_REFERENCE.includes(p)) }
}

export interface ResellerProfile {
  productId: string; slug: string; name: string; saleStatus: string
  storageMb: number; bandwidthMb: number; maxAccounts: number; mainQuotaMb: number
  aclName: string | null; mainPackage: string | null; allowedPackages: string[]; serverIds: string[]; allowOwnPackages: boolean; notes: string | null
  complete: boolean; missing: string[]
}
export function profileMissing(p: { aclName: string | null; mainPackage: string | null; allowedPackages: string[] }) {
  const m: string[] = []
  if (!p.aclName) m.push('ACL')
  if (!p.mainPackage) m.push('pacote da conta principal')
  if (!p.allowedPackages.length) m.push('pacotes autorizados')
  return m
}
const mapProfile = (r: any): ResellerProfile => {
  const p = {
    productId: r.id, slug: r.slug, name: r.name, saleStatus: r.sale_status,
    storageMb: Number(r.storage_mb ?? 0), bandwidthMb: Number(r.bandwidth_mb ?? 0), maxAccounts: Number(r.max_accounts ?? 0), mainQuotaMb: Number(r.main_quota_mb ?? 0),
    aclName: r.acl_name ?? null, mainPackage: r.main_package ?? null, allowedPackages: parseJson<string[]>(r.allowed_packages, []), serverIds: parseJson<string[]>(r.server_ids, []),
    allowOwnPackages: !!Number(r.allow_own_packages ?? 0), notes: r.notes ?? null, complete: false, missing: [] as string[],
  }
  const configured = r.storage_mb != null
  p.missing = configured ? profileMissing(p) : ['perfil técnico']
  p.complete = configured && p.missing.length === 0
  return p
}

export async function listProfiles(db: Queryable = getPool()): Promise<ResellerProfile[]> {
  return (await rows(db, `SELECT p.id, p.slug, p.name, p.sale_status, r.* FROM products p LEFT JOIN reseller_plan_profiles r ON r.product_id = p.id
    WHERE p.category = 'reseller' AND p.subcategory IS NULL AND p.active = 1 ORDER BY p.position, p.name`)).map(mapProfile)
}
export async function getProfile(productId: string, db: Queryable = getPool()): Promise<ResellerProfile | null> {
  const [r] = await rows(db, `SELECT p.id, p.slug, p.name, p.sale_status, r.* FROM products p LEFT JOIN reseller_plan_profiles r ON r.product_id = p.id
    WHERE p.id = ? AND p.category = 'reseller' AND p.subcategory IS NULL`, [productId])
  return r ? mapProfile(r) : null
}

const LAB = /_lab(_|$)/i
const name = (v: unknown, label: string, required = false): string | null => {
  const s = String(v ?? '').trim()
  if (!s) { if (required) throw new ResellerError('invalid', `${label}: obrigatório.`); return null }
  if (!/^[A-Za-z0-9_.\- ]{1,64}$/.test(s)) throw new ResellerError('invalid', `${label}: só letras, números, espaço, «_», «-» e «.» (máx. 64).`)
  if (LAB.test(s)) throw new ResellerError('lab_profile', `${label}: «${s}» é do laboratório (vhreslab) e não é usado comercialmente. Crie um perfil comercial auditado.`)
  return s
}
const int = (v: unknown, label: string, min: number, max: number) => {
  const x = Number(v)
  if (!Number.isInteger(x) || x < min || x > max) throw new ResellerError('invalid', `${label}: número inteiro entre ${min} e ${max.toLocaleString('pt-PT')}.`)
  return x
}

export async function saveProfile(adminId: string, input: Record<string, any>) {
  const db = getPool()
  const productId = String(input.productId ?? '')
  const cur = await getProfile(productId, db)
  if (!cur) throw new ResellerError('not_found', 'Plano de revenda inexistente.', 404)
  // Limites finitos sempre (nunca ilimitado); tráfego e espaço em MB
  const storage = int(input.storageMb, 'Armazenamento distribuível (MB)', 1024, 10_485_760)
  const bw = int(input.bandwidthMb, 'Tráfego mensal (MB)', 1024, 104_857_600)
  const accts = int(input.maxAccounts, 'Contas cPanel', 1, 1000)
  const mainq = int(input.mainQuotaMb, 'Quota da conta principal (MB)', 100, 1_048_576)
  const acl = name(input.aclName, 'ACL')
  const mainPkg = name(input.mainPackage, 'Pacote da conta principal')
  const pkgs = [...new Set((Array.isArray(input.allowedPackages) ? input.allowedPackages : String(input.allowedPackages ?? '').split(/[\n,]+/)).map((x: unknown) => String(x).trim()).filter(Boolean))]
  if (pkgs.length > 20) throw new ResellerError('invalid', 'No máximo 20 pacotes autorizados.')
  pkgs.forEach(p => name(p, 'Pacote autorizado', true))
  const serverIds = [...new Set((Array.isArray(input.serverIds) ? input.serverIds : []).map(String))]
  if (serverIds.length) {
    const ok = await rows(db, `SELECT id FROM servers WHERE id IN (${serverIds.map(() => '?').join(',')})`, serverIds)
    if (ok.length !== serverIds.length) throw new ResellerError('invalid', 'Servidor compatível inexistente.')
  }
  const own = input.allowOwnPackages === true
  if (own && String(input.ownPackagesConfirm ?? '').trim().toUpperCase() !== 'VALIDADO') throw new ResellerError('confirm_required', 'Gestão de pacotes próprios: escreva «VALIDADO» (exige validação técnica e comercial).')
  const notes = String(input.notes ?? '').trim().slice(0, 500) || null
  await db.query(`INSERT INTO reseller_plan_profiles (product_id, storage_mb, bandwidth_mb, max_accounts, main_quota_mb, acl_name, main_package, allowed_packages, server_ids, allow_own_packages, notes, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE storage_mb = VALUES(storage_mb), bandwidth_mb = VALUES(bandwidth_mb), max_accounts = VALUES(max_accounts),
    main_quota_mb = VALUES(main_quota_mb), acl_name = VALUES(acl_name), main_package = VALUES(main_package), allowed_packages = VALUES(allowed_packages), server_ids = VALUES(server_ids),
    allow_own_packages = VALUES(allow_own_packages), notes = VALUES(notes), updated_by = VALUES(updated_by)`,
    [productId, storage, bw, accts, mainq, acl, mainPkg, JSON.stringify(pkgs), JSON.stringify(serverIds), own ? 1 : 0, notes, adminId])
  await audit(adminId, 'update', 'reseller_profile', productId, `Perfil técnico ${cur.name}: ${storage} MB, ${bw} MB tráfego, ${accts} contas, principal ${mainq} MB, ACL ${acl ?? '—'}, pacotes ${pkgs.join(', ') || '—'}`)
  return getProfile(productId, db)
}

/** Lê do WHM (só leitura) os pacotes e as ACLs de um servidor e audita cada ACL. */
export async function whmCatalog(serverId: string) {
  const cfg = await loadWhmConfig(serverId)
  if (!cfg) throw new ResellerError('no_credentials', 'Servidor sem credencial WHM.', 409)
  try {
    const [pkgs, acls] = await Promise.all([listPackages(cfg.config), listAcls(cfg.config)])
    return {
      packages: pkgs.map(p => ({ name: p.name, quota: p.quota, bwlimit: p.bwlimit, unlimited: /unlimited/i.test(`${p.quota}${p.bwlimit}`) })),
      acls: acls.map(a => ({ ...a, lab: LAB.test(a.name), audit: auditAcl(a.privileges, false) })),
    }
  } catch (e) { throw new ResellerError('whm_error', e instanceof WhmCallError ? e.message : 'Falha ao ler o WHM.', 502) }
}
