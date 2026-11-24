import 'server-only'
import { getPool } from '@/lib/db/pool'

// Configurações → Contas. Lido da base em CADA pedido (sem cache): uma alteração no painel entra em vigor
// de imediato, sem reiniciar o servidor. Sem valor guardado, mantém o comportamento anterior, definido pela
// variável AUTH_EMAIL_CONFIRMATION (≠ 'false' → confirmação exigida).

/* eslint-disable @typescript-eslint/no-explicit-any */
const envDefault = () => process.env.AUTH_EMAIL_CONFIRMATION !== 'false'

export interface AccountSettings {
  emailConfirmationRequired: boolean
  /** 'panel' = guardado em Configurações → Contas; 'default' = valor inicial (AUTH_EMAIL_CONFIRMATION) */
  source: 'panel' | 'default'
  updatedAt: string | null
  updatedBy: string | null
}

export async function getAccountSettings(): Promise<AccountSettings> {
  const [[r]] = await getPool().query(
    'SELECT s.email_confirmation_required v, s.updated_at, p.email updated_by FROM account_settings s LEFT JOIN profiles p ON p.id = s.updated_by WHERE s.id = 1') as any
  if (!r || r.v == null) return { emailConfirmationRequired: envDefault(), source: 'default', updatedAt: null, updatedBy: null }
  return { emailConfirmationRequired: !!Number(r.v), source: 'panel', updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null, updatedBy: r.updated_by ?? null }
}

/** Regra aplicada a TODOS os registos de clientes (formulário de registo e checkout). */
export async function emailConfirmationRequired(): Promise<boolean> {
  try { return (await getAccountSettings()).emailConfirmationRequired } catch { return envDefault() }
}

/** Só chamado depois de requireAdminRole(); regista a alteração em activity_logs. */
export async function setEmailConfirmationRequired(required: boolean, adminId: string) {
  const before = await getAccountSettings()
  await getPool().query(
    `INSERT INTO account_settings (id, email_confirmation_required, updated_by) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE email_confirmation_required = VALUES(email_confirmation_required), updated_by = VALUES(updated_by)`, [required ? 1 : 0, adminId])
  if (before.emailConfirmationRequired !== required || before.source === 'default') {
    await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'settings', 'accounts', ?)",
      [adminId, `Contas: confirmação de e-mail para novos clientes ${required ? 'EXIGIDA' : 'NÃO exigida'} (antes: ${before.emailConfirmationRequired ? 'exigida' : 'não exigida'}${before.source === 'default' ? ', valor inicial' : ''})`]).catch(() => {})
  }
  return getAccountSettings()
}
