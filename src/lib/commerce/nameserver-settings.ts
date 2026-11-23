import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'
import { FALLBACK_NAMESERVERS, validateNameservers, type NameserverChoice } from './nameservers'

// Nameservers padrão da ViralizaHost: Integrações → Registrador (registrar_settings.default_nameservers).
// Sem configuração, ns1/ns2.viralizahost.com.

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getDefaultNameservers(db: Queryable = getPool()): Promise<string[]> {
  try {
    const [rows] = await db.query('SELECT default_nameservers FROM registrar_settings WHERE id = 1') as any
    const raw = rows[0]?.default_nameservers
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(list) && list.length >= 2) return list.map(String)
  } catch { /* coluna ainda não migrada ou JSON inválido → valores de origem */ }
  return [...FALLBACK_NAMESERVERS]
}

export async function saveDefaultNameservers(list: unknown[], adminId: string) {
  const v = validateNameservers({ useDefault: false, ns: list })
  if (!v.ok) throw new Error(v.message)
  await getPool().query(
    `INSERT INTO registrar_settings (id, default_nameservers, updated_by) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE default_nameservers = VALUES(default_nameservers), updated_by = VALUES(updated_by)`,
    [JSON.stringify(v.value.ns), adminId],
  )
  return v.value.ns
}

/** Lista efectiva (a que vai para o registrador/equipa) de uma escolha já validada. */
export function effectiveNameservers(choice: NameserverChoice, defaults: string[]): string[] {
  return choice.useDefault ? defaults : choice.ns
}
