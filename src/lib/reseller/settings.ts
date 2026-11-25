import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'

// Modo comercial da Revenda de Hospedagem (linha única em reseller_settings). Todas as restrições são aplicadas
// no servidor (API de pedidos, cotação/checkout, motor de aprovisionamento); a página só reflecte o modo.
//   disabled      planos visíveis com «Em breve»; sem pedidos, compras nem aprovisionamento
//   test          só administradores; servidores de ambiente «test» (simulador / laboratório autorizado); sem pagamentos reais
//   request_only  (inicial) pedidos guardados e analisados; sem cobrança nem criação automática de contas
//   automatic     carrinho/checkout directo — SÓ com autorização expressa do administrador E aprovação técnica da infraestrutura

/* eslint-disable @typescript-eslint/no-explicit-any */
export const RESELLER_MODES = ['disabled', 'test', 'request_only', 'automatic'] as const
export type ResellerMode = (typeof RESELLER_MODES)[number]
export const MODE_LABEL: Record<ResellerMode, string> = { disabled: 'Desactivado', test: 'Teste (só administradores)', request_only: 'Só pedidos (aprovação manual)', automatic: 'Automático' }

export interface ResellerSettings {
  mode: ResellerMode
  automaticAuthorizedAt: string | null; automaticAuthorizedBy: string | null
  infraApprovedAt: string | null; infraApprovedBy: string | null; infraApprovalNote: string | null
  notifyEmails: string[]; requestNotice: string | null; maxOpenPerEmail: number; defaultNameservers: string[]
  /** Venda automática efectivamente permitida (modo + as duas autorizações). */
  automaticReady: boolean
}

export async function getResellerSettings(db: Queryable = getPool()): Promise<ResellerSettings> {
  const [[r]] = await db.query('SELECT * FROM reseller_settings WHERE id = 1').catch(() => [[null]]) as any
  const mode: ResellerMode = r && RESELLER_MODES.includes(r.mode) ? r.mode : 'request_only'
  const list = (v: unknown) => String(v ?? '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)
  const s: ResellerSettings = {
    mode,
    automaticAuthorizedAt: r?.automatic_authorized_at ? new Date(r.automatic_authorized_at).toISOString() : null, automaticAuthorizedBy: r?.automatic_authorized_by ?? null,
    infraApprovedAt: r?.infra_approved_at ? new Date(r.infra_approved_at).toISOString() : null, infraApprovedBy: r?.infra_approved_by ?? null, infraApprovalNote: r?.infra_approval_note ?? null,
    notifyEmails: list(r?.notify_emails), requestNotice: r?.request_notice ?? null, maxOpenPerEmail: Number(r?.max_open_requests_per_email ?? 3),
    defaultNameservers: list(r?.default_nameservers), automaticReady: false,
  }
  s.automaticReady = s.mode === 'automatic' && !!s.automaticAuthorizedAt && !!s.infraApprovedAt
  return s
}

export class ResellerError extends Error { constructor(public code: string, message: string, public status = 400) { super(message) } }

/** Alteração do modo e das autorizações (só depois de requireAdminRole). Regista em activity_logs. */
export async function updateResellerSettings(adminId: string, input: Record<string, unknown>) {
  const db = getPool()
  const cur = await getResellerSettings(db)
  const sets: string[] = [], args: unknown[] = []
  const log: string[] = []
  if (input.mode !== undefined) {
    const mode = String(input.mode) as ResellerMode
    if (!RESELLER_MODES.includes(mode)) throw new ResellerError('mode_invalid', 'Modo inválido.')
    // Venda automática: nunca por omissão; exige as duas autorizações registadas e a confirmação escrita
    if (mode === 'automatic') {
      const auth = input.authorizeAutomatic === true && String(input.confirmText ?? '').trim().toUpperCase() === 'AUTORIZO VENDA AUTOMATICA'
      if (!cur.infraApprovedAt) throw new ResellerError('infra_not_approved', 'Registe primeiro a aprovação técnica da infraestrutura.', 409)
      if (!cur.automaticAuthorizedAt && !auth) throw new ResellerError('automatic_not_authorized', 'Para activar a venda automática escreva «AUTORIZO VENDA AUTOMATICA» e confirme a autorização expressa.', 409)
      if (auth) { sets.push('automatic_authorized_by = ?', 'automatic_authorized_at = CURRENT_TIMESTAMP(6)'); args.push(adminId) }
    }
    sets.push('mode = ?'); args.push(mode); log.push(`modo ${cur.mode} → ${mode}`)
  }
  if (input.revokeAutomatic === true) { sets.push('automatic_authorized_by = NULL', 'automatic_authorized_at = NULL'); log.push('autorização de venda automática revogada'); if ((input.mode ?? cur.mode) === 'automatic') { sets.push("mode = 'request_only'"); log.push('modo → request_only') } }
  if (input.infraApproval !== undefined) {
    if (input.infraApproval === true) {
      const note = String(input.infraApprovalNote ?? '').trim().slice(0, 500)
      if (note.length < 10) throw new ResellerError('note_required', 'Descreva a validação técnica feita (mín. 10 caracteres).')
      sets.push('infra_approved_by = ?', 'infra_approved_at = CURRENT_TIMESTAMP(6)', 'infra_approval_note = ?'); args.push(adminId, note); log.push('aprovação técnica da infraestrutura registada')
    } else { sets.push('infra_approved_by = NULL', 'infra_approved_at = NULL', 'infra_approval_note = NULL'); log.push('aprovação técnica retirada'); if (cur.mode === 'automatic') { sets.push("mode = 'request_only'"); log.push('modo → request_only') } }
  }
  if (input.notifyEmails !== undefined) {
    const emails = String(input.notifyEmails ?? '').split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean)
    if (emails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) || emails.length > 5) throw new ResellerError('emails_invalid', 'E-mails de notificação inválidos (até 5).')
    sets.push('notify_emails = ?'); args.push(emails.join(',') || null); log.push('e-mails de notificação')
  }
  if (input.requestNotice !== undefined) { sets.push('request_notice = ?'); args.push(String(input.requestNotice ?? '').trim().slice(0, 600) || null); log.push('aviso do formulário') }
  if (input.defaultNameservers !== undefined) {
    const ns = String(input.defaultNameservers ?? '').split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean)
    if (ns.length > 4 || ns.some(n => !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(n))) throw new ResellerError('ns_invalid', 'Nameservers inválidos (até 4).')
    sets.push('default_nameservers = ?'); args.push(ns.join(',') || null); log.push('nameservers')
  }
  if (input.maxOpenPerEmail !== undefined) {
    const n = Number(input.maxOpenPerEmail)
    if (!Number.isInteger(n) || n < 1 || n > 20) throw new ResellerError('max_invalid', 'Limite de pedidos em aberto por e-mail: 1 a 20.')
    sets.push('max_open_requests_per_email = ?'); args.push(n)
  }
  if (!sets.length) return cur
  sets.push('updated_by = ?'); args.push(adminId)
  await db.query(`UPDATE reseller_settings SET ${sets.join(', ')} WHERE id = 1`, args)
  await audit(adminId, 'update', 'reseller_settings', null, `Revenda: ${log.join('; ') || 'configuração'}`)
  return getResellerSettings(db)
}

/** Auditoria de operações sensíveis (activity_logs). Nunca inclui senhas, tokens nem URLs de sessão. */
export async function audit(actorId: string | null, action: 'create' | 'update' | 'delete' | 'payment' | 'suspend' | 'activate' | 'login', entityType: string, entityId: string | null, description: string, metadata?: Record<string, unknown>) {
  await getPool().query('INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description, metadata) VALUES (UUID(), ?, ?, ?, ?, ?, ?)',
    [actorId, action, entityType, entityId && /^[0-9a-f-]{36}$/i.test(entityId) ? entityId : null, description.slice(0, 1000), metadata ? JSON.stringify(metadata) : null])
    .catch(e => console.error('[reseller/audit]', (e as Error).message))
}
