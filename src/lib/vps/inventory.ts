import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { VpsApiError } from './hostinger-vps'
import { vpsClient } from './settings'
import { CloudError, PROTECTED_VM_IDS, assertVmNotProtected } from './cloud'

// Cloud VPS — inventário das VMs da conta do fornecedor e histórico de sincronização.
//   • Sincronização só de leitura: VMs, subscrições (custos/renovação), catálogo, templates, centros de dados,
//     métodos de pagamento (mascarados). Cada consulta tem resultado próprio; a ligação só é «OK» se TODAS as
//     consultas essenciais responderem.
//   • VMs importadas ficam «sem associação comercial»; as compradas por este portal (vps_provider_orders) são
//     reconhecidas pelo id. Nenhuma associação automática por e-mail/hostname.
//   • Associação a um cliente só explícita, pelo administrador, com confirmação de titularidade; VMs internas ou
//     protegidas (ex.: 1564781, infraestrutura de produção) nunca são associadas.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
const dt = (v: unknown) => (v ? new Date(String(v)) : null)
export const ESSENTIAL = ['catalog', 'virtualMachines', 'dataCenters', 'templates'] as const
type QueryResult = { ok: boolean; count?: number; ms: number; error?: string }

/** Executa as consultas de leitura, cada uma com o seu resultado (nunca esconde uma falha atrás de um «OK»). */
export async function providerReadAll(actor: string | null, kind = 'sync') {
  const cl = await vpsClient('read')
  const db = getPool()
  if ('error' in cl) {
    await db.query('INSERT INTO vps_sync_runs (id, kind, ok, results, message, actor) VALUES (?, ?, 0, NULL, ?, ?)', [randomUUID(), kind, cl.error.slice(0, 500), actor])
    return { ok: false, message: cl.error, results: {} as Record<string, QueryResult>, data: null }
  }
  const c = cl.client
  const calls: Record<string, () => Promise<unknown[]>> = {
    catalog: () => c.catalog(), virtualMachines: () => c.virtualMachines(), dataCenters: () => c.dataCenters(), templates: () => c.templates(),
    paymentMethods: () => c.paymentMethods(), subscriptions: () => c.subscriptions(), firewalls: () => c.firewalls(),
  }
  const results: Record<string, QueryResult> = {}, data: Record<string, any[]> = {}
  await Promise.all(Object.entries(calls).map(async ([k, fn]) => {
    const t0 = Date.now()
    try { const v = await fn(); data[k] = v; results[k] = { ok: true, count: v.length, ms: Date.now() - t0 } }
    catch (e) { results[k] = { ok: false, ms: Date.now() - t0, error: e instanceof VpsApiError ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}` : 'falha' } }
  }))
  const ok = ESSENTIAL.every(k => results[k]?.ok)
  // Centros de dados e templates reais guardados (mantém o que o administrador configurou)
  if (results.dataCenters?.ok && results.templates?.ok) {
    const { mergeProviderOptions } = await import('./settings')
    await mergeProviderOptions(data.dataCenters as never, data.templates as never).catch(e => { results.templates = { ...results.templates, ok: false, error: `não gravado: ${(e as Error).message}` } })
  }
  const failed = Object.entries(results).filter(([, r]) => !r.ok).map(([k]) => k)
  const message = ok
    ? `Ligação OK: ${results.catalog.count} produto(s), ${results.virtualMachines.count} VM(s), ${results.dataCenters.count} centro(s), ${results.templates.count} template(s)${failed.length ? `; com falhas não essenciais: ${failed.join(', ')}` : ''}.`
    : `Falha em consultas essenciais: ${failed.join(', ')}.`
  await db.query('INSERT INTO vps_sync_runs (id, kind, ok, results, message, actor) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), kind, ok ? 1 : 0, JSON.stringify(results), message.slice(0, 500), actor])
  // O estado da integração reflecte o último resultado real (as compras automáticas exigem last_test_ok = 1)
  await db.query('UPDATE vps_provider_settings SET last_test_at = CURRENT_TIMESTAMP(6), last_test_ok = ?, last_test_message = ? WHERE id = 1', [ok ? 1 : 0, message.slice(0, 500)])
  return { ok, message, results, data }
}

/** Sincroniza o inventário (VMs + subscrições). Não associa nada a clientes. */
export async function syncInventory(actor: string | null) {
  const r = await providerReadAll(actor, 'inventory')
  if (!r.data || !r.results.virtualMachines?.ok) return { ...r, imported: 0, updated: 0 }
  const db = getPool()
  const vms = r.data.virtualMachines ?? [], subs = r.data.subscriptions ?? []
  let imported = 0, updated = 0
  const seen: string[] = []
  for (const vm of vms) {
    const id = String(vm.id); seen.push(id)
    const sub = subs.find((x: any) => String(x.id) === String(vm.subscription_id ?? ''))
    const [cur] = await rows(db, "SELECT id FROM vps_instances WHERE provider = 'hostinger' AND provider_vm_id = ?", [id])
    // VM comprada por este portal: associada ao respectivo serviço (reconhecida pelo id da VM, nunca por e-mail)
    const [own] = await rows(db, "SELECT v.service_id, s.profile_id FROM vps_provider_orders v JOIN services s ON s.id = v.service_id WHERE v.provider_vm_id = ? AND v.status = 'active' LIMIT 1", [id])
    const protectedVm = (PROTECTED_VM_IDS as readonly string[]).includes(id)
    const vals = [vm.subscription_id ?? null, vm.plan ?? null, vm.hostname ?? null, vm.state ?? null, vm.cpus ?? null, vm.memory ?? null, vm.disk ?? null, vm.bandwidth ?? null,
      vm.ipv4?.[0]?.address ?? null, vm.ipv6?.[0]?.address ?? null, vm.data_center_id != null ? String(vm.data_center_id) : null, vm.template?.name ?? null, dt(vm.created_at),
      sub?.status ?? null, sub?.currency_code ?? null, sub?.total_price ?? null, sub?.renewal_price ?? null, sub?.billing_period ?? null, sub?.billing_period_unit ?? null,
      sub?.is_auto_renewed == null ? null : sub.is_auto_renewed ? 1 : 0, dt(sub?.next_billing_at), dt(sub?.expires_at)]
    const cols = 'subscription_id = ?, plan = ?, hostname = ?, state = ?, cpus = ?, memory_mb = ?, disk_mb = ?, bandwidth_mb = ?, ipv4 = ?, ipv6 = ?, data_center_id = ?, template_name = ?, provider_created_at = ?, sub_status = ?, sub_currency = ?, sub_total_minor = ?, sub_renewal_minor = ?, sub_billing_period = ?, sub_billing_unit = ?, sub_auto_renew = ?, sub_next_billing_at = ?, sub_expires_at = ?'
    if (cur) {
      await db.query(`UPDATE vps_instances SET ${cols}, missing_since = NULL, last_sync_at = CURRENT_TIMESTAMP(6)${protectedVm ? ', is_internal = 1, is_protected = 1' : ''}
        ${own && !protectedVm ? ", link_status = 'linked', service_id = ?, profile_id = ?" : ''} WHERE id = ?`, [...vals, ...(own && !protectedVm ? [own.service_id, own.profile_id] : []), cur.id])
      updated++
    } else {
      await db.query(`INSERT INTO vps_instances (id, provider, provider_vm_id, is_internal, is_protected, protection_reason, link_status, service_id, profile_id, last_sync_at)
        VALUES (?, 'hostinger', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))`,
        [randomUUID(), id, protectedVm ? 1 : 0, protectedVm ? 1 : 0, protectedVm ? 'Infraestrutura de produção da ViralizaHost' : null, own && !protectedVm ? 'linked' : 'unlinked', own && !protectedVm ? own.service_id : null, own && !protectedVm ? own.profile_id : null])
      await db.query(`UPDATE vps_instances SET ${cols} WHERE provider = 'hostinger' AND provider_vm_id = ?`, [...vals, id])
      imported++
    }
  }
  // VMs que desapareceram da conta: marcadas (nunca apagadas)
  if (seen.length) await db.query(`UPDATE vps_instances SET missing_since = COALESCE(missing_since, CURRENT_TIMESTAMP(6)) WHERE provider = 'hostinger' AND provider_vm_id NOT IN (${seen.map(() => '?').join(',')})`, seen)
  if (actor) await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'integration', 'cloud_vps', ?)", [actor, `Cloud VPS: inventário sincronizado (${imported} nova(s), ${updated} actualizada(s))`]).catch(() => {})
  return { ...r, imported, updated }
}

export async function listInstances(f: { q?: string; filter?: string; page?: number } = {}) {
  const where: string[] = [], args: unknown[] = []
  if (f.filter === 'internal') where.push('i.is_internal = 1')
  else if (f.filter === 'commercial') where.push('i.is_internal = 0')
  else if (f.filter === 'unlinked') where.push("i.link_status = 'unlinked' AND i.is_internal = 0")
  else if (f.filter === 'linked') where.push("i.link_status = 'linked'")
  else if (f.filter === 'missing') where.push('i.missing_since IS NOT NULL')
  if (f.q) { const q = `%${f.q.slice(0, 80)}%`; where.push('(i.provider_vm_id LIKE ? OR i.hostname LIKE ? OR i.ipv4 LIKE ? OR p.email LIKE ?)'); args.push(q, q, q, q) }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const page = Math.max(1, Number(f.page ?? 1) || 1), size = 25
  const [[c]] = await getPool().query(`SELECT COUNT(*) n FROM vps_instances i LEFT JOIN profiles p ON p.id = i.profile_id ${w}`, args) as any
  const items = await rows(getPool(), `SELECT i.*, p.email client_email, p.full_name client_name, s.service_name, s.next_due_date FROM vps_instances i
    LEFT JOIN profiles p ON p.id = i.profile_id LEFT JOIN services s ON s.id = i.service_id ${w} ORDER BY i.is_internal DESC, i.provider_vm_id + 0 DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, args)
  return { items, total: Number(c.n), page, pages: Math.max(1, Math.ceil(Number(c.n) / size)) }
}

/** Marca uma VM como interna/protegida (as da lista fixa nunca podem deixar de o ser). */
export async function setInternal(adminId: string, instanceId: string, internal: boolean, reason: string) {
  const db = getPool()
  const [i] = await rows(db, 'SELECT * FROM vps_instances WHERE id = ?', [instanceId])
  if (!i) throw new CloudError('not_found', 'VM inexistente.', 404)
  if (!internal && (PROTECTED_VM_IDS as readonly string[]).includes(String(i.provider_vm_id))) throw new CloudError('vm_protected', `A VM ${i.provider_vm_id} é infraestrutura de produção: a protecção é permanente.`, 403)
  if (internal && i.link_status === 'linked') throw new CloudError('linked', 'A VM está associada a um cliente: desassocie primeiro.', 409)
  if (reason.trim().length < 5) throw new CloudError('reason_required', 'Indique o motivo (mín. 5 caracteres).')
  await db.query('UPDATE vps_instances SET is_internal = ?, is_protected = ?, protection_reason = ? WHERE id = ?', [internal ? 1 : 0, internal ? 1 : 0, reason.trim().slice(0, 300), instanceId])
  await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'vps_instance', ?, ?)", [adminId, instanceId, `VM ${i.provider_vm_id}: ${internal ? 'marcada INTERNA/protegida' : 'deixa de ser interna'} — ${reason.trim().slice(0, 200)}`]).catch(() => {})
}

/**
 * Associação explícita de uma VM importada a um cliente: cria o serviço VPS (sem preço nem cobrança) e a operação
 * «activa» com a VM — é assim que «Os meus VPS» a encontra. O acesso fica por configurar pelo cliente (senha/chave).
 */
export async function linkInstance(adminId: string, input: { instanceId: string; profileId: string; productId?: string | null; confirmed: boolean }) {
  if (!input.confirmed) throw new CloudError('confirmation_required', 'Confirme que verificou que o cliente é o titular deste VPS.', 400)
  return withTransaction(async conn => {
    const [i] = await rows(conn, 'SELECT * FROM vps_instances WHERE id = ? FOR UPDATE', [input.instanceId])
    if (!i) throw new CloudError('not_found', 'VM inexistente.', 404)
    if (Number(i.is_internal) || Number(i.is_protected)) throw new CloudError('vm_protected', `A VM ${i.provider_vm_id} é interna/protegida: nunca é associada a clientes.`, 403)
    await assertVmNotProtected(i.provider_vm_id, conn)
    if (i.link_status === 'linked') throw new CloudError('already_linked', 'Esta VM já está associada a um cliente.', 409)
    const [other] = await rows(conn, 'SELECT service_id FROM vps_provider_orders WHERE provider_vm_id = ? LIMIT 1', [i.provider_vm_id])
    if (other) throw new CloudError('already_linked', 'Esta VM já está associada a um serviço.', 409)
    const [p] = await rows(conn, "SELECT id, email, role, is_active FROM profiles WHERE id = ?", [input.profileId])
    if (!p || p.role !== 'client' || !Number(p.is_active)) throw new CloudError('client_not_eligible', 'Só contas de cliente activas podem ser titulares (contas administrativas excluídas).', 422)
    const [prod] = input.productId ? await rows(conn, "SELECT id, name FROM products WHERE id = ? AND category = 'vps'", [input.productId]) : [null]
    const serviceId = randomUUID(), opId = randomUUID()
    await conn.query(`INSERT INTO services (id, profile_id, product_id, service_type, service_name, status, currency, price, renewal_price, billing_cycle, auto_renew,
        provisioning_status, provisioned_at, started_at, external_ref, activation_source, activated_by, notes)
      VALUES (?, ?, ?, 'vps', ?, 'active', 'AKZ', 0, NULL, 'monthly', 0, 'active', CURRENT_TIMESTAMP(6), COALESCE(?, CURRENT_TIMESTAMP(6)), ?, 'import', ?, ?)`,
      [serviceId, p.id, prod?.id ?? null, `${prod?.name ?? i.plan ?? 'VPS'} (importado)`, i.provider_created_at, `VM ${i.provider_vm_id}${i.ipv4 ? ` · ${i.ipv4}` : ''}`, adminId,
        `VM ${i.provider_vm_id} importada da conta Hostinger. Sem cobrança associada: renovação a definir pela equipa.`])
    await conn.query(`INSERT INTO vps_provider_orders (id, service_id, provider, mode, client_ref, item_id, status, provider_vm_id, provider_subscription_id, provider_status, ipv4, request)
      VALUES (?, ?, 'hostinger', 'manual', ?, 'import', 'active', ?, ?, ?, ?, NULL)`, [opId, serviceId, `imp${i.provider_vm_id}`.slice(0, 64), String(i.provider_vm_id), i.subscription_id, i.state, i.ipv4])
    await conn.query("INSERT INTO vps_provider_events (id, provider_order_id, event, detail, actor) VALUES (?, ?, 'import_link', ?, ?)", [randomUUID(), opId, `VM ${i.provider_vm_id} associada a ${p.email} pela equipa`, adminId])
    await conn.query("UPDATE vps_instances SET link_status = 'linked', service_id = ?, profile_id = ?, linked_by = ?, linked_at = CURRENT_TIMESTAMP(6) WHERE id = ?", [serviceId, p.id, adminId, i.id])
    await conn.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'vps_instance', ?, ?)", [adminId, i.id, `VM ${i.provider_vm_id} associada ao cliente ${p.email} (serviço importado, sem cobrança)`])
    return { serviceId }
  })
}

/** Desassociação comercial (não toca na VM nem na subscrição do fornecedor). */
export async function unlinkInstance(adminId: string, instanceId: string, reason: string) {
  if (reason.trim().length < 5) throw new CloudError('reason_required', 'Indique o motivo (mín. 5 caracteres).')
  return withTransaction(async conn => {
    const [i] = await rows(conn, 'SELECT * FROM vps_instances WHERE id = ? FOR UPDATE', [instanceId])
    if (!i || i.link_status !== 'linked') throw new CloudError('not_linked', 'VM sem associação.', 409)
    const [svc] = await rows(conn, 'SELECT activation_source FROM services WHERE id = ?', [i.service_id])
    if (svc?.activation_source !== 'import') throw new CloudError('purchased', 'Esta VM foi contratada pelo portal (encomenda paga): trate-a pelo serviço/encomenda, não por desassociação.', 409)
    await conn.query("UPDATE services SET status = 'cancelled', notes = CONCAT(COALESCE(notes, ''), ?) WHERE id = ? AND activation_source = 'import'", [`\nDesassociado: ${reason.trim().slice(0, 200)}`, i.service_id])
    await conn.query("UPDATE vps_provider_orders SET status = 'failed', message = 'Desassociada pela equipa' WHERE service_id = ? AND item_id = 'import'", [i.service_id])
    await conn.query("UPDATE vps_instances SET link_status = 'unlinked', service_id = NULL, profile_id = NULL WHERE id = ?", [instanceId])
    await conn.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'vps_instance', ?, ?)", [adminId, instanceId, `VM ${i.provider_vm_id} desassociada: ${reason.trim().slice(0, 200)}`])
  })
}

export async function syncHistory(limit = 30) {
  return (await rows(getPool(), 'SELECT r.*, p.email actor_email FROM vps_sync_runs r LEFT JOIN profiles p ON p.id = r.actor ORDER BY r.created_at DESC LIMIT ?', [limit]))
    .map(r => ({ ...r, results: typeof r.results === 'string' ? JSON.parse(r.results) : r.results }))
}
