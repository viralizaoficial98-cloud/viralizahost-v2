import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { loadWhmConfig } from '@/lib/whm/config'
import type { WHMConfig } from '@/lib/whm/client'
import { cpanelUsername } from '@/lib/commerce/provisioning'
import { audit, getResellerSettings, ResellerError } from './settings'
import { eligibility, getServer, planNeed, listServers, type InfraServer } from './infra'
import { getProfile, type ResellerProfile } from './profiles'
import { notifyAdmins, notifyClient } from './notify'
import * as W from './whm'

// Motor de aprovisionamento de revendedores (WHM). Uma operação persistente por serviço (reseller_provision_ops,
// UNIQUE service_id), com bloqueio (lock_token + locked_until), estado retomável (state.done), tentativas limitadas,
// eventos auditados por passo (reseller_provision_events) e tempo limite por chamada WHM.
// Passos (1–20 da especificação):
//   1 pedido aprovado · 2 modo · 3 autorização do administrador · 4 pagamento confirmado · 5 servidor elegível
//   6 domínio e utilizador livres · 7 reserva de capacidade · 8 conta principal · 9 pacote · 10 estatuto de revendedor
//   11 ACL · 12 limite de contas · 13 espaço e tráfego · 14 sem overselling · 15 pacotes autorizados
//   16 verificação do que é observável · 17 sincronização na base · 18 activação (após confirmação da ACL efectiva)
//   19 notificação do cliente · 20 acesso na área de cliente
// Regras: em qualquer falha NÃO há acesso; nunca se apagam contas (nem para corrigir falhas parciais); a conta de
// laboratório (vhreslab) e as contas protegidas do servidor nunca são usadas; escrita no WHM só com
// RESELLER_PROVISIONING_ENABLED=1 e, em servidores de produção, também RESELLER_PRODUCTION_PROVISIONING=1.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
const LOCK_MINUTES = 5
const BACKOFF_MIN = [1, 5, 15, 60]

type Step = 'validate' | 'availability' | 'reserve' | 'create_account' | 'package' | 'setup_reseller' | 'acl' | 'limits' | 'packages' | 'verify' | 'sync'
export const STEP_LABEL: Record<string, string> = {
  validate: 'Validações (pedido, modo, autorização, pagamento, servidor)', availability: 'Domínio e utilizador livres', reserve: 'Reserva de capacidade',
  create_account: 'Conta principal (createacct)', package: 'Pacote da conta principal', setup_reseller: 'Estatuto de revendedor (setupreseller)', acl: 'ACL (setacls)',
  limits: 'Limites de contas, espaço, tráfego e overselling (setresellerlimits)', packages: 'Pacotes autorizados (setresellerpackagelimit)', verify: 'Verificação das definições efectivas',
  sync: 'Sincronização na base', confirm_acl: 'Confirmação da ACL efectiva', activate: 'Activação e notificação',
}

interface OpState { username?: string; created?: boolean; done: Step[]; verification?: Record<string, unknown> }
class StepError extends Error { logged = false; constructor(message: string, public retryable = false, public blocked = false) { super(message) } }

export function writeGuard(server: InfraServer): string | null {
  if (process.env.RESELLER_PROVISIONING_ENABLED !== '1') return 'Escrita no WHM desactivada neste processo (RESELLER_PROVISIONING_ENABLED ≠ 1).'
  if (server.environment === 'production' && process.env.RESELLER_PRODUCTION_PROVISIONING !== '1') return 'Aprovisionamento em servidores de PRODUÇÃO desactivado neste processo (RESELLER_PRODUCTION_PROVISIONING ≠ 1).'
  return null
}

async function logEvent(db: Queryable, opId: string, step: string, outcome: 'ok' | 'skipped' | 'error' | 'info', message: string, fn: string | null = null, ms: number | null = null) {
  await db.query('INSERT INTO reseller_provision_events (id, op_id, step, outcome, whm_function, message, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), opId, step, outcome, fn, message.slice(0, 600), ms])
}
async function reqEvent(db: Queryable, requestId: string | null, actorId: string | null, from: string | null, to: string | null, action: string, note: string | null) {
  if (!requestId) return
  await db.query('INSERT INTO reseller_request_events (id, request_id, actor_id, from_status, to_status, action, note) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), requestId, actorId, from, to, action, note?.slice(0, 1000) ?? null])
}

/** Painel: autoriza expressamente o aprovisionamento de um pedido pago e executa o motor. */
export async function authorizeAndRun(adminId: string, requestId: string) {
  const db = getPool()
  const [r] = await rows(db, 'SELECT id, reference, status, service_id FROM reseller_requests WHERE id = ?', [requestId])
  if (!r?.service_id) throw new ResellerError('no_service', 'Pedido sem serviço associado (encaminhe primeiro para pagamento).', 409)
  const [res] = await db.query("UPDATE reseller_requests SET status = 'provisioning_authorized', provisioning_authorized_by = ?, provisioning_authorized_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND status = 'paid'", [adminId, requestId]) as any
  if (!res.affectedRows) throw new ResellerError('conflict', 'O pedido já não está «Pago»: recarregue.', 409)
  await reqEvent(db, requestId, adminId, 'paid', 'provisioning_authorized', 'authorize_provisioning', null)
  await audit(adminId, 'activate', 'reseller_request', requestId, `Pedido ${r.reference}: aprovisionamento autorizado`)
  await db.query(`INSERT INTO reseller_provision_ops (id, service_id, request_id, status, step, state, authorized_by) VALUES (?, ?, ?, 'queued', 'validate', JSON_OBJECT('done', JSON_ARRAY()), ?)
    ON DUPLICATE KEY UPDATE authorized_by = VALUES(authorized_by)`, [randomUUID(), r.service_id, requestId, adminId])
  const out = await runProvisioning(r.service_id, adminId)
  const { requestDetail } = await import('./requests')
  return { ...(await requestDetail(requestId)), outcome: out }
}

export type EngineOutcome = { status: 'awaiting_confirmation' | 'active' | 'failed' | 'blocked' | 'busy' | 'skipped'; message: string }

/**
 * Executa (ou retoma) a operação do serviço. Idempotente: passos concluídos (state.done) não se repetem; a conta
 * criada numa tentativa anterior é reconhecida pelo utilizador guardado ANTES do createacct.
 */
export async function runProvisioning(serviceId: string, actorId: string | null): Promise<EngineOutcome> {
  const db = getPool()
  const [op0] = await rows(db, 'SELECT * FROM reseller_provision_ops WHERE service_id = ?', [serviceId])
  if (!op0) return { status: 'skipped', message: 'Sem operação de aprovisionamento autorizada.' }
  if (op0.status === 'succeeded') return { status: 'active', message: 'Revendedor já activo.' }
  if (op0.status === 'awaiting_confirmation') return { status: 'awaiting_confirmation', message: 'A aguardar a confirmação da ACL efectiva.' }
  if (Number(op0.attempts) >= Number(op0.max_attempts) && op0.status === 'failed') return { status: 'failed', message: `Limite de ${op0.max_attempts} tentativas atingido: reveja o erro e use «Repor tentativas».` }
  // Bloqueio: só um processo de cada vez por serviço
  const token = randomUUID()
  const [claim] = await db.query(`UPDATE reseller_provision_ops SET status = 'running', lock_token = ?, locked_until = CURRENT_TIMESTAMP(6) + INTERVAL ${LOCK_MINUTES} MINUTE, attempts = attempts + 1, next_attempt_at = NULL
    WHERE service_id = ? AND (status IN ('queued','failed','blocked') OR (status = 'running' AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP(6))))`, [token, serviceId]) as any
  if (!claim.affectedRows) return { status: 'busy', message: 'Aprovisionamento já em curso noutro processo.' }
  const op = (await rows(db, 'SELECT * FROM reseller_provision_ops WHERE service_id = ?', [serviceId]))[0]
  let state: OpState = { done: [] }
  try { state = { done: [], ...(typeof op.state === 'string' ? JSON.parse(op.state) : op.state ?? {}) } } catch { /* estado ilegível → recomeça as validações (os passos WHM são idempotentes) */ }
  const save = async (step: string, extra: Record<string, unknown> = {}) => {
    const cols = Object.keys(extra)
    await db.query(`UPDATE reseller_provision_ops SET step = ?, state = ?${cols.map(c => `, \`${c}\` = ?`).join('')} WHERE id = ? AND lock_token = ?`, [step, JSON.stringify(state), ...cols.map(c => extra[c]), op.id, token])
  }
  const [s] = await rows(db, `SELECT s.*, o.payment_status, p.slug, p.name product_name FROM services s JOIN orders o ON o.id = s.order_id JOIN products p ON p.id = s.product_id WHERE s.id = ?`, [serviceId])
  const [req] = op.request_id ? await rows(db, 'SELECT * FROM reseller_requests WHERE id = ?', [op.request_id]) : [null]
  const [client] = s ? await rows(db, 'SELECT id, email, full_name FROM profiles WHERE id = ?', [s.profile_id]) : [null]
  await db.query("UPDATE services SET provisioning_status = 'in_progress', provisioning_attempts = provisioning_attempts + 1 WHERE id = ?", [serviceId])
  if (req && ['provisioning_authorized', 'failed'].includes(req.status)) {
    await db.query("UPDATE reseller_requests SET status = 'provisioning' WHERE id = ? AND status IN ('provisioning_authorized','failed')", [req.id])
    await reqEvent(db, req.id, actorId, req.status, 'provisioning', 'provisioning_started', `Tentativa ${op.attempts}`)
  }

  let server: InfraServer | null = null, cfg: WHMConfig | null = null, profile: ResellerProfile | null = null
  const timed = async <T>(step: string, fn: string, call: () => Promise<T>): Promise<T> => {
    const t0 = Date.now()
    try { const v = await call(); await logEvent(db, op.id, step, 'ok', `${fn} OK`, fn, Date.now() - t0); return v }
    catch (e) {
      const msg = e instanceof W.WhmCallError ? e.message : `Erro inesperado em ${fn}.`
      await logEvent(db, op.id, step, 'error', msg, fn, Date.now() - t0)
      const se = new StepError(msg, e instanceof W.WhmCallError ? e.transient : false); se.logged = true; throw se
    }
  }
  let current: string = 'validate'
  try {
    // ── 1–5: validações (repetidas em cada execução) ──
    current = 'validate'
    if (!s) throw new StepError('Serviço inexistente.', false, true)
    const settings = await getResellerSettings(db)
    if (settings.mode === 'disabled') throw new StepError('Revenda desactivada: aprovisionamento bloqueado.', false, true)
    if (req) {
      if (!['provisioning_authorized', 'provisioning', 'failed'].includes(req.status)) throw new StepError(`Pedido no estado «${req.status}»: não aprovado para aprovisionamento.`, false, true)
      if (!req.provisioning_authorized_by && !op.authorized_by) throw new StepError('Sem autorização expressa do administrador.', false, true)
      if (settings.mode === 'test' && !Number(req.is_test)) throw new StepError('Modo de teste: só pedidos de teste.', false, true)
    } else if (!settings.automaticReady) throw new StepError('Venda automática não autorizada: aprovisionamento sem pedido bloqueado.', false, true)
    if (s.payment_status !== 'paid') throw new StepError('Pagamento não confirmado.', false, true)
    profile = await getProfile(s.product_id, db)
    if (!profile?.complete) throw new StepError(`Perfil técnico incompleto (${profile?.missing.join(', ') || 'perfil'}).`, false, true)
    const need = planNeed({ storage_mb: profile.storageMb, main_quota_mb: profile.mainQuotaMb, max_accounts: profile.maxAccounts })
    let serverId: string | null = req?.server_id ?? op.server_id ?? null
    if (!serverId) {
      // Venda automática (sem pedido): primeiro servidor elegível
      const all = await listServers(db)
      serverId = all.find(x => eligibility(x, need, { mode: settings.mode, planServerIds: profile!.serverIds }).length === 0)?.id ?? null
      if (!serverId) throw new StepError('Sem servidor elegível com capacidade.', false, true)
    }
    server = await getServer(serverId, db)
    if (!server) throw new StepError('Servidor inexistente.', false, true)
    // Elegibilidade: com reserva já feita para este pedido, a capacidade reservada não conta contra ele próprio
    const [ownRes] = await rows(db, "SELECT storage_mb, accounts FROM capacity_reservations WHERE (request_id = ? OR service_id = ?) AND status IN ('reserved','committed')", [req?.id ?? '', serviceId])
    const effective: InfraServer = ownRes ? { ...server, capacity: { ...server.capacity, storageFreeMb: (server.capacity.storageFreeMb ?? 0) + Number(ownRes.storage_mb), accountsFree: (server.capacity.accountsFree ?? 0) + Number(ownRes.accounts) } } : server
    const problems = state.created ? [] : eligibility(effective, need, { mode: settings.mode, planServerIds: profile.serverIds })
    if (problems.length) throw new StepError(problems.join(' '), false, true)
    const guard = writeGuard(server)
    if (guard) throw new StepError(guard, false, true)
    const lc = await loadWhmConfig(server.id)
    if (!lc) throw new StepError('Credencial WHM do servidor em falta ou ilegível.', false, true)
    cfg = lc.config
    await db.query('UPDATE reseller_provision_ops SET server_id = ? WHERE id = ?', [server.id, op.id])
    await logEvent(db, op.id, 'validate', 'ok', `Pedido, modo (${settings.mode}), autorização, pagamento e servidor ${server.label} validados.`)

    const domain = String(s.domain ?? req?.domain ?? '').toLowerCase()
    if (!domain) throw new StepError('Serviço sem domínio.', false, true)
    const protectedAccounts = new Set(['vhreslab', ...server.protectedAccounts])

    // ── 6: disponibilidade do domínio e do utilizador ──
    if (!state.done.includes('availability')) {
      current = 'availability'
      const onServer = await timed('availability', 'listaccts', () => W.findAccountByDomain(cfg!, domain))
      if (onServer && !(state.username && onServer.user === state.username)) throw new StepError(`O domínio ${domain} já existe no servidor (conta ${onServer.user}). Resolva manualmente: nenhuma conta é apagada ou reutilizada.`, false, true)
      if (!state.username) {
        let chosen: string | null = null
        // Candidatos: o derivado do domínio, com sufixos 2–8, e depois sufixos aleatórios (domínios parecidos)
        for (let i = 0; i < 12 && !chosen; i++) {
          const cand = cpanelUsername(domain, i === 0 ? '' : i < 8 ? String(i + 1) : randomUUID().replace(/[^a-z]/g, '').slice(0, 3) || 'x')
          if (protectedAccounts.has(cand) || /lab$/.test(cand)) continue
          const [local] = await rows(db, `SELECT 1 FROM reseller_services WHERE server_id = ? AND whm_username = ? UNION SELECT 1 FROM hosting_accounts WHERE cpanel_username = ?
            UNION SELECT 1 FROM whm_accounts WHERE server_id = ? AND whm_username = ? LIMIT 1`, [server.id, cand, cand, server.id, cand])
          if (local) continue
          const free = await timed('availability', 'verify_new_username', () => W.usernameAvailable(cfg!, cand))
          if (!free.ok) continue
          if (await timed('availability', 'accountsummary', () => W.accountSummary(cfg!, cand))) continue
          chosen = cand
        }
        if (!chosen) throw new StepError('Não foi possível escolher um utilizador livre.', false, true)
        state.username = chosen
      }
      state.done.push('availability'); await save('availability')
    }
    const user = state.username!
    if (protectedAccounts.has(user)) throw new StepError(`Conta protegida (${user}): nunca usada comercialmente.`, false, true)

    // ── 7: reserva de capacidade (transaccional) ──
    if (!state.done.includes('reserve')) {
      current = 'reserve'
      await withTransaction(async conn => {
        await conn.query('SELECT id FROM servers WHERE id = ? FOR UPDATE', [server!.id])
        const [mine] = await rows(conn, "SELECT id FROM capacity_reservations WHERE (request_id = ? OR service_id = ?) AND status IN ('reserved','committed') FOR UPDATE", [req?.id ?? '', serviceId])
        if (mine) { await conn.query('UPDATE capacity_reservations SET service_id = ?, server_id = ? WHERE id = ?', [serviceId, server!.id, mine.id]); return }
        const fresh = await getServer(server!.id, conn)
        const p2 = fresh ? eligibility(fresh, need, { mode: settings.mode, planServerIds: profile!.serverIds }) : ['Servidor inexistente.']
        if (p2.length) throw new StepError(p2.join(' '), false, true)
        await conn.query("INSERT INTO capacity_reservations (id, server_id, request_id, service_id, storage_mb, accounts, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?)",
          [randomUUID(), server!.id, req?.id ?? null, serviceId, need.storageMb, need.accounts, actorId])
      })
      await logEvent(db, op.id, 'reserve', 'ok', `Reservados ${need.storageMb} MB e ${need.accounts} conta(s) licenciada(s).`)
      state.done.push('reserve'); await save('reserve')
    }

    // ── 8: conta principal ──
    if (!state.done.includes('create_account')) {
      current = 'create_account'
      const existing = await timed('create_account', 'accountsummary', () => W.accountSummary(cfg!, user))
      if (existing) {
        // Só se adopta a conta criada por ESTA operação (utilizador guardado antes do createacct e mesmo domínio)
        if (existing.domain.toLowerCase() !== domain) throw new StepError(`O utilizador ${user} já existe com outro domínio: intervenção manual.`, false, true)
        await logEvent(db, op.id, 'create_account', 'skipped', `Conta ${user} já criada numa tentativa anterior: retomada sem recriar.`)
      } else {
        await timed('create_account', 'createacct', () => W.createMainAccount(cfg!, { username: user, domain, plan: profile!.mainPackage!, contactemail: client?.email ?? req?.email ?? '', quotaMb: profile!.mainQuotaMb }))
      }
      state.created = true; state.done.push('create_account'); await save('create_account')
    }
    // ── 9: pacote ──
    if (!state.done.includes('package')) {
      current = 'package'
      const a = await timed('package', 'accountsummary', () => W.accountSummary(cfg!, user))
      if (!a) throw new StepError('Conta principal não encontrada depois da criação.', true)
      if (a.plan !== profile.mainPackage) throw new StepError(`Pacote aplicado «${a.plan}» ≠ «${profile.mainPackage}».`, false, true)
      state.done.push('package'); await save('package')
    }
    // ── 10: estatuto de revendedor ──
    if (!state.done.includes('setup_reseller')) {
      current = 'setup_reseller'
      const list = await timed('setup_reseller', 'listresellers', () => W.listResellers(cfg!))
      if (!list.includes(user)) await timed('setup_reseller', 'setupreseller', () => W.setupReseller(cfg!, user))
      state.done.push('setup_reseller'); await save('setup_reseller')
    }
    // ── 11: ACL ──
    if (!state.done.includes('acl')) {
      current = 'acl'
      await timed('acl', 'setacls', () => W.setAcls(cfg!, user, profile!.aclName!))
      state.done.push('acl'); await save('acl')
    }
    // ── 12–14: limites (contas, espaço, tráfego) e overselling desactivado ──
    if (!state.done.includes('limits')) {
      current = 'limits'
      await timed('limits', 'setresellerlimits', () => W.setResellerLimits(cfg!, user, { accounts: profile!.maxAccounts, diskMb: profile!.storageMb, bwMb: profile!.bandwidthMb }))
      state.done.push('limits'); await save('limits')
    }
    // ── 15: pacotes autorizados ──
    if (!state.done.includes('packages')) {
      current = 'packages'
      for (const pkg of profile.allowedPackages) await timed('packages', 'setresellerpackagelimit', () => W.setResellerPackageLimit(cfg!, user, pkg, true))
      state.done.push('packages'); await save('packages')
    }
    // ── 16: verificação do que é observável ──
    if (!state.done.includes('verify')) {
      current = 'verify'
      const list = await timed('verify', 'listresellers', () => W.listResellers(cfg!))
      const counts = await timed('verify', 'acctcounts', () => W.acctCounts(cfg!, user))
      const stats = await timed('verify', 'resellerstats', () => W.resellerStats(cfg!, user))
      const main = await timed('verify', 'accountsummary', () => W.accountSummary(cfg!, user))
      const checks: Record<string, { expected: unknown; actual: unknown; ok: boolean | null }> = {
        reseller: { expected: true, actual: list.includes(user), ok: list.includes(user) },
        account_limit: { expected: profile.maxAccounts, actual: counts.limit, ok: counts.limit === profile.maxAccounts },
        disk_limit_mb: { expected: profile.storageMb, actual: stats.diskLimitMb, ok: stats.diskLimitMb == null ? null : stats.diskLimitMb === profile.storageMb },
        bandwidth_limit_mb: { expected: profile.bandwidthMb, actual: stats.bwLimitMb, ok: stats.bwLimitMb == null ? null : stats.bwLimitMb === profile.bandwidthMb },
        main_package: { expected: profile.mainPackage, actual: main?.plan ?? null, ok: main?.plan === profile.mainPackage },
        main_quota_mb: { expected: profile.mainQuotaMb, actual: main?.disklimitMb ?? null, ok: main?.disklimitMb === profile.mainQuotaMb },
        main_active: { expected: true, actual: main ? !main.suspended : false, ok: !!main && !main.suspended },
        child_accounts: { expected: 0, actual: counts.accounts, ok: true },
        acl: { expected: profile.aclName, actual: 'não observável pela WHM API 1 de leitura (getresellerprivs não existe)', ok: null },
      }
      state.verification = checks
      const bad = Object.entries(checks).filter(([, c]) => c.ok === false).map(([k, c]) => `${k}: esperado ${String(c.expected)}, obtido ${String(c.actual)}`)
      if (bad.length) throw new StepError(`Verificação falhou — ${bad.join('; ')}. Sem acesso ao cliente; corrija no WHM e repita.`, false, true)
      await logEvent(db, op.id, 'verify', 'ok', `Verificado: revendedor, limite ${profile.maxAccounts} contas, pacote e quota da conta principal${checks.disk_limit_mb.ok === null ? ' (limite de espaço não devolvido pelo WHM: confirmar)' : ''}. ACL: confirmação humana.`)
      state.done.push('verify'); await save('verify')
    }
    // ── 17: sincronização na base (sem acesso ainda) ──
    if (!state.done.includes('sync')) {
      current = 'sync'
      await withTransaction(async conn => {
        await conn.query(`INSERT INTO reseller_services (id, service_id, request_id, profile_id, server_id, product_id, whm_username, domain, status, storage_mb, bandwidth_mb, max_accounts, main_quota_mb, acl_name, verified_at, verification)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_confirmation', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), ?)
          ON DUPLICATE KEY UPDATE whm_username = VALUES(whm_username), server_id = VALUES(server_id), status = IF(status IN ('active','suspended'), status, 'awaiting_confirmation'), verified_at = VALUES(verified_at), verification = VALUES(verification)`,
          [randomUUID(), serviceId, req?.id ?? null, s.profile_id, server!.id, s.product_id, user, domain, profile!.storageMb, profile!.bandwidthMb, profile!.maxAccounts, profile!.mainQuotaMb, profile!.aclName, JSON.stringify(state.verification ?? {})])
        await conn.query(`INSERT INTO whm_accounts (id, server_id, whm_username, primary_domain, package_name, owner, profile_id, service_id, status, link_status, requires_manual_link, sync_status, notes)
          VALUES (?, ?, ?, ?, ?, 'root', ?, ?, 'active', 'linked', 0, 'synced', 'Revendedor (conta principal)')
          ON DUPLICATE KEY UPDATE profile_id = VALUES(profile_id), service_id = VALUES(service_id), link_status = 'linked', requires_manual_link = 0`,
          [randomUUID(), server!.id, user, domain, profile!.mainPackage, s.profile_id, serviceId])
        await conn.query("UPDATE capacity_reservations SET status = 'committed', service_id = ? WHERE (request_id = ? OR service_id = ?) AND status = 'reserved'", [serviceId, req?.id ?? '', serviceId])
        await conn.query("UPDATE services SET server_id = ?, external_ref = ? WHERE id = ?", [server!.id, user, serviceId])
      })
      await logEvent(db, op.id, 'sync', 'ok', `Revendedor ${user} registado na base; reserva comprometida.`)
      state.done.push('sync'); await save('sync')
    }
    // ACL efectiva: confirmação humana obrigatória antes do acesso (não há leitura fiável na WHM API 1)
    await save('confirm_acl', { status: 'awaiting_confirmation', locked_until: null, lock_token: null, last_error: null })
    await db.query("UPDATE services SET provisioning_status = 'manual_required', provisioning_error = ? WHERE id = ?", [`Revenda criada (${user}): confirme no WHM a ACL efectiva «${profile.aclName}» para activar.`, serviceId])
    if (req) {
      await db.query("UPDATE reseller_requests SET status = 'awaiting_confirmation' WHERE id = ? AND status = 'provisioning'", [req.id])
      await reqEvent(db, req.id, actorId, 'provisioning', 'awaiting_confirmation', 'provisioned', `Conta ${user} criada e verificada; falta confirmar a ACL efectiva.`)
    }
    await audit(actorId, 'create', 'reseller_service', serviceId, `Revendedor ${user} criado em ${server.label} (${profile.name}); a aguardar confirmação da ACL`)
    await notifyAdmins('Revenda criada: confirmar ACL', `${req?.reference ?? serviceId}: revendedor ${user} criado e verificado. Confirme a ACL efectiva «${profile.aclName}» no WHM para activar.`, `/admin/reseller?pedido=${req?.reference ?? ''}`)
    return { status: 'awaiting_confirmation', message: `Revendedor ${user} criado e verificado. Confirme a ACL efectiva para activar.` }
  } catch (e) {
    const se = e instanceof StepError ? e : new StepError(e instanceof ResellerError ? e.message : `Erro inesperado: ${String((e as Error)?.message ?? e).slice(0, 200)}`)
    if (!se.logged) await logEvent(db, op.id, current, 'error', se.message).catch(() => {})
    const attempts = Number(op.attempts)
    const delay = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)]
    const status = se.blocked ? 'blocked' : 'failed'
    await save(current, { status, locked_until: null, lock_token: null, last_error: se.message.slice(0, 600), next_attempt_at: se.retryable ? new Date(Date.now() + delay * 60_000) : null })
    await db.query("UPDATE services SET provisioning_status = 'failed', provisioning_error = ? WHERE id = ?", [`Revenda: ${se.message}`.slice(0, 1000), serviceId])
    if (req) {
      await db.query("UPDATE reseller_requests SET status = 'failed' WHERE id = ? AND status IN ('provisioning','provisioning_authorized')", [req.id])
      await reqEvent(db, req.id, actorId, 'provisioning', 'failed', 'provisioning_failed', `${STEP_LABEL[current] ?? current}: ${se.message}`)
    }
    await audit(actorId, 'update', 'reseller_service', serviceId, `Aprovisionamento de revenda falhou em «${current}»: ${se.message.slice(0, 300)}`)
    await notifyAdmins('Falha no aprovisionamento de Revenda', `${req?.reference ?? serviceId}: ${STEP_LABEL[current] ?? current} — ${se.message}`, `/admin/reseller?pedido=${req?.reference ?? ''}`)
    return { status: status === 'blocked' ? 'blocked' : 'failed', message: se.message }
  }
}

/** Passos 18–20: o administrador confirma a ACL efectiva no WHM → activação, notificação e acesso na área de cliente. */
export async function confirmAclAndActivate(adminId: string, serviceId: string, confirmText: string) {
  const db = getPool()
  const [rs] = await rows(db, 'SELECT * FROM reseller_services WHERE service_id = ?', [serviceId])
  const [op] = await rows(db, 'SELECT * FROM reseller_provision_ops WHERE service_id = ?', [serviceId])
  if (!rs || op?.status !== 'awaiting_confirmation') throw new ResellerError('invalid_state', 'Sem revendedor a aguardar confirmação.', 409)
  if (confirmText.trim().toUpperCase() !== 'ACL CONFIRMADA') throw new ResellerError('confirm_required', `Confirme no WHM (Editar privilégios do revendedor ${rs.whm_username}) que a ACL efectiva é «${rs.acl_name}» e escreva «ACL CONFIRMADA».`)
  const [s] = await rows(db, 'SELECT s.order_id, s.profile_id, oi.months FROM services s LEFT JOIN order_items oi ON oi.id = s.order_item_id WHERE s.id = ?', [serviceId])
  await withTransaction(async conn => {
    const [u] = await conn.query("UPDATE reseller_provision_ops SET status = 'succeeded', step = 'activate' WHERE id = ? AND status = 'awaiting_confirmation'", [op.id]) as any
    if (!u.affectedRows) throw new ResellerError('conflict', 'Já confirmado noutro pedido.', 409)
    await conn.query("UPDATE reseller_services SET status = 'active', acl_confirmed_by = ?, acl_confirmed_at = CURRENT_TIMESTAMP(6), activated_at = CURRENT_TIMESTAMP(6) WHERE id = ?", [adminId, rs.id])
    await conn.query(`UPDATE services SET provisioning_status = 'active', provisioning_error = NULL, status = 'active', provisioned_at = CURRENT_TIMESTAMP(6), started_at = COALESCE(started_at, CURRENT_TIMESTAMP(6)),
      next_due_date = DATE_ADD(CURRENT_DATE, INTERVAL ? MONTH), activation_source = 'whm', activated_by = ? WHERE id = ?`, [Number(s?.months ?? 1) || 1, adminId, serviceId])
    if (rs.request_id) await conn.query("UPDATE reseller_requests SET status = 'active' WHERE id = ? AND status = 'awaiting_confirmation'", [rs.request_id])
  })
  await logEvent(db, op.id, 'activate', 'ok', `ACL efectiva confirmada pelo administrador; revendedor activo.`)
  await reqEvent(db, rs.request_id, adminId, 'awaiting_confirmation', 'active', 'activated', 'ACL efectiva confirmada')
  const { refreshOrderActivation } = await import('@/lib/commerce/provisioning')
  if (s?.order_id) await refreshOrderActivation(s.order_id)
  await audit(adminId, 'activate', 'reseller_service', serviceId, `Revendedor ${rs.whm_username} activado (ACL ${rs.acl_name} confirmada)`)
  const [c] = await rows(db, 'SELECT email FROM profiles WHERE id = ?', [rs.profile_id])
  await notifyClient(rs.profile_id, c?.email ?? '', 'A sua Revenda está activa', `A revenda ${rs.domain} está activa. Entre na área de cliente → Revenda para aceder ao WHM, criar contas para os seus clientes e consultar o consumo.`, '/revendedor', 'success')
}

/** «Repor tentativas» depois de corrigir a causa (o motor retoma no passo em que parou). */
export async function resetAttempts(adminId: string, serviceId: string) {
  const db = getPool()
  const [u] = await db.query("UPDATE reseller_provision_ops SET attempts = 0, status = IF(status = 'blocked', 'failed', status) WHERE service_id = ? AND status IN ('failed','blocked')", [serviceId]) as any
  if (!u.affectedRows) throw new ResellerError('invalid_state', 'Operação sem falha para repetir.', 409)
  await audit(adminId, 'update', 'reseller_service', serviceId, 'Tentativas de aprovisionamento repostas')
}

/** Depois do pagamento confirmado (provisionService): actualiza o pedido; venda automática corre o motor. */
export async function afterPayment(serviceId: string): Promise<{ status: 'manual_required' | 'active' | 'failed' | 'skipped'; message: string }> {
  const db = getPool()
  const [req] = await rows(db, 'SELECT id, status FROM reseller_requests WHERE service_id = ?', [serviceId])
  if (req) {
    if (req.status === 'awaiting_payment') { const { markPaid } = await import('./requests'); await markPaid(req.id, null) }
    return { status: 'manual_required', message: 'Revenda paga: aguarda a autorização de aprovisionamento no painel (Revenda de Hospedagem).' }
  }
  const settings = await getResellerSettings(db)
  if (!settings.automaticReady) return { status: 'manual_required', message: 'Revenda paga sem pedido aprovado: venda automática não autorizada — analisar no painel.' }
  await db.query(`INSERT INTO reseller_provision_ops (id, service_id, status, step, state) VALUES (?, ?, 'queued', 'validate', JSON_OBJECT('done', JSON_ARRAY()))
    ON DUPLICATE KEY UPDATE service_id = service_id`, [randomUUID(), serviceId])
  const out = await runProvisioning(serviceId, null)
  return out.status === 'failed' || out.status === 'blocked' ? { status: 'failed', message: out.message } : { status: 'manual_required', message: out.message }
}

/** Reconciliação só de leitura: compara a base com o WHM (nunca corrige nem apaga automaticamente). */
export async function reconcile(serviceId: string) {
  const db = getPool()
  const [rs] = await rows(db, 'SELECT * FROM reseller_services WHERE service_id = ?', [serviceId])
  if (!rs?.whm_username) throw new ResellerError('not_found', 'Revendedor inexistente.', 404)
  const lc = await loadWhmConfig(rs.server_id)
  if (!lc) throw new ResellerError('no_credentials', 'Servidor sem credencial WHM.', 409)
  const diffs: string[] = []
  try {
    const main = await W.accountSummary(lc.config, rs.whm_username)
    const resellers = await W.listResellers(lc.config)
    const counts = main ? await W.acctCounts(lc.config, rs.whm_username) : null
    if (!main) diffs.push('A conta principal não existe no WHM.')
    else {
      if (main.suspended !== (rs.status === 'suspended')) diffs.push(`Suspensão: WHM ${main.suspended ? 'suspensa' : 'activa'}, base ${rs.status}.`)
      if (main.domain.toLowerCase() !== String(rs.domain).toLowerCase()) diffs.push(`Domínio: WHM ${main.domain}, base ${rs.domain}.`)
    }
    if (!resellers.includes(rs.whm_username)) diffs.push('A conta já não tem estatuto de revendedor.')
    if (counts && counts.limit !== Number(rs.max_accounts)) diffs.push(`Limite de contas: WHM ${counts.limit ?? 'ilimitado'}, base ${rs.max_accounts}.`)
    if (counts && counts.accounts > Number(rs.max_accounts)) diffs.push(`Contas-filhas acima do limite: ${counts.accounts}.`)
  } catch (e) { throw new ResellerError('whm_error', e instanceof W.WhmCallError ? e.message : 'Falha na reconciliação.', 502) }
  return { ok: diffs.length === 0, diffs }
}
