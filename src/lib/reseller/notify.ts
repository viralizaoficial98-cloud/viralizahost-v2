import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool } from '@/lib/db/pool'
import { sendNoticeEmail } from '@/lib/auth/email'
import { siteUrl } from '@/lib/auth/server'
import { getResellerSettings } from './settings'

// Notificações com os mecanismos existentes: tabela `notifications` (sino do painel e da área de cliente) e
// e-mail transaccional (Resend, registado em auth_email_log). Falhas de envio nunca bloqueiam o fluxo.

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function notifyAdmins(title: string, message: string, link: string) {
  const db = getPool()
  try {
    const [admins] = await db.query("SELECT id FROM profiles WHERE role = 'admin' AND is_active = 1") as any
    for (const a of admins as any[]) await db.query('INSERT INTO notifications (id, profile_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), a.id, 'info', title.slice(0, 200), message.slice(0, 1000), link])
    const s = await getResellerSettings(db)
    for (const to of s.notifyEmails) await sendNoticeEmail(to, `${title} — ViralizaHost`, title, message, { label: 'Abrir no painel', link: `${siteUrl()}${link}` })
  } catch (e) { console.error('[reseller/notify] admins:', (e as Error).message) }
}

export async function notifyClient(profileId: string | null, email: string, title: string, message: string, link = '/revendedor', type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  try {
    if (profileId) await getPool().query('INSERT INTO notifications (id, profile_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), profileId, type, title.slice(0, 200), message.slice(0, 1000), link])
    await sendNoticeEmail(email, `${title} — ViralizaHost`, title, message, { label: 'Ver na área de cliente', link: `${siteUrl()}${link}` }, profileId)
  } catch (e) { console.error('[reseller/notify] client:', (e as Error).message) }
}
