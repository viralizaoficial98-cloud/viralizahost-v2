import 'server-only'

// Cliente da API Hostinger para VPS (especificação OpenAPI oficial 3.7.0 — ver docs/hostinger-vps-api.md).
// Base https://developers.hostinger.com · Authorization: Bearer <token>. O token nunca é devolvido, registado
// nem incluído em mensagens de erro. A ÚNICA chamada com custo é purchase(); só vps-provisioning.ts a usa.

export const HOSTINGER_API = 'https://developers.hostinger.com'

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface VpsCatalogPrice { id: string; name?: string; currency: string; price: number; first_period_price?: number | null; period: number; period_unit: string }
export interface VpsCatalogItem { id: string; name: string; category: string; metadata?: Record<string, unknown> | null; prices: VpsCatalogPrice[] }
export interface DataCenter { id: number; name?: string | null; location?: string | null; city?: string | null; continent?: string | null }
export interface Template { id: number; name: string; description?: string | null }
export interface VirtualMachine {
  id: number; subscription_id?: string | null; data_center_id?: number | null; plan?: string | null; hostname?: string; state?: string
  cpus?: number; memory?: number; disk?: number; bandwidth?: number; ipv4?: { id?: number; address: string }[] | null; created_at?: string
}
export interface PurchaseRequest {
  item_id: string; payment_method_id?: number
  setup: { template_id: number; data_center_id: number; hostname?: string }
}
export type PurchaseOutcome =
  | { kind: 'ok'; orderId: string | null; subscriptionId: string | null; orderStatus: string | null; vm: VirtualMachine | null; total: number | null; currency: string | null }
  | { kind: 'processing'; orderId: string | null; subscriptionId: string | null; message: string | null }
  | { kind: 'refused'; status: number; message: string }       // a Hostinger recusou: nada foi comprado
  | { kind: 'unknown'; message: string }                       // sem resposta conclusiva: NÃO repetir sem conciliar

export class VpsApiError extends Error { constructor(message: string, public status: number) { super(message) } }
const safe = (s: unknown) => String(s ?? '').replace(/Bearer\s+\S+/gi, 'Bearer [oculto]').replace(/https?:\/\/\S+/g, '[url]').slice(0, 300)

export function hostingerVpsClient({ token, baseUrl = HOSTINGER_API, timeoutMs = 20000, purchaseTimeoutMs = 30000 }: { token: string; baseUrl?: string; timeoutMs?: number; purchaseTimeoutMs?: number }) {
  const base = baseUrl.replace(/\/+$/, '')
  async function call(method: string, path: string, body?: unknown, timeout = timeoutMs): Promise<{ status: number; json: any }> {
    const res = await fetch(`${base}${path}`, {
      method, cache: 'no-store', signal: AbortSignal.timeout(timeout),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: res.status, json: await res.json().catch(() => ({})) }
  }
  const read = async (path: string) => {
    let r
    try { r = await call('GET', path) } catch (e) { throw new VpsApiError((e as Error).name === 'TimeoutError' ? 'A Hostinger não respondeu dentro do tempo limite.' : 'Ligação à API da Hostinger falhou.', 0) }
    if (r.status === 401) throw new VpsApiError('Token recusado pela Hostinger (401).', 401)
    if (r.status < 200 || r.status >= 300) throw new VpsApiError(safe(r.json?.error ?? r.json?.message ?? `HTTP ${r.status}`), r.status)
    return r.json
  }
  const list = <T>(j: any): T[] => (Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [])
  return {
    async catalog(): Promise<VpsCatalogItem[]> { return list<VpsCatalogItem>(await read('/api/billing/v1/catalog?category=VPS')) },
    async dataCenters(): Promise<DataCenter[]> { return list<DataCenter>(await read('/api/vps/v1/data-centers')) },
    async templates(): Promise<Template[]> { return list<Template>(await read('/api/vps/v1/templates')) },
    async paymentMethods(): Promise<{ id: number; name?: string; identifier?: string; is_default?: boolean; is_expired?: boolean; is_suspended?: boolean }[]> { return list(await read('/api/billing/v1/payment-methods')) },
    /** Todas as VMs da conta (percorre as páginas; leitura). */
    async virtualMachines(): Promise<VirtualMachine[]> {
      const out: VirtualMachine[] = []
      for (let page = 1; page <= 20; page++) {
        const j = await read(`/api/vps/v1/virtual-machines${page > 1 ? `?page=${page}` : ''}`)
        const items = list<VirtualMachine>(j)
        out.push(...items)
        if (items.length < 50 || !j?.meta || (j.meta.current_page ?? page) >= (j.meta.last_page ?? page)) break
      }
      return out
    },
    async virtualMachine(id: number | string): Promise<VirtualMachine | null> {
      let r
      try { r = await call('GET', `/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}`) } catch { throw new VpsApiError('Ligação à API da Hostinger falhou.', 0) }
      if (r.status === 404) return null
      if (r.status < 200 || r.status >= 300) throw new VpsApiError(safe(r.json?.error ?? r.json?.message ?? `HTTP ${r.status}`), r.status)
      return (r.json?.data ?? r.json) as VirtualMachine
    },
    /** COMPRA (debita o método de pagamento da conta Hostinger). Sem idempotência na API: nunca repetir sem conciliar. */
    async purchase(req: PurchaseRequest): Promise<PurchaseOutcome> {
      let r
      try { r = await call('POST', '/api/vps/v1/virtual-machines', req, purchaseTimeoutMs) } catch (e) {
        return { kind: 'unknown', message: (e as Error).name === 'TimeoutError' ? 'Sem resposta da Hostinger dentro do tempo limite.' : 'Ligação interrompida durante a compra.' }
      }
      const j = r.json ?? {}
      if (r.status === 200 || r.status === 201) {
        const o = j.order ?? j.data?.order ?? {}
        const vm = (j.virtual_machine ?? j.data?.virtual_machine ?? null) as VirtualMachine | null
        return { kind: 'ok', orderId: o.id != null ? String(o.id) : null, subscriptionId: o.subscription_id ?? vm?.subscription_id ?? null, orderStatus: o.status ?? null, vm, total: o.total ?? null, currency: o.currency ?? null }
      }
      if (r.status === 202) return { kind: 'processing', orderId: j.id != null ? String(j.id) : null, subscriptionId: j.subscription_id ?? null, message: safe(j.message) || null }
      if (r.status === 401 || r.status === 422 || r.status === 400 || r.status === 403) return { kind: 'refused', status: r.status, message: safe(j.error ?? j.message ?? `HTTP ${r.status}`) }
      return { kind: 'unknown', message: `Resposta inconclusiva da Hostinger (HTTP ${r.status}).` }
    },
    /** Conclui a configuração de uma VM já paga no estado «initial» (sem nova compra). */
    async setup(id: number | string, setup: PurchaseRequest['setup']): Promise<{ ok: boolean; status: number; message: string | null }> {
      try {
        const r = await call('POST', `/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}/setup`, setup)
        return { ok: r.status >= 200 && r.status < 300, status: r.status, message: r.status >= 300 ? safe(r.json?.error ?? r.json?.message) : null }
      } catch { return { ok: false, status: 0, message: 'Ligação interrompida durante a configuração.' } }
    },
  }
}
export type HostingerVpsClient = ReturnType<typeof hostingerVpsClient>

/** Especificações do produto a partir dos metadados do catálogo (chaves não documentadas: tenta as habituais). */
export function specsFromMetadata(meta: Record<string, unknown> | null | undefined) {
  if (!meta || typeof meta !== 'object') return null
  const num = (...keys: string[]) => { for (const k of keys) { const v = Number((meta as any)[k]); if (Number.isFinite(v) && v > 0) return v } return null }
  const cpus = num('cpus', 'cpu', 'vcpu', 'vcpus', 'cores')
  const memMb = num('memory', 'ram', 'memory_mb', 'ram_mb')
  const diskMb = num('disk', 'disk_space', 'storage', 'disk_mb')
  const bwMb = num('bandwidth', 'traffic', 'bandwidth_mb')
  if (!cpus && !memMb && !diskMb && !bwMb) return null
  // Os campos da VM vêm em MB; nos metadados assume-se o mesmo quando o valor é grande (>= 512)
  const gb = (v: number | null) => v == null ? null : v >= 512 ? Math.round(v / 1024) : v
  return { vcpu: cpus, ramGb: gb(memMb), diskGb: gb(diskMb), trafficGb: gb(bwMb), trafficUnlimited: bwMb == null ? null : false }
}

/** Especificações reais de uma VM (MB → GB) para comparar com o anunciado. */
export const specsFromVm = (vm: VirtualMachine) => ({
  vcpu: vm.cpus ?? null, ramGb: vm.memory ? Math.round(vm.memory / 1024) : null, diskGb: vm.disk ? Math.round(vm.disk / 1024) : null,
  trafficGb: vm.bandwidth ? Math.round(vm.bandwidth / 1024) : null, trafficUnlimited: vm.bandwidth ? false : null,
})
