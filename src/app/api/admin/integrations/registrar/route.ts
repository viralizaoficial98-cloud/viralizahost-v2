import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { getDefaultNameservers, saveDefaultNameservers } from '@/lib/commerce/nameserver-settings'
import { PROVIDERS, RegistrarConfigError, loadRegistrarSettings, saveRegistrarSettings, testRegistrarConnection } from '@/lib/registrar/settings'

export const dynamic = 'force-dynamic'

// Integrações → Registrador de domínios. O segredo nunca é devolvido (só hasSecret).
/* eslint-disable @typescript-eslint/no-explicit-any */
async function state() {
  const db = getPool()
  const [[exts], [ops]] = await Promise.all([
    db.query("SELECT extension, MAX(status = 'active') AS on_sale FROM domain_prices GROUP BY extension ORDER BY FIELD(extension, '.ao', '.co.ao') DESC, extension"),
    db.query('SELECT status, COUNT(*) n FROM registrar_operations GROUP BY status'),
  ]) as any
  return {
    settings: await loadRegistrarSettings(),
    defaultNameservers: await getDefaultNameservers(),
    providers: PROVIDERS,
    extensions: (exts as any[]).map(e => ({ extension: e.extension, onSale: !!Number(e.on_sale) })),
    operations: Object.fromEntries((ops as any[]).map(o => [o.status, Number(o.n)])),
    encryptionKey: (process.env.WHM_ENCRYPTION_KEY?.length ?? 0) >= 64,
    testProvisioning: process.env.REGISTRAR_TEST_PROVISIONING === '1',
  }
}

export async function GET() {
  try { await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try { return NextResponse.json(await state()) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const body = await req.json().catch(() => ({})) as any
  const log = (description: string) => getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'integration', 'registrar', ?)", [adminId, description]).catch(() => {})
  try {
    if (body.action === 'test') {
      const r = await testRegistrarConnection()
      await log(`registrar test: ${r.ok ? 'ok' : 'falhou'}`)
      return NextResponse.json({ ...r, state: await state() })
    }
    if (body.action === 'save') {
      await saveRegistrarSettings({
        provider: String(body.provider ?? 'none'), mode: body.mode === 'live' ? 'live' : 'test',
        apiUrl: body.apiUrl ?? null, username: body.username ?? null, secret: body.secret ? String(body.secret) : null,
        extensions: Array.isArray(body.extensions) ? body.extensions.map(String) : [], enabled: body.enabled === true,
      }, adminId)
      await log(`registrar save: ${body.provider} ${body.mode} ${body.enabled ? 'activo' : 'inactivo'}${body.secret ? ' (credencial alterada)' : ''}`)
      return NextResponse.json({ ok: true, state: await state() })
    }
    if (body.action === 'nameservers') {
      let list: string[]
      try { list = await saveDefaultNameservers(Array.isArray(body.nameservers) ? body.nameservers : [], adminId) } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
      await log(`nameservers padrão: ${list.join(', ')}`)
      return NextResponse.json({ ok: true, state: await state() })
    }
    return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
  } catch (e) {
    if (e instanceof RegistrarConfigError) return NextResponse.json({ error: e.message }, { status: 400 })
    console.error('[integrations/registrar]', (e as Error).message)
    return NextResponse.json({ error: 'Erro ao guardar a configuração.' }, { status: 500 })
  }
}
