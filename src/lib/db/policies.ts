/*
 * Políticas de acesso — reprodução das políticas RLS do Supabase (schema viralizahost) para o MySQL.
 *
 * Aplicam-se às consultas feitas com contexto de utilizador (browser e createClient() no servidor).
 * O contexto 'service' (service role) ignora-as, como no Supabase.
 * Políticas permissivas do PostgreSQL combinam-se com OR — aqui cada função devolve essa união.
 *
 * Diferenças intencionais face ao Supabase (correções de segurança):
 *   1. site_banners / site_domains / site_email_plans / site_hosting_plans / site_team:
 *      no Supabase qualquer utilizador autenticado podia escrever (política ALL authenticated true).
 *      Aqui só administradores escrevem e veem linhas inativas.
 *   2. ticket_messages: no Supabase a união das políticas deixava o cliente ler (e criar) notas internas
 *      (is_internal) dos seus tickets. Aqui o cliente só lê/cria mensagens não internas.
 *   3. profiles: no Supabase o cliente podia alterar qualquer coluna do próprio perfil (incluindo role).
 *      Aqui só pode alterar full_name, phone, country, currency, avatar_url, updated_at.
 */
import type { DbContext } from './types'

export type Cond = { sql: string; params: unknown[] } | boolean

export type InsertCheck = (ctx: AuthCtx, row: Record<string, unknown>, lookup: Lookup) => Promise<boolean> | boolean

export type TablePolicy = {
  select?: (ctx: Ctx) => Cond
  insert?: InsertCheck
  update?: (ctx: Ctx) => Cond
  /** WITH CHECK do UPDATE (por omissão = USING, como no PostgreSQL) */
  updateCheck?: (ctx: Ctx) => Cond
  delete?: (ctx: Ctx) => Cond
  /** Colunas que um não-administrador pode alterar (null = todas) */
  writableColumns?: (ctx: Ctx) => string[] | null
}

type Ctx = Exclude<DbContext, { role: 'service' }>
type AuthCtx = Ctx
export type Lookup = (sql: string, params: unknown[]) => Promise<boolean>

const uidOf = (c: Ctx) => (c.role === 'authenticated' ? c.uid : null)
const admin = (c: Ctx) => c.role === 'authenticated' && c.isAdmin
const staff = (c: Ctx) => c.role === 'authenticated' && (c.isAdmin || c.isStaff)

/** t.col = auth.uid() */
const own = (col: string) => (c: Ctx): Cond => (uidOf(c) ? { sql: `t.\`${col}\` = ?`, params: [uidOf(c)] } : false)
const anyOf = (...fs: ((c: Ctx) => Cond)[]) => (c: Ctx): Cond => {
  const parts = fs.map(f => f(c))
  if (parts.some(p => p === true)) return true
  const real = parts.filter((p): p is { sql: string; params: unknown[] } => typeof p === 'object')
  if (!real.length) return false
  return { sql: '(' + real.map(p => `(${p.sql})`).join(' OR ') + ')', params: real.flatMap(p => p.params) }
}
const allOf = (...fs: ((c: Ctx) => Cond)[]) => (c: Ctx): Cond => {
  const parts = fs.map(f => f(c))
  if (parts.some(p => p === false)) return false
  const real = parts.filter((p): p is { sql: string; params: unknown[] } => typeof p === 'object')
  if (!real.length) return true
  return { sql: '(' + real.map(p => `(${p.sql})`).join(' AND ') + ')', params: real.flatMap(p => p.params) }
}
const isAdmin = (c: Ctx): Cond => admin(c)
const isStaff = (c: Ctx): Cond => staff(c)
const always = (): Cond => true
const authenticated = (c: Ctx): Cond => c.role === 'authenticated'
const col = (sql: string) => (): Cond => ({ sql, params: [] })
const sub = (sqlWithUid: string) => (c: Ctx): Cond => (uidOf(c) ? { sql: sqlWithUid, params: [uidOf(c)] } : false)

const ownOrAdmin = (column: string) => anyOf(own(column), isAdmin)
const rowOwn = (column: string): InsertCheck => (c, row) => !!uidOf(c) && row[column] === uidOf(c)
const rowOwnOrAdmin = (column: string): InsertCheck => (c, row) => admin(c) || rowOwn(column)(c, row, async () => false)
const adminOnly: TablePolicy = { select: isAdmin, insert: c => admin(c), update: isAdmin, delete: isAdmin }

/** Tabelas de conteúdo do site: leitura pública das linhas ativas; escrita só para administradores (correção 1). */
const siteContent = (activeCol: string): TablePolicy => ({
  select: anyOf(col(`t.\`${activeCol}\` = 1`), isAdmin),
  insert: c => admin(c), update: isAdmin, delete: isAdmin,
})

export const POLICIES: Record<string, TablePolicy> = {
  activity_logs: { select: ownOrAdmin('profile_id'), insert: () => true },
  ai_audit_logs: { select: isAdmin },
  ai_conversations: { select: ownOrAdmin('profile_id') },
  ai_messages: {
    select: anyOf(isAdmin, sub('EXISTS (SELECT 1 FROM `ai_conversations` c WHERE c.`id` = t.`conversation_id` AND c.`profile_id` = ?)')),
  },
  banner_pages: { select: col('t.`is_active` = 1') },
  clients: {
    select: ownOrAdmin('profile_id'), insert: rowOwnOrAdmin('profile_id'),
    update: ownOrAdmin('profile_id'), delete: isAdmin,
  },
  company_billing_settings: { select: isAdmin },
  currency_rates: { select: col('t.`is_active` = 1') },
  domains: {
    select: ownOrAdmin('profile_id'), insert: rowOwnOrAdmin('profile_id'),
    update: ownOrAdmin('profile_id'), delete: isAdmin,
  },
  email_logs: { select: own('profile_id') },
  emails: {
    select: ownOrAdmin('profile_id'), insert: rowOwnOrAdmin('profile_id'),
    update: ownOrAdmin('profile_id'), delete: ownOrAdmin('profile_id'),
  },
  hosting_accounts: { select: ownOrAdmin('profile_id'), insert: c => admin(c), update: isAdmin, delete: isAdmin },
  invoice_items: {
    select: anyOf(isAdmin, sub('EXISTS (SELECT 1 FROM `invoices` i WHERE i.`id` = t.`invoice_id` AND i.`profile_id` = ?)')),
  },
  invoice_send_logs: { select: isAdmin },
  invoices: { select: ownOrAdmin('profile_id'), insert: c => admin(c), update: isAdmin, delete: isAdmin },
  notifications: {
    select: ownOrAdmin('profile_id'), insert: rowOwnOrAdmin('profile_id'),
    update: ownOrAdmin('profile_id'), delete: ownOrAdmin('profile_id'),
  },
  order_items: {
    select: sub('t.`order_id` IN (SELECT o.`id` FROM `orders` o WHERE o.`user_id` = ?)'),
  },
  orders: { select: own('user_id') },
  payments: {
    select: ownOrAdmin('profile_id'), insert: rowOwnOrAdmin('profile_id'),
    update: isAdmin, delete: isAdmin,
  },
  plans: { select: anyOf(col('t.`is_active` = 1'), isAdmin), insert: c => admin(c), update: isAdmin, delete: isAdmin },
  product_features: { select: always, insert: c => admin(c), update: isAdmin, delete: isAdmin },
  products: { select: anyOf(col('t.`active` = 1'), isAdmin), insert: c => admin(c), update: isAdmin, delete: isAdmin },
  profiles: {
    select: anyOf(own('id'), isAdmin),
    // INSERT com id = auth.uid(): um cliente só pode criar o próprio perfil e sempre como 'client' (correção 3)
    insert: (c, row) => admin(c) || (rowOwn('id')(c, row, async () => false) && (row.role === undefined || row.role === 'client')),
    update: anyOf(own('id'), isAdmin),
    delete: isAdmin,
    writableColumns: c => (admin(c) ? null : ['full_name', 'phone', 'country', 'currency', 'avatar_url', 'updated_at']),
  },
  servers: adminOnly,
  services: {
    select: ownOrAdmin('profile_id'), insert: rowOwnOrAdmin('profile_id'),
    update: isAdmin, delete: isAdmin,
  },
  site_banners: siteContent('active'),
  site_domains: siteContent('active'),
  site_email_plans: siteContent('active'),
  site_hosting_plans: siteContent('active'),
  site_team: siteContent('active'),
  site_home_hero: { select: always },
  sso_audit_logs: { select: ownOrAdmin('profile_id'), insert: c => admin(c), update: isAdmin, delete: isAdmin },
  ticket_attachments: {
    select: anyOf(isAdmin, sub('EXISTS (SELECT 1 FROM `tickets` x WHERE x.`id` = t.`ticket_id` AND x.`profile_id` = ?)')),
  },
  ticket_messages: {
    // correção 2: o cliente não vê notas internas
    select: anyOf(isStaff, allOf(sub('t.`ticket_id` IN (SELECT x.`id` FROM `tickets` x WHERE x.`profile_id` = ?)'), col('t.`is_internal` = 0'))),
    insert: async (c, row, lookup) => {
      const uid = uidOf(c); if (!uid || !row.ticket_id) return false
      if (staff(c)) return row.profile_id === uid
      const ownsTicket = await lookup('SELECT 1 FROM `tickets` WHERE `id` = ? AND `profile_id` = ?', [row.ticket_id, uid])
      return ownsTicket && !truthy(row.is_internal) && !truthy(row.is_staff) && (row.profile_id === undefined || row.profile_id === uid)
    },
  },
  tickets: {
    select: anyOf(own('profile_id'), isStaff), insert: rowOwn('profile_id'),
    update: anyOf(own('profile_id'), isStaff), delete: isAdmin,
  },
  whm_accounts: { select: ownOrAdmin('profile_id'), insert: c => admin(c), update: isAdmin, delete: isAdmin },
  whm_package_mappings: adminOnly,
}

function truthy(v: unknown) { return v === true || v === 1 || v === '1' || v === 'true' }

/** Sem política = sem acesso (o RLS também nega por omissão). */
export function policyFor(table: string): TablePolicy {
  return POLICIES[table] ?? {}
}

// Garante que authenticated() não fica sem uso (útil para políticas futuras)
void authenticated
