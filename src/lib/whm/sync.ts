import 'server-only'
import { applyImport } from './import'

// Sincronização WHM (painel «Sincronizar» e cron /api/cron/whm-sync).
// Antes: criava contas de cliente a partir do e-mail de contacto do WHM.
// Agora: usa a importação segura (src/lib/whm/import.ts) — actualiza contas e uso,
// associa só por (servidor, utilizador) a serviços existentes e deixa o resto
// pendente de validação. O formato do resultado mantém-se para o painel.

export interface SyncResult {
  total: number
  imported: number
  whmAccountsCreated: number
  whmAccountsUpdated: number
  whmDbErrors: number
  clientsCreated: number
  clientsLinked: number
  servicesCreated: number
  servicesUpdated: number
  pending: number
  suspended: number
  active: number
  markedMissing: number
  errors: Array<{ username: string; error: string }>
  syncedAt: string
  pendingValidation: number
  conflicts: { username: string; message: string }[]
}

export async function syncWhmAccounts(): Promise<SyncResult> {
  const plan = await applyImport()
  const suspended = plan.items.filter(i => i.suspended).length
  return {
    total: plan.found,
    imported: plan.new,
    whmAccountsCreated: plan.new,
    whmAccountsUpdated: plan.updated,
    whmDbErrors: 0,
    clientsCreated: 0,
    clientsLinked: plan.autoLinked,
    servicesCreated: 0,
    servicesUpdated: plan.items.filter(i => i.link === 'linked').length,
    pending: plan.pendingValidation + plan.unlinked,
    suspended,
    active: plan.found - suspended,
    markedMissing: plan.missingFromWhm.length,
    errors: [],
    syncedAt: new Date().toISOString(),
    pendingValidation: plan.pendingValidation,
    conflicts: plan.conflicts,
  }
}
