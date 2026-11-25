import 'server-only'
import type { WHMConfig } from '@/lib/whm/client'

// Funções WHM API 1 usadas pela Revenda de Hospedagem. SÓ no servidor (componente de aprovisionamento):
// o token administrativo nunca sai deste módulo, nunca é registado e nunca chega ao navegador.
//   • HTTPS com validação de certificado (fetch do Node; nunca se desliga a verificação);
//   • cada chamada valida o código HTTP E o resultado interno do WHM (metadata.result === 1);
//   • tempo limite por chamada; erros sem URLs, tokens nem senhas;
//   • senhas só no corpo de um POST (nunca no URL, que fica nos registos de acesso do cPanel).
// Nomes e parâmetros: WHM API 1 (api.docs.cpanel.net, WHM 138). NÃO existe «getresellerprivs» — não é chamada.
// Os privilégios efectivos de um revendedor não são devolvidos por nenhuma função de leitura usada aqui:
// a verificação compara o que é observável (listresellers, acctcounts, resellerstats, accountsummary) e a ACL
// fica com confirmação humana explícita (ver lib/reseller/provisioning.ts → «awaiting_confirmation»).

export type WhmErrorKind = 'http' | 'auth' | 'metadata' | 'timeout' | 'network' | 'parse'
export class WhmCallError extends Error {
  constructor(public fn: string, message: string, public kind: WhmErrorKind, public status?: number) { super(message) }
  /** Erros que podem desaparecer ao repetir (rede, tempo limite, 5xx). Recusas do WHM não se repetem às cegas. */
  get transient() { return this.kind === 'timeout' || this.kind === 'network' || (this.kind === 'http' && (this.status ?? 0) >= 500) }
}

const scrub = (s: unknown) => String(s ?? '').replace(/https?:\/\/\S+/g, '[url]').replace(/(token|password|pass|secret|authorization)\s*[=:]\s*\S+/gi, '$1=[oculto]').slice(0, 300)
export const DEFAULT_TIMEOUT_MS = Math.max(2000, Number(process.env.RESELLER_WHM_TIMEOUT_MS) || 20_000)

type Params = Record<string, string | number | boolean | undefined | null>
const enc = (v: string | number | boolean) => (typeof v === 'boolean' ? (v ? '1' : '0') : String(v))

/** Uma chamada WHM API 1. Devolve o JSON completo; lança WhmCallError com motivo limpo. */
export async function whmCall(cfg: WHMConfig, fn: string, params: Params = {}, opts: { method?: 'GET' | 'POST'; timeoutMs?: number } = {}): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!/^[a-z_]+$/.test(fn)) throw new WhmCallError(fn, 'Função WHM inválida.', 'parse')
  if (fn === 'getresellerprivs') throw new WhmCallError(fn, 'getresellerprivs não existe na WHM API 1.', 'parse')
  let base: string
  try { const u = new URL(cfg.url); if (u.protocol !== 'https:') throw new Error('http'); base = u.origin } catch { throw new WhmCallError(fn, 'URL do WHM inválida (tem de ser https://).', 'parse') }
  const body = new URLSearchParams({ 'api.version': '1' })
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.append(k, enc(v))
  const method = opts.method ?? 'GET'
  const url = method === 'GET' ? `${base}/json-api/${fn}?${body}` : `${base}/json-api/${fn}`
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `whm ${cfg.username ?? 'root'}:${cfg.token}`, Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      body: method === 'POST' ? body.toString() : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (e) {
    const name = (e as Error).name
    if (name === 'TimeoutError' || name === 'AbortError') throw new WhmCallError(fn, `Sem resposta do WHM em ${Math.round((opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000)} s.`, 'timeout')
    const m = String((e as Error & { cause?: { code?: string; message?: string } }).cause?.code ?? (e as Error).message)
    if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(m)) throw new WhmCallError(fn, 'Certificado TLS do servidor WHM inválido ou não confiável.', 'network')
    throw new WhmCallError(fn, `Erro de rede: ${scrub(m)}`, 'network')
  }
  if (res.status === 401 || res.status === 403) throw new WhmCallError(fn, 'Token WHM inválido ou sem privilégios para esta função.', 'auth', res.status)
  if (!res.ok) throw new WhmCallError(fn, `O WHM respondeu HTTP ${res.status}.`, 'http', res.status)
  let data: any // eslint-disable-line @typescript-eslint/no-explicit-any
  try { data = await res.json() } catch { throw new WhmCallError(fn, 'Resposta do WHM não é JSON.', 'parse', res.status) }
  // WHM API 1: metadata.result 1 = sucesso; 0 = recusa (metadata.reason explica)
  if (!data?.metadata || Number(data.metadata.result) !== 1) throw new WhmCallError(fn, `WHM recusou ${fn}: ${scrub(data?.metadata?.reason ?? 'sem motivo')}`, 'metadata', res.status)
  return data
}

const num = (v: unknown): number | null => { if (v === null || v === undefined || v === '' || /unlimited/i.test(String(v))) return null; const n = parseFloat(String(v)); return Number.isFinite(n) ? n : null }
/** «10240M», «10G», «unlimited» → MB (null = ilimitado/desconhecido). */
export function toMb(v: unknown): number | null {
  if (v === null || v === undefined || /unlimited/i.test(String(v))) return null
  const s = String(v).trim(), n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  if (/g/i.test(s)) return Math.round(n * 1024)
  if (/t/i.test(s)) return Math.round(n * 1024 * 1024)
  return Math.round(n)
}

export interface WhmAcct { user: string; domain: string; owner: string; plan: string; suspended: boolean; diskusedMb: number | null; disklimitMb: number | null; email: string }
const mapAcct = (a: any): WhmAcct => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
  user: String(a.user ?? ''), domain: String(a.domain ?? ''), owner: String(a.owner ?? 'root'), plan: String(a.plan ?? ''),
  suspended: a.suspended === 1 || a.suspended === '1' || a.suspended === true, diskusedMb: toMb(a.diskused), disklimitMb: toMb(a.disklimit), email: String(a.email ?? ''),
})

// ── Leitura ──
export const whmVersion = async (cfg: WHMConfig) => String((await whmCall(cfg, 'version')).data?.version ?? '')
export async function listAllAccounts(cfg: WHMConfig): Promise<WhmAcct[]> { return ((await whmCall(cfg, 'listaccts')).data?.acct ?? []).map(mapAcct) }
export async function listAccountsByOwner(cfg: WHMConfig, owner: string): Promise<WhmAcct[]> {
  return ((await whmCall(cfg, 'listaccts', { searchtype: 'owner', search: owner, searchmethod: 'exact' })).data?.acct ?? []).map(mapAcct).filter((a: WhmAcct) => a.owner === owner)
}
export async function findAccountByDomain(cfg: WHMConfig, domain: string): Promise<WhmAcct | null> {
  const list: WhmAcct[] = ((await whmCall(cfg, 'listaccts', { searchtype: 'domain', search: domain, searchmethod: 'exact' })).data?.acct ?? []).map(mapAcct)
  return list.find(a => a.domain.toLowerCase() === domain.toLowerCase()) ?? null
}
/** accountsummary: null se a conta não existir (o WHM responde result=0 «does not exist»). */
export async function accountSummary(cfg: WHMConfig, user: string): Promise<WhmAcct | null> {
  try { const a = (await whmCall(cfg, 'accountsummary', { user })).data?.acct?.[0]; return a ? mapAcct(a) : null }
  catch (e) { if (e instanceof WhmCallError && e.kind === 'metadata' && /does not exist|não existe|no such/i.test(e.message)) return null; throw e }
}
/** verify_new_username: true se o nome pode ser usado numa conta nova. */
export async function usernameAvailable(cfg: WHMConfig, user: string): Promise<{ ok: boolean; reason?: string }> {
  try { await whmCall(cfg, 'verify_new_username', { user }); return { ok: true } }
  catch (e) { if (e instanceof WhmCallError && e.kind === 'metadata') return { ok: false, reason: e.message }; throw e }
}
export async function listResellers(cfg: WHMConfig): Promise<string[]> {
  const r = (await whmCall(cfg, 'listresellers')).data?.reseller
  return Array.isArray(r) ? r.map(String) : []
}
export interface AcctCounts { accounts: number; active: number; suspended: number; limit: number | null }
export async function acctCounts(cfg: WHMConfig, user: string): Promise<AcctCounts> {
  const r = (await whmCall(cfg, 'acctcounts', { user })).data?.reseller ?? {}
  return { accounts: Number(r.account ?? 0), active: Number(r.active ?? 0), suspended: Number(r.suspended ?? 0), limit: num(r.limit) }
}
export interface ResellerStats { diskUsedMb: number | null; diskAllocMb: number | null; diskLimitMb: number | null; bwUsedMb: number | null; bwAllocMb: number | null; bwLimitMb: number | null; accounts: WhmAcct[] }
export async function resellerStats(cfg: WHMConfig, user: string): Promise<ResellerStats> {
  const r = (await whmCall(cfg, 'resellerstats', { user })).data?.reseller ?? {}
  return {
    diskUsedMb: num(r.diskused), diskAllocMb: num(r.totaldiskalloc), diskLimitMb: num(r.diskquota),
    bwUsedMb: num(r.totalbwused), bwAllocMb: num(r.totalbwalloc), bwLimitMb: num(r.bandwidthlimit),
    accounts: (Array.isArray(r.acct) ? r.acct : []).map(mapAcct),
  }
}
export async function listAcls(cfg: WHMConfig): Promise<{ name: string; privileges: string[] }[]> {
  const acl = (await whmCall(cfg, 'listacls')).data?.acl
  if (!Array.isArray(acl)) return []
  return acl.map((a: { name?: string; privileges?: Record<string, unknown> }) => ({ name: String(a.name ?? ''), privileges: Object.entries(a.privileges ?? {}).filter(([, v]) => Number(v) === 1).map(([k]) => k).sort() }))
}
export async function getPkgInfo(cfg: WHMConfig, pkg: string): Promise<Record<string, unknown> | null> {
  try { return (await whmCall(cfg, 'getpkginfo', { pkg })).data?.pkg ?? null }
  catch (e) { if (e instanceof WhmCallError && e.kind === 'metadata') return null; throw e }
}

// ── Escrita (só o motor de aprovisionamento e as acções administrativas chamam estas funções) ──
/** createacct da conta principal: sem senha (o WHM gera uma; o acesso é por sessão temporária). */
export async function createMainAccount(cfg: WHMConfig, p: { username: string; domain: string; plan: string; contactemail: string; quotaMb: number }) {
  return whmCall(cfg, 'createacct', { username: p.username, domain: p.domain, plan: p.plan, contactemail: p.contactemail, quota: p.quotaMb, reseller: 0 }, { method: 'POST' })
}
/** setupreseller: concede o estatuto de revendedor; makeowner=0 mantém o dono actual (root), como no laboratório. */
export const setupReseller = (cfg: WHMConfig, user: string) => whmCall(cfg, 'setupreseller', { user, makeowner: 0 }, { method: 'POST' })
export const setAcls = (cfg: WHMConfig, user: string, acllist: string) => whmCall(cfg, 'setacls', { reseller: user, acllist }, { method: 'POST' })
/** Limites de contas, espaço e tráfego; overselling de espaço e tráfego desactivado; limites por pacote activos. */
export const setResellerLimits = (cfg: WHMConfig, user: string, l: { accounts: number; diskMb: number; bwMb: number }) => whmCall(cfg, 'setresellerlimits', {
  user, enable_account_limit: 1, account_limit: l.accounts,
  enable_resource_limits: 1, diskspace_limit: l.diskMb, bandwidth_limit: l.bwMb,
  enable_overselling: 0, enable_overselling_bandwidth: 0, enable_overselling_diskspace: 0,
  enable_package_limits: 1, enable_package_limit_numbers: 0,
}, { method: 'POST' })
export const setResellerPackageLimit = (cfg: WHMConfig, user: string, pkg: string, allowed: boolean) =>
  whmCall(cfg, 'setresellerpackagelimit', { user, package: pkg, allowed: allowed ? 1 : 0, no_limit: 1 }, { method: 'POST' })
export const suspendReseller = (cfg: WHMConfig, user: string, reason: string) => whmCall(cfg, 'suspendreseller', { user, reason: reason.slice(0, 200), disallow: 1 }, { method: 'POST' })
export const unsuspendReseller = (cfg: WHMConfig, user: string) => whmCall(cfg, 'unsuspendreseller', { user }, { method: 'POST' })
/** Sessão temporária (create_user_session): WHM do revendedor (whostmgrd) ou cPanel da conta (cpaneld). */
export async function userSession(cfg: WHMConfig, user: string, service: 'whostmgrd' | 'cpaneld'): Promise<{ url: string; expires: number }> {
  const d = (await whmCall(cfg, 'create_user_session', { user, service }, { method: 'POST' })).data
  if (!d?.url) throw new WhmCallError('create_user_session', 'O WHM não devolveu o endereço da sessão.', 'parse')
  return { url: String(d.url), expires: Number(d.expires ?? 0) }
}
/** passwd por POST (a senha nunca vai no URL). */
export const changeAccountPassword = (cfg: WHMConfig, user: string, password: string) => whmCall(cfg, 'passwd', { user, password }, { method: 'POST' })
