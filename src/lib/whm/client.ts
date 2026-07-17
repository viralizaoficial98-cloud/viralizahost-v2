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
export async function createWebmailSessionForMailbox(
  config: WHMConfig,
  cpanelUsername: string,
  emailAddress: string,
): Promise<{ url: string }> {
  const { url: sessionUrl } = await createUserSession(config, cpanelUsername, 'webmaild')

  // Roundcube lives at /webmail/roundcube/ within the cPanel session path
  const rcPath = `/webmail/roundcube/?_user=${encodeURIComponent(emailAddress)}`

  // Format A: /login/?session=TOKEN  (cPanel v94+)
  if (sessionUrl.includes('/login/?') || sessionUrl.includes('/login?')) {
    const u = new URL(sessionUrl)
    u.searchParams.set('goto_uri', rcPath)
    return { url: u.toString() }
  }

  // Format B: https://server:2096/cpsessXXX/webmail/  (older)
  if (sessionUrl.includes('/cpsess')) {
    const base = sessionUrl.replace(/\/webmail\/?$/, '').replace(/\/$/, '')
    return { url: `${base}${rcPath}` }
  }

  // Fallback: return session URL as-is (opens Webmail home, no 404)
  return { url: sessionUrl }
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
