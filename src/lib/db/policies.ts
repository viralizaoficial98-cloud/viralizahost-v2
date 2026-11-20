// Substituto das políticas RLS do Supabase (schema viralizahost).
//
// Cada pedido executa com um AuthContext:
//   - service → equivalente ao service_role (ignora políticas). Só no servidor.
//   - user    → equivalente ao papel `authenticated` com auth.uid() = userId.
//   - anon    → visitante sem sessão.
//
// As regras abaixo foram derivadas de pg_policies (todas as políticas permissivas
// de cada tabela combinadas com OR). Diferenças intencionais face ao Supabase:
//   * site_banners / site_domains / site_email_plans / site_hosting_plans / site_team
//     tinham escrita aberta a QUALQUER utilizador autenticado (`USING (true)`).
//     Aqui a escrita exige perfil admin.
//   * Funções RPC deixam de estar expostas ao navegador (no Supabase, as funções
//     SECURITY DEFINER do schema public podiam ser chamadas por anon).

export type AuthContext =
  | { kind: 'service' }
  | { kind: 'anon' }
  | { kind: 'user'; userId: string; role: 'client' | 'admin' | 'reseller' | null; email?: string }

export interface SqlFragment { sql: string; params: unknown[] }

/** `$t` é substituído pelo alias da tabela na consulta. */
export type RowFilter = (ctx: AuthContext) => SqlFragment | boolean

/** Verificação WITH CHECK de uma linha a inserir. Pode consultar a base. */
export type RowCheck = (
  ctx: AuthContext,
  row: Record<string, unknown>,
  lookup: (sql: string, params: unknown[]) => Promise<unknown[]>,
) => boolean | Promise<boolean>

export interface TablePolicy {
  select?: RowFilter
  insert?: RowCheck
  update?: RowFilter
  delete?: RowFilter
}

const uid = (ctx: AuthContext) => (ctx.kind === 'user' ? ctx.userId : null)
const isAdmin = (ctx: AuthContext) => ctx.kind === 'user' && ctx.role === 'admin'
const isStaff = (ctx: AuthContext) => ctx.kind === 'user' && (ctx.role === 'admin' || ctx.role === 'reseller')
const isUser = (ctx: AuthContext) => ctx.kind === 'user'

const sql = (s: string, ...params: unknown[]): SqlFragment => ({ sql: s, params })
const or = (...parts: (SqlFragment | boolean)[]): SqlFragment | boolean => {
  if (parts.some(p => p === true)) return true
  const frags = parts.filter((p): p is SqlFragment => typeof p === 'object')
  if (!frags.length) return false
  return { sql: frags.map(f => `(${f.sql})`).join(' OR '), params: frags.flatMap(f => f.params) }
}

const own = (col: string): RowFilter => ctx => (uid(ctx) ? sql(`$t.\`${col}\` = ?`, uid(ctx)) : false)
const admin: RowFilter = ctx => isAdmin(ctx)
const ownOrAdmin = (col: string): RowFilter => ctx => or(admin(ctx), own(col)(ctx))
const activeOnly = (col: string): RowFilter => () => sql(`$t.\`${col}\` = 1`)
const activeOrAdmin = (col: string): RowFilter => ctx => or(admin(ctx), activeOnly(col)(ctx))

const checkOwn = (col: string): RowCheck => (ctx, row) => !!uid(ctx) && row[col] === uid(ctx)
const checkOwnOrAdmin = (col: string): RowCheck => (ctx, row) => isAdmin(ctx) || checkOwn(col)(ctx, row, async () => [])
const checkAdmin: RowCheck = ctx => isAdmin(ctx)

const sitePolicy = (activeCol = 'active'): TablePolicy => ({
  select: activeOrAdmin(activeCol),
  insert: checkAdmin,
  update: admin,
  delete: admin,
})

export const POLICIES: Record<string, TablePolicy> = {
  activity_logs: { select: ownOrAdmin('profile_id'), insert: () => true },
  ai_audit_logs: { select: admin },
  ai_conversations: { select: ownOrAdmin('profile_id') },
  ai_messages: {
    select: ctx => or(admin(ctx), uid(ctx)
      ? sql('EXISTS (SELECT 1 FROM `ai_conversations` c WHERE c.id = $t.`conversation_id` AND c.profile_id = ?)', uid(ctx))
      : false),
  },
  banner_pages: { select: activeOnly('is_active') },
  clients: {
    select: ownOrAdmin('profile_id'),
    insert: checkOwnOrAdmin('profile_id'),
    update: ownOrAdmin('profile_id'),
    delete: admin,
  },
  company_billing_settings: { select: admin },
  currency_rates: { select: activeOnly('is_active') },
  domains: {
    select: ownOrAdmin('profile_id'),
    insert: checkOwnOrAdmin('profile_id'),
    update: ownOrAdmin('profile_id'),
    delete: admin,
  },
  email_logs: { select: ctx => (isUser(ctx) ? own('profile_id')(ctx) : false) },
  emails: {
    select: ownOrAdmin('profile_id'),
    insert: checkOwnOrAdmin('profile_id'),
    update: ownOrAdmin('profile_id'),
    delete: ownOrAdmin('profile_id'),
  },
  hosting_accounts: { select: ownOrAdmin('profile_id'), insert: checkAdmin, update: admin, delete: admin },
  invoice_items: {
    select: ctx => or(admin(ctx), uid(ctx)
      ? sql('EXISTS (SELECT 1 FROM `invoices` i WHERE i.id = $t.`invoice_id` AND i.profile_id = ?)', uid(ctx))
      : false),
  },
  invoice_send_logs: { select: admin },
  invoices: { select: ownOrAdmin('profile_id'), insert: checkAdmin, update: admin, delete: admin },
  notifications: {
    select: ownOrAdmin('profile_id'),
    insert: checkOwnOrAdmin('profile_id'),
    update: ownOrAdmin('profile_id'),
    delete: ownOrAdmin('profile_id'),
  },
  order_items: {
    select: ctx => (uid(ctx)
      ? sql('$t.`order_id` IN (SELECT o.id FROM `orders` o WHERE o.user_id = ?)', uid(ctx))
      : false),
  },
  orders: { select: ctx => (isUser(ctx) ? own('user_id')(ctx) : false) },
  payments: {
    select: ownOrAdmin('profile_id'),
    insert: (ctx, row) => isAdmin(ctx) || (!!uid(ctx) && row.profile_id === uid(ctx)),
    update: admin,
    delete: admin,
  },
  plans: { select: activeOrAdmin('is_active'), insert: checkAdmin, update: admin, delete: admin },
  product_features: { select: () => true, insert: checkAdmin, update: admin, delete: admin },
  // Preços por ciclo e de domínios: leitura pública dos activos; escrita só admin
  product_prices: { select: activeOrAdmin('active'), insert: checkAdmin, update: admin, delete: admin },
  domain_prices: {
    select: ctx => or(admin(ctx), sql("$t.`status` IN ('active','on_request')")),
    insert: checkAdmin, update: admin, delete: admin,
  },
  products: { select: activeOrAdmin('active'), insert: checkAdmin, update: admin, delete: admin },
  profiles: {
    select: ownOrAdmin('id'),
    insert: checkOwn('id'),
    update: ownOrAdmin('id'),
    delete: admin,
  },
  servers: { select: admin, insert: checkAdmin, update: admin, delete: admin },
  services: {
    select: ownOrAdmin('profile_id'),
    insert: checkOwnOrAdmin('profile_id'),
    update: admin,
    delete: admin,
  },
  site_banners: sitePolicy(),
  site_domains: sitePolicy(),
  site_email_plans: sitePolicy(),
  site_hosting_plans: sitePolicy(),
  site_team: sitePolicy(),
  site_home_hero: { select: () => true },
  sso_audit_logs: {
    select: ownOrAdmin('profile_id'),
    insert: checkAdmin,
    update: admin,
    delete: admin,
  },
  ticket_attachments: {
    select: ctx => or(admin(ctx), uid(ctx)
      ? sql('EXISTS (SELECT 1 FROM `tickets` t WHERE t.id = $t.`ticket_id` AND t.profile_id = ?)', uid(ctx))
      : false),
  },
  ticket_messages: {
    // ticket_messages_select (dono do ticket ou staff) OR client_select_messages (⊂ anterior)
    select: ctx => (uid(ctx)
      ? (isStaff(ctx) ? true : sql('EXISTS (SELECT 1 FROM `tickets` t WHERE t.id = $t.`ticket_id` AND t.profile_id = ?)', uid(ctx)))
      : false),
    insert: async (ctx, row, lookup) => {
      const me = uid(ctx)
      if (!me) return false
      if (isStaff(ctx) && row.profile_id === me) return true
      const rows = await lookup('SELECT 1 FROM `tickets` WHERE id = ? AND profile_id = ?', [row.ticket_id, me])
      if (!rows.length) return false
      // ticket_messages_insert: profile_id = uid ; client_insert_messages: não interno e não staff
      return row.profile_id === me || (!row.is_internal && !row.is_staff)
    },
  },
  tickets: {
    select: ctx => or(isStaff(ctx), own('profile_id')(ctx)),
    insert: checkOwn('profile_id'),
    update: ctx => or(isStaff(ctx), own('profile_id')(ctx)),
    delete: admin,
  },
  whm_accounts: { select: ownOrAdmin('profile_id'), insert: checkAdmin, update: admin, delete: admin },
  whm_package_mappings: { select: admin, insert: checkAdmin, update: admin, delete: admin },
}

/** Tabelas de plataforma nunca acessíveis fora do contexto de serviço. */
export const PRIVATE_TABLES = new Set([
  'auth_users', 'auth_sessions', 'auth_tokens', 'storage_buckets', 'storage_objects', 'vh_migration_runs',
])
