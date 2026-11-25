import 'server-only'
import { getPool } from '@/lib/db/pool'

/**
 * Filtro de pesquisa das contas WHM (domínio, utilizador, e-mail de contacto, nome/e-mail do cliente associado),
 * aplicado na BASE antes da paginação — antes era aplicado só às 50 linhas da página actual, e uma conta noutra
 * página nunca era encontrada. Devolve uma expressão para `.or()` ou `null` (sem pesquisa / nada a procurar).
 */
export async function whmSearchOr(raw: string | null | undefined): Promise<string | null> {
  // Só caracteres seguros na expressão (sem vírgulas, parênteses, aspas nem curingas)
  const term = String(raw ?? '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}@._\- ]/gu, '').trim().slice(0, 80)
  if (!term) return null
  const like = `%${term.replace(/[\\%_]/g, m => '\\' + m)}%`
  const [rows] = await getPool().query('SELECT id FROM profiles WHERE full_name LIKE ? OR email LIKE ? LIMIT 500', [like, like]) as unknown as [{ id: string }[]]
  const t = `*${term.replace(/_/g, '\\_')}*`
  const parts = [`primary_domain.ilike.${t}`, `whm_username.ilike.${t}`, `contact_email.ilike.${t}`]
  if (rows.length) parts.push(`profile_id.in.(${rows.map(r => r.id).join(',')})`)
  return parts.join(',')
}
