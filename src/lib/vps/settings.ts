import 'server-only'
import { getPool } from '@/lib/db/pool'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { HOSTINGER_API, hostingerVpsClient, VpsApiError, type HostingerVpsClient } from './hostinger-vps'
import type { VpsOption } from '@/lib/commerce/vps-shared'

// Integrações → Hostinger VPS (linha única vps_provider_settings.id = 1).
// Credencial cifrada com WHM_ENCRYPTION_KEY (como o Registrador); nunca sai do servidor. Sem token próprio, usa o
// token da Hostinger guardado em Integrações → Registrador (mesma conta).
// Compra automática só com: opção explícita activada + último «Testar ligação» com sucesso + plano em modo
// automático. Em modo «test» só no servidor de ensaio (REGISTRAR_TEST_PROVISIONING=1); em modo «live» exige também
// VPS_LIVE_PURCHASES=1 no servidor (activação das compras reais sujeita a aprovação).

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OptionRow extends VpsOption { enabled: boolean; detail?: string | null }
export interface VpsSettings {
  mode: 'test' | 'live'; apiUrl: string | null; hasSecret: boolean; usesRegistrarToken: boolean; autoProvision: boolean
  paymentMethodId: number | null; hostnameSuffix: string; locations: OptionRow[]; images: OptionRow[]
  lastTest: { at: string | null; ok: boolean | null; message: string | null }
}
export class VpsConfigError extends Error {}

const row = async (): Promise<any | null> => ((await getPool().query('SELECT * FROM vps_provider_settings WHERE id = 1')) as any)[0][0] ?? null
const parse = (v: unknown) => { try { return (typeof v === 'string' ? JSON.parse(v) : v) ?? {} } catch { return {} } }
async function registrarHostingerSecret(): Promise<string | null> {
  const [[r]] = await getPool().query("SELECT secret_enc FROM registrar_settings WHERE id = 1 AND provider = 'hostinger'") as any
  try { return r?.secret_enc ? decryptSecret(r.secret_enc) : null } catch { return null }
}

export async function loadVpsSettings(): Promise<VpsSettings> {
  const r = await row().catch(() => null)
  const o = parse(r?.options)
  return {
    mode: r?.mode === 'live' ? 'live' : 'test', apiUrl: r?.api_url ?? null, hasSecret: !!r?.secret_enc,
    usesRegistrarToken: !r?.secret_enc && !!(await registrarHostingerSecret().catch(() => null)),
    autoProvision: !!r?.auto_provision, paymentMethodId: r?.payment_method_id != null ? Number(r.payment_method_id) : null,
    hostnameSuffix: typeof o.hostnameSuffix === 'string' && o.hostnameSuffix ? o.hostnameSuffix : 'srv.viralizahost.com',
    locations: Array.isArray(o.locations) ? o.locations : [], images: Array.isArray(o.images) ? o.images : [],
    lastTest: { at: r?.last_test_at ?? null, ok: r?.last_test_ok == null ? null : !!r.last_test_ok, message: r?.last_test_message ?? null },
  }
}

/** Opções que o cliente pode escolher (só as activadas pelo administrador). */
export async function publicVpsOptions(): Promise<{ locations: VpsOption[]; images: VpsOption[] }> {
  const s = await loadVpsSettings()
  const pick = (l: OptionRow[]) => l.filter(x => x.enabled).map(x => ({ id: String(x.id), label: x.label }))
  return { locations: pick(s.locations), images: pick(s.images) }
}

/** Cliente da API (ou o motivo por que não há). purchase=true aplica as salvaguardas das compras. */
export async function vpsClient(purpose: 'read' | 'purchase' = 'read'): Promise<{ client: HostingerVpsClient; mode: 'test' | 'live' } | { error: string }> {
  const r = await row().catch(() => null)
  if (!r) return { error: 'Integração Hostinger VPS por configurar (Integrações → Hostinger VPS).' }
  const token = r.secret_enc ? (() => { try { return decryptSecret(r.secret_enc) } catch { return null } })() : await registrarHostingerSecret()
  if (!token) return { error: 'Sem token da Hostinger (Integrações → Hostinger VPS ou Registrador).' }
  const mode: 'test' | 'live' = r.mode === 'live' ? 'live' : 'test'
  const baseUrl = mode === 'live' ? HOSTINGER_API : r.api_url
  if (!baseUrl) return { error: 'Em modo de ensaio indique o endereço da API simulada.' }
  if (purpose === 'purchase') {
    if (!r.auto_provision) return { error: 'Aprovisionamento automático desactivado (Integrações → Hostinger VPS).' }
    if (r.last_test_ok !== 1) return { error: 'Teste a ligação com sucesso antes de usar o aprovisionamento automático.' }
    if (mode === 'test' && process.env.REGISTRAR_TEST_PROVISIONING !== '1') return { error: 'Hostinger VPS em modo de ensaio: só o servidor de ensaio executa compras simuladas.' }
    if (mode === 'live' && process.env.VPS_LIVE_PURCHASES !== '1') return { error: 'Compras reais de VPS por aprovar: falta VPS_LIVE_PURCHASES=1 no servidor.' }
  }
  const t = Number(process.env.VPS_PROVIDER_TIMEOUT_MS) || 0
  return { client: hostingerVpsClient({ token, baseUrl, timeoutMs: t || 20000, purchaseTimeoutMs: t || 30000 }), mode }
}

export async function saveVpsSettings(input: { mode?: unknown; apiUrl?: unknown; secret?: unknown; paymentMethodId?: unknown; hostnameSuffix?: unknown; autoProvision?: unknown; confirmAuto?: unknown; enabledLocations?: unknown; enabledImages?: unknown }, adminId: string) {
  const prev = await row()
  const mode = input.mode === 'live' ? 'live' : input.mode === 'test' ? 'test' : (prev?.mode ?? 'test')
  const apiUrlRaw = input.apiUrl === undefined ? prev?.api_url ?? null : String(input.apiUrl ?? '').trim() || null
  if (apiUrlRaw && !/^https?:\/\/[^\s]+$/.test(apiUrlRaw)) throw new VpsConfigError('Endereço da API inválido.')
  if (mode === 'live' && apiUrlRaw && apiUrlRaw.replace(/\/+$/, '') !== HOSTINGER_API) throw new VpsConfigError(`Em produção a Hostinger usa sempre ${HOSTINGER_API}.`)
  if (mode === 'test' && !apiUrlRaw) throw new VpsConfigError('Em modo de ensaio indique o endereço da API simulada.')
  const apiUrl = mode === 'live' ? null : apiUrlRaw
  let secretEnc: string | null | undefined
  if (typeof input.secret === 'string' && input.secret.trim()) {
    if ((process.env.WHM_ENCRYPTION_KEY?.length ?? 0) < 64) throw new VpsConfigError('Sem WHM_ENCRYPTION_KEY: o token não pode ser guardado cifrado.')
    secretEnc = encryptSecret(input.secret.trim())
  }
  let pm: number | null = prev?.payment_method_id != null ? Number(prev.payment_method_id) : null
  if (input.paymentMethodId !== undefined) {
    pm = input.paymentMethodId === null || input.paymentMethodId === '' ? null : Number(input.paymentMethodId)
    if (pm !== null && (!Number.isInteger(pm) || pm <= 0)) throw new VpsConfigError('Método de pagamento inválido.')
  }
  const o = parse(prev?.options)
  if (input.hostnameSuffix !== undefined) {
    const s = String(input.hostnameSuffix ?? '').trim().toLowerCase()
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(s)) throw new VpsConfigError('Sufixo do hostname inválido (ex.: srv.viralizahost.com).')
    o.hostnameSuffix = s
  }
  const flag = (list: OptionRow[], ids: unknown) => Array.isArray(ids) ? list.map(x => ({ ...x, enabled: ids.map(String).includes(String(x.id)) })) : list
  o.locations = flag(Array.isArray(o.locations) ? o.locations : [], input.enabledLocations)
  o.images = flag(Array.isArray(o.images) ? o.images : [], input.enabledImages)
  const changed = !prev || prev.mode !== mode || (prev.api_url ?? null) !== apiUrl || !!secretEnc
  let auto = input.autoProvision === undefined ? !!prev?.auto_provision : input.autoProvision === true
  if (changed) auto = false // nova configuração: volta a testar antes de automatizar
  if (auto && !prev?.auto_provision) {
    if (input.confirmAuto !== true) throw new VpsConfigError('Confirme explicitamente o aprovisionamento automático (compra na Hostinger com o método de pagamento da conta).')
    if (changed || prev?.last_test_ok !== 1) throw new VpsConfigError('Teste a ligação com sucesso antes de activar o aprovisionamento automático.')
    if (pm == null) throw new VpsConfigError('Escolha o método de pagamento da conta Hostinger a usar nas compras.')
  }
  await getPool().query(
    `INSERT INTO vps_provider_settings (id, mode, api_url, secret_enc, auto_provision, payment_method_id, options, updated_by, last_test_ok, last_test_at, last_test_message)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
     ON DUPLICATE KEY UPDATE mode = VALUES(mode), api_url = VALUES(api_url), secret_enc = COALESCE(VALUES(secret_enc), secret_enc), auto_provision = VALUES(auto_provision),
       payment_method_id = VALUES(payment_method_id), options = VALUES(options), updated_by = VALUES(updated_by),
       last_test_ok = IF(?, NULL, last_test_ok), last_test_at = IF(?, NULL, last_test_at), last_test_message = IF(?, NULL, last_test_message)`,
    [mode, apiUrl, secretEnc ?? null, auto ? 1 : 0, pm, JSON.stringify(o), adminId, changed ? 1 : 0, changed ? 1 : 0, changed ? 1 : 0])
  await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'integration', 'hostinger_vps', ?)",
    [adminId, `Hostinger VPS: modo ${mode}${secretEnc ? ', token novo' : ''}; automático ${auto ? 'ACTIVADO' : 'desactivado'}; método de pagamento ${pm ?? '—'}`]).catch(() => {})
  return loadVpsSettings()
}

/** «Testar ligação»: só leituras (catálogo VPS, centros de dados, templates, métodos de pagamento, VMs). Actualiza as opções. */
export async function testVpsConnection() {
  const c = await vpsClient('read')
  let result: { ok: boolean; message: string; detail?: Record<string, unknown> }
  if ('error' in c) result = { ok: false, message: c.error }
  else {
    try {
      const [catalog, dcs, tpls, pms, vms] = await Promise.all([c.client.catalog(), c.client.dataCenters(), c.client.templates(), c.client.paymentMethods(), c.client.virtualMachines()])
      const prev = await row(); const o = parse(prev?.options)
      const old = (l: OptionRow[] | undefined, id: string) => (l ?? []).find(x => String(x.id) === id)?.enabled ?? false
      o.locations = dcs.map(d => ({ id: String(d.id), label: [d.city, d.location].filter(Boolean).join(', ') || d.name || `Centro ${d.id}`, detail: d.name ?? null, enabled: old(o.locations, String(d.id)) }))
      o.images = tpls.map(t => ({ id: String(t.id), label: t.name, detail: t.description ?? null, enabled: old(o.images, String(t.id)) }))
      await getPool().query('UPDATE vps_provider_settings SET options = ? WHERE id = 1', [JSON.stringify(o)])
      result = { ok: true, message: `Ligação OK (${c.mode === 'live' ? 'produção' : 'ensaio'}): ${catalog.length} produto(s) VPS no catálogo, ${dcs.length} centro(s) de dados, ${tpls.length} sistema(s)/imagem(ns), ${vms.length} VPS na conta, ${pms.length} método(s) de pagamento.`,
        detail: { catalog: catalog.map(i => ({ id: i.id, name: i.name, metadata: i.metadata ?? null, prices: i.prices })), paymentMethods: pms.map(p => ({ id: p.id, label: `${p.name ?? 'Método'} ${p.identifier ?? ''}`.trim(), isDefault: !!p.is_default, unusable: !!(p.is_expired || p.is_suspended) })) } }
    } catch (e) { result = { ok: false, message: e instanceof VpsApiError ? e.message : 'Falha ao contactar a Hostinger.' } }
  }
  await getPool().query('UPDATE vps_provider_settings SET last_test_at = CURRENT_TIMESTAMP(6), last_test_ok = ?, last_test_message = ? WHERE id = 1', [result.ok ? 1 : 0, result.message.slice(0, 500)])
  return result
}

/** Catálogo VPS da Hostinger (leitura) para associar planos no painel. */
export async function providerCatalog() {
  const c = await vpsClient('read')
  if ('error' in c) return { error: c.error, items: [] }
  try { return { items: await c.client.catalog() } } catch (e) { return { error: (e as Error).message, items: [] } }
}
