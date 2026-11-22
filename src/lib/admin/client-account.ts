import 'server-only'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'

// Eliminação e suspensão de contas de cliente do PORTAL.
//   * Nunca toca no WHM: não chama a API do WHM nem apaga contas cPanel.
//   * Contas administrativas (role 'admin') e a própria conta do administrador são protegidas.
//   * Eliminar só é possível sem dependências: facturas, pagamentos, encomendas, serviços,
//     hospedagem, vínculo WHM, domínios, caixas de e-mail ou tickets. Atenção: na base,
//     apagar auth_users faz CASCADE para várias destas tabelas — por isso a verificação é
//     repetida dentro da transacção, com a linha do perfil bloqueada.
//   * Com dependências, a acção adequada é suspender o acesso ao portal (reversível).

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export class AccountError extends Error {
  constructor(public code: string, message: string, public status = 400, public extra: Record<string, unknown> = {}) { super(message) }
}

export interface Blocker { code: string; label: string; count: number }
export interface Assessment {
  account: { id: string; email: string; full_name: string; role: string; is_active: boolean; email_verified: boolean }
  eligible: boolean
  blockers: Blocker[]
  canSuspend: boolean
}

const DEPENDENCIES: { code: string; label: (n: number) => string; sql: string }[] = [
  { code: 'invoices', label: n => `${n} factura(s) — histórico financeiro`, sql: 'SELECT COUNT(*) n FROM invoices WHERE profile_id = ?' },
  { code: 'payments', label: n => `${n} pagamento(s) registado(s)`, sql: 'SELECT COUNT(*) n FROM payments WHERE profile_id = ?' },
  { code: 'orders', label: n => `${n} encomenda(s)`, sql: 'SELECT COUNT(*) n FROM orders WHERE user_id = ?' },
  { code: 'services', label: n => `${n} serviço(s)`, sql: 'SELECT COUNT(*) n FROM services WHERE profile_id = ?' },
  { code: 'hosting', label: n => `${n} conta(s) de hospedagem (cPanel)`, sql: 'SELECT COUNT(*) n FROM hosting_accounts WHERE profile_id = ?' },
  { code: 'whm', label: n => `${n} conta(s) WHM associada(s)`, sql: 'SELECT COUNT(*) n FROM whm_accounts WHERE profile_id = ?' },
  { code: 'domains', label: n => `${n} domínio(s)`, sql: 'SELECT COUNT(*) n FROM domains WHERE profile_id = ?' },
  { code: 'mailboxes', label: n => `${n} caixa(s) de e-mail registada(s)`, sql: 'SELECT COUNT(*) n FROM emails WHERE profile_id = ?' },
  { code: 'tickets', label: n => `${n} ticket(s) de suporte`, sql: 'SELECT COUNT(*) n FROM tickets WHERE profile_id = ?' },
]

async function load(db: Queryable, profileId: string, lock = false) {
  const [p] = await rows(db, `SELECT p.id, p.email, p.full_name, p.role, p.is_active, u.email_confirmed_at, u.id AS auth_id
    FROM profiles p LEFT JOIN auth_users u ON u.id = p.id WHERE p.id = ?${lock ? ' FOR UPDATE' : ''}`, [profileId])
  if (!p) throw new AccountError('not_found', 'Conta não encontrada (pode já ter sido eliminada).', 404)
  return p
}

async function assessWith(db: Queryable, profileId: string, adminId: string, lock = false): Promise<Assessment> {
  const p = await load(db, profileId, lock)
  const blockers: Blocker[] = []
  if (p.id === adminId) blockers.push({ code: 'self', label: 'É a sua própria conta', count: 1 })
  if (p.role !== 'client') blockers.push({ code: 'protected_role', label: p.role === 'admin' ? 'Conta administrativa — protegida' : `Conta com papel «${p.role}» — protegida`, count: 1 })
  for (const d of DEPENDENCIES) {
    const [r] = await rows(db, d.sql, [p.id])
    const n = Number(r?.n ?? 0)
    if (n > 0) blockers.push({ code: d.code, label: d.label(n), count: n })
  }
  return {
    account: { id: p.id, email: p.email, full_name: p.full_name ?? '', role: p.role, is_active: !!Number(p.is_active), email_verified: !!p.email_confirmed_at },
    eligible: blockers.length === 0,
    blockers,
    canSuspend: p.role === 'client' && p.id !== adminId,
  }
}

export function assessClient(profileId: string, adminId: string) {
  return assessWith(getPool(), profileId, adminId)
}

const log = (db: Queryable, adminId: string, entityId: string | null, description: string) =>
  db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'profile', ?, ?)", [adminId, entityId, description])

/** Elimina a conta do portal (autenticação, perfil, sessões, tokens). Nunca o WHM. */
export async function deleteClientAccount(profileId: string, adminId: string, confirmEmail: string) {
  return withTransaction(async conn => {
    const a = await assessWith(conn, profileId, adminId, true)
    if (confirmEmail.trim().toLowerCase() !== a.account.email.toLowerCase()) {
      throw new AccountError('confirmation_mismatch', 'Escreva o e-mail exacto da conta para confirmar a eliminação.', 400)
    }
    if (!a.eligible) throw new AccountError('blocked', 'A eliminação está bloqueada.', 409, { blockers: a.blockers, canSuspend: a.canSuspend })
    // Referências sem chave estrangeira: deixam de apontar para a conta
    await conn.query('UPDATE whm_accounts SET link_candidate_profile_id = NULL, link_candidate_reason = NULL WHERE link_candidate_profile_id = ?', [profileId])
    await conn.query('UPDATE quote_requests SET profile_id = NULL WHERE profile_id = ?', [profileId])
    await conn.query('DELETE FROM auth_email_log WHERE user_id = ?', [profileId])
    await conn.query('DELETE FROM auth_sessions WHERE user_id = ?', [profileId])
    await conn.query('DELETE FROM auth_tokens WHERE user_id = ?', [profileId])
    // auth_users → profiles → clients/notificações (CASCADE). As dependências financeiras
    // e de hospedagem já foram verificadas como inexistentes, com o perfil bloqueado.
    await conn.query('DELETE FROM auth_users WHERE id = ?', [profileId])
    await conn.query('DELETE FROM profiles WHERE id = ?', [profileId]) // perfil sem auth_users (dados antigos)
    await log(conn, adminId, null, `client_delete: conta ${a.account.email} eliminada do portal (WHM não alterado)`)
    return { deleted: true, email: a.account.email }
  })
}

/** Suspende ou reactiva o acesso ao PORTAL (não suspende a conta WHM). */
export async function setPortalAccess(profileId: string, adminId: string, active: boolean) {
  return withTransaction(async conn => {
    const p = await load(conn, profileId, true)
    if (p.role !== 'client') throw new AccountError('protected_role', 'Contas administrativas não podem ser suspensas aqui.', 403)
    if (p.id === adminId) throw new AccountError('self', 'Não pode suspender a sua própria conta.', 403)
    await conn.query('UPDATE profiles SET is_active = ? WHERE id = ?', [active ? 1 : 0, profileId])
    await conn.query(`UPDATE auth_users SET banned_until = ${active ? 'NULL' : 'CURRENT_TIMESTAMP(6) + INTERVAL 100 YEAR'} WHERE id = ?`, [profileId])
    if (!active) await conn.query('DELETE FROM auth_sessions WHERE user_id = ?', [profileId])
    await log(conn, adminId, profileId, `portal_${active ? 'reactivate' : 'suspend'}: ${p.email}`)
    return { active }
  })
}
