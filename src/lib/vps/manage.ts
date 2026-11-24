import 'server-only'
import { getPool } from '@/lib/db/pool'
import { randomUUID } from 'node:crypto'
import { imageRow, publicVpsOptions, vpsClient } from './settings'
import { ACTION_PENDING, type VpsAction } from './hostinger-vps'
import { VPS_CLIENT_STATE, accessUrlFor, fitsLocation, vpsClientState, type VpsClientState } from './install-shared'
import { VPS_CYCLES } from '@/lib/commerce/vps-shared'

// «Os meus VPS» (Área do Cliente). Cada função recebe o id do cliente autenticado e só actua sobre serviços dele
// (services.profile_id). Nenhuma palavra-passe é guardada, registada ou enviada por e-mail: a palavra-passe root
// segue uma única vez, por HTTPS, para a API da Hostinger e é descartada. Consola: a API não a disponibiliza.

/* eslint-disable @typescript-eslint/no-explicit-any */
export class VpsManageError extends Error { constructor(message: string, public status = 400) { super(message) } }
const json = (v: unknown) => { if (!v) return null; try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }

export interface MyVps {
  id: string; name: string; plan: string; cycleLabel: string; orderId: string; orderNumber: string
  state: VpsClientState; stateLabel: string; stateHelp: string; message: string | null
  location: string | null; ip: string | null; power: string | null
  install: { id: string | null; label: string; category: string; includedOs: string | null; version: string | null } | null
  awaitingChoice: boolean; sshUser: string; accessUrl: string | null
  /** Gestão pela API disponível (VM da Hostinger associada). Em entrega manual: só suporte. */
  manageable: boolean; vmId: string | null; nextDue: string | null; reference: string
}

const BASE_SQL = `SELECT s.id, s.status, s.provisioning_status, s.provisioning_error, s.next_due_date, s.profile_id, s.external_ref,
    o.id order_id, o.order_number, o.payment_status, oi.options, oi.billing_cycle, p.name plan_name, p.slug plan_slug, p.plan_specs,
    v.id op_id, v.provider, v.provider_vm_id, v.provider_status, v.ipv4, v.request, v.status op_status
  FROM services s JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id JOIN products p ON p.id = s.product_id
  LEFT JOIN vps_provider_orders v ON v.service_id = s.id
  WHERE s.profile_id = ? AND p.category = 'vps' AND p.subcategory IS NULL AND s.status <> 'cancelled'`

async function toMyVps(r: any): Promise<MyVps> {
  const o = json(r.options) ?? {}
  const req = json(r.request) ?? {}
  const cur = req.current_image ?? o.image ?? null
  const awaiting = !!o.later && !o.image?.id
  const state = vpsClientState({ payment_status: r.payment_status, service_status: r.status, provisioning_status: r.provisioning_status, provisioning_error: r.provisioning_error, awaiting_choice: awaiting })
  const row = cur?.id ? await imageRow(cur.id) : null
  const ready = state === 'ready'
  const ip = ready ? r.ipv4 ?? null : null
  return {
    id: r.id, name: r.plan_name, plan: r.plan_name, cycleLabel: VPS_CYCLES.find(c => c.cycle === r.billing_cycle)?.label ?? r.billing_cycle ?? '—',
    orderId: r.order_id, orderNumber: r.order_number, state, stateLabel: VPS_CLIENT_STATE[state].label,
    stateHelp: awaiting ? 'Escolha o que instalar para iniciarmos a preparação do VPS.' : VPS_CLIENT_STATE[state].help,
    // Mensagens internas (custos, ids do fornecedor) não são mostradas ao cliente
    message: state === 'intervention' && !awaiting ? 'A equipa foi notificada e está a tratar da activação. Pode pedir suporte com a referência abaixo.' : null,
    location: o.location?.label ?? null, ip, power: ready ? r.provider_status ?? null : null,
    install: cur ? { id: cur.id ?? null, label: cur.label, category: cur.category ?? row?.category ?? 'os', includedOs: cur.includedOs ?? row?.includedOs ?? null, version: cur.version ?? row?.version ?? null } : null,
    awaitingChoice: awaiting && r.payment_status === 'paid', sshUser: row?.sshUser ?? 'root', accessUrl: ready ? accessUrlFor(row?.accessUrl, ip) : null,
    manageable: ready && r.provider !== 'manual' && !!r.provider_vm_id, vmId: ready ? r.provider_vm_id ?? null : null,
    nextDue: r.next_due_date ? String(r.next_due_date instanceof Date ? r.next_due_date.toISOString() : r.next_due_date).slice(0, 10) : null,
    reference: `${r.order_number}${r.provider_vm_id ? ` · VM ${r.provider_vm_id}` : ''}`,
  }
}

export async function listMyVps(profileId: string): Promise<MyVps[]> {
  const [rows] = await getPool().query(`${BASE_SQL} ORDER BY s.created_at DESC`, [profileId]) as any
  return Promise.all((rows as any[]).map(toMyVps))
}
async function own(profileId: string, serviceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(String(serviceId))) throw new VpsManageError('VPS não encontrado.', 404)
  const [[r]] = await getPool().query(`${BASE_SQL} AND s.id = ?`, [profileId, serviceId]) as any
  if (!r) throw new VpsManageError('VPS não encontrado.', 404) // também para VPS de outro cliente (sem revelar que existe)
  return r
}
export async function getMyVps(profileId: string, serviceId: string) { return toMyVps(await own(profileId, serviceId)) }

async function audit(r: { op_id: string | null; id: string }, event: string, detail: string, actor: string) {
  const opId = r.op_id
  if (opId) await getPool().query('INSERT INTO vps_provider_events (id, provider_order_id, event, detail, actor) VALUES (?, ?, ?, ?, ?)', [randomUUID(), opId, event, detail.slice(0, 500), actor]).catch(() => {})
  await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'service', ?, ?)", [actor, r.id, `VPS: ${detail}`.slice(0, 500)]).catch(() => {})
}
/** VM gerível pelo cliente: serviço pronto, VM da Hostinger associada e API acessível. */
async function managed(profileId: string, serviceId: string) {
  const r = await own(profileId, serviceId)
  const v = await toMyVps(r)
  if (!v.manageable || !r.provider_vm_id) throw new VpsManageError('A gestão deste VPS não está disponível no portal: peça suporte com a referência indicada.', 409)
  const cl = await vpsClient('read')
  if ('error' in cl) throw new VpsManageError('Gestão temporariamente indisponível. Tente mais tarde ou peça suporte.', 503)
  return { r, v, client: cl.client, vmId: String(r.provider_vm_id) }
}

/** Estado em tempo real (estado da VM e últimas acções) para mostrar o progresso. */
export async function liveStatus(profileId: string, serviceId: string) {
  const { r, client, vmId } = await managed(profileId, serviceId)
  const vm = await client.virtualMachine(vmId).catch(() => null)
  if (!vm) throw new VpsManageError('Não foi possível consultar o estado do VPS agora.', 503)
  const actions = (await client.actions(vmId).catch(() => [] as VpsAction[])).slice(0, 5)
  if (vm.state && vm.state !== r.provider_status) await getPool().query('UPDATE vps_provider_orders SET provider_status = ? WHERE id = ?', [vm.state, r.op_id]).catch(() => {})
  const busy = (vm as any).actions_lock === 'locked' || actions.some(a => ACTION_PENDING.includes(String(a.state)))
  return { state: vm.state ?? null, ip: vm.ipv4?.[0]?.address ?? null, busy, actions: actions.map(a => ({ id: a.id, name: a.name ?? null, state: a.state, at: a.updated_at ?? a.created_at ?? null })) }
}

/** Ligar, desligar, reiniciar — só quando o estado actual o permite e nenhuma operação está em curso. */
export async function powerAction(profileId: string, serviceId: string, op: string) {
  if (!['start', 'stop', 'restart'].includes(op)) throw new VpsManageError('Operação inválida.')
  const { r, client, vmId } = await managed(profileId, serviceId)
  const vm = await client.virtualMachine(vmId).catch(() => null)
  if (!vm) throw new VpsManageError('Não foi possível confirmar o estado do VPS: nada foi alterado.', 503)
  const acts = await client.actions(vmId).catch(() => null)
  if ((vm as any).actions_lock === 'locked' || acts?.some(a => ACTION_PENDING.includes(String(a.state)))) throw new VpsManageError('Há uma operação em curso neste VPS. Aguarde que termine.', 409)
  const allowed = op === 'start' ? vm.state === 'stopped' : vm.state === 'running'
  if (!allowed) throw new VpsManageError(op === 'start' ? 'O VPS já está ligado (ou num estado que não permite ligar).' : 'O VPS não está ligado: esta operação não está disponível agora.', 409)
  const res = await client.manage(vmId, op as 'start' | 'stop' | 'restart')
  if (!res.ok) throw new VpsManageError(`A Hostinger não aceitou a operação (${res.message}).`, 502)
  await audit(r, `client_${op}`, `${op} pedido pelo cliente (acção ${res.action?.id ?? '—'})`, profileId)
  return { action: res.action }
}

/** Regras da Hostinger para a palavra-passe root (12–50, maiúscula, minúscula, número e símbolo permitido). */
export function rootPasswordProblem(pw: string): string | null {
  if (pw.length < 12 || pw.length > 50) return 'Use entre 12 e 50 caracteres.'
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return 'Inclua maiúsculas, minúsculas e números.'
  if (!/[-().&@?'#;/,+]/.test(pw)) return "Inclua pelo menos um destes símbolos: - ( ) . & @ ? ' # ; / , +"
  if (/[^A-Za-z0-9\-().&@?'#;/,+]/.test(pw)) return "Só são permitidos letras, números e os símbolos - ( ) . & @ ? ' # ; / , +"
  return null
}
export async function setRootPassword(profileId: string, serviceId: string, password: unknown) {
  const pw = typeof password === 'string' ? password : ''
  const problem = rootPasswordProblem(pw)
  if (problem) throw new VpsManageError(problem, 422)
  const { r, client, vmId } = await managed(profileId, serviceId)
  const res = await client.manage(vmId, 'root-password', { password: pw })
  if (!res.ok) throw new VpsManageError(res.status === 422 ? 'A Hostinger recusou esta palavra-passe (pode constar de listas de palavras-passe comprometidas). Escolha outra.' : `Não foi possível alterar a palavra-passe (${res.message}).`, res.status === 422 ? 422 : 502)
  await audit(r, 'client_root_password', 'palavra-passe root definida pelo cliente (valor não guardado)', profileId)
  return { action: res.action }
}

const SSH_KEY = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com) [A-Za-z0-9+/]{40,}={0,3}(?: [^\r\n]{0,200})?$/
export async function addSshKey(profileId: string, serviceId: string, key: unknown) {
  const k = String(key ?? '').trim().replace(/\s+/g, ' ')
  if (k.length > 8000 || !SSH_KEY.test(k)) throw new VpsManageError('Chave pública SSH inválida. Cole a chave completa (ex.: «ssh-ed25519 AAAA… nome»). Nunca cole a chave privada.', 422)
  const { r, client, vmId } = await managed(profileId, serviceId)
  const res = await client.manage(vmId, 'ssh-keys-add', { keys: [k] })
  if (!res.ok) throw new VpsManageError(`Não foi possível adicionar a chave (${res.message}).`, 502)
  await audit(r, 'client_ssh_key', `chave SSH ${k.split(' ')[0]} adicionada (${k.slice(-24)})`, profileId)
  return { action: res.action }
}
export async function listSshKeys(profileId: string, serviceId: string) {
  const { client, vmId } = await managed(profileId, serviceId)
  return (await client.sshKeys(vmId).catch(() => [])).map(k => { const [type, body, ...c] = k.split(' '); return { type, fingerprint: `${body?.slice(0, 12)}…${body?.slice(-8)}`, comment: c.join(' ') || null } })
}

/** Opções que o cliente pode instalar (reinstalar ou escolher mais tarde): licença incluída e compatíveis. */
async function installChoices(r: any, locationId: string | null) {
  let specs: { ramGb?: number | null } = {}
  try { specs = json(r.plan_specs) ?? {} } catch { /* */ }
  const o = await publicVpsOptions({ slug: r.plan_slug, ramGb: specs.ramGb ?? null })
  return o.images.filter(i => fitsLocation(i, locationId))
}
export async function availableInstalls(profileId: string, serviceId: string) {
  const r = await own(profileId, serviceId)
  const o = json(r.options) ?? {}
  const req = json(r.request) ?? {}
  const current = String((req.current_image ?? o.image)?.id ?? '')
  // Licença paga: só a já paga (a mesma imagem); outras licenças pagas exigem nova encomenda/suporte
  return (await installChoices(r, o.location?.id ?? null)).filter(i => i.license.type === 'included' || i.id === current)
}

/** Reinstalar (apaga todos os dados): exige confirmação explícita e separada. */
export async function reinstall(profileId: string, serviceId: string, input: { image?: unknown; acceptDataLoss?: unknown; confirmText?: unknown }) {
  if (input.acceptDataLoss !== true || String(input.confirmText ?? '').trim().toUpperCase() !== 'REINSTALAR') throw new VpsManageError('Confirme que aceita a perda de todos os dados e escreva REINSTALAR.', 422)
  const { r, client, vmId } = await managed(profileId, serviceId)
  const choices = await availableInstalls(profileId, serviceId)
  const img = choices.find(i => i.id === String(input.image ?? ''))
  if (!img) throw new VpsManageError('Instalação indisponível para este VPS (localização, plano ou licença). Escolha outra ou peça suporte.', 422)
  if (!/^\d+$/.test(img.id)) throw new VpsManageError('Esta instalação é feita pela equipa: peça suporte.', 409)
  const acts = await client.actions(vmId).catch(() => null)
  if (acts?.some(a => ACTION_PENDING.includes(String(a.state)))) throw new VpsManageError('Há uma operação em curso neste VPS. Aguarde que termine.', 409)
  const res = await client.manage(vmId, 'recreate', { template_id: Number(img.id) })
  if (!res.ok) throw new VpsManageError(`A Hostinger não aceitou a reinstalação (${res.message}). Nada foi alterado.`, 502)
  const req = json(r.request) ?? {}
  req.current_image = { id: img.id, label: img.label, category: img.category, name: img.name, version: img.version, includedOs: img.includedOs }
  await getPool().query('UPDATE vps_provider_orders SET request = ? WHERE id = ?', [JSON.stringify(req), r.op_id])
  await audit(r, 'client_reinstall', `reinstalação com «${img.label}» (template ${img.id}) confirmada pelo cliente; acção ${res.action?.id ?? '—'}`, profileId)
  return { action: res.action }
}

/** «Escolher mais tarde»: o cliente escolhe a instalação depois do pagamento; inicia o aprovisionamento. */
export async function chooseInstall(profileId: string, serviceId: string, imageId: unknown) {
  const r = await own(profileId, serviceId)
  const o = json(r.options) ?? {}
  if (!(o.later && !o.image?.id)) throw new VpsManageError('A instalação deste VPS já foi escolhida.', 409)
  if (r.payment_status !== 'paid') throw new VpsManageError('Disponível depois de o pagamento ser confirmado.', 409)
  const img = (await installChoices(r, o.location?.id ?? null)).find(i => i.id === String(imageId ?? '') && i.license.type === 'included')
  if (!img) throw new VpsManageError('Instalação indisponível nesta localização ou neste plano. Escolha outra.', 422)
  const next = { ...o, later: false, image: { id: img.id, label: img.label, category: img.category, name: img.name, version: img.version, includedOs: img.includedOs, license: { type: 'included', monthlyKz: 0, total: 0 } }, chosenAt: new Date().toISOString() }
  const [u] = await getPool().query("UPDATE order_items oi JOIN services s ON s.order_item_id = oi.id SET oi.options = ? WHERE s.id = ? AND s.profile_id = ? AND JSON_EXTRACT(oi.options, '$.later') = true AND JSON_EXTRACT(oi.options, '$.image.id') IS NULL", [JSON.stringify(next), serviceId, profileId]) as any
  if (!u.affectedRows) throw new VpsManageError('A instalação deste VPS já foi escolhida.', 409)
  await getPool().query("UPDATE services SET provisioning_status = 'pending', provisioning_error = NULL WHERE id = ?", [serviceId])
  await audit(r, 'client_choose_install', `instalação escolhida depois do pagamento: «${img.label}»`, profileId)
  const { provisionService, refreshOrderActivation } = await import('@/lib/commerce/provisioning')
  const out = await provisionService(serviceId)
  await refreshOrderActivation(r.order_id).catch(() => {})
  return out
}
