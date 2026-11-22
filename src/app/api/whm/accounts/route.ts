import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { listAccounts, getServerLoad } from '@/lib/whm/client'
import { loadWhmConfig } from '@/lib/whm/config'

// Contas e carga de cada servidor WHM configurado (só leitura).
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET() {
  try { await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const [servers] = await getPool().query("SELECT id, name, hostname FROM servers WHERE is_active = 1 AND whm_url IS NOT NULL AND whm_api_token IS NOT NULL") as any
  const results = await Promise.all((servers as any[]).map(async server => {
    const label = server.name === '__whm_config__' ? server.hostname : server.name
    const cfg = await loadWhmConfig(server.id)
    if (!cfg) return { server: label, server_id: server.id, accounts: [], load: null, error: 'Token ilegível (verifique WHM_ENCRYPTION_KEY).' }
    const [accounts, load] = await Promise.allSettled([listAccounts(cfg.config), getServerLoad(cfg.config)])
    return {
      server: label, server_id: server.id,
      accounts: accounts.status === 'fulfilled' ? accounts.value : [],
      load: load.status === 'fulfilled' ? load.value : null,
      error: accounts.status === 'rejected' ? 'Falha ao listar contas.' : undefined,
    }
  }))
  return NextResponse.json({ servers: results })
}
