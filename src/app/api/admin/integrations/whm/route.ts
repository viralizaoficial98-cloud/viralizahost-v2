import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { loadWhmConfig, isEncryptedToken, WHM_CONFIG_NAME } from '@/lib/whm/config'
import { listPackages, testConnection } from '@/lib/whm/client'

export const dynamic = 'force-dynamic'

// Integrações → WHM/cPanel: estado, teste só de leitura e plano → servidor/pacote.
// Nunca devolve o token (nem mascarado): só se existe e se está cifrado.
/* eslint-disable @typescript-eslint/no-explicit-any */
const SERVICE_TYPES = ['hosting', 'email', 'reseller', 'wordpress', 'website-builder']

async function status() {
  const db = getPool()
  const [[servers], [plans], [[acc]]] = await Promise.all([
    db.query('SELECT id, name, hostname, whm_url, whm_username, whm_api_token, is_active FROM servers WHERE whm_url IS NOT NULL ORDER BY name = ? DESC, name', [WHM_CONFIG_NAME]),
    db.query(`SELECT id, slug, name, category, service_type, sale_status, provisioning, whm_package, whm_server_id FROM products
      WHERE service_type IN (${SERVICE_TYPES.map(() => '?').join(',')}) OR provisioning = 'whm' ORDER BY category, position, name`, SERVICE_TYPES),
    db.query(`SELECT COUNT(*) total, SUM(link_status = 'linked') linked, SUM(link_candidate_profile_id IS NOT NULL AND link_status <> 'linked') candidates FROM whm_accounts`),
  ]) as any
  return {
    encryptionKey: (process.env.WHM_ENCRYPTION_KEY?.length ?? 0) >= 64,
    servers: (servers as any[]).map(s => ({
      id: s.id, label: s.name === WHM_CONFIG_NAME ? `${s.hostname} (principal)` : s.name, host: (() => { try { return new URL(s.whm_url).host } catch { return null } })(),
      username: s.whm_username ?? 'root', hasToken: !!s.whm_api_token, tokenEncrypted: isEncryptedToken(s.whm_api_token), active: !!s.is_active, primary: s.name === WHM_CONFIG_NAME,
    })),
    plans: (plans as any[]).map(p => ({ ...p })),
    accounts: { total: Number(acc?.total ?? 0), linked: Number(acc?.linked ?? 0), candidates: Number(acc?.candidates ?? 0) },
  }
}

export async function GET() {
  try { await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try { return NextResponse.json(await status()) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}

const safe = (e: unknown) => String((e as Error)?.message ?? e).replace(/https?:\/\/\S+/g, '[url]').slice(0, 200)

export async function POST(req: NextRequest) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const body = await req.json().catch(() => ({})) as any
  const db = getPool()
  const log = (d: string) => db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'integration', 'whm', ?)", [adminId, d]).catch(() => {})

  if (body.action === 'test') {
    // Só leitura: version + listaccts (contagem) + listpkgs. Não cria nem altera contas.
    const cfg = await loadWhmConfig(body.serverId || undefined)
    if (!cfg) return NextResponse.json({ ok: false, message: 'Servidor sem URL/token, ou token ilegível (verifique WHM_ENCRYPTION_KEY).' })
    const t = await testConnection(cfg.config)
    if (!t.success) { await log('whm test: falhou'); return NextResponse.json({ ok: false, message: t.error ?? 'Falha na ligação.' }) }
    let packages: { name: string; maxpop: string; quota: string }[] = []
    let pkgError: string | null = null
    try { packages = (await listPackages(cfg.config)).map(p => ({ name: p.name, maxpop: p.maxpop, quota: p.quota })) } catch (e) { pkgError = safe(e) }
    await log('whm test: ok')
    return NextResponse.json({ ok: true, message: `Ligação OK — WHM ${t.version?.version ?? ''}, ${t.accountCount ?? 0} conta(s).`, packages, pkgError, serverId: cfg.serverId })
  }

  if (body.action === 'map') {
    const provisioning = body.provisioning === 'whm' ? 'whm' : 'manual'
    const pkg = provisioning === 'whm' ? String(body.whmPackage ?? '').trim() : ''
    const [[p]] = await db.query('SELECT id, slug FROM products WHERE id = ?', [body.productId]) as any
    if (!p) return NextResponse.json({ error: 'Plano inexistente.' }, { status: 404 })
    let serverId: string | null = null
    if (provisioning === 'whm') {
      if (!/^[\w .@-]{1,64}$/.test(pkg)) return NextResponse.json({ error: 'Escolha um pacote WHM.' }, { status: 400 })
      const cfg = await loadWhmConfig(body.serverId || undefined)
      if (!cfg) return NextResponse.json({ error: 'Servidor WHM sem credenciais válidas.' }, { status: 400 })
      // O pacote tem de existir no servidor escolhido
      try {
        const pkgs = await listPackages(cfg.config)
        if (!pkgs.some(x => x.name === pkg)) return NextResponse.json({ error: `O pacote «${pkg}» não existe nesse servidor WHM.` }, { status: 400 })
      } catch (e) { return NextResponse.json({ error: `Não foi possível confirmar o pacote no WHM: ${safe(e)}` }, { status: 502 }) }
      const [[primary]] = await db.query('SELECT id FROM servers WHERE name = ?', [WHM_CONFIG_NAME]) as any
      serverId = cfg.serverId === primary?.id ? null : cfg.serverId
    }
    await db.query('UPDATE products SET provisioning = ?, whm_package = ?, whm_server_id = ? WHERE id = ?', [provisioning, pkg || null, serverId, p.id])
    await log(`whm map: ${p.slug} → ${provisioning}${pkg ? ` ${pkg}` : ''}`)
    return NextResponse.json({ ok: true, state: await status() })
  }
  return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
}
