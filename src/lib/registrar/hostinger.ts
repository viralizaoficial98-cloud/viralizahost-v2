import 'server-only'
import { RegistrarTimeout, type CheckResult, type RegistrarAdapter } from './types'

// Cliente da API pública da Hostinger (domínios e facturação).
// Fonte: SDK oficial github.com/hostinger/api-python-sdk (docs/DomainsPortfolioApi.md,
// DomainsAvailabilityApi.md, DomainsWHOISApi.md, BillingCatalogApi.md, BillingPaymentMethodsApi.md).
//   Base: https://developers.hostinger.com · Autenticação: Authorization: Bearer <token do hPanel>
// O token nunca sai desta função: não é devolvido, nem registado, nem incluído em mensagens de erro.
// Este cliente NÃO compra nada por si: a compra (purchase) e a conclusão (setup) só são chamadas
// pelo fluxo autorizado por um administrador (hostinger-flow.ts).

export const HOSTINGER_API = 'https://developers.hostinger.com'

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface HostingerResponse<T = any> { status: number; json: T }

export interface CatalogPrice { id: string; name?: string; currency: string; price: number; first_period_price?: number | null; period: number; period_unit: string }
export interface CatalogItem { id: string; name: string; category: string; prices: CatalogPrice[] }
export interface PaymentMethod { id: number; name?: string; identifier?: string; payment_method?: string; is_default?: boolean; is_expired?: boolean; is_suspended?: boolean }
export interface PortfolioDomain { id?: number; domain: string | null; type?: string; status?: string; created_at?: string; expires_at?: string | null; verification?: { type?: string } | null }
export interface DomainDetails { domain?: string; status?: string; message?: string; registered_at?: string | null; expires_at?: string | null; name_servers?: Record<string, string | null> | string[] | null; contact_verification?: unknown }
export interface Order { id: number; subscription_id?: string; status?: string; currency?: string; subtotal?: number; total?: number }

export class HostingerError extends Error {
  constructor(message: string, public status: number, public errors: Record<string, unknown> | null = null) { super(message) }
}

const safe = (s: unknown) => String(s ?? '').replace(/Bearer\s+\S+/gi, 'Bearer [oculto]').replace(/https?:\/\/\S+/g, '[url]').slice(0, 400)

export function hostingerClient({ token, baseUrl = HOSTINGER_API, timeoutMs = 15000 }: { token: string; baseUrl?: string; timeoutMs?: number }) {
  const base = baseUrl.replace(/\/+$/, '')
  async function call<T = any>(method: string, path: string, body?: unknown, timeout = timeoutMs): Promise<HostingerResponse<T>> {
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeout),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({})) as T
      return { status: res.status, json }
    } catch (e) {
      if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') throw new RegistrarTimeout('A Hostinger não respondeu dentro do tempo limite.')
      throw new HostingerError('Ligação à API da Hostinger falhou.', 0)
    }
  }
  /** Mensagem legível de um erro da API (422 lista os campos em errors.*). */
  const errorOf = (r: HostingerResponse): HostingerError => {
    const j = (r.json ?? {}) as any
    if (r.status === 401) return new HostingerError('Token recusado pela Hostinger (401).', 401)
    const msg = safe(j.message ?? j.error ?? `HTTP ${r.status}`)
    return new HostingerError(msg, r.status, j.errors && typeof j.errors === 'object' ? j.errors : null)
  }
  const ok = <T>(r: HostingerResponse<T>) => { if (r.status < 200 || r.status >= 300) throw errorOf(r); return r.json }
  const list = <T>(j: any): T[] => (Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [])

  return {
    errorOf,
    /** Leitura: lista de domínios da conta (GET /api/domains/v1/portfolio). */
    async portfolio(): Promise<PortfolioDomain[]> { return list<PortfolioDomain>(ok(await call('GET', '/api/domains/v1/portfolio'))) },
    /** Leitura: detalhe de um domínio já registado. 404 = ainda não registado (ou não pertence à conta). */
    async domain(domain: string): Promise<DomainDetails | null> {
      const r = await call<DomainDetails>('GET', `/api/domains/v1/portfolio/${encodeURIComponent(domain)}`)
      if (r.status === 404) return null
      const j = ok(r) as any
      return (j?.data ?? j) as DomainDetails
    },
    /** Leitura: disponibilidade (POST /api/domains/v1/availability; não cria nada; limite 90/min). */
    async availability(name: string, tld: string): Promise<{ domain: string | null; is_available?: boolean; is_premium?: boolean; restriction?: string | null }[]> {
      return list(ok(await call('POST', '/api/domains/v1/availability', { domain: name, tlds: [tld.replace(/^\./, '')], with_alternatives: false })))
    },
    /** Leitura: catálogo (preços em cêntimos). name aceita «*», ex.: «.COM*». */
    async catalog(name?: string): Promise<CatalogItem[]> {
      return list<CatalogItem>(ok(await call('GET', `/api/billing/v1/catalog${name ? `?name=${encodeURIComponent(name)}` : ''}`)))
    },
    /** Leitura: métodos de pagamento da conta (o cartão fica na Hostinger; só se lê o rótulo). */
    async paymentMethods(): Promise<PaymentMethod[]> { return list<PaymentMethod>(ok(await call('GET', '/api/billing/v1/payment-methods'))) },
    async whoisProfiles(tld: string): Promise<{ id: number; tld?: string; country?: string; entity_type?: string; is_default?: boolean; whois_details?: Record<string, unknown> }[]> {
      return list(ok(await call('GET', `/api/domains/v1/whois?tld=${encodeURIComponent(tld.replace(/^\./, ''))}`)))
    },
    /** Escrita (sem custo): cria um perfil WHOIS do titular. */
    async createWhois(input: { tld: string; country: string; entity_type: string; whois_details: Record<string, string>; tld_details?: Record<string, unknown> }) {
      const r = await call('POST', '/api/domains/v1/whois', { ...input, tld: input.tld.replace(/^\./, '') })
      const j = ok(r) as any
      return (j?.data ?? j) as { id: number }
    },
    /** COMPRA (pode debitar o método de pagamento da conta Hostinger). 200 = encomenda; 202 = pagamento em processamento. */
    async purchase(input: { domain: string; item_id: string; payment_method_id?: number; domain_contacts: { owner_id: number; admin_id: number; billing_id: number; tech_id: number }; additional_details?: Record<string, unknown> }) {
      return call<Order>('POST', '/api/domains/v1/portfolio', input)
    },
    /** Conclui o registo de um domínio JÁ PAGO e a aguardar configuração (sem nova encomenda nem pagamento). */
    async setup(domain: string, input: { domain_contacts?: { owner_id: number; admin_id: number; billing_id: number; tech_id: number }; additional_details?: Record<string, unknown> }) {
      return call('POST', `/api/domains/v1/portfolio/${encodeURIComponent(domain)}/setup`, input)
    },
    /** Nameservers (ns1 e ns2 obrigatórios). */
    async setNameservers(domain: string, ns: string[]) {
      const body: Record<string, string> = { ns1: ns[0], ns2: ns[1] }
      if (ns[2]) body.ns3 = ns[2]
      if (ns[3]) body.ns4 = ns[3]
      return call('PUT', `/api/domains/v1/portfolio/${encodeURIComponent(domain)}/nameservers`, body)
    },
  }
}
export type HostingerClient = ReturnType<typeof hostingerClient>

/**
 * Adaptador para o resto da plataforma (pesquisa de disponibilidade e «Testar ligação»).
 * register/renew/transfer recusam: com a Hostinger, cada compra exige a autorização explícita
 * de um administrador em Encomendas → «Registar na Hostinger».
 */
export function hostingerAdapter(client: HostingerClient): RegistrarAdapter {
  const refuse = async () => ({ outcome: 'failed' as const, message: 'Com a Hostinger, o registo exige autorização do administrador na encomenda.' })
  return {
    async testConnection() {
      // Só leituras: lista de domínios e métodos de pagamento. Nunca compra.
      try {
        const domains = await client.portfolio()
        let pm = ''
        try {
          const methods = await client.paymentMethods()
          const def = methods.find(m => m.is_default)
          pm = def ? ` Método de pagamento predefinido: ${[def.name, def.identifier].filter(Boolean).join(' ')}${def.is_expired ? ' (EXPIRADO)' : ''}.` : ' Sem método de pagamento predefinido na conta.'
        } catch { pm = ' (métodos de pagamento não consultados)' }
        return { ok: true, message: `Token aceite pela Hostinger: ${domains.length} domínio(s) na conta.${pm}` }
      } catch (e) {
        if (e instanceof RegistrarTimeout) return { ok: false, message: 'A Hostinger não respondeu a tempo.' }
        const st = (e as HostingerError).status
        return { ok: false, message: st === 401 ? 'Token recusado pela Hostinger (401). Gere um novo token no hPanel.' : `Falha na leitura: ${safe((e as Error).message)}` }
      }
    },
    async check(domain: string): Promise<CheckResult> {
      const dot = domain.indexOf('.')
      try {
        const r = await client.availability(domain.slice(0, dot), domain.slice(dot + 1))
        const hit = r.find(x => (x.domain ?? '').toLowerCase() === domain) ?? (r.length === 1 ? r[0] : undefined)
        if (!hit || typeof hit.is_available !== 'boolean') return { domain, status: 'unknown', message: 'Resposta sem disponibilidade.' }
        if (hit.is_available && hit.is_premium) return { domain, status: 'unknown', message: 'Domínio premium (preço especial): revisão manual.' }
        return { domain, status: hit.is_available ? 'available' : 'unavailable' }
      } catch (e) {
        return { domain, status: 'unknown', message: e instanceof RegistrarTimeout ? 'Sem resposta.' : safe((e as Error).message) }
      }
    },
    register: refuse,
    renew: refuse,
    transfer: refuse,
    async lookup() { return { found: false, outcome: 'failed', message: 'Não aplicável: use «Consultar estado na Hostinger» na encomenda.' } },
  }
}
