import 'server-only'
import { getPool } from '@/lib/db/pool'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import type { RegistrarAdapter } from './types'
import { simulatedAdapter } from './simulated'
import { normalizeDomain } from '@/lib/commerce/domains'
import { HOSTINGER_API, hostingerAdapter, hostingerClient, type HostingerClient } from './hostinger'

// Configuração do registrador de domínios (linha única registrar_settings.id = 1).
// O segredo é cifrado com WHM_ENCRYPTION_KEY e nunca sai do servidor.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProviderInfo { id: string; label: string; testOnly?: boolean; needsUrl?: boolean; needsUser?: boolean; docs?: string
  /** Cada compra exige autorização explícita do administrador na encomenda (nunca automática). */
  authorizePerOrder?: boolean
  /** Extensões que ficam em registo manual até o suporte ser confirmado no fornecedor. */
  manualSuffixes?: string[]
  /** Extensões exactas em registo manual, com o motivo (mostrado no painel e nas mensagens). */
  manualExtensions?: Record<string, string>
  secretLabel?: string
}

// Só aparecem fornecedores cuja integração está implementada e testada.
// Um fornecedor real (contratado) acrescenta-se com um adaptador em src/lib/registrar/.
export const PROVIDERS: ProviderInfo[] = [
  { id: 'none', label: 'Nenhum — registo manual pela equipa' },
  { id: 'simulado', label: 'Simulador de ensaio (sem registos reais)', testOnly: true, needsUrl: true },
  // API pública da Hostinger (developers.hostinger.com). O cartão fica na conta Hostinger.
  // Em «ensaio» aponta para a API simulada (endereço obrigatório); em produção usa sempre a API oficial.
  { id: 'hostinger', label: 'Hostinger', authorizePerOrder: true, manualSuffixes: ['.ao'],
    manualExtensions: { '.ai': 'período de registo por confirmar: o catálogo real da Hostinger não mostrou preço de 1 ano para «.AI Domain» (a ViralizaHost vende .ai a partir de 1 ano)' }, secretLabel: 'Token da API (hPanel → Conta → API)', docs: 'https://developers.hostinger.com' },
]

/** true se a extensão tem de ficar manual com este fornecedor (ex.: .ao e .co.ao na Hostinger). */
export const isManualForProvider = (provider: string, ext: string) => !!manualReason(provider, ext)
/** Motivo pelo qual a extensão fica manual com este fornecedor, ou null. */
export function manualReason(provider: string, ext: string): string | null {
  const p = PROVIDERS.find(x => x.id === provider)
  const e = String(ext ?? '').trim().toLowerCase()
  if (p?.manualExtensions?.[e]) return p.manualExtensions[e]
  if ((p?.manualSuffixes ?? []).some(s => e === s || e.endsWith(s))) return 'suporte por confirmar na API e na conta'
  return null
}

export interface RegistrarSettings {
  provider: string; mode: 'test' | 'live'; enabled: boolean; apiUrl: string | null; username: string | null
  hasSecret: boolean; extensions: string[]
  lastTest: { at: string | null; ok: boolean | null; message: string | null }
}

async function row(): Promise<any | null> {
  const [r] = await getPool().query('SELECT * FROM registrar_settings WHERE id = 1') as any
  return r[0] ?? null
}

const parseExt = (v: unknown): string[] => {
  try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}

export async function loadRegistrarSettings(): Promise<RegistrarSettings> {
  const r = await row().catch(() => null)
  return {
    provider: r?.provider ?? 'none', mode: r?.mode ?? 'test', enabled: !!r?.enabled, apiUrl: r?.api_url ?? null, username: r?.username ?? null,
    hasSecret: !!r?.secret_enc, extensions: parseExt(r?.extensions),
    lastTest: { at: r?.last_test_at ?? null, ok: r?.last_test_ok == null ? null : !!r.last_test_ok, message: r?.last_test_message ?? null },
  }
}

export class RegistrarConfigError extends Error {}

export async function saveRegistrarSettings(input: { provider: string; mode: 'test' | 'live'; apiUrl?: string | null; username?: string | null; secret?: string | null; extensions?: string[]; enabled?: boolean }, adminId: string) {
  const p = PROVIDERS.find(x => x.id === input.provider)
  if (!p) throw new RegistrarConfigError('Fornecedor desconhecido.')
  if (!['test', 'live'].includes(input.mode)) throw new RegistrarConfigError('Modo inválido.')
  if (p.testOnly && input.mode === 'live') throw new RegistrarConfigError('O simulador só pode ser usado em modo de ensaio.')
  const apiUrl = (input.apiUrl ?? '').trim() || null
  // Campos vazios contam como «sem valor» (a página envia '' para campos escondidos, ex.: utilizador na Hostinger).
  // Antes, '' ≠ NULL guardado marcava a configuração como alterada e activar era sempre recusado.
  const username = p.id === 'hostinger' ? null : (input.username ?? '').trim() || null
  if (apiUrl && !/^https?:\/\/[^\s]+$/.test(apiUrl)) throw new RegistrarConfigError('Endereço da API inválido.')
  if (apiUrl?.startsWith('http://') && input.mode === 'live') throw new RegistrarConfigError('Em produção a API tem de usar HTTPS.')
  let secretEnc: string | undefined
  if (input.secret) {
    if ((process.env.WHM_ENCRYPTION_KEY?.length ?? 0) < 64) throw new RegistrarConfigError('Sem WHM_ENCRYPTION_KEY: o segredo não pode ser guardado cifrado.')
    secretEnc = encryptSecret(input.secret)
  }
  if (p.id === 'hostinger') {
    if (input.mode === 'live' && apiUrl && apiUrl.replace(/\/+$/, '') !== HOSTINGER_API) throw new RegistrarConfigError(`Em produção a Hostinger usa sempre ${HOSTINGER_API}.`)
    if (input.mode === 'test' && !apiUrl) throw new RegistrarConfigError('Em modo de ensaio indique o endereço da API simulada.')
  }
  const [known] = await getPool().query('SELECT DISTINCT extension FROM domain_prices') as any
  const valid = new Set((known as any[]).map(k => k.extension))
  const blocked = (input.extensions ?? []).filter(e => isManualForProvider(p.id, e))
  if (blocked.length) throw new RegistrarConfigError(`Em registo manual com ${p.label}: ${blocked.map(e => `${e} (${manualReason(p.id, e)})`).join('; ')}.`)
  const extensions = [...new Set((input.extensions ?? []).filter(e => valid.has(e)))]
  const prev = await row()
  // Qualquer alteração de fornecedor/endereço/credenciais obriga a testar de novo antes de activar
  const providerChanged = !!prev && prev.provider !== input.provider
  const storedUrl = p.id === 'hostinger' && input.mode === 'live' ? null : apiUrl
  const changed = !prev || prev.provider !== input.provider || prev.mode !== input.mode || (prev.api_url ?? null) !== storedUrl || ((prev.username ?? '').trim() || null) !== username || !!secretEnc
  const enabled = input.enabled === true && input.provider !== 'none'
  if (enabled && (changed || prev?.last_test_ok !== 1)) {
    throw new RegistrarConfigError(changed
      ? 'Teste a ligação com sucesso antes de activar a integração: guarde primeiro as alterações (fornecedor, modo, endereço ou credencial), teste e só depois active.'
      : 'Teste a ligação com sucesso antes de activar a integração.')
  }
  await getPool().query(
    `INSERT INTO registrar_settings (id, provider, mode, enabled, api_url, username, secret_enc, extensions, updated_by, last_test_ok, last_test_at, last_test_message)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
     ON DUPLICATE KEY UPDATE provider = VALUES(provider), mode = VALUES(mode), enabled = VALUES(enabled), api_url = VALUES(api_url), username = VALUES(username),
       secret_enc = IF(?, ?, COALESCE(?, secret_enc)), extensions = VALUES(extensions), updated_by = VALUES(updated_by),
       last_test_ok = IF(?, NULL, last_test_ok), last_test_at = IF(?, NULL, last_test_at), last_test_message = IF(?, NULL, last_test_message)`,
    [input.provider, input.mode, enabled ? 1 : 0, storedUrl, username, secretEnc ?? null, JSON.stringify(extensions), adminId,
      // Credencial própria de cada fornecedor: mudar de fornecedor sem novo segredo apaga o anterior
      providerChanged ? 1 : 0, secretEnc ?? null, secretEnc ?? null, changed ? 1 : 0, changed ? 1 : 0, changed ? 1 : 0],
  )
}

function build(r: any): RegistrarAdapter | null {
  if (!r || r.provider === 'none') return null
  const secret = r.secret_enc ? decryptSecret(r.secret_enc) : ''
  if (r.provider === 'hostinger') {
    const client = hostingerClientFor(r, secret)
    return client ? hostingerAdapter(client) : null
  }
  if (r.provider === 'simulado') {
    if (r.mode !== 'test' || !r.api_url) return null
    return simulatedAdapter({ baseUrl: r.api_url, secret, timeoutMs: Number(process.env.REGISTRAR_TIMEOUT_MS) || 8000 })
  }
  return null
}

function hostingerClientFor(r: any, secret: string): HostingerClient | null {
  if (!secret) return null
  const baseUrl = r.mode === 'live' ? HOSTINGER_API : r.api_url
  if (!baseUrl) return null
  return hostingerClient({ token: secret, baseUrl, timeoutMs: Number(process.env.REGISTRAR_TIMEOUT_MS) || 15000 })
}

/**
 * Hostinger activa para um domínio (extensão autorizada, integração activa), com o cliente HTTP.
 * Em modo «test» só no servidor de ensaio (REGISTRAR_TEST_PROVISIONING=1), como os restantes.
 */
export async function hostingerForDomain(domain: string): Promise<{ client: HostingerClient; mode: 'test' | 'live'; extension: string } | { error: string }> {
  const r = await row().catch(() => null)
  if (!r || r.provider !== 'hostinger') return { error: 'A Hostinger não é o fornecedor configurado (Integrações → Registrador).' }
  if (!r.enabled) return { error: 'Integração com a Hostinger inactiva: teste a ligação e active-a em Integrações → Registrador.' }
  if (r.mode === 'test' && process.env.REGISTRAR_TEST_PROVISIONING !== '1') return { error: 'Hostinger em modo de ensaio: só o servidor de ensaio executa compras simuladas.' }
  const d = registrarDomain(domain)
  if (!d) return { error: 'Domínio inválido para registo.' }
  const ext = matchExtension(d, parseExt(r.extensions))
  if (!ext) return { error: `Extensão ${extensionOf(d)} não autorizada para a Hostinger (Integrações → Registrador): registo manual.` }
  if (isManualForProvider('hostinger', ext)) return { error: `${ext} fica em registo manual: ${manualReason('hostinger', ext)}.` }
  const client = hostingerClientFor(r, r.secret_enc ? decryptSecret(r.secret_enc) : '')
  if (!client) return { error: 'Token da Hostinger não configurado.' }
  return { client, mode: r.mode, extension: ext }
}

/** Domínio normalizado (minúsculas, sem espaços, «www.», protocolo, caminho nem ponto final). */
export const registrarDomain = (raw: unknown) => normalizeDomain(String(raw ?? '').trim().replace(/\.+$/, ''))
/** Extensão autorizada (a mais longa) que corresponde exactamente ao domínio, ou null. */
export function matchExtension(domain: string, extensions: string[]): string | null {
  const list = extensions.map(e => String(e).trim().toLowerCase()).filter(Boolean).sort((a, b) => b.length - a.length)
  return list.find(e => domain.endsWith(e) && domain.length > e.length && !domain.slice(0, -e.length).includes('.')) ?? null
}
const extensionOf = (d: string) => d.slice(d.indexOf('.'))

/**
 * Elegibilidade para «Registar na Hostinger» com a configuração ACTUAL (nunca com o estado manual
 * gravado numa tentativa anterior). Sem chamadas ao fornecedor: serve a lista de encomendas.
 */
export function hostingerEligibility(
  reg: { provider: string; enabled: boolean; extensions: string[] } | null,
  svc: { serviceType: string; domain: string | null; operation: string | null; renews: boolean; paid: boolean },
): { eligible: boolean; reason: string | null } {
  if (!reg || reg.provider !== 'hostinger' || svc.serviceType !== 'domain') return { eligible: false, reason: null }
  if (!reg.enabled) return { eligible: false, reason: 'Hostinger inactiva: em Integrações → Registrador marque «Activar integração» e guarde.' }
  if (svc.renews || (svc.operation && svc.operation !== 'register')) return { eligible: false, reason: 'Só registos novos são feitos na Hostinger (renovação/transferência manual).' }
  if (!svc.paid) return { eligible: false, reason: 'Pagamento do cliente por validar.' }
  const d = registrarDomain(svc.domain)
  if (!d) return { eligible: false, reason: 'Domínio do item inválido ou em falta.' }
  const manual = manualReason('hostinger', extensionOf(d)) ?? manualReason('hostinger', `.${d.split('.').slice(-1)[0]}`)
  const ext = matchExtension(d, reg.extensions)
  if (!ext) return { eligible: false, reason: manual ? `${extensionOf(d)} em registo manual: ${manual}.` : `Extensão ${extensionOf(d)} não autorizada para a Hostinger (Integrações → Registrador).` }
  if (isManualForProvider('hostinger', ext)) return { eligible: false, reason: `${ext} em registo manual: ${manualReason('hostinger', ext)}.` }
  return { eligible: true, reason: null }
}

/** Fornecedor activo exige autorização por encomenda (Hostinger)? */
export async function providerRequiresAuthorization(): Promise<boolean> {
  const r = await row().catch(() => null)
  return !!r?.enabled && !!PROVIDERS.find(p => p.id === r.provider)?.authorizePerOrder
}

/** Testa a ligação com uma operação de leitura (nunca regista nem cobra). Guarda o resultado. */
export async function testRegistrarConnection() {
  const r = await row()
  const adapter = build(r)
  let result: { ok: boolean; message: string; extensions?: string[] }
  if (!adapter) result = { ok: false, message: r?.provider && r.provider !== 'none' ? 'Configuração incompleta (endereço ou credenciais).' : 'Nenhum fornecedor configurado.' }
  else {
    try { result = await adapter.testConnection() } catch (e) { result = { ok: false, message: (e as Error).message.slice(0, 200) } }
  }
  if (r) await getPool().query('UPDATE registrar_settings SET last_test_at = CURRENT_TIMESTAMP(6), last_test_ok = ?, last_test_message = ? WHERE id = 1', [result.ok ? 1 : 0, result.message.slice(0, 500)])
  return result
}

/**
 * Adaptador activo para um domínio, ou null (fluxo manual). Em modo «test» só actua
 * quando REGISTRAR_TEST_PROVISIONING=1 (servidor de ensaio): numa instalação de produção
 * com o simulador ligado, as encomendas reais continuam em registo manual.
 */
export async function adapterForDomain(domain: string): Promise<{ adapter: RegistrarAdapter; provider: string; mode: 'test' | 'live' } | null> {
  const r = await row().catch(() => null)
  if (!r?.enabled) return null
  if (r.mode === 'test' && process.env.REGISTRAR_TEST_PROVISIONING !== '1') return null
  const exts = parseExt(r.extensions).sort((a, b) => b.length - a.length)
  const ext = exts.find(e => domain.endsWith(e) && domain.length > e.length && !domain.slice(0, -e.length).includes('.'))
  if (!ext) return null
  const adapter = build(r)
  return adapter ? { adapter, provider: r.provider, mode: r.mode } : null
}
