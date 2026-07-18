export interface WHMConfig {
  url: string
  token: string
  username?: string
}

export interface WHMVersionInfo {
  hostname: string
  version: string
  release: string
  build: string
}

export interface WHMTestResult {
  success: boolean
  version?: WHMVersionInfo
  accountCount?: number
  testedAt: string
  error?: string
}

/**
 * Normalise a WHM URL: ensure https, port 2087, no trailing slash.
 * Accepts: https://host:2087, http://host, host:2087, host
 */
export function normalizeWhmUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '')
  if (!u.startsWith('http')) u = `https://${u}`
  try {
    const parsed = new URL(u)
    parsed.protocol = 'https:'
    if (!parsed.port || parsed.port !== '2087') parsed.port = '2087'
    return parsed.origin // drops path, trailing slash
  } catch {
    return u
  }
}

/**
 * Test the WHM connection end-to-end:
 * 1. Calls /json-api/version  — validates URL + credentials
 * 2. Calls /json-api/listaccts — validates permissions + returns account count
 *
 * Returns a structured result (never throws).
 */
export async function testConnection(config: WHMConfig, timeoutMs = 15_000): Promise<WHMTestResult> {
  const testedAt = new Date().toISOString()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const baseUrl = normalizeWhmUrl(config.url)
  const authHeader = `whm ${config.username ?? 'root'}:${config.token}`

  try {
    // ── Step 1: version ──────────────────────────────────────────────────────
    const vRes = await fetch(`${baseUrl}/json-api/version?api.version=1`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (vRes.status === 401 || vRes.status === 403) {
      clearTimeout(timer)
      return { success: false, testedAt, error: 'API Token inválido ou sem privilégios suficientes.' }
    }
    if (!vRes.ok) {
      clearTimeout(timer)
      return { success: false, testedAt, error: `O servidor respondeu com o estado HTTP ${vRes.status}. Verifique a URL e porta 2087.` }
    }

    const vData = await vRes.json()
    if (vData?.metadata?.result === 0) {
      clearTimeout(timer)
      return { success: false, testedAt, error: vData.metadata?.reason ?? 'O WHM recusou a autenticação.' }
    }

    const version: WHMVersionInfo = {
      hostname: vData?.data?.version?.hostname ?? new URL(baseUrl).hostname,
      version:  vData?.data?.version?.version  ?? 'N/A',
      release:  vData?.data?.version?.release  ?? 'N/A',
      build:    vData?.data?.version?.build     ?? 'N/A',
    }

    // ── Step 2: listaccts (permissions + account count) ──────────────────────
    let accountCount: number | undefined
    try {
      const lRes = await fetch(
        `${baseUrl}/json-api/listaccts?api.version=1&api.columns.enable=user`,
        {
          headers: { Authorization: authHeader, Accept: 'application/json' },
          cache: 'no-store',
          // separate abort — don't block success on listaccts timeout
        }
      )
      if (lRes.ok) {
        const lData = await lRes.json()
        accountCount = Array.isArray(lData?.data?.acct) ? lData.data.acct.length : undefined
      }
    } catch {
      // listaccts failure is non-fatal — connection is still valid
    }

    clearTimeout(timer)
    return { success: true, version, accountCount, testedAt }

  } catch (err: unknown) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : String(err)
    const name = err instanceof Error ? err.name : ''

    if (name === 'AbortError') {
      return { success: false, testedAt, error: 'A ligação excedeu o tempo limite (15 s). Verifique a URL e se a porta 2087 está acessível.' }
    }
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      return { success: false, testedAt, error: 'Hostname não encontrado. Verifique o endereço do servidor WHM.' }
    }
    if (msg.includes('ECONNREFUSED')) {
      return { success: false, testedAt, error: 'Ligação recusada. Verifique se a porta 2087 está aberta no servidor.' }
    }
    if (msg.includes('ETIMEDOUT') || msg.includes('TIMEOUT')) {
      return { success: false, testedAt, error: 'Tempo limite excedido. O servidor não respondeu a tempo.' }
    }
    if (msg.toLowerCase().includes('cert') || msg.toLowerCase().includes('ssl')) {
      return { success: false, testedAt, error: 'Certificado SSL inválido ou não confiável no servidor WHM.' }
    }
    return { success: false, testedAt, error: `Erro de rede: ${msg}` }
  }
}

export interface WHMAccount {
  user: string
  domain: string
  email: string
  plan: string
  diskused: string
  disklimit: string
  ip: string
  suspended: boolean
  maxpop: string
  maxsub: string
  maxsql: string
  phpversion: string
}

export interface WHMCreateAccountParams {
  username: string
  domain: string
  password: string
  plan: string
  email: string
  quota?: number
}

async function whmRequest(config: WHMConfig, fn: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${config.url.replace(/\/$/, '')}/json-api/${fn}`)
  url.searchParams.set('api.version', '1')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `whm ${config.username ?? 'root'}:${config.token}`,
      Accept: 'application/json',
    },
    // Server-side only — no client exposure
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`WHM API error: ${res.status} ${res.statusText}`)
  const data = await res.json()
  if (data.metadata?.result === 0) throw new Error(data.metadata.reason ?? 'WHM error')
  return data
}

export async function listAccounts(config: WHMConfig): Promise<WHMAccount[]> {
  const data = await whmRequest(config, 'listaccts', { searchtype: 'domain', search: '' })
  return (data.data?.acct ?? []).map((a: Record<string, unknown>) => ({
    user: a.user,
    domain: a.domain,
    email: a.email,
    plan: a.plan,
    diskused: a.diskused,
    disklimit: a.disklimit,
    ip: a.ip,
    suspended: a.suspended === 1,
    maxpop: a.maxpop,
    maxsub: a.maxsub,
    maxsql: a.maxsql,
    phpversion: a.phpversion ?? '8.2',
  }))
}

export async function getAccount(config: WHMConfig, username: string): Promise<WHMAccount | null> {
  try {
    const data = await whmRequest(config, 'accountsummary', { user: username })
    const a = data.data?.acct?.[0]
    if (!a) return null
    return {
      user: a.user, domain: a.domain, email: a.email, plan: a.plan,
      diskused: a.diskused, disklimit: a.disklimit, ip: a.ip,
      suspended: a.suspended === 1, maxpop: a.maxpop, maxsub: a.maxsub,
      maxsql: a.maxsql, phpversion: a.phpversion ?? '8.2',
    }
  } catch { return null }
}

export async function createAccount(config: WHMConfig, params: WHMCreateAccountParams) {
  return whmRequest(config, 'createacct', {
    username: params.username,
    domain: params.domain,
    password: params.password,
    plan: params.plan,
    contactemail: params.email,
    quota: params.quota ?? 10240,
  })
}

export async function suspendAccount(config: WHMConfig, username: string, reason = 'Suspended by system') {
  return whmRequest(config, 'suspendacct', { user: username, reason })
}

export async function unsuspendAccount(config: WHMConfig, username: string) {
  return whmRequest(config, 'unsuspendacct', { user: username })
}

export async function terminateAccount(config: WHMConfig, username: string) {
  return whmRequest(config, 'removeacct', { user: username })
}

export async function changePassword(config: WHMConfig, username: string, password: string) {
  return whmRequest(config, 'passwd', { user: username, password })
}

export async function getDiskUsage(config: WHMConfig, username: string) {
  const data = await whmRequest(config, 'getdiskusage', { user: username })
  return {
    used: data.data?.used ?? 0,
    limit: data.data?.limit ?? 0,
  }
}

export async function getServerLoad(config: WHMConfig) {
  const data = await whmRequest(config, 'loadavg')
  return {
    one: data.one ?? 0,
    five: data.five ?? 0,
    fifteen: data.fifteen ?? 0,
  }
}

// ── Extended account type with all WHM fields ─────────────────────────────────

export interface WHMAccountFull extends WHMAccount {
  suspendreason: string
  unix_startdate: number
  owner: string
  partition: string
  maxftp: string
  theme: string
}

export async function listAccountsFull(config: WHMConfig): Promise<WHMAccountFull[]> {
  const data = await whmRequest(config, 'listaccts', { searchtype: 'domain', search: '' })
  return (data.data?.acct ?? []).map((a: Record<string, unknown>) => ({
    user:           String(a.user         ?? ''),
    domain:         String(a.domain       ?? ''),
    email:          String(a.email        ?? ''),
    plan:           String(a.plan         ?? ''),
    diskused:       String(a.diskused     ?? '0'),
    disklimit:      String(a.disklimit    ?? 'unlimited'),
    ip:             String(a.ip           ?? ''),
    suspended:      a.suspended === 1 || a.suspended === '1' || a.suspended === true,
    maxpop:         String(a.maxpop       ?? 'unlimited'),
    maxsub:         String(a.maxsub       ?? 'unlimited'),
    maxsql:         String(a.maxsql       ?? 'unlimited'),
    phpversion:     String(a.phpversion   ?? '8.2'),
    suspendreason:  String(a.suspendreason ?? ''),
    unix_startdate: Number(a.unix_startdate ?? 0),
    owner:          String(a.owner        ?? 'root'),
    partition:      String(a.partition    ?? 'home'),
    maxftp:         String(a.maxftp       ?? 'unlimited'),
    theme:          String(a.theme        ?? ''),
  }))
}

export async function createUserSession(
  config: WHMConfig,
  cpanelUsername: string,
  service: 'cpaneld' | 'webmaild',
): Promise<{ url: string; expire: number }> {
  const data = await whmRequest(config, 'create_user_session', {
    user: cpanelUsername,
    service,
  })
  const session = data.data
  if (!session?.url) throw new Error('WHM não devolveu URL de sessão')
  return { url: String(session.url), expire: Number(session.expire ?? 3600) }
}

// ─── Webmail SSO for a specific mailbox ──────────────────────────────────────
// Uses WHM API 1 create_user_session with user=<full email address>.
// This authenticates directly as that mailbox — never as the cPanel account holder.
export async function createWebmailSessionForMailbox(
  config: WHMConfig,
  emailAddress: string,
): Promise<{ url: string }> {
  const data = await whmRequest(config, 'create_user_session', {
    user: emailAddress,
    service: 'webmaild',
  })

  const url = data.data?.url as string | undefined
  if (!url) {
    throw new Error(
      data.metadata?.reason ?? 'O WHM não devolveu uma URL de sessão para esta conta de e-mail.',
    )
  }

  return { url }
}

// ── cPanel UAPI / API 2 via WHM proxy ────────────────────────────────────────

const authHdr = (cfg: WHMConfig) => `whm ${cfg.username ?? 'root'}:${cfg.token}`

// ─── UAPI proxy (modern, port 2087) ─────────────────────────────────────────
async function cpanelUapi(
  config: WHMConfig,
  cpanelUser: string,
  module: string,
  fn: string,
  params: Record<string, string | number> = {},
  method: 'GET' | 'POST' = 'GET',
): Promise<Record<string, unknown>> {
  const baseUrl = normalizeWhmUrl(config.url)
  const endpoint = `${baseUrl}/execute/${module}/${fn}`

  // user is always a query param for the WHM proxy — even for POST
  const urlQs = new URLSearchParams({ user: cpanelUser })
  const bodyQs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))

  const fetchUrl = method === 'POST' ? `${endpoint}?${urlQs}` : `${endpoint}?${urlQs}&${bodyQs}`

  const res = await fetch(fetchUrl, {
    method,
    headers: {
      Authorization: authHdr(config),
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? bodyQs.toString() : undefined,
    cache: 'no-store',
  })

  if (res.status === 404) throw Object.assign(new Error('UAPI_404'), { code: 'UAPI_404' })
  if (!res.ok) throw new Error(`cPanel UAPI error: ${res.status} ${res.statusText}`)
  const data = await res.json() as Record<string, unknown>
  const errors = (data.errors as string[] | null | undefined)
  if (data.status === 0) throw new Error(errors?.[0] ?? 'cPanel UAPI error')
  return data
}

// ─── cPanel API 2 via WHM JSON API (fallback, compatible with all versions) ──
async function cpanelApi2(
  config: WHMConfig,
  cpanelUser: string,
  module: string,
  fn: string,
  params: Record<string, string | number> = {},
  method: 'GET' | 'POST' = 'GET',
): Promise<{ data: unknown }> {
  const baseUrl = normalizeWhmUrl(config.url)
  const base = `${baseUrl}/json-api/cpanel`

  const allParams: Record<string, string> = {
    cpanel_jsonapi_version: '2',
    cpanel_jsonapi_user:    cpanelUser,
    cpanel_jsonapi_module:  module,
    cpanel_jsonapi_func:    fn,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  }

  const qs = new URLSearchParams(allParams)
  const fetchUrl = method === 'POST' ? base : `${base}?${qs}`

  const res = await fetch(fetchUrl, {
    method,
    headers: {
      Authorization: authHdr(config),
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' ? qs.toString() : undefined,
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`cPanel API2 error: ${res.status} ${res.statusText}`)
  const raw = await res.json() as Record<string, unknown>
  const result = (raw.cpanelresult ?? raw) as Record<string, unknown>
  if (result.error) throw new Error(String(result.error))
  return { data: result.data }
}

// ─── Unified caller: UAPI → API2 fallback ───────────────────────────────────
// api2Fn: the API 2 function name when it differs from the UAPI name
async function callCpanel(
  config: WHMConfig,
  cpanelUser: string,
  module: string,
  uapiFn: string,
  params: Record<string, string | number> = {},
  method: 'GET' | 'POST' = 'GET',
  api2Fn?: string,
): Promise<{ data: unknown; source: 'uapi' | 'api2' }> {
  try {
    const data = await cpanelUapi(config, cpanelUser, module, uapiFn, params, method)
    return { data: data.data, source: 'uapi' }
  } catch (err: unknown) {
    const code = (err as Record<string, unknown>)?.code
    if (code !== 'UAPI_404') throw err
    // UAPI not available on this server — fall back to cPanel API 2
    console.warn(`[whm] UAPI /execute/${module}/${uapiFn} returned 404 — falling back to API 2`)
    const fnName = api2Fn ?? uapiFn
    const result = await cpanelApi2(config, cpanelUser, module, fnName, params, method)
    return { data: result.data, source: 'api2' }
  }
}

export interface CpanelEmailAccount {
  email: string
  login: string
  domain: string
  diskused: number
  diskquota: number
  humandiskused: string
  humandiskquota: string
  suspended_login: number
}

// ─── Human-readable byte formatter (server-side) ─────────────────────────────
function formatBytesServer(n: number, fallbackUnit: 'bytes' | 'MB' = 'bytes'): string {
  if (!isFinite(n) || n < 0) return '0 B'
  const bytes = fallbackUnit === 'MB' && n < 100_000 ? n * 1024 * 1024 : n
  if (bytes < 1024)      return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2).replace(/\.?0+$/, '')} MB`
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2).replace(/\.?0+$/, '')} GB`
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`
}

// ─── API 2 response normaliser for list_pops_with_disk ───────────────────────
function normEmailRows(rows: unknown[], source: 'uapi' | 'api2', domain: string): CpanelEmailAccount[] {
  return (rows as Record<string, unknown>[])
    .filter(r => r.login !== 'main' && r.user !== 'main')
    .map(r => {
      const login = String(r.login ?? r.user ?? '')
      const dom   = String(r.domain ?? domain)
      const used  = Number(source === 'uapi' ? (r.diskused  ?? r._diskused  ?? 0) : (r._diskused  ?? r.diskused  ?? 0))
      const quota = Number(source === 'uapi' ? (r.diskquota ?? r._diskquota ?? 0) : (r._diskquota ?? r.diskquota ?? 0))
      const unit: 'bytes' | 'MB' = source === 'uapi' ? 'bytes' : 'MB'
      return {
        email:           String(r.email ?? `${login}@${dom}`),
        login,
        domain:          dom,
        diskused:        used,
        diskquota:       quota,
        humandiskused:   String(r.humandiskused  ?? formatBytesServer(used, unit)),
        humandiskquota:  String(r.humandiskquota ?? (quota === 0 ? '∞' : formatBytesServer(quota, unit))),
        suspended_login: Number(r.suspended_login ?? 0),
      } satisfies CpanelEmailAccount
    })
}

export async function listCpanelEmails(
  config: WHMConfig,
  cpanelUser: string,
  domain: string,
): Promise<CpanelEmailAccount[]> {
  const { data, source } = await callCpanel(
    config, cpanelUser, 'Email', 'list_pops_with_disk', { domain }, 'GET', 'listpopswithdisk',
  )
  const rows = Array.isArray(data) ? data as unknown[] : []
  return normEmailRows(rows, source, domain)
}

export async function addCpanelEmail(
  config: WHMConfig,
  cpanelUser: string,
  domain: string,
  localpart: string,
  password: string,
  quotaMb = 500,
): Promise<void> {
  await callCpanel(config, cpanelUser, 'Email', 'add_pop', {
    email: localpart, domain, password, quota: quotaMb,
  }, 'POST', 'addpop')
}

export async function deleteCpanelEmail(
  config: WHMConfig,
  cpanelUser: string,
  emailAddress: string,
): Promise<void> {
  await callCpanel(config, cpanelUser, 'Email', 'delete_pop', {
    email: emailAddress,
  }, 'POST', 'delpop')
}

export async function changeCpanelEmailPassword(
  config: WHMConfig,
  cpanelUser: string,
  domain: string,
  localpart: string,
  password: string,
): Promise<void> {
  await callCpanel(config, cpanelUser, 'Email', 'passwd_pop', {
    email: localpart, domain, password,
  }, 'POST', 'passwdpop')
}

export async function changeCpanelEmailQuota(
  config: WHMConfig,
  cpanelUser: string,
  domain: string,
  localpart: string,
  quota: number,
): Promise<void> {
  await callCpanel(config, cpanelUser, 'Email', 'edit_pop_quota', {
    email: localpart, domain, quota,
  }, 'POST', 'editquota')
}

// ─── Domain listing ──────────────────────────────────────────────────────────

export interface CpanelDomainInfo {
  domain: string
  type: 'main' | 'addon' | 'parked' | 'subdomain'
  document_root?: string
  main_domain?: string
}

export async function listCpanelDomains(
  config: WHMConfig,
  cpanelUser: string,
  mainDomain: string,
): Promise<CpanelDomainInfo[]> {
  // Try DomainInfo::domains_data first (single call, all types)
  try {
    const { data } = await callCpanel(config, cpanelUser, 'DomainInfo', 'domains_data', {}, 'GET', 'domaindata')
    if (Array.isArray(data) && (data as unknown[]).length > 0) {
      return (data as Record<string, unknown>[]).map(d => {
        const raw = String(d.domain_type ?? d.type ?? '')
        const type: CpanelDomainInfo['type'] =
          raw === 'main' ? 'main' : raw === 'addon' ? 'addon' : raw === 'parked' ? 'parked' : 'subdomain'
        return {
          domain:        String(d.domain ?? ''),
          type,
          document_root: d.document_root ? String(d.document_root) : undefined,
          main_domain:   d.main_domain   ? String(d.main_domain)   : mainDomain,
        }
      }).filter(d => d.domain)
    }
  } catch { /* fall through to separate queries */ }

  // Fallback: 3 separate UAPI calls
  const results: CpanelDomainInfo[] = [{ domain: mainDomain, type: 'main' }]
  const [subRes, addonRes, parkedRes] = await Promise.allSettled([
    callCpanel(config, cpanelUser, 'SubDomain',   'listsubdomains',    {}, 'GET', 'listsubdomains'),
    callCpanel(config, cpanelUser, 'AddonDomain', 'listaddondomains',  {}, 'GET', 'listaddondomains'),
    callCpanel(config, cpanelUser, 'Park',        'list_parked_domains', {}, 'GET', 'listparkeddomains'),
  ])
  if (subRes.status === 'fulfilled') {
    for (const s of (Array.isArray(subRes.value.data) ? subRes.value.data : []) as Record<string, unknown>[]) {
      const sub  = String(s.sub ?? s.subdomain ?? s.domain ?? '')
      const root = String(s.rootdomain ?? s.domain ?? mainDomain)
      if (sub && !sub.includes('.')) results.push({ domain: `${sub}.${root}`, type: 'subdomain', main_domain: root })
      else if (sub)                  results.push({ domain: sub, type: 'subdomain', main_domain: root })
    }
  }
  if (addonRes.status === 'fulfilled') {
    for (const a of (Array.isArray(addonRes.value.data) ? addonRes.value.data : []) as Record<string, unknown>[]) {
      const domain = String(a.domain ?? a.addondomain ?? '')
      if (domain) results.push({ domain, type: 'addon', main_domain: mainDomain })
    }
  }
  if (parkedRes.status === 'fulfilled') {
    for (const p of (Array.isArray(parkedRes.value.data) ? parkedRes.value.data : []) as Record<string, unknown>[]) {
      const domain = String(p.domain ?? '')
      if (domain) results.push({ domain, type: 'parked', main_domain: mainDomain })
    }
  }
  return results
}

// ─── Database listing ─────────────────────────────────────────────────────────

export interface CpanelDatabase {
  name: string
  disk_usage_mb?: number
}

export async function listCpanelDatabases(
  config: WHMConfig,
  cpanelUser: string,
): Promise<CpanelDatabase[]> {
  try {
    const { data } = await callCpanel(config, cpanelUser, 'Mysql', 'list_databases', {}, 'GET', 'listdbs')
    const rows = Array.isArray(data) ? data : []
    return (rows as Record<string, unknown>[]).map(r => ({
      name:          String(r.database ?? r.name ?? r.db ?? ''),
      disk_usage_mb: r.disk_usage ? Math.round(Number(r.disk_usage) / (1024 * 1024)) : undefined,
    })).filter(r => r.name)
  } catch { return [] }
}

// ─── FTP account listing ──────────────────────────────────────────────────────

export interface CpanelFtpAccount {
  user: string
  homedir: string
  quota_type: string
  quota_bytes?: number
}

export async function listCpanelFtpAccounts(
  config: WHMConfig,
  cpanelUser: string,
): Promise<CpanelFtpAccount[]> {
  try {
    const { data } = await callCpanel(config, cpanelUser, 'Ftp', 'list_ftp_with_disk', {}, 'GET', 'listftpwithdisk')
    const rows = Array.isArray(data) ? data : []
    return (rows as Record<string, unknown>[])
      .filter(r => !['ftpuser', 'anonymous'].includes(String(r.user ?? '')))
      .map(r => ({
        user:        String(r.user ?? r.login ?? ''),
        homedir:     String(r.homedir ?? r.dir ?? ''),
        quota_type:  String(r.quotatype ?? r.type ?? 'unlimited'),
        quota_bytes: r.diskquota ? Number(r.diskquota) : undefined,
      }))
  } catch { return [] }
}

// ─── SSL certificate info ─────────────────────────────────────────────────────

export interface CpanelSslInfo {
  domain: string
  valid: boolean
  not_after?: string
  issuer?: string
  is_lets_encrypt?: boolean
}

export async function getCpanelSslInfo(
  config: WHMConfig,
  cpanelUser: string,
  domain: string,
): Promise<CpanelSslInfo | null> {
  try {
    const { data } = await callCpanel(
      config, cpanelUser, 'SSL', 'fetch_best_for_domain', { domain }, 'GET', 'fetchbestcert',
    )
    if (!data || typeof data !== 'object') return null
    const d = data as Record<string, unknown>
    const cert = (d.certificate ?? d) as Record<string, unknown>
    const notAfter = String(cert.not_after ?? cert.notAfter ?? '')
    const issuer   = String(cert.issuer ?? cert.issuer_organization ?? '')
    return {
      domain,
      valid:            cert.is_self_signed ? false : !!notAfter,
      not_after:        notAfter || undefined,
      issuer:           issuer || undefined,
      is_lets_encrypt:  issuer.toLowerCase().includes("let's encrypt") ||
                        issuer.toLowerCase().includes('letsencrypt'),
    }
  } catch { return null }
}

// ─── Cron jobs ────────────────────────────────────────────────────────────────

export async function countCpanelCrons(
  config: WHMConfig,
  cpanelUser: string,
): Promise<number> {
  try {
    const { data } = await callCpanel(config, cpanelUser, 'Cron', 'list_cron', {}, 'GET', 'fetchcron')
    return Array.isArray(data) ? data.length : 0
  } catch { return 0 }
}

export async function createEmailAccount(config: WHMConfig, domain: string, email: string, password: string, quota = 500) {
  // Legacy — kept for compatibility
  const cpanelUser = domain.replace(/\./g, '_').slice(0, 8)
  const url = `${normalizeWhmUrl(config.url)}/execute/Email/add_pop`
  const qs = new URLSearchParams({ user: cpanelUser, email, password, quota: String(quota), domain })
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `whm ${config.username ?? 'root'}:${config.token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: qs.toString(),
    cache: 'no-store',
  })
  return res.json()
}
