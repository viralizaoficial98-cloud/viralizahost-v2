import 'server-only'
import type { RegistrarAdapter, OperationResult, LookupResult } from './types'
import { RegistrarTimeout } from './types'

// Fornecedor SIMULADO — só para ensaio (modo «test»). Fala HTTP com
// scripts/mariadb/rehearsal/mock-registrar.mjs: nenhum domínio real é registado
// e nada é cobrado. Serve para validar idempotência, timeouts e repetição.

interface Opts { baseUrl: string; secret: string; timeoutMs?: number }

export function simulatedAdapter({ baseUrl, secret, timeoutMs = 8000 }: Opts): RegistrarAdapter {
  const base = baseUrl.replace(/\/+$/, '')
  async function call(method: string, path: string, body?: unknown) {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({})) as Record<string, unknown>
      return { status: res.status, json }
    } catch (e) {
      if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') throw new RegistrarTimeout()
      throw new Error('Ligação ao registrador falhou.')
    }
  }
  const asResult = (status: number, j: Record<string, unknown>): OperationResult => {
    if (status >= 500) return { outcome: 'unknown', message: `Erro do registrador (HTTP ${status}).` }
    if (status === 401 || status === 403) return { outcome: 'failed', message: 'Credenciais recusadas pelo registrador.' }
    const st = String(j.status ?? '')
    if (status < 300 && st === 'active') return { outcome: 'succeeded', providerRef: String(j.id ?? ''), providerStatus: st, message: 'Confirmado pelo registrador.' }
    if (status < 300 && ['pending', 'pending_transfer'].includes(st)) return { outcome: 'pending', providerRef: String(j.id ?? ''), providerStatus: st, message: 'Aceite; a aguardar o registo.' }
    return { outcome: 'failed', providerStatus: st || null, message: String(j.error ?? `Recusado (HTTP ${status}).`).slice(0, 300) }
  }
  return {
    async testConnection() {
      const { status, json } = await call('GET', '/v1/account')
      if (status === 200) return { ok: true, message: `Ligação ao simulador OK (conta ${String(json.account ?? '')}).`, extensions: (json.extensions as string[]) ?? [] }
      return { ok: false, message: status === 401 ? 'Credenciais recusadas.' : `HTTP ${status}` }
    },
    async check(domain) {
      const { status, json } = await call('GET', `/v1/check?domain=${encodeURIComponent(domain)}`)
      if (status !== 200) return { domain, status: 'unknown', message: `HTTP ${status}` }
      return { domain, status: json.available === true ? 'available' : json.available === false ? 'unavailable' : 'unknown' }
    },
    async register({ domain, years, clientRef, nameservers }) {
      const { status, json } = await call('POST', '/v1/domains', { domain, years, clientRef, nameservers })
      return asResult(status, json)
    },
    async renew({ domain, years, clientRef }) {
      const { status, json } = await call('POST', `/v1/domains/${encodeURIComponent(domain)}/renew`, { years, clientRef })
      return asResult(status, json)
    },
    async transfer({ domain, authCode, clientRef }) {
      const { status, json } = await call('POST', '/v1/transfers', { domain, authCode, clientRef })
      return asResult(status, json)
    },
    async lookup({ clientRef }): Promise<LookupResult> {
      const { status, json } = await call('GET', `/v1/operations/${encodeURIComponent(clientRef)}`)
      if (status === 404) return { found: false, outcome: 'failed', message: 'Operação desconhecida no registrador.' }
      if (status !== 200) return { found: true, outcome: 'unknown', message: `Estado inconclusivo (HTTP ${status}).` }
      return { found: true, ...asResult(200, json) }
    },
  }
}
