import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'
import { PROTECTED_VM_IDS } from './protected'

// Cloud VPS — regras comerciais, financeiras e de protecção partilhadas pelo painel, pela cotação, pelos pedidos,
// pelo motor de compra (provisioning.ts) e pela área do cliente (manage.ts). Tudo aplicado NO SERVIDOR.
// A configuração fica em vps_provider_settings.options (a mesma linha da integração Hostinger: sem tabelas novas).
//   commercialMode  disabled | test | request_only (inicial) | automatic
//     automatic só pode ser activado com a API simulada (modo «test») ou, em produção, com VPS_LIVE_PURCHASES=1
//     (a mesma variável que já autoriza compras reais) — sem flags novas.
//   finance         câmbio BRL→AOA, acréscimo comercial (100 % inicial), comissão bancária, impostos
//   addons          extras vendidos pela ViralizaHost (suporte, backups adicionais, licenças) — entrega pela equipa
//   spendLimit      limite mensal de compras no fornecedor (em cêntimos da moeda do fornecedor)
//   operations      activar/desactivar compras automáticas e a gestão pelo cliente

/* eslint-disable @typescript-eslint/no-explicit-any */
export const VPS_MODES = ['disabled', 'test', 'request_only', 'automatic'] as const
export type VpsMode = (typeof VPS_MODES)[number]
export const VPS_MODE_LABEL: Record<VpsMode, string> = { disabled: 'Desactivado', test: 'Teste (só administradores)', request_only: 'Solicitação mediante aprovação', automatic: 'Automático' }

/** VMs da infraestrutura de produção da ViralizaHost: protegidas SEMPRE, mesmo que a base seja alterada. */
export { PROTECTED_VM_IDS }

export interface VpsAddon { id: string; label: string; kind: 'support' | 'backup' | 'license' | 'other'; monthlyKz: number; enabled: boolean; description: string | null }
export interface VpsFinance { fxBrlAoa: number | null; fxUsdAoa: number | null; markupPct: number; bankFeePct: number; taxPct: number }
export interface CloudSettings {
  mode: VpsMode; providerMode: 'test' | 'live'; finance: VpsFinance; addons: VpsAddon[]
  spendLimitMonthlyMinor: number | null; operations: { purchases: boolean; clientManagement: boolean }
  liveAllowed: boolean
}
export class CloudError extends Error { constructor(public code: string, message: string, public status = 400) { super(message) } }

const parse = (v: unknown) => { try { return (typeof v === 'string' ? JSON.parse(v) : v) ?? {} } catch { return {} } }
const num = (v: unknown, d: number | null) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : Number(v))

export async function loadCloudSettings(db: Queryable = getPool()): Promise<CloudSettings> {
  const [[r]] = await db.query('SELECT mode, options FROM vps_provider_settings WHERE id = 1').catch(() => [[null]]) as any
  const o = parse(r?.options)
  const f = o.finance ?? {}
  return {
    mode: VPS_MODES.includes(o.commercialMode) ? o.commercialMode : 'request_only',
    providerMode: r?.mode === 'live' ? 'live' : 'test',
    finance: { fxBrlAoa: num(f.fxBrlAoa, null), fxUsdAoa: num(f.fxUsdAoa, null), markupPct: num(f.markupPct, 100)!, bankFeePct: num(f.bankFeePct, 0)!, taxPct: num(f.taxPct, 0)! },
    addons: (Array.isArray(o.addons) ? o.addons : []).map((a: any) => ({ id: String(a.id), label: String(a.label ?? ''), kind: ['support', 'backup', 'license'].includes(a.kind) ? a.kind : 'other', monthlyKz: Number(a.monthlyKz ?? 0), enabled: !!a.enabled, description: a.description ?? null })),
    spendLimitMonthlyMinor: num(o.spendLimitMonthlyMinor, null),
    operations: { purchases: o.operations?.purchases !== false, clientManagement: o.operations?.clientManagement !== false },
    liveAllowed: process.env.VPS_LIVE_PURCHASES === '1',
  }
}

/** Grava a parte comercial/financeira (só depois de requireAdminRole). Regista em activity_logs. */
export async function saveCloudSettings(adminId: string, input: Record<string, any>) {
  const db = getPool()
  const [[r]] = await db.query('SELECT mode, options FROM vps_provider_settings WHERE id = 1') as any
  if (!r) throw new CloudError('not_configured', 'Configure primeiro o fornecedor (Cloud VPS → Fornecedores).', 409)
  const o = parse(r.options)
  const cur = await loadCloudSettings(db)
  const log: string[] = []
  if (input.mode !== undefined) {
    const mode = String(input.mode) as VpsMode
    if (!VPS_MODES.includes(mode)) throw new CloudError('mode_invalid', 'Modo inválido.')
    if (mode === 'automatic' && cur.mode !== 'automatic') {
      if (String(input.confirmText ?? '').trim().toUpperCase() !== 'AUTORIZO VENDA AUTOMATICA VPS') throw new CloudError('confirm_required', 'Para o modo automático escreva «AUTORIZO VENDA AUTOMATICA VPS» (autorização expressa).', 409)
      // Compras reais: a mesma salvaguarda já existente — VPS_LIVE_PURCHASES=1 no servidor
      if (r.mode === 'live' && process.env.VPS_LIVE_PURCHASES !== '1') throw new CloudError('live_blocked', 'Modo automático bloqueado: as compras reais exigem VPS_LIVE_PURCHASES=1 no servidor (activação sujeita a aprovação).', 409)
    }
    o.commercialMode = mode; log.push(`modo ${cur.mode} → ${mode}`)
  }
  if (input.finance && typeof input.finance === 'object') {
    const f = input.finance, nf: any = { ...(o.finance ?? {}) }
    for (const [k, min, max] of [['fxBrlAoa', 1, 100000], ['fxUsdAoa', 1, 100000], ['markupPct', 0, 1000], ['bankFeePct', 0, 50], ['taxPct', 0, 50]] as const) {
      if (f[k] === undefined) continue
      if (f[k] === null || f[k] === '') { if (k.startsWith('fx')) { nf[k] = null; continue } throw new CloudError('invalid', `${k}: obrigatório.`) }
      const n = Number(f[k]); if (!Number.isFinite(n) || n < min || n > max) throw new CloudError('invalid', `${k}: valor entre ${min} e ${max}.`)
      nf[k] = Math.round(n * 10000) / 10000
    }
    o.finance = nf; log.push(`finanças (câmbio BRL ${nf.fxBrlAoa ?? '—'}, acréscimo ${nf.markupPct ?? 100}%)`)
  }
  if (Array.isArray(input.addons)) {
    const seen = new Set<string>()
    o.addons = input.addons.slice(0, 20).map((a: any, i: number) => {
      const label = String(a.label ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80)
      if (label.length < 2) throw new CloudError('invalid', `Extra n.º ${i + 1}: indique o nome.`)
      const price = Number(a.monthlyKz)
      if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw new CloudError('invalid', `Extra «${label}»: preço mensal inválido.`)
      const id = String(a.id || `addon-${label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`)
      if (seen.has(id)) throw new CloudError('invalid', `Extra repetido: ${label}.`)
      seen.add(id)
      return { id, label, kind: ['support', 'backup', 'license'].includes(a.kind) ? a.kind : 'other', monthlyKz: Math.round(price * 100) / 100, enabled: !!a.enabled, description: String(a.description ?? '').slice(0, 200) || null }
    })
    log.push(`${o.addons.length} extra(s)`)
  }
  if (input.spendLimitMonthlyMinor !== undefined) {
    const n = input.spendLimitMonthlyMinor === null || input.spendLimitMonthlyMinor === '' ? null : Number(input.spendLimitMonthlyMinor)
    if (n !== null && (!Number.isInteger(n) || n < 0)) throw new CloudError('invalid', 'Limite mensal de despesas inválido (cêntimos).')
    o.spendLimitMonthlyMinor = n; log.push(`limite mensal ${n ?? 'sem limite'}`)
  }
  if (input.operations && typeof input.operations === 'object') {
    o.operations = { purchases: input.operations.purchases !== false, clientManagement: input.operations.clientManagement !== false }
    log.push(`operações: compras ${o.operations.purchases ? 'on' : 'OFF'}, gestão do cliente ${o.operations.clientManagement ? 'on' : 'OFF'}`)
  }
  await db.query('UPDATE vps_provider_settings SET options = ?, updated_by = ? WHERE id = 1', [JSON.stringify(o), adminId])
  await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'integration', 'cloud_vps', ?)", [adminId, `Cloud VPS: ${log.join('; ')}`.slice(0, 500)]).catch(() => {})
  return loadCloudSettings(db)
}

// ── Protecção da infraestrutura ──
/** VM protegida? (lista fixa no código + marca na base). */
export async function isProtectedVm(vmId: string | number | null | undefined, db: Queryable = getPool()): Promise<boolean> {
  if (vmId == null || vmId === '') return false
  const id = String(vmId)
  if ((PROTECTED_VM_IDS as readonly string[]).includes(id)) return true
  const [[r]] = await db.query('SELECT is_protected FROM vps_instances WHERE provider_vm_id = ? LIMIT 1', [id]).catch(() => [[null]]) as any
  return !!Number(r?.is_protected)
}
/** Recusa qualquer operação do módulo Cloud VPS sobre uma VM protegida (energia, reinstalação, credenciais, associação…). */
export async function assertVmNotProtected(vmId: string | number | null | undefined, db: Queryable = getPool()) {
  if (await isProtectedVm(vmId, db)) throw new CloudError('vm_protected', `A VM ${vmId} é infraestrutura protegida da ViralizaHost: nenhuma operação é permitida pelo módulo Cloud VPS.`, 403)
}

// ── Cotação / checkout ──
export const VPS_GATE_MSG: Record<string, string> = {
  vps_disabled: 'A contratação de VPS está temporariamente indisponível.',
  vps_test_admin_only: 'Cloud VPS em modo de teste: contratação reservada a administradores.',
  vps_request_only: 'O VPS é contratado mediante pedido e aprovação: use «Solicitar VPS» no configurador.',
  vps_request_mismatch: 'Pedido de VPS inválido para esta encomenda (plano, ciclo ou opções diferentes do aprovado).',
  vps_cycle_unsustainable: 'Este período não está disponível para novas contratações (preço de renovação abaixo do custo do fornecedor).',
}
/**
 * Bloqueio comercial dos VPS na cotação. requestId = encomenda criada pelo painel a partir de um pedido aprovado
 * (plano, ciclo e opções têm de coincidir). validateOnly = cálculo do preço para um pedido (nunca cria encomenda).
 */
export async function vpsGate(db: Queryable, p: { productId: string; cycle: string; userId?: string | null; requestId?: string | null; validateOnly?: boolean; options?: unknown }): Promise<string | null> {
  const s = await loadCloudSettings(db)
  if (s.mode === 'disabled') return 'vps_disabled'
  const [[u]] = p.userId ? await db.query('SELECT role FROM profiles WHERE id = ?', [p.userId]) as any : [[null]]
  const isAdmin = u?.role === 'admin'
  if (p.validateOnly) return s.mode === 'test' && !isAdmin ? 'vps_test_admin_only' : null
  if (p.requestId) {
    const [[r]] = await db.query('SELECT product_id, cycle, profile_id, status, options FROM vps_requests WHERE id = ?', [p.requestId]) as any
    const same = (a: any, b: any) => String(a?.location?.id ?? a?.location ?? '') === String(b?.location?.id ?? b?.location ?? '') && String(a?.image?.id ?? a?.image ?? '') === String(b?.image?.id ?? b?.image ?? '')
    const ok = r && r.product_id === p.productId && r.cycle === p.cycle && r.profile_id && r.profile_id === p.userId && ['approved', 'awaiting_payment'].includes(r.status) && same(parse(r.options), p.options ?? {})
    return ok ? null : 'vps_request_mismatch'
  }
  if (s.mode === 'test') return isAdmin ? null : 'vps_test_admin_only'
  if (s.mode === 'request_only') return 'vps_request_only'
  return null
}

/** Ciclo sustentável? Renovação de venda ≥ custo de renovação do fornecedor convertido (+ comissão e impostos). */
export function cycleSustainable(f: VpsFinance, renewalKz: number, providerRenewalMinor: number | null, currency: string | null): boolean | null {
  const fx = currency === 'BRL' ? f.fxBrlAoa : currency === 'USD' ? f.fxUsdAoa : null
  if (!fx || providerRenewalMinor == null) return null // sem dados: não é possível concluir (não bloqueia, é mostrado no painel)
  const cost = (providerRenewalMinor / 100) * fx * (1 + (f.bankFeePct + f.taxPct) / 100)
  return renewalKz >= cost
}

/** Preço sugerido (Kz) a partir do custo do fornecedor: custo × câmbio × (1 + acréscimo) + extras mensais × meses. */
export function suggestedPrice(f: VpsFinance, costMinor: number | null, currency: string | null, months: number, extraMonthlyKz = 0, markupPct = f.markupPct): number | null {
  const fx = currency === 'BRL' ? f.fxBrlAoa : currency === 'USD' ? f.fxUsdAoa : null
  if (!fx || costMinor == null) return null
  const base = (costMinor / 100) * fx * (1 + (f.bankFeePct + f.taxPct) / 100)
  return Math.ceil((base * (1 + markupPct / 100) + extraMonthlyKz * months) / 100) * 100 // arredonda às centenas de Kz
}

/** Despesa do mês corrente com compras no fornecedor (cêntimos) — limite de despesas. */
export async function monthSpendMinor(db: Queryable = getPool()): Promise<number> {
  const [[r]] = await db.query("SELECT COALESCE(SUM(expected_cost_minor), 0) n FROM vps_provider_orders WHERE status IN ('submitting','submitted','payment_processing','active','unknown') AND mode <> 'manual' AND created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')") as any
  return Number(r?.n ?? 0)
}
