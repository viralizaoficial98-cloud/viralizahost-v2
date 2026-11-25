import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { CloudError, loadCloudSettings, saveCloudSettings, VPS_MODE_LABEL } from '@/lib/vps/cloud'
import { listVpsRequests, vpsRequestAction, vpsRequestDetail } from '@/lib/vps/requests'
import { linkInstance, listInstances, providerReadAll, setInternal, syncHistory, syncInventory, unlinkInstance } from '@/lib/vps/inventory'
import { applySuggested, cloudOverview, planFinance, savePlanExtras, serviceFinance, syncPlanCosts } from '@/lib/vps/finance'
import { loadVpsSettings, saveVpsSettings, VpsConfigError, vpsClient } from '@/lib/vps/settings'
import { reconcileOpenVps } from '@/lib/vps/provisioning'
import { INSTALL_GROUPS } from '@/lib/vps/install-shared'

export const dynamic = 'force-dynamic'

// Painel → Cloud VPS (só administradores). GET ?section=… · POST { action, … }. Nunca devolve o token do fornecedor;
// métodos de pagamento mascarados (só o nome e os últimos 4 caracteres).
/* eslint-disable @typescript-eslint/no-explicit-any */
const ns = { headers: { 'Cache-Control': 'no-store' } }
async function guard(): Promise<string | NextResponse> {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}
function fail(e: unknown) {
  if (e instanceof CloudError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, ...ns })
  if (e instanceof VpsConfigError) return NextResponse.json({ error: e.message }, { status: 400, ...ns })
  console.error('[admin/cloud-vps]', (e as Error).message)
  return NextResponse.json({ error: (e as Error).message?.slice(0, 200) || 'Erro.' }, { status: 500, ...ns })
}
const mask = (s: unknown) => { const v = String(s ?? ''); const tail = v.replace(/[^A-Za-z0-9]/g, '').slice(-4); return tail ? `•••• ${tail}` : '••••' }

export async function GET(req: NextRequest) {
  const g = await guard(); if (typeof g !== 'string') return g
  const sp = req.nextUrl.searchParams, section = sp.get('section') ?? 'overview'
  try {
    switch (section) {
      case 'overview': return NextResponse.json(await cloudOverview(), ns)
      case 'requests': {
        const id = sp.get('id')
        if (id) { const d = await vpsRequestDetail(id); return d ? NextResponse.json(d, ns) : NextResponse.json({ error: 'Pedido inexistente.' }, { status: 404 }) }
        return NextResponse.json(await listVpsRequests({ status: sp.get('estado') ?? undefined, q: sp.get('q') ?? undefined, page: Number(sp.get('page') ?? 1) }), ns)
      }
      case 'instances': {
        const [clients] = sp.get('clients') ? await getPool().query("SELECT id, full_name, email FROM profiles WHERE role = 'client' AND is_active = 1 AND (email LIKE ? OR full_name LIKE ?) ORDER BY full_name LIMIT 10", [`%${sp.get('clients')}%`, `%${sp.get('clients')}%`]) as any : [[]]
        if (sp.get('clients')) return NextResponse.json({ clients }, ns)
        const [plans] = await getPool().query("SELECT id, name FROM products WHERE category = 'vps' AND subcategory IS NULL AND active = 1 ORDER BY position") as any
        return NextResponse.json({ ...(await listInstances({ q: sp.get('q') ?? undefined, filter: sp.get('filtro') ?? undefined, page: Number(sp.get('page') ?? 1) })), plans }, ns)
      }
      case 'providers': {
        const s = await loadVpsSettings()
        const out: any = { settings: { mode: s.mode, apiUrl: s.apiUrl, hasSecret: s.hasSecret, usesRegistrarToken: s.usesRegistrarToken, autoProvision: s.autoProvision, paymentMethodId: s.paymentMethodId, hostnameSuffix: s.hostnameSuffix, lastTest: s.lastTest },
          history: await syncHistory(20), livePurchasesEnv: process.env.VPS_LIVE_PURCHASES === '1', cloud: await loadCloudSettings() }
        if (sp.get('live') === '1') {
          const cl = await vpsClient('read')
          if ('error' in cl) out.liveError = cl.error
          else {
            const [pms, subs] = await Promise.allSettled([cl.client.paymentMethods(), cl.client.subscriptions()])
            out.paymentMethods = pms.status === 'fulfilled' ? pms.value.map(p => ({ id: p.id, label: `${p.name ?? 'Método'} ${mask(p.identifier)}`, isDefault: !!p.is_default, unusable: !!(p.is_expired || p.is_suspended) })) : { error: 'Consulta falhou.' }
            out.subscriptions = subs.status === 'fulfilled' ? subs.value.map(x => ({ id: x.id, name: x.name, status: x.status, period: `${x.billing_period ?? ''} ${x.billing_period_unit ?? ''}`.trim(), currency: x.currency_code, totalMinor: x.total_price, renewalMinor: x.renewal_price, autoRenew: x.is_auto_renewed, nextBillingAt: x.next_billing_at, expiresAt: x.expires_at })) : { error: 'Consulta falhou.' }
          }
        }
        return NextResponse.json(out, ns)
      }
      case 'templates': {
        const s = await loadVpsSettings()
        const [plans] = await getPool().query("SELECT slug, name FROM products WHERE category = 'vps' AND subcategory IS NULL AND active = 1 ORDER BY position") as any
        return NextResponse.json({ images: s.images, locations: s.locations, groups: INSTALL_GROUPS, plans }, ns)
      }
      case 'datacenters': { const s = await loadVpsSettings(); return NextResponse.json({ locations: s.locations }, ns) }
      case 'provisioning': {
        const [ops] = await getPool().query(`SELECT v.id, v.service_id, v.status, v.mode, v.item_id, v.expected_cost_minor, v.cost_limit_minor, v.currency, v.provider_vm_id, v.provider_status, v.ipv4,
            v.message, v.attempts, v.access_method, v.access_configured_at, v.updated_at, s.service_name, s.provisioning_status, s.provisioning_error, o.order_number, pr.email, r.reference request_ref
          FROM vps_provider_orders v JOIN services s ON s.id = v.service_id LEFT JOIN orders o ON o.id = s.order_id LEFT JOIN profiles pr ON pr.id = s.profile_id
          LEFT JOIN vps_requests r ON r.service_id = v.service_id ORDER BY v.updated_at DESC LIMIT 100`) as any
        const [pending] = await getPool().query(`SELECT s.id service_id, s.service_name, s.provisioning_status, s.provisioning_error, o.order_number, pr.email FROM services s JOIN products p ON p.id = s.product_id
          JOIN orders o ON o.id = s.order_id JOIN profiles pr ON pr.id = s.profile_id LEFT JOIN vps_provider_orders v ON v.service_id = s.id
          WHERE p.category = 'vps' AND o.payment_status = 'paid' AND s.status <> 'cancelled' AND s.provisioning_status IN ('pending','manual_required','failed') AND v.id IS NULL ORDER BY s.created_at DESC LIMIT 50`) as any
        return NextResponse.json({ ops, pending }, ns)
      }
      case 'finance': return NextResponse.json({ ...(await planFinance()), services: await serviceFinance() }, ns)
      case 'settings': return NextResponse.json({ cloud: await loadCloudSettings(), modes: VPS_MODE_LABEL, livePurchasesEnv: process.env.VPS_LIVE_PURCHASES === '1' }, ns)
      default: return NextResponse.json({ error: 'Secção inválida.' }, { status: 400 })
    }
  } catch (e) { return fail(e) }
}

export async function POST(req: NextRequest) {
  const g = await guard(); if (typeof g !== 'string') return g
  const b = await req.json().catch(() => null) as Record<string, any> | null
  if (!b?.action) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try {
    switch (b.action) {
      case 'request': return NextResponse.json(await vpsRequestAction(g, String(b.id), String(b.op), b), ns)
      case 'test': return NextResponse.json(await providerReadAll(g, 'test').then(r => ({ ok: r.ok, message: r.message, results: r.results })), ns)
      case 'sync_inventory': { const r = await syncInventory(g); return NextResponse.json({ ok: r.ok, message: r.message, results: r.results, imported: r.imported, updated: r.updated }, ns) }
      case 'set_internal': await setInternal(g, String(b.id), b.internal === true, String(b.reason ?? '')); return NextResponse.json({ ok: true })
      case 'link_instance': return NextResponse.json(await linkInstance(g, { instanceId: String(b.id), profileId: String(b.profileId ?? ''), productId: b.productId ? String(b.productId) : null, confirmed: b.confirmed === true }), ns)
      case 'unlink_instance': await unlinkInstance(g, String(b.id), String(b.reason ?? '')); return NextResponse.json({ ok: true })
      case 'save_cloud': return NextResponse.json({ cloud: await saveCloudSettings(g, b) }, ns)
      case 'provider_save': {
        // Reutiliza a gravação existente (token cifrado, modo, método de pagamento, automático com confirmação)
        const s = await saveVpsSettings({ mode: b.mode, apiUrl: b.apiUrl, secret: b.secret, paymentMethodId: b.paymentMethodId, hostnameSuffix: b.hostnameSuffix, autoProvision: b.autoProvision, confirmAuto: b.confirmAuto }, g)
        return NextResponse.json({ ok: true, settings: { mode: s.mode, hasSecret: s.hasSecret, autoProvision: s.autoProvision, paymentMethodId: s.paymentMethodId, hostnameSuffix: s.hostnameSuffix } }, ns)
      }
      case 'templates_save': { const s = await saveVpsSettings({ enabledImages: b.enabledImages, images: b.images, allowChooseLater: b.allowChooseLater }, g); return NextResponse.json({ images: s.images }, ns) }
      case 'datacenters_save': { const s = await saveVpsSettings({ enabledLocations: b.enabledLocations }, g); return NextResponse.json({ locations: s.locations }, ns) }
      case 'sync_costs': return NextResponse.json(await syncPlanCosts(g), ns)
      case 'apply_suggested': return NextResponse.json(await applySuggested(g, String(b.productId), String(b.cycle)), ns)
      case 'plan_extras': return NextResponse.json(await savePlanExtras(g, String(b.productId), b), ns)
      case 'reconcile_all': return NextResponse.json({ results: await reconcileOpenVps() }, ns)
      default: return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
    }
  } catch (e) { return fail(e) }
}
