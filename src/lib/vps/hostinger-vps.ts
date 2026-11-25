import 'server-only'
import { protectedVmInRequest } from './protected'

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
  cpus?: number; memory?: number; disk?: number; bandwidth?: number; ipv4?: { id?: number; address: string }[] | null
  ipv6?: { id?: number; address: string }[] | null; template?: { id?: number; name?: string } | null; created_at?: string
}
/** Especificação 3.9.2: métricas por série { unit, usage: { <unix>: valor } }. */
export interface VpsMetrics { [serie: string]: { unit?: string; usage?: Record<string, number> } }
export interface VpsBackup { id: number; size?: number; restore_time?: number; location?: string; created_at?: string }
export interface VpsSnapshot { id: number; restore_time?: number; created_at?: string; expires_at?: string }
export interface FirewallRule { id: number; action: 'accept' | 'drop'; protocol: string; port: string; source: string; source_detail: string }
export interface Firewall { id: number; name: string; is_synced?: boolean; rules?: FirewallRule[]; created_at?: string }
export interface Subscription {
  id: string; name?: string; status?: string; billing_period?: number; billing_period_unit?: string; currency_code?: string
  total_price?: number; renewal_price?: number; is_auto_renewed?: boolean; created_at?: string; expires_at?: string | null; next_billing_at?: string | null
}
export interface PurchaseRequest {
  item_id: string; payment_method_id?: number
  setup: { template_id: number; data_center_id: number; hostname?: string; ssh_keys?: string[]; enable_backups?: boolean }
}
export type PurchaseOutcome =
  | { kind: 'ok'; orderId: string | null; subscriptionId: string | null; orderStatus: string | null; vm: VirtualMachine | null; total: number | null; currency: string | null }
  | { kind: 'processing'; orderId: string | null; subscriptionId: string | null; message: string | null }
  | { kind: 'refused'; status: number; message: string }       // a Hostinger recusou: nada foi comprado
  | { kind: 'unknown'; message: string }                       // sem resposta conclusiva: NÃO repetir sem conciliar

export interface VpsAction { id: number; name?: string; state: 'success' | 'error' | 'delayed' | 'sent' | 'created' | 'started' | 'cancelled' | string; created_at?: string; updated_at?: string }
export const ACTION_PENDING = ['created', 'sent', 'started', 'delayed']
/** Resultado de uma operação de gestão (start/stop/restart/recreate/root-password/ssh-keys). */
export type ManageOutcome = { ok: true; action: VpsAction | null } | { ok: false; status: number; message: string }

export class VpsApiError extends Error { constructor(message: string, public status: number) { super(message) } }
const safe = (s: unknown) => String(s ?? '').replace(/Bearer\s+\S+/gi, 'Bearer [oculto]').replace(/https?:\/\/\S+/g, '[url]').slice(0, 300)

export function hostingerVpsClient({ token, baseUrl = HOSTINGER_API, timeoutMs = 20000, purchaseTimeoutMs = 30000 }: { token: string; baseUrl?: string; timeoutMs?: number; purchaseTimeoutMs?: number }) {
  const base = baseUrl.replace(/\/+$/, '')
  async function call(method: string, path: string, body?: unknown, timeout = timeoutMs): Promise<{ status: number; json: any }> {
    // VM de produção protegida: o pedido de alteração é recusado aqui, sem contactar a Hostinger
    const blocked = protectedVmInRequest(method, path)
    if (blocked) return { status: 403, json: { error: `A VM ${blocked} é infraestrutura protegida da ViralizaHost: operação recusada.` } }
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
    /** Histórico de acções da VM (mais recentes primeiro). */
    async actions(id: number | string): Promise<VpsAction[]> {
      const items = list<VpsAction>(await read(`/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}/actions`))
      return items.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')) || b.id - a.id)
    },
    async action(id: number | string, actionId: number | string): Promise<VpsAction | null> {
      try { const j = await read(`/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}/actions/${encodeURIComponent(String(actionId))}`); return (j?.data ?? j) as VpsAction } catch { return null }
    },
    /** Gestão (sem custo): ligar, desligar, reiniciar, reinstalar, palavra-passe root, chaves SSH. */
    async manage(id: number | string, op: 'start' | 'stop' | 'restart' | 'recreate' | 'root-password' | 'ssh-keys-add' | 'ssh-keys-remove', body?: Record<string, unknown>): Promise<ManageOutcome> {
      const vm = `/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}`
      const [method, path] = op === 'root-password' ? ['PUT', `${vm}/root-password`] : op === 'ssh-keys-add' ? ['POST', `${vm}/ssh-keys`] : op === 'ssh-keys-remove' ? ['DELETE', `${vm}/ssh-keys`] : ['POST', `${vm}/${op}`]
      let r
      try { r = await call(method, path, body) } catch (e) { return { ok: false, status: 0, message: (e as Error).name === 'TimeoutError' ? 'A Hostinger não respondeu dentro do tempo limite.' : 'Ligação à Hostinger falhou.' } }
      if (r.status >= 200 && r.status < 300) { const a = r.json?.data ?? r.json; return { ok: true, action: a && typeof a === 'object' && 'state' in a ? a as VpsAction : null } }
      // Nunca devolver o corpo enviado (pode conter a palavra-passe): só a mensagem do fornecedor, higienizada
      return { ok: false, status: r.status, message: safe(r.json?.error ?? r.json?.message ?? `HTTP ${r.status}`) }
    },
    async sshKeys(id: number | string): Promise<string[]> {
      const j = await read(`/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}/ssh-keys`)
      return list<any>(j).map(k => (typeof k === 'string' ? k : k?.key ?? k?.public_key ?? '')).filter(Boolean)
    },
    /** Subscrições da conta (custos, renovação automática, próxima cobrança) — leitura. */
    async subscriptions(): Promise<Subscription[]> { return list<Subscription>(await read('/api/billing/v1/subscriptions')) },
    /** Métricas (CPU %, RAM/disco/tráfego em bytes, uptime em ms) entre duas datas (YYYY-MM-DD). */
    async metrics(id: number | string, from: string, to: string): Promise<VpsMetrics> {
      const j = await read(`/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}/metrics?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`)
      return (j?.data ?? j ?? {}) as VpsMetrics
    },
    async backups(id: number | string): Promise<VpsBackup[]> { return list<VpsBackup>(await read(`/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}/backups`)) },
    /** Snapshot actual (null se não existir: 404). */
    async snapshot(id: number | string): Promise<VpsSnapshot | null> {
      let r
      try { r = await call('GET', `/api/vps/v1/virtual-machines/${encodeURIComponent(String(id))}/snapshot`) } catch { throw new VpsApiError('Ligação à API da Hostinger falhou.', 0) }
      if (r.status === 404) return null
      if (r.status < 200 || r.status >= 300) throw new VpsApiError(safe(r.json?.error ?? r.json?.message ?? `HTTP ${r.status}`), r.status)
      const sn = r.json?.data ?? r.json
      return sn && sn.id != null ? sn as VpsSnapshot : null
    },
    async firewalls(): Promise<Firewall[]> { return list<Firewall>(await read('/api/vps/v1/firewall')) },
    async firewall(fid: number | string): Promise<Firewall | null> { try { const j = await read(`/api/vps/v1/firewall/${encodeURIComponent(String(fid))}`); return (j?.data ?? j) as Firewall } catch (e) { if (e instanceof VpsApiError && e.status === 404) return null; throw e } },
    /**
     * Operações sem custo para o cliente (as destrutivas exigem confirmação no módulo que as chama):
     * backups (restaurar), snapshot (criar/restaurar/apagar), firewall (criar/regra/activar/desactivar/sincronizar), hostname.
     */
    async op(kind: 'backup-restore' | 'snapshot-create' | 'snapshot-restore' | 'snapshot-delete' | 'hostname-set' | 'firewall-create' | 'firewall-rule-add' | 'firewall-rule-delete' | 'firewall-activate' | 'firewall-deactivate' | 'firewall-sync',
      a: { vm?: number | string; backup?: number | string; firewall?: number | string; rule?: number | string; body?: Record<string, unknown> }): Promise<{ ok: true; data: any } | { ok: false; status: number; message: string }> {
      const vm = `/api/vps/v1/virtual-machines/${encodeURIComponent(String(a.vm ?? ''))}`, fw = `/api/vps/v1/firewall/${encodeURIComponent(String(a.firewall ?? ''))}`
      const map: Record<string, [string, string]> = {
        'backup-restore': ['POST', `${vm}/backups/${encodeURIComponent(String(a.backup ?? ''))}/restore`],
        'snapshot-create': ['POST', `${vm}/snapshot`], 'snapshot-restore': ['POST', `${vm}/snapshot/restore`], 'snapshot-delete': ['DELETE', `${vm}/snapshot`],
        'hostname-set': ['PUT', `${vm}/hostname`],
        'firewall-create': ['POST', '/api/vps/v1/firewall'], 'firewall-rule-add': ['POST', `${fw}/rules`], 'firewall-rule-delete': ['DELETE', `${fw}/rules/${encodeURIComponent(String(a.rule ?? ''))}`],
        'firewall-activate': ['POST', `${fw}/activate/${encodeURIComponent(String(a.vm ?? ''))}`], 'firewall-deactivate': ['POST', `${fw}/deactivate/${encodeURIComponent(String(a.vm ?? ''))}`],
        'firewall-sync': ['POST', `${fw}/sync/${encodeURIComponent(String(a.vm ?? ''))}`],
      }
      const [method, path] = map[kind]
      let r
      try { r = await call(method, path, a.body) } catch (e) { return { ok: false, status: 0, message: (e as Error).name === 'TimeoutError' ? 'A Hostinger não respondeu dentro do tempo limite.' : 'Ligação à Hostinger falhou.' } }
      if (r.status >= 200 && r.status < 300) return { ok: true, data: r.json?.data ?? r.json }
      return { ok: false, status: r.status, message: safe(r.json?.error ?? r.json?.message ?? `HTTP ${r.status}`) }
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

// Leitura das especificações (unidades): módulo sem dependências de servidor, testado em scripts/vps/vps-specs.test.mjs
export { specsFromMetadata, specsFromVm } from './hostinger-specs'
