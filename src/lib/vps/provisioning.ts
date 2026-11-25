import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool, type Queryable } from '@/lib/db/pool'
import { imageRow, loadVpsSettings, vpsClient } from './settings'
import { ACTION_PENDING, specsFromVm, type VirtualMachine } from './hostinger-vps'
import { AWAITING_CHOICE_MSG, describeVpsOptions } from './install-shared'
import { VPS_CYCLES, specMismatches, type VpsSpecs } from '@/lib/commerce/vps-shared'
import { assertVmNotProtected, isProtectedVm, loadCloudSettings, monthSpendMinor } from './cloud'

// Aprovisionamento de VPS depois do pagamento validado (chamado por provisionService).
//   Automático (opção activa + plano em modo automático + item e limite de custo por ciclo + localização/sistema):
//     1. confirma o preço actual do item no catálogo: moeda igual e custo ≤ limite do plano; senão, tarefa manual;
//     2. regista a operação (UNIQUE por serviço) e só UMA execução passa de «pending» a «submitting»;
//     3. compra (POST /api/vps/v1/virtual-machines) com item, método de pagamento da conta e setup
//        (template, centro de dados, hostname único). Nunca envia palavra-passe, comprovativos nem dados do cliente;
//     4. resposta inconclusiva → NÃO repete: concilia pela lista de VMs (hostname único / subscrição); se não confirmar,
//        fica em revisão manual. 202 → espera a VM «initial» e chama /setup uma vez. «running» → serviço activo.
//   Manual (sem automatização, por escolha ou por salvaguarda): tarefa no painel para a equipa adquirir e associar.
// Cloud VPS: nenhuma compra sem autorização (pedido com «Autorizar aquisição», ou modo automático sem pedido);
// operações de compra activáveis no painel; limite mensal de despesas; VMs protegidas nunca são associadas.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type VpsOutcome = { serviceId: string; status: 'active' | 'manual_required' | 'failed' | 'skipped' | 'in_progress'; message: string }
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
const json = (v: unknown) => { if (!v) return null; try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }
const addMonths = (m: number) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + (m || 1)); return d.toISOString().slice(0, 10) }

async function setService(serviceId: string, status: string, message: string | null, extra: Record<string, unknown> = {}) {
  const sets = ['provisioning_status = ?', 'provisioning_error = ?'], params: unknown[] = [status, message]
  if (status === 'active') sets.push("status = 'active'", 'provisioned_at = CURRENT_TIMESTAMP(6)', 'started_at = COALESCE(started_at, CURRENT_TIMESTAMP(6))')
  for (const [k, v] of Object.entries(extra)) { sets.push(`\`${k}\` = ?`); params.push(v) }
  await getPool().query(`UPDATE services SET ${sets.join(', ')} WHERE id = ?`, [...params, serviceId])
  // O pedido Cloud VPS (se existir) acompanha o estado do aprovisionamento
  const { syncRequestFromService } = await import('./requests')
  await syncRequestFromService(serviceId, status).catch(() => {})
}
async function event(opId: string, ev: string, detail: string | null, actor: string | null = null) {
  await getPool().query('INSERT INTO vps_provider_events (id, provider_order_id, event, detail, actor) VALUES (?, ?, ?, ?, ?)', [randomUUID(), opId, ev, detail?.slice(0, 500) ?? null, actor]).catch(() => {})
}

/** Contexto do serviço VPS: plano, ciclo, opções aceites e associação ao fornecedor. */
async function context(serviceId: string) {
  const [s] = await rows(getPool(), `SELECT s.id, s.order_id, s.order_item_id, s.profile_id, s.product_id, s.provisioning_status, o.payment_status,
      oi.billing_cycle, oi.months, oi.options, p.name, p.slug, p.category, p.subcategory, p.plan_specs, p.provider_product_id, p.provider_mode,
      pp.provider_item_id, pp.provider_cost_minor, pp.provider_currency, pp.provider_cost_limit_minor
    FROM services s JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id LEFT JOIN products p ON p.id = s.product_id
    LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.cycle = oi.billing_cycle WHERE s.id = ?`, [serviceId])
  return s ?? null
}
export const isServerVps = (s: { category?: string | null; subcategory?: string | null; service_type?: string | null }) => s.category === 'vps' && !s.subcategory

function manualTask(c: any, reason: string) {
  const o = json(c.options) ?? {}
  const cyc = VPS_CYCLES.find(x => x.cycle === c.billing_cycle)?.label ?? c.billing_cycle
  const opts = describeVpsOptions(o, n => `Kz ${n}`)
  return `Tarefa da equipa: preparar o VPS «${c.name}» (${cyc}${opts ? `; ${opts}` : ''}) e associá-lo em «Associar VPS…» ou confirmar a entrega. ${reason}`.trim()
}

/** Ponto de entrada (pagamento já validado; provisionService já reservou o serviço). */
export async function provisionVps(serviceId: string): Promise<VpsOutcome> {
  const c = await context(serviceId)
  if (!c) return { serviceId, status: 'failed', message: 'Serviço inexistente.' }
  const done = async (status: VpsOutcome['status'], message: string, extra: Record<string, unknown> = {}) => {
    await setService(serviceId, status === 'skipped' ? 'pending' : status, status === 'active' ? null : message, extra)
    return { serviceId, status, message }
  }
  if (c.payment_status !== 'paid') return done('skipped', 'Pagamento ainda não validado.')
  const [op] = await rows(getPool(), 'SELECT * FROM vps_provider_orders WHERE service_id = ?', [serviceId])
  // Autorização de aquisição (pedido autorizado, ou modo automático sem pedido) — antes de qualquer compra
  if (!op || op.status === 'pending' || (op.status === 'failed' && !op.provider_order_id)) {
    const { purchaseAuthorization } = await import('./requests')
    const auth = await purchaseAuthorization(serviceId)
    if (!auth.ok) return done('manual_required', auth.message)
  }
  // Já houve tentativa: nunca comprar de novo aqui — conciliar (excepto recusa explícita sem encomenda)
  if (op && !(op.status === 'failed' && !op.provider_order_id) && op.status !== 'pending') return reconcileVps(serviceId)

  // «Escolher mais tarde»: nada é comprado até o cliente escolher a instalação em «Os meus VPS»
  const o = json(c.options) ?? {}
  if (o.later && !o.image?.id) return done('manual_required', AWAITING_CHOICE_MSG)
  // Salvaguardas: qualquer falta → tarefa manual (sem compra)
  if (!c.provider_product_id || c.provider_mode !== 'auto') return done('manual_required', manualTask(c, 'Plano em activação manual.'))
  if (!c.provider_item_id || c.provider_cost_limit_minor == null || !c.provider_currency) return done('manual_required', manualTask(c, 'Falta o item de preço ou o limite de custo deste ciclo.'))
  if (!o.location?.id || !o.image?.id) return done('manual_required', manualTask(c, 'A encomenda não tem localização e sistema operativo.'))
  const img = await imageRow(o.image.id)
  if (img?.source === 'manual' || !/^\d+$/.test(String(o.image.id))) return done('manual_required', manualTask(c, 'Instalação de entrega manual (sem template da Hostinger).'))
  const cl = await vpsClient('purchase')
  if ('error' in cl) return done('manual_required', manualTask(c, cl.error))
  const settings = await loadVpsSettings()
  // Preço actual do fornecedor vs limite do plano (evita cobranças inesperadas)
  let price: { id: string; currency: string; price: number; first_period_price?: number | null } | undefined
  try { price = (await cl.client.catalog()).flatMap(i => i.prices).find(p => p.id === c.provider_item_id) } catch (e) { return done('manual_required', manualTask(c, `Catálogo da Hostinger indisponível (${(e as Error).message}); nada foi comprado.`)) }
  if (!price) return done('manual_required', manualTask(c, `O item ${c.provider_item_id} já não existe no catálogo da Hostinger; nada foi comprado.`))
  const cost = price.first_period_price ?? price.price
  if (price.currency !== c.provider_currency) return done('manual_required', manualTask(c, `Moeda do fornecedor mudou (${price.currency} ≠ ${c.provider_currency}); nada foi comprado.`))
  if (cost > Number(c.provider_cost_limit_minor)) return done('manual_required', manualTask(c, `Custo actual ${(cost / 100).toFixed(2)} ${price.currency} acima do limite ${(Number(c.provider_cost_limit_minor) / 100).toFixed(2)} ${price.currency}; nada foi comprado.`))
  // Orçamento: limite mensal de despesas no fornecedor (Cloud VPS → Fornecedores)
  const cloud = await loadCloudSettings()
  if (cloud.spendLimitMonthlyMinor != null) {
    const spent = await monthSpendMinor()
    if (spent + cost > cloud.spendLimitMonthlyMinor) return done('manual_required', manualTask(c, `Limite mensal de despesas atingido (${((spent + cost) / 100).toFixed(2)} > ${(cloud.spendLimitMonthlyMinor / 100).toFixed(2)} ${price.currency}); nada foi comprado.`))
  }

  // Operação única por serviço
  const ref = `vh${serviceId.replace(/-/g, '').slice(0, 14)}`
  const hostname = `${ref}.${settings.hostnameSuffix}`
  // Chave pública SSH indicada no configurador: o cliente tem acesso desde o início (nunca se envia senha)
  const sshKeys = typeof o.sshKey === 'string' && o.sshKey ? [o.sshKey] : undefined
  const request = { item_id: c.provider_item_id, payment_method_id: settings.paymentMethodId ?? undefined, setup: { template_id: Number(o.image.id), data_center_id: Number(o.location.id), hostname, ...(sshKeys ? { ssh_keys: sshKeys } : {}) } }
  const opId = op?.id ?? randomUUID()
  if (!op) {
    await getPool().query(`INSERT IGNORE INTO vps_provider_orders (id, service_id, order_item_id, mode, client_ref, item_id, expected_cost_minor, cost_limit_minor, currency, status, request)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`, [opId, serviceId, c.order_item_id, cl.mode, ref, c.provider_item_id, cost, c.provider_cost_limit_minor, price.currency, JSON.stringify({ ...request, hostname })])
  } else {
    await getPool().query("UPDATE vps_provider_orders SET status = 'pending', item_id = ?, expected_cost_minor = ?, request = ? WHERE id = ? AND status IN ('failed','pending')", [c.provider_item_id, cost, JSON.stringify({ ...request, hostname }), op.id])
  }
  const [mine] = await rows(getPool(), 'SELECT id FROM vps_provider_orders WHERE service_id = ?', [serviceId])
  const [claim] = await getPool().query("UPDATE vps_provider_orders SET status = 'submitting', attempts = attempts + 1, message = NULL WHERE service_id = ? AND status = 'pending'", [serviceId]) as any
  if (!claim.affectedRows) return done('in_progress', 'Compra já em curso noutra execução: a acompanhar o estado.')
  await event(mine.id, 'purchase_sent', `item ${c.provider_item_id}, custo ${(cost / 100).toFixed(2)} ${price.currency} (limite ${(Number(c.provider_cost_limit_minor) / 100).toFixed(2)})`)

  const r = await cl.client.purchase(request)
  if (r.kind === 'ok') {
    const vm = r.vm
    await getPool().query("UPDATE vps_provider_orders SET status = 'submitted', provider_order_id = ?, provider_subscription_id = ?, provider_vm_id = ?, provider_status = ?, ipv4 = ? WHERE id = ?",
      [r.orderId, r.subscriptionId, vm?.id != null ? String(vm.id) : null, vm?.state ?? r.orderStatus, vm?.ipv4?.[0]?.address ?? null, mine.id])
    await event(mine.id, 'purchase_ok', `encomenda ${r.orderId ?? '—'}, VM ${vm?.id ?? '—'} (${vm?.state ?? r.orderStatus ?? '?'}), total ${r.total ?? '?'} ${r.currency ?? ''}`)
    return reconcileVps(serviceId)
  }
  if (r.kind === 'processing') {
    await getPool().query("UPDATE vps_provider_orders SET status = 'payment_processing', provider_order_id = ?, provider_subscription_id = ?, provider_status = 'payment_initiated', message = ? WHERE id = ?", [r.orderId, r.subscriptionId, r.message, mine.id])
    await event(mine.id, 'purchase_processing', `encomenda ${r.orderId ?? '—'}, subscrição ${r.subscriptionId ?? '—'}: pagamento em processamento`)
    return done('in_progress', 'Compra feita na Hostinger: pagamento ao fornecedor em processamento. A configuração conclui-se automaticamente.')
  }
  if (r.kind === 'refused') {
    await getPool().query("UPDATE vps_provider_orders SET status = 'failed', message = ? WHERE id = ?", [r.message, mine.id])
    await event(mine.id, 'purchase_refused', `HTTP ${r.status}: ${r.message}`)
    return done('failed', `A Hostinger recusou a compra (${r.message}). Nada foi comprado: corrija e use «Repetir», ou adquira manualmente.`)
  }
  // Inconclusivo: concilia já; se não confirmar, revisão manual (sem nova compra)
  await getPool().query("UPDATE vps_provider_orders SET status = 'unknown', message = ? WHERE id = ?", [r.message, mine.id])
  await event(mine.id, 'purchase_unknown', r.message)
  return reconcileVps(serviceId)
}

/**
 * Conciliação (sem compras): procura a VM da operação, conclui a configuração de uma VM «initial» uma única vez
 * e activa o serviço quando a VM está «running». Seguro em paralelo (bloqueio de 30 s por operação).
 */
export async function reconcileVps(serviceId: string, actor: string | null = null): Promise<VpsOutcome> {
  const db = getPool()
  const [op] = await rows(db, 'SELECT * FROM vps_provider_orders WHERE service_id = ?', [serviceId])
  if (!op) return { serviceId, status: 'skipped', message: 'Sem compra registada para este serviço.' }
  // Compra ainda em curso noutra execução (pedido enviado há pouco, sem resposta): não concluir «sem VM» antes do tempo
  if (op.status === 'submitting') {
    const [recent] = await rows(db, "SELECT 1 x FROM vps_provider_events WHERE provider_order_id = ? AND event = 'purchase_sent' AND created_at > CURRENT_TIMESTAMP(6) - INTERVAL 120 SECOND", [op.id])
    if (recent) return { serviceId, status: 'in_progress', message: 'Compra enviada à Hostinger há instantes: a aguardar resposta.' }
  }
  const [lock] = await db.query('UPDATE vps_provider_orders SET locked_until = CURRENT_TIMESTAMP(6) + INTERVAL 30 SECOND WHERE id = ? AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP(6))', [op.id]) as any
  if (!lock.affectedRows) return { serviceId, status: 'in_progress', message: 'Consulta já em curso.' }
  const done = async (status: VpsOutcome['status'], message: string, extra: Record<string, unknown> = {}) => {
    await setService(serviceId, status === 'skipped' ? 'pending' : status, status === 'active' ? null : message, extra)
    await db.query('UPDATE vps_provider_orders SET locked_until = NULL WHERE id = ?', [op.id])
    return { serviceId, status, message }
  }
  try {
    if (op.status === 'active') return done('active', 'VPS activo.')
    if (op.status === 'failed') return done('failed', `A Hostinger recusou a compra (${op.message ?? 'sem detalhe'}). Nada foi comprado.`)
    const cl = await vpsClient('read')
    if ('error' in cl) return done('manual_required', `Não é possível consultar a Hostinger (${cl.error}): confirme no hPanel. Não é feita nova compra.`)
    const req = json(op.request) ?? {}
    let vm: VirtualMachine | null = null
    if (op.provider_vm_id) vm = await cl.client.virtualMachine(op.provider_vm_id).catch(() => null)
    if (!vm) {
      const all = await cl.client.virtualMachines().catch(() => null)
      if (!all) return done(op.status === 'unknown' ? 'manual_required' : 'in_progress', 'Não foi possível listar as VMs na Hostinger agora: nova consulta mais tarde. Não é feita nova compra.')
      vm = all.find(v => (req.hostname && v.hostname === req.hostname) || (op.provider_subscription_id && v.subscription_id === op.provider_subscription_id)) ?? null
    }
    // Infraestrutura protegida nunca é associada a um serviço comercial
    if (vm && await isProtectedVm(vm.id)) {
      await event(op.id, 'protected_vm_ignored', `VM ${vm.id} é protegida: não associada`, actor)
      return done('manual_required', `A conciliação encontrou a VM protegida ${vm.id}: nada foi associado. Verificar no hPanel.`)
    }
    if (!vm) {
      if (op.status === 'payment_processing') return done('in_progress', 'Pagamento ao fornecedor em processamento: a VM ainda não existe.')
      await db.query("UPDATE vps_provider_orders SET status = 'unknown', message = ? WHERE id = ?", ['Sem VM encontrada na conta para esta compra.', op.id])
      await event(op.id, 'reconcile_not_found', `hostname ${req.hostname ?? '—'}, subscrição ${op.provider_subscription_id ?? '—'}`, actor)
      return done('manual_required', `Resultado da compra por confirmar: nenhuma VM «${req.hostname ?? '—'}» encontrada na Hostinger. Verifique no hPanel antes de qualquer nova tentativa (não é feita nova compra automática).`)
    }
    const ip = vm.ipv4?.[0]?.address ?? null
    await db.query('UPDATE vps_provider_orders SET provider_vm_id = ?, provider_subscription_id = COALESCE(provider_subscription_id, ?), provider_status = ?, ipv4 = ? WHERE id = ?', [String(vm.id), vm.subscription_id ?? null, vm.state ?? null, ip, op.id])
    if (op.status === 'unknown') await event(op.id, 'reconcile_found', `VM ${vm.id} encontrada (${vm.state}) depois de resposta inconclusiva`, actor)
    // VM paga e por configurar (202): /setup uma única vez
    if (vm.state === 'initial') {
      if (!req.setup_sent && req.setup) {
        req.setup_sent = true
        await db.query("UPDATE vps_provider_orders SET request = ?, status = 'submitted' WHERE id = ?", [JSON.stringify(req), op.id])
        const s = await cl.client.setup(vm.id, req.setup)
        await event(op.id, s.ok ? 'setup_sent' : 'setup_failed', s.ok ? `configuração enviada (template ${req.setup.template_id}, centro ${req.setup.data_center_id})` : `configuração falhou: ${s.message}`, actor)
        if (!s.ok) return done('manual_required', `VM ${vm.id} paga mas a configuração falhou (${s.message}): concluir no hPanel.`)
      }
      return done('in_progress', `VM ${vm.id} a configurar na Hostinger.`)
    }
    if (vm.state === 'running') {
      // «Pronto a utilizar» só depois de terminada a instalação: nenhuma acção pendente e a última sem erro
      const acts = await cl.client.actions(vm.id).catch(() => null)
      if (!acts) return done('in_progress', `VM ${vm.id} em execução; a confirmar o fim da instalação.`)
      const pending = acts.find(a => ACTION_PENDING.includes(String(a.state)))
      if (pending) return done('in_progress', `VM ${vm.id} em execução; instalação em curso (${pending.name ?? 'acção'}: ${pending.state}).`)
      if (acts[0]?.state === 'error' && !req.install_error_seen) {
        req.install_error_seen = true
        await db.query('UPDATE vps_provider_orders SET request = ? WHERE id = ?', [JSON.stringify(req), op.id])
        await event(op.id, 'install_error', `acção ${acts[0].id} (${acts[0].name ?? '—'}) terminou com erro`, actor)
        return done('manual_required', `VM ${vm.id} criada mas a instalação falhou na Hostinger (acção ${acts[0].name ?? acts[0].id}). Verificar no hPanel e reinstalar ou associar.`)
      }
      if (acts[0]?.state === 'error') return done('manual_required', `VM ${vm.id}: a última instalação falhou na Hostinger. Verificar no hPanel.`)
      await db.query("UPDATE vps_provider_orders SET status = 'active', message = NULL WHERE id = ?", [op.id])
      const c = await context(serviceId)
      const warn = specMismatches((json(c?.plan_specs) ?? {}) as VpsSpecs, specsFromVm(vm))
      await event(op.id, 'vm_running', `VM ${vm.id} activa (${ip ?? 'sem IP'})${warn.length ? `; ATENÇÃO: ${warn.join('; ')}` : ''}`, actor)
      const months = Number(c?.months ?? VPS_CYCLES.find(x => x.cycle === c?.billing_cycle)?.months ?? 1)
      // Acesso do cliente: chave SSH enviada na compra → acesso configurado; senão o cliente define senha/chave no portal
      const keys = Array.isArray(req.setup?.ssh_keys) && req.setup.ssh_keys.length
      await db.query("UPDATE vps_provider_orders SET access_method = COALESCE(access_method, ?), access_configured_at = IF(? = 1, COALESCE(access_configured_at, CURRENT_TIMESTAMP(6)), access_configured_at) WHERE id = ?", [keys ? 'ssh_key' : null, keys ? 1 : 0, op.id])
      // Hostname pedido pelo cliente (a compra usa um hostname único para a conciliação): aplicado uma vez
      const wanted = (json(c?.options) ?? {}).hostname
      if (wanted && !req.client_hostname_applied) {
        req.client_hostname_applied = true
        await db.query('UPDATE vps_provider_orders SET request = ?, client_hostname = ? WHERE id = ?', [JSON.stringify(req), wanted, op.id])
        const h = await cl.client.op('hostname-set', { vm: vm.id, body: { hostname: wanted } })
        await event(op.id, h.ok ? 'hostname_set' : 'hostname_failed', h.ok ? `hostname «${wanted}» aplicado` : `hostname «${wanted}» não aplicado: ${h.message}`, actor)
      }
      const res = await done('active', 'VPS activo.', { external_ref: `VM ${vm.id}${ip ? ` · ${ip}` : ''}`, next_due_date: addMonths(months), activation_source: 'provider' })
      if (warn.length) await db.query('UPDATE vps_provider_orders SET message = ? WHERE id = ?', [`Características da VM diferem do anunciado: ${warn.join('; ')}`, op.id])
      return res
    }
    if (['error', 'destroyed', 'destroying', 'suspended'].includes(String(vm.state))) {
      await event(op.id, 'vm_problem', `VM ${vm.id} em «${vm.state}»`, actor)
      return done('manual_required', `VM ${vm.id} em estado «${vm.state}» na Hostinger: verificar no hPanel.`)
    }
    if (op.status === 'unknown') await db.query("UPDATE vps_provider_orders SET status = 'submitted' WHERE id = ?", [op.id])
    return done('in_progress', `VM ${vm.id} em «${vm.state}» na Hostinger.`)
  } catch (e) {
    await db.query('UPDATE vps_provider_orders SET locked_until = NULL WHERE id = ?', [op.id]).catch(() => {})
    return { serviceId, status: 'in_progress', message: `Consulta falhou: ${(e as Error).message}` }
  }
}

/** Associação manual (a equipa adquiriu o VPS): confirma a VM na Hostinger quando possível e activa o serviço. */
export async function linkVps(serviceId: string, vmId: string, adminId: string): Promise<VpsOutcome> {
  const id = String(vmId ?? '').trim()
  if (!/^\d{1,12}$/.test(id)) throw new Error('Indique o número da VM na Hostinger (só dígitos).')
  await assertVmNotProtected(id).catch(e => { throw new Error(e.message) })
  const db = getPool()
  const [other] = await rows(db, 'SELECT service_id FROM vps_provider_orders WHERE provider_vm_id = ? AND service_id <> ?', [id, serviceId])
  if (other) throw new Error('Essa VM já está associada a outro serviço.')
  const c = await context(serviceId)
  if (!c) throw new Error('Serviço inexistente.')
  if (c.payment_status !== 'paid') throw new Error('Pagamento ainda não validado: associe depois da validação.')
  let vm: VirtualMachine | null = null
  const cl = await vpsClient('read')
  if (!('error' in cl)) {
    vm = await cl.client.virtualMachine(id).catch(() => null)
    if (!vm) throw new Error(`VM ${id} não encontrada na conta Hostinger.`)
  }
  const [op] = await rows(db, 'SELECT id, status FROM vps_provider_orders WHERE service_id = ?', [serviceId])
  if (op && ['submitting', 'submitted', 'payment_processing'].includes(op.status)) throw new Error('Há uma compra automática em curso: use «Consultar Hostinger».')
  const opId = op?.id ?? randomUUID()
  if (!op) await db.query(`INSERT INTO vps_provider_orders (id, service_id, order_item_id, mode, client_ref, item_id, status, provider_vm_id, provider_status, ipv4, request)
    VALUES (?, ?, ?, 'manual', ?, ?, 'active', ?, ?, ?, NULL)`, [opId, serviceId, c.order_item_id, `man${serviceId.replace(/-/g, '').slice(0, 14)}`, c.provider_item_id ?? 'manual', id, vm?.state ?? 'manual', vm?.ipv4?.[0]?.address ?? null])
  else await db.query("UPDATE vps_provider_orders SET status = 'active', provider_vm_id = ?, provider_status = ?, ipv4 = ? WHERE id = ?", [id, vm?.state ?? 'manual', vm?.ipv4?.[0]?.address ?? null, opId])
  const warn = vm ? specMismatches((json(c.plan_specs) ?? {}) as VpsSpecs, specsFromVm(vm)) : []
  await event(opId, 'manual_link', `VM ${id} associada pela equipa${vm ? ` (${vm.state})` : ' (sem consulta à API)'}${warn.length ? `; ATENÇÃO: ${warn.join('; ')}` : ''}`, adminId)
  const months = Number(c.months ?? VPS_CYCLES.find(x => x.cycle === c.billing_cycle)?.months ?? 1)
  const ip = vm?.ipv4?.[0]?.address
  await setService(serviceId, 'active', null, { external_ref: `VM ${id}${ip ? ` · ${ip}` : ''}`, next_due_date: addMonths(months), activation_source: 'manual' })
  return { serviceId, status: 'active', message: `VM ${id} associada.${warn.length ? ` Atenção: ${warn.join('; ')}` : ''}` }
}

/**
 * Activação manual sem VM da Hostinger (ex.: infra própria): a equipa confirma a entrega com o IP.
 * Nenhuma palavra-passe é guardada nem enviada: o acesso inicial é configurado pelo cliente em «Os meus VPS»
 * (chave SSH) ou entregue pela equipa por canal seguro.
 */
export async function deliverManualVps(serviceId: string, input: { ip?: unknown; note?: unknown }, adminId: string): Promise<VpsOutcome> {
  const ip = String(input.ip ?? '').trim()
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(x => Number(x) > 255)) throw new Error('Indique o IPv4 público do VPS.')
  const note = String(input.note ?? '').trim().slice(0, 300)
  const db = getPool()
  const c = await context(serviceId)
  if (!c) throw new Error('Serviço inexistente.')
  if (!isServerVps(c)) throw new Error('Só para serviços Servidor VPS.')
  if (c.payment_status !== 'paid') throw new Error('Pagamento ainda não validado: confirme a entrega depois da validação.')
  const o = json(c.options) ?? {}
  if (o.later && !o.image?.id) throw new Error('O cliente ainda não escolheu a instalação.')
  const [op] = await rows(db, 'SELECT id, status FROM vps_provider_orders WHERE service_id = ?', [serviceId])
  if (op && ['submitting', 'submitted', 'payment_processing', 'unknown'].includes(op.status)) throw new Error('Há uma compra automática em curso ou por confirmar: concilie primeiro.')
  const opId = op?.id ?? randomUUID()
  if (!op) await db.query(`INSERT INTO vps_provider_orders (id, service_id, order_item_id, provider, mode, client_ref, item_id, status, provider_status, ipv4, request, access_method, access_configured_at)
    VALUES (?, ?, ?, 'manual', 'manual', ?, 'manual', 'active', 'delivered', ?, NULL, 'manual', CURRENT_TIMESTAMP(6))`, [opId, serviceId, c.order_item_id, `man${serviceId.replace(/-/g, '').slice(0, 14)}`, ip])
  else await db.query("UPDATE vps_provider_orders SET status = 'active', provider = 'manual', provider_status = 'delivered', ipv4 = ?, access_method = 'manual', access_configured_at = CURRENT_TIMESTAMP(6) WHERE id = ?", [ip, opId])
  await event(opId, 'manual_delivery', `entrega confirmada pela equipa (${ip})${note ? `: ${note}` : ''}`, adminId)
  const months = Number(c.months ?? VPS_CYCLES.find(x => x.cycle === c.billing_cycle)?.months ?? 1)
  await setService(serviceId, 'active', null, { external_ref: `Manual · ${ip}`, next_due_date: addMonths(months), activation_source: 'manual' })
  return { serviceId, status: 'active', message: `Entrega confirmada (${ip}).` }
}

/** Revisão manual concluída: a equipa confirmou no hPanel que NADA foi comprado — permite uma nova tentativa. */
export async function confirmNotPurchased(serviceId: string, note: string, adminId: string) {
  const db = getPool()
  const [op] = await rows(db, 'SELECT id, status FROM vps_provider_orders WHERE service_id = ?', [serviceId])
  if (!op || !['unknown', 'failed'].includes(op.status)) throw new Error('Só se aplica a compras com resultado por confirmar ou recusadas.')
  if (String(note ?? '').trim().length < 5) throw new Error('Indique o que foi verificado no hPanel (mín. 5 caracteres).')
  await db.query("UPDATE vps_provider_orders SET status = 'pending', provider_order_id = NULL, message = NULL WHERE id = ?", [op.id])
  await event(op.id, 'confirmed_not_purchased', String(note).slice(0, 400), adminId)
  await setService(serviceId, 'pending', 'Nova tentativa autorizada pela equipa.')
}

/** Concilia todas as compras em aberto (cron). */
export async function reconcileOpenVps() {
  const open = await rows(getPool(), "SELECT service_id FROM vps_provider_orders WHERE status IN ('submitting','submitted','payment_processing','unknown')")
  const out: VpsOutcome[] = []
  for (const o of open) out.push(await reconcileVps(o.service_id))
  return out
}
