import 'server-only'
import { isServerVps, provisionVps } from '@/lib/vps/provisioning'
import { randomUUID } from 'node:crypto'
import { getPool, type Queryable } from '@/lib/db/pool'
import { loadWhmConfig } from '@/lib/whm/config'
import { createAccount, getAccount } from '@/lib/whm/client'
import { runDomainOperation } from '@/lib/registrar/operations'
import { hostingerForDomain, providerRequiresAuthorization } from '@/lib/registrar/settings'

// Activação de serviços depois do pagamento confirmado.
// Nunca cobra: só lê a encomenda paga e cria/associa o recurso no fornecedor.
// Repetível: um serviço já activo não é tocado; a conta WHM é procurada antes de criar.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export type ProvisionOutcome = { serviceId: string; status: 'active' | 'manual_required' | 'failed' | 'skipped' | 'in_progress'; message: string }

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

  const [s] = await rows(db, `SELECT s.*, o.payment_status, o.ns1, o.ns2, o.ns3, o.ns4, oi.months, oi.years, oi.domain_operation, oi.epp_code_enc, oi.nameservers AS item_ns, p.provisioning, p.whm_package, p.whm_server_id, p.slug, p.category, p.subcategory
    FROM services s JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id LEFT JOIN products p ON p.id = s.product_id
    WHERE s.id = ?`, [serviceId])
  const done = async (status: ProvisionOutcome['status'], message: string, extra: Record<string, unknown> = {}) => {
    await setStatus(serviceId, status === 'skipped' ? 'pending' : status, status === 'active' ? null : message, extra)
    return { serviceId, status, message }
  }
  if (!s) return { serviceId, status: 'failed', message: 'Serviço inexistente.' }
  if (s.payment_status !== 'paid') return done('skipped', 'Pagamento ainda não confirmado.')
  // Domínio da encomenda por confirmar (ex.: .ao) ou indisponível: o pagamento pode estar validado, mas nem o
  // registo nem os serviços que usam esse domínio (e-mail, alojamento) avançam antes da decisão da equipa.
  if (s.domain && !s.renews_service_id) {
    const [pend] = await rows(db, "SELECT availability FROM order_items WHERE order_id = ? AND domain_name = ? AND availability IN ('confirm','unavailable') LIMIT 1", [s.order_id, s.domain])
    if (pend) {
      const msg = pend.availability === 'confirm'
        ? (s.service_type === 'domain' ? 'A confirmar pela equipa: o registo espera pela confirmação da disponibilidade.' : `Aguarda a confirmação do domínio ${s.domain} pela equipa.`)
        : `Domínio ${s.domain} indisponível: caso em tratamento manual pela equipa.`
      return done('skipped', msg)
    }
  }

  const due = addMonths(Number(s.months ?? 12))
  try {
    if (s.renews_service_id) {
      // Renovação paga: serviços no nosso WHM prolongam já; os restantes dependem do fornecedor
      const [orig] = await rows(db, 'SELECT o.service_type, o.domain, p.provisioning FROM services o LEFT JOIN products p ON p.id = o.product_id WHERE o.id = ?', [s.renews_service_id])
      // Revenda: a renovação paga prolonga o serviço (a reactivação de uma suspensão é decisão do administrador)
      if (orig?.provisioning === 'whm' || orig?.service_type === 'reseller') {
        await extendService(db, s.renews_service_id, Number(s.months ?? 12))
        return await done('active', 'Renovação aplicada.', { next_due_date: null, activation_source: 'whm' })
      }
      if (orig?.service_type === 'domain' && orig.domain) {
        const r = await runDomainOperation(serviceId, 'renew', orig.domain, { years: Math.max(1, Number(s.years ?? 1)) })
        if (r.handled) {
          if (r.outcome === 'succeeded') {
            await extendService(db, s.renews_service_id, Math.max(1, Number(s.years ?? 1)) * 12)
            await db.query("UPDATE domains SET expires_at = GREATEST(COALESCE(expires_at, CURRENT_TIMESTAMP(6)), CURRENT_TIMESTAMP(6)) + INTERVAL ? YEAR WHERE service_id = ?", [Math.max(1, Number(s.years ?? 1)), s.renews_service_id])
            return await done('active', 'Renovação confirmada pelo registrador.', { external_ref: r.providerRef, activation_source: 'registrar' })
          }
          return await done(r.outcome === 'failed' ? 'failed' : 'manual_required', r.message)
        }
      }
      return await done('manual_required', 'Renovação paga: confirmar a renovação no fornecedor e marcar como concluída.')
    }
    // Servidor VPS: compra automática na Hostinger (com salvaguardas) ou tarefa manual — ver lib/vps/provisioning.ts
    if (isServerVps(s)) return await provisionVps(serviceId)
    // Revenda de Hospedagem: nunca cria contas só por estar paga — o pedido passa a «Pago» e o aprovisionamento
    // exige a autorização expressa do administrador (ou a venda automática autorizada). Ver lib/reseller/provisioning.ts
    if (s.service_type === 'reseller') {
      const { afterPayment } = await import('@/lib/reseller/provisioning')
      const r = await afterPayment(serviceId)
      const [now] = await rows(db, 'SELECT provisioning_status FROM services WHERE id = ?', [serviceId])
      // O motor pode já ter gravado o seu estado (ex.: a aguardar confirmação da ACL): não o sobrescrever
      if (now?.provisioning_status !== 'in_progress') return { serviceId, status: now.provisioning_status, message: r.message }
      return await done(r.status === 'active' ? 'manual_required' : r.status, r.message)
    }
    if (s.service_type === 'domain') {
      const op = s.domain_operation === 'transfer' ? 'transfer' : s.domain_operation === 'renew' ? 'renew' : 'register'
      const label = op === 'transfer' ? 'Transferência' : op === 'renew' ? 'Renovação' : 'Registo'
      if (!s.domain) return await done('manual_required', `${label} sem domínio associado.`)
      // Nameservers escolhidos para este domínio (item); encomendas antigas usam os da encomenda.
      let ns = [s.ns1, s.ns2, s.ns3, s.ns4].filter(Boolean)
      try { const it = s.item_ns ? JSON.parse(s.item_ns) : null; if (Array.isArray(it?.ns) && it.ns.length) ns = it.ns } catch { /* JSON inválido → os da encomenda */ }
      // Fornecedor com autorização por encomenda (Hostinger): nunca compra ao aprovar o pagamento
      if (await providerRequiresAuthorization()) {
        const h = op === 'register' ? await hostingerForDomain(s.domain) : { error: '' }
        return await done('manual_required', !('error' in h)
          ? 'Aguarda autorização: use «Registar na Hostinger» (o custo é confirmado antes da compra).'
          : `${label} manual no registrador: ${'error' in h && h.error ? h.error : 'operação sem automatização.'} Marque como activo só com a referência do registo.`)
      }
      const r = await runDomainOperation(serviceId, op, s.domain, { years: Math.max(1, Number(s.years ?? 1)), eppEnc: s.epp_code_enc, nameservers: ns })
      if (!r.handled) return await done('manual_required', `${label} manual no registrador: extensão sem integração automática activa. Marque como activo só com a referência do registo.`)
      if (r.outcome === 'succeeded') {
        await activateDomainRecord(db, s)
        return await done('active', `${label} confirmado pelo registrador.`, { external_ref: r.providerRef, next_due_date: addMonths(12 * Math.max(1, Number(s.years ?? 1))), activation_source: 'registrar' })
      }
      return await done(r.outcome === 'failed' ? 'failed' : 'manual_required', r.message)
    }
    if (s.provisioning !== 'whm') {
      return await done('manual_required', `Activação manual (${s.service_type}): sem API de fornecedor configurada para este serviço.`)
    }
    if (!s.whm_package) return await done('manual_required', `Defina o pacote WHM do plano ${s.slug} em Integrações → WHM/cPanel para activar automaticamente.`)
    if (!s.domain) return await done('manual_required', 'Serviço sem domínio associado.')
    const cfg = await loadWhmConfig(s.whm_server_id ?? undefined)
    if (!cfg) return await done('manual_required', 'Servidor WHM do plano não configurado ou token ilegível (Integrações → WHM/cPanel).')

    // Já existe conta associada a este serviço?
    const [ha] = await rows(db, 'SELECT id, cpanel_username FROM hosting_accounts WHERE service_id = ?', [serviceId])
    if (ha) return await done('active', 'Conta já associada.', { external_ref: ha.cpanel_username, next_due_date: due, activation_source: 'whm' })

    const [profile] = await rows(db, 'SELECT email FROM profiles WHERE id = ?', [s.profile_id])
    // Procura conta existente com o mesmo domínio no servidor (repetição após falha parcial)
    // Um utilizador cPanel já registado na base para OUTRO serviço nunca é reutilizado
    // (mesmo que tenha desaparecido do WHM): evita reatribuir a conta de outro cliente.
    const takenLocally = async (u: string) => (await rows(db,
      `SELECT 1 FROM hosting_accounts WHERE cpanel_username = ? AND (service_id IS NULL OR service_id <> ?)
       UNION SELECT 1 FROM whm_accounts WHERE whm_username = ? AND server_id = ? AND (service_id IS NULL OR service_id <> ?) LIMIT 1`,
      [u, serviceId, u, cfg.serverId, serviceId])).length > 0
    let username: string | null = null
    // Derivado do domínio, com sufixos 2–8 e depois aleatórios (domínios com o mesmo início esgotavam os 8 nomes)
    for (let i = 0; i < 12; i++) {
      const candidate = cpanelUsername(s.domain, i === 0 ? '' : i < 8 ? String(i + 1) : randomUUID().replace(/[^a-z]/g, '').slice(0, 3) || 'x')
      if (await takenLocally(candidate)) continue
      const acct = await getAccount(cfg.config, candidate)
      if (!acct) { username = candidate; break }
      if (acct.domain === s.domain) {
        // Conta criada numa tentativa anterior deste serviço — associa sem recriar
        await linkAccount(db, s, cfg.serverId, candidate, acct.domain, s.whm_package)
        return await done('active', 'Conta WHM existente associada.', { external_ref: candidate, next_due_date: due, activation_source: 'whm' })
      }
    }
    if (!username) return await done('manual_required', 'Não foi possível escolher um utilizador cPanel livre: atribuir manualmente.')
    await createAccount(cfg.config, {
      username, domain: s.domain, plan: s.whm_package, email: profile?.email ?? '',
      // Sem senha: o WHM gera uma; o cliente entra por SSO (nunca guardada nem registada)
      password: '',
    })
    await linkAccount(db, s, cfg.serverId, username, s.domain, s.whm_package)
    return await done('active', 'Conta cPanel criada.', { external_ref: username, next_due_date: due, activation_source: 'whm' })
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

/** Domínio confirmado (registrador ou equipa): passa o registo local a activo. */
async function activateDomainRecord(db: Queryable, s: any) {
  // registered_at é avaliado antes de status (MariaDB aplica as atribuições por ordem)
  await db.query(`UPDATE domains SET registered_at = IF(status = 'pending', CURRENT_TIMESTAMP(6), registered_at), status = 'active',
    expires_at = GREATEST(COALESCE(expires_at, CURRENT_TIMESTAMP(6)), CURRENT_TIMESTAMP(6)) + INTERVAL ? YEAR, service_id = COALESCE(service_id, ?)
    WHERE profile_id = ? AND CONCAT(name, extension) = ?`, [Math.max(1, Number(s.years ?? 1)), s.id, s.profile_id, s.domain])
}

/** Registo confirmado pelo fornecedor (fluxo autorizado, ex.: Hostinger): activa serviço e domínio. */
export async function activateFromRegistrar(serviceId: string, providerRef: string | null) {
  const db = getPool()
  const [s] = await rows(db, 'SELECT s.id, s.order_id, s.domain, s.profile_id, s.provisioning_status, oi.years FROM services s LEFT JOIN order_items oi ON oi.id = s.order_item_id WHERE s.id = ?', [serviceId])
  if (!s || s.provisioning_status === 'active') return
  await setStatus(serviceId, 'active', null, { external_ref: providerRef, next_due_date: addMonths(12 * Math.max(1, Number(s.years ?? 1))), activation_source: 'registrar' })
  await activateDomainRecord(db, s)
  await refreshOrderActivation(s.order_id)
}

export class ActivationError extends Error { constructor(message: string, public status = 400) { super(message) } }

/**
 * Activação manual concluída pelo administrador (ex.: domínio registado no painel do registrador).
 * Para domínios a referência do registo é obrigatória: sem ela o domínio não passa a «Activo».
 */
export async function markServiceActive(serviceId: string, note: string | null, externalRef: string | null, adminId: string | null = null) {
  const db = getPool()
  const [s] = await rows(db, 'SELECT s.id, s.order_id, s.service_type, s.domain, s.profile_id, s.renews_service_id, s.provisioning_status, oi.months, oi.years, o.payment_status FROM services s JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id WHERE s.id = ?', [serviceId])
  if (!s) throw new ActivationError('Serviço inexistente.', 404)
  if (s.payment_status !== 'paid') throw new ActivationError('A encomenda ainda não está paga.', 409)
  if (s.provisioning_status === 'active') throw new ActivationError('Este serviço já está activo.', 409)
  const ref = (externalRef ?? '').trim()
  if (s.service_type === 'domain' && ref.length < 3) throw new ActivationError('Indique a referência do registo no registrador (n.º da operação ou do domínio) para marcar o domínio como activo.')
  if (s.renews_service_id) {
    // Atómico: só a primeira confirmação prolonga o serviço original
    const [r] = await db.query("UPDATE services SET provisioning_status = 'active', provisioning_error = NULL, status = 'active', provisioned_at = CURRENT_TIMESTAMP(6), notes = ?, external_ref = ?, activation_source = 'manual', activated_by = ? WHERE id = ? AND provisioning_status <> 'active'", [note, ref || null, adminId, serviceId]) as any
    if (r.affectedRows) await extendService(db, s.renews_service_id, Number(s.months ?? 12))
    await refreshOrderActivation(s.order_id)
    return
  }
  const due = addMonths(s.service_type === 'domain' ? 12 * Math.max(1, Number(s.years ?? 1)) : Number(s.months ?? 12))
  await setStatus(serviceId, 'active', null, { external_ref: ref || null, next_due_date: due, notes: note, activation_source: 'manual', activated_by: adminId })
  if (s.service_type === 'domain' && s.domain) await activateDomainRecord(db, s)
  await refreshOrderActivation(s.order_id)
}
