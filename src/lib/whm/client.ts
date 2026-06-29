export interface WHMConfig {
  url: string
  token: string
  username?: string
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
  return (data.data?.acct ?? []).map((a: any) => ({
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
