import 'server-only'
import { getPool } from '@/lib/db/pool'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { HOSTINGER_API, hostingerVpsClient, VpsApiError, type HostingerVpsClient } from './hostinger-vps'
import type { VpsOption } from '@/lib/commerce/vps-shared'
import { classifyTemplate, fitsPlan, isInstallGroup, normalizeRow, sellable, type InstallOptionRow, type PublicVpsOptions } from './install-shared'

// Integrações → Hostinger VPS (linha única vps_provider_settings.id = 1).
// Credencial cifrada com WHM_ENCRYPTION_KEY (como o Registrador); nunca sai do servidor. Sem token próprio, usa o
// token da Hostinger guardado em Integrações → Registrador (mesma conta).
// Compra automática só com: opção explícita activada + último «Testar ligação» com sucesso + plano em modo
// automático. Em modo «test» só no servidor de ensaio (REGISTRAR_TEST_PROVISIONING=1); em modo «live» exige também
// VPS_LIVE_PURCHASES=1 no servidor (activação das compras reais sujeita a aprovação).

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface OptionRow extends VpsOption { enabled: boolean; detail?: string | null }
export type ImageRow = ReturnType<typeof normalizeRow>
export interface VpsSettings {
  mode: 'test' | 'live'; apiUrl: string | null; hasSecret: boolean; usesRegistrarToken: boolean; autoProvision: boolean
  paymentMethodId: number | null; hostnameSuffix: string; locations: OptionRow[]; images: ImageRow[]
  /** «Escolher mais tarde»: o cliente paga e escolhe a instalação depois, em «Os meus VPS». */
  allowChooseLater: boolean
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
    locations: Array.isArray(o.locations) ? o.locations : [], images: (Array.isArray(o.images) ? o.images : []).map((x: InstallOptionRow) => normalizeRow(x)),
    allowChooseLater: o.allowChooseLater === true,
    lastTest: { at: r?.last_test_at ?? null, ok: r?.last_test_ok == null ? null : !!r.last_test_ok, message: r?.last_test_message ?? null },
  }
}

/**
 * Opções que o cliente pode escolher: só as activadas, com licença vendável e compatíveis com o plano
 * (planos permitidos / RAM mínima). As localizações de cada imagem ficam restritas às activadas.
 */
export async function publicVpsOptions(plan?: { slug: string; ramGb?: number | null } | null): Promise<PublicVpsOptions> {
  const s = await loadVpsSettings()
  const locations = s.locations.filter(x => x.enabled).map(x => ({ id: String(x.id), label: x.label }))
  const locIds = locations.map(l => l.id)
  const images = s.images.filter(r => sellable(r) && (!plan || fitsPlan(r, plan)))
    .map(r => ({ r, locs: r.locations.filter(l => locIds.includes(l)) }))
    .filter(({ r, locs }) => !r.locations.length || !locIds.length || locs.length > 0)
    .map(({ r, locs }) => ({
      id: r.id, label: r.label, category: r.category, group: r.group ?? "other", name: r.name, version: r.version, icon: r.icon ?? "generic", includedOs: r.includedOs,
      license: { type: r.license.type, monthlyKz: r.license.type === 'paid' ? Number(r.license.monthlyKz ?? 0) : 0 },
      locations: r.locations.length ? locs : [], description: r.detail,
    }))
  return { locations, images, allowChooseLater: s.allowChooseLater && images.length > 0 }
}
/** Linha completa (interna) de uma imagem: sistema incluído, acesso, utilizador SSH, origem. */
export async function imageRow(id: string | null | undefined): Promise<ImageRow | null> {
  if (!id) return null
  return (await loadVpsSettings()).images.find(x => x.id === String(id)) ?? null
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

/** Valida a configuração de uma opção de instalação vinda do painel. */
function imageConfig(raw: any, prev: ImageRow | undefined): InstallOptionRow {
  const str = (v: unknown, max = 80) => (v == null ? null : String(v).trim().slice(0, max) || null)
  const cat = ['os', 'panel', 'app'].includes(raw?.category) ? raw.category : prev?.category ?? 'os'
  const licType = raw?.license?.type === 'paid' ? 'paid' : raw?.license?.type === 'included' ? 'included' : prev?.license.type ?? 'included'
  const monthly = raw?.license?.monthlyKz === undefined ? prev?.license.monthlyKz ?? null : raw.license.monthlyKz === null || raw.license.monthlyKz === '' ? null : Number(raw.license.monthlyKz)
  if (monthly != null && (!Number.isFinite(monthly) || monthly < 0 || monthly > 10_000_000)) throw new VpsConfigError(`Preço da licença inválido em «${raw?.label ?? prev?.label}».`)
  const enabled = raw?.enabled === undefined ? !!prev?.enabled : raw.enabled === true
  if (enabled && licType === 'paid' && !(monthly && monthly > 0)) throw new VpsConfigError(`«${raw?.label ?? prev?.label}» tem licença paga: indique o preço mensal da licença antes de a activar.`)
  const url = raw?.accessUrl === undefined ? prev?.accessUrl ?? null : str(raw.accessUrl, 200)
  if (url && !/^https?:\/\/[^\s]*\{ip\}[^\s]*$/.test(url)) throw new VpsConfigError('Endereço de acesso inválido: use, por exemplo, https://{ip}:8090')
  const minRam = raw?.minRamGb === undefined ? prev?.minRamGb ?? null : raw.minRamGb === null || raw.minRamGb === '' ? null : Number(raw.minRamGb)
  if (minRam != null && (!Number.isFinite(minRam) || minRam < 0 || minRam > 4096)) throw new VpsConfigError('RAM mínima inválida.')
  const list = (v: unknown, p: string[] | undefined) => (Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean).slice(0, 100) : p ?? [])
  const user = raw?.sshUser === undefined ? prev?.sshUser ?? 'root' : str(raw.sshUser, 32) ?? 'root'
  if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(user)) throw new VpsConfigError('Utilizador SSH inválido.')
  return {
    id: String(raw?.id ?? prev?.id), label: str(raw?.label, 120) ?? prev?.label ?? String(raw?.id), enabled, detail: raw?.detail === undefined ? prev?.detail ?? null : str(raw.detail, 300),
    source: prev?.source ?? (raw?.source === 'manual' ? 'manual' : 'api'), category: cat, name: str(raw?.name) ?? prev?.name ?? raw?.label,
    version: raw?.version === undefined ? prev?.version ?? null : str(raw.version, 40), icon: str(raw?.icon, 30) ?? prev?.icon ?? 'generic',
    includedOs: cat === 'os' ? null : raw?.includedOs === undefined ? prev?.includedOs ?? null : str(raw.includedOs),
    license: { type: licType, monthlyKz: licType === 'paid' ? monthly : null, note: raw?.license?.note === undefined ? prev?.license.note ?? null : str(raw.license.note, 160) },
    locations: list(raw?.locations, prev?.locations), minRamGb: minRam || null, plans: list(raw?.plans, prev?.plans), accessUrl: url, sshUser: user,
    group: raw?.group === undefined ? prev?.group ?? null : isInstallGroup(raw.group) ? raw.group : prev?.group ?? null,
  }
}

export async function saveVpsSettings(input: { mode?: unknown; apiUrl?: unknown; secret?: unknown; paymentMethodId?: unknown; hostnameSuffix?: unknown; autoProvision?: unknown; confirmAuto?: unknown; enabledLocations?: unknown; enabledImages?: unknown; images?: unknown; addManualImage?: unknown; removeImage?: unknown; allowChooseLater?: unknown }, adminId: string) {
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
  let imgs: ImageRow[] = (Array.isArray(o.images) ? o.images : []).map((x: InstallOptionRow) => normalizeRow(x))
  if (Array.isArray(input.enabledImages)) imgs = imgs.map(x => ({ ...x, enabled: (input.enabledImages as unknown[]).map(String).includes(x.id) }))
  if (Array.isArray(input.images)) {
    for (const raw of input.images as any[]) {
      const i = imgs.findIndex(x => x.id === String(raw?.id))
      if (i < 0) throw new VpsConfigError(`Opção de instalação desconhecida: ${String(raw?.id).slice(0, 40)}.`)
      imgs[i] = normalizeRow(imageConfig(raw, imgs[i]))
    }
  }
  // Opções manuais (activação manual): o que a equipa sabe entregar, sem template da Hostinger
  if (input.addManualImage && typeof input.addManualImage === 'object') {
    const raw = input.addManualImage as any
    if (!String(raw.label ?? '').trim()) throw new VpsConfigError('Indique o nome da opção manual.')
    const id = `m-${Date.now().toString(36)}`
    imgs.push(normalizeRow(imageConfig({ ...raw, id, source: 'manual', enabled: raw.enabled === true }, { ...normalizeRow({ id, label: String(raw.label), enabled: false, ...classifyTemplate(String(raw.label)) }), source: 'manual' })))
  }
  if (input.removeImage) {
    const r = imgs.find(x => x.id === String(input.removeImage))
    if (!r || r.source !== 'manual') throw new VpsConfigError('Só as opções manuais podem ser removidas (as da Hostinger desactivam-se).')
    imgs = imgs.filter(x => x !== r)
  }
  o.images = imgs
  if (input.allowChooseLater !== undefined) o.allowChooseLater = input.allowChooseLater === true
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

/**
 * Actualiza as localizações e os templates guardados a partir do fornecedor, mantendo a configuração do
 * administrador (publicação, categoria, licença, compatibilidade). Novos ficam por publicar. Usado pelo «Testar
 * ligação» antigo e pela sincronização do Cloud VPS.
 */
export async function mergeProviderOptions(dcs: { id: number; name?: string | null; location?: string | null; city?: string | null }[], tpls: { id: number; name: string; description?: string | null }[]) {
  const prev = await row(); const o = parse(prev?.options)
  const old = (l: OptionRow[] | undefined, id: string) => (l ?? []).find(x => String(x.id) === id)?.enabled ?? false
  o.locations = dcs.map(d => ({ id: String(d.id), label: [d.city, d.location].filter(Boolean).join(', ') || d.name || `Centro ${d.id}`, detail: d.name ?? null, enabled: old(o.locations, String(d.id)) }))
  const prevImgs: InstallOptionRow[] = Array.isArray(o.images) ? o.images : []
  o.images = [
    ...tpls.map(t => {
      const p = prevImgs.find(x => String(x.id) === String(t.id))
      return p ? { ...p, label: t.name, detail: t.description ?? null, source: 'api' } : { id: String(t.id), label: t.name, detail: t.description ?? null, enabled: false, source: 'api', ...classifyTemplate(t.name) }
    }),
    ...prevImgs.filter(x => x.source === 'manual'),
  ]
  await getPool().query('UPDATE vps_provider_settings SET options = ? WHERE id = 1', [JSON.stringify(o)])
}

/** «Testar ligação»: só leituras (catálogo VPS, centros de dados, templates, métodos de pagamento, VMs). Actualiza as opções. */
export async function testVpsConnection() {
  const c = await vpsClient('read')
  let result: { ok: boolean; message: string; detail?: Record<string, unknown> }
  if ('error' in c) result = { ok: false, message: c.error }
  else {
    try {
      const [catalog, dcs, tpls, pms, vms] = await Promise.all([c.client.catalog(), c.client.dataCenters(), c.client.templates(), c.client.paymentMethods(), c.client.virtualMachines()])
      await mergeProviderOptions(dcs, tpls)
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
