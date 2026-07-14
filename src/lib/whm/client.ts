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

export async function createEmailAccount(config: WHMConfig, domain: string, email: string, password: string, quota = 500) {
  // cPanel API via WHM proxy
  const cpanelUser = domain.replace(/\./g, '_').slice(0, 8)
  const url = `${config.url.replace(/\/$/, '')}/execute/Email/add_pop`
  const res = await fetch(`${url}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&quota=${quota}&domain=${encodeURIComponent(domain)}`, {
    headers: { Authorization: `cpanel ${cpanelUser}:${config.token}` },
    cache: 'no-store',
  })
  return res.json()
}
