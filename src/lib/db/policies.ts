// Regras de acesso por linha (equivalente às políticas RLS do Supabase).
//
// Aplicam-se a pedidos feitos com o papel "anon" ou "authenticated" — ou seja,
// às consultas que chegam do browser (/api/db) e às do servidor feitas com
// createClient() (sessão do utilizador). O papel "service" (createAdminClient,
// createAdminWriteClient, RPCs) ignora estas regras, tal como a service_role key.
//
// Cada predicado devolve SQL sobre o alias da tabela; nunca interpola valores.
// Diferenças intencionais face às políticas do Supabase (endurecimento):
//   • site_* (banners, domínios, planos, equipa): escrita só para admin
//     (no Supabase qualquer utilizador autenticado podia escrever).
//   • profiles: um cliente não pode alterar o próprio "role".
//   • activity_logs: inserção só para utilizadores autenticados e com o próprio profile_id.

export type AuthCtx =
  | { role: 'service' }
  | { role: 'anon' }
  | { role: 'authenticated'; uid: string; email?: string | null; profileRole: string | null }

export interface Frag { sql: string; params: unknown[] }
type Pred = (a: string, c: Exclude<AuthCtx, { role: 'service' }>) => Frag | boolean

export interface TablePolicy {
  select?: Pred
  insert?: Pred        // WITH CHECK, verificado sobre as linhas inseridas
  update?: Pred        // USING
  updateCheck?: Pred   // WITH CHECK, verificado sobre as linhas depois da alteração
  delete?: Pred
}

const uid = (c: Exclude<AuthCtx, { role: 'service' }>) => (c.role === 'authenticated' ? c.uid : null)
const isAdmin = (c: Exclude<AuthCtx, { role: 'service' }>) => c.role === 'authenticated' && c.profileRole === 'admin'
const isStaff = (c: Exclude<AuthCtx, { role: 'service' }>) => c.role === 'authenticated' && (c.profileRole === 'admin' || c.profileRole === 'reseller')

const col = (a: string, name: string) => `${a}.\`${name}\``
const own = (column: string): Pred => (a, c) => (uid(c) ? { sql: `${col(a, column)} = ?`, params: [uid(c)] } : false)
const ownOrAdmin = (column: string): Pred => (a, c) => (isAdmin(c) ? true : own(column)(a, c))
const admin: Pred = (_a, c) => isAdmin(c)
const always: Pred = () => true
const activeOrAdmin = (column: string): Pred => (a, c) => (isAdmin(c) ? true : { sql: `${col(a, column)} = 1`, params: [] })
const authenticated: Pred = (_a, c) => c.role === 'authenticated'

const adminWrite = { insert: admin, update: admin, delete: admin }

export const policies: Record<string, TablePolicy> = {
  profiles: {
    select: ownOrAdmin('id'),
    insert: ownOrAdmin('id'),
    update: ownOrAdmin('id'),
    updateCheck: (a, c) => (isAdmin(c) ? true : { sql: `${col(a, 'id')} = ? AND ${col(a, 'role')} <=> ?`, params: [uid(c), c.role === 'authenticated' ? c.profileRole : null] }),
    delete: admin,
  },
  clients: { select: ownOrAdmin('profile_id'), insert: ownOrAdmin('profile_id'), update: ownOrAdmin('profile_id'), updateCheck: ownOrAdmin('profile_id'), delete: admin },
  plans: { select: activeOrAdmin('is_active'), ...adminWrite },
  servers: { select: admin, ...adminWrite },
  services: { select: ownOrAdmin('profile_id'), insert: ownOrAdmin('profile_id'), update: admin, delete: admin },
  hosting_accounts: { select: ownOrAdmin('profile_id'), ...adminWrite },
  domains: { select: ownOrAdmin('profile_id'), insert: ownOrAdmin('profile_id'), update: ownOrAdmin('profile_id'), updateCheck: ownOrAdmin('profile_id'), delete: admin },
  emails: { select: ownOrAdmin('profile_id'), insert: ownOrAdmin('profile_id'), update: ownOrAdmin('profile_id'), updateCheck: ownOrAdmin('profile_id'), delete: ownOrAdmin('profile_id') },
  notifications: { select: ownOrAdmin('profile_id'), insert: ownOrAdmin('profile_id'), update: ownOrAdmin('profile_id'), updateCheck: ownOrAdmin('profile_id'), delete: ownOrAdmin('profile_id') },
  activity_logs: { select: ownOrAdmin('profile_id'), insert: (a, c) => (isAdmin(c) ? true : own('profile_id')(a, c)) },

  tickets: {
    select: (a, c) => (isStaff(c) ? true : own('profile_id')(a, c)),
    insert: own('profile_id'),
    update: (a, c) => (isStaff(c) ? true : own('profile_id')(a, c)),
    updateCheck: (a, c) => (isStaff(c) ? true : own('profile_id')(a, c)),
    delete: admin,
  },
  ticket_messages: {
    select: (a, c) => (isStaff(c) ? true : uid(c)
      ? { sql: `${col(a, 'is_internal')} = 0 AND EXISTS (SELECT 1 FROM \`tickets\` _t WHERE _t.id = ${col(a, 'ticket_id')} AND _t.profile_id = ?)`, params: [uid(c)] }
      : false),
    insert: (a, c) => (isStaff(c)
      ? { sql: `${col(a, 'profile_id')} = ?`, params: [uid(c)] }
      : uid(c)
        ? { sql: `${col(a, 'profile_id')} = ? AND ${col(a, 'is_internal')} = 0 AND ${col(a, 'is_staff')} = 0 AND EXISTS (SELECT 1 FROM \`tickets\` _t WHERE _t.id = ${col(a, 'ticket_id')} AND _t.profile_id = ?)`, params: [uid(c), uid(c)] }
        : false),
  },
  ticket_attachments: {
    select: (a, c) => (isAdmin(c) ? true : uid(c)
      ? { sql: `EXISTS (SELECT 1 FROM \`tickets\` _t WHERE _t.id = ${col(a, 'ticket_id')} AND _t.profile_id = ?)`, params: [uid(c)] }
      : false),
  },

  orders: { select: ownOrAdmin('user_id') },
  order_items: {
    select: (a, c) => (isAdmin(c) ? true : uid(c)
      ? { sql: `${col(a, 'order_id')} IN (SELECT _o.id FROM \`orders\` _o WHERE _o.user_id = ?)`, params: [uid(c)] }
      : false),
  },
  invoices: { select: ownOrAdmin('profile_id'), ...adminWrite },
  invoice_items: {
    select: (a, c) => (isAdmin(c) ? true : uid(c)
      ? { sql: `EXISTS (SELECT 1 FROM \`invoices\` _i WHERE _i.id = ${col(a, 'invoice_id')} AND _i.profile_id = ?)`, params: [uid(c)] }
      : false),
  },
  payments: { select: ownOrAdmin('profile_id'), insert: ownOrAdmin('profile_id'), update: admin, delete: admin },
  invoice_send_logs: { select: admin },
  email_logs: { select: ownOrAdmin('profile_id') },
  company_billing_settings: { select: admin },
  currency_rates: { select: (a) => ({ sql: `${col(a, 'is_active')} = 1`, params: [] }) },

  products: { select: activeOrAdmin('active'), ...adminWrite },
  product_features: { select: always, ...adminWrite },
  banner_pages: { select: activeOrAdmin('is_active') },
  site_banners: { select: activeOrAdmin('active'), ...adminWrite },
  site_domains: { select: activeOrAdmin('active'), ...adminWrite },
  site_email_plans: { select: activeOrAdmin('active'), ...adminWrite },
  site_hosting_plans: { select: activeOrAdmin('active'), ...adminWrite },
  site_team: { select: activeOrAdmin('active'), ...adminWrite },
  site_home_hero: { select: always },

  whm_accounts: { select: ownOrAdmin('profile_id'), ...adminWrite },
  whm_package_mappings: { select: admin, ...adminWrite },
  sso_audit_logs: { select: ownOrAdmin('profile_id'), ...adminWrite },

  ai_conversations: { select: ownOrAdmin('profile_id') },
  ai_messages: {
    select: (a, c) => (isAdmin(c) ? true : uid(c)
      ? { sql: `EXISTS (SELECT 1 FROM \`ai_conversations\` _c WHERE _c.id = ${col(a, 'conversation_id')} AND _c.profile_id = ?)`, params: [uid(c)] }
      : false),
  },
  ai_audit_logs: { select: admin },
  // auth_users, storage_objects, migration_state: sem política → inacessíveis fora do papel service.
}

void authenticated

/** Resolve o predicado para um comando; false = negado, true = sem restrição. */
export function policyFor(table: string, cmd: keyof TablePolicy, alias: string, ctx: AuthCtx): Frag | boolean {
  if (ctx.role === 'service') return true
  const p = policies[table]?.[cmd]
  if (!p) {
    // updateCheck ausente → o PostgreSQL reutiliza a expressão USING
    if (cmd === 'updateCheck') return policyFor(table, 'update', alias, ctx)
    return false
  }
  return p(alias, ctx)
}
