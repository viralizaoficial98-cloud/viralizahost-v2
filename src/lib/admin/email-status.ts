import 'server-only'
import { getPool } from '@/lib/db/pool'
import { siteUrl } from '@/lib/auth/server'
import { emailFrom, fetchDeliveryEvent, resendApi, sendAuthEmail } from '@/lib/auth/email'
import { checkMailDomain, publicResolver } from '@/lib/auth/mail-domain'

// Diagnóstico do envio de e-mails de autenticação, lido do PROCESSO em execução.
// Mostra só presença/ausência de segredos — nunca valores, tokens nem links.

/* eslint-disable @typescript-eslint/no-explicit-any */
export function emailConfig() {
  const from = emailFrom()
  const url = siteUrl()
  return {
    keyPresent: !!process.env.RESEND_API_KEY,
    fromEmail: from.email,
    fromEmailSet: !!process.env.RESEND_FROM_EMAIL,
    fromName: from.name,
    fromNameSet: !!process.env.RESEND_FROM_NAME,
    fromDomain: from.email.split('@')[1] ?? '',
    confirmationRequired: process.env.AUTH_EMAIL_CONFIRMATION !== 'false',
    linkBase: url,
    linkBaseOk: url === 'https://viralizahost.com',
    simulated: !!process.env.RESEND_API_URL,
  }
}

/** Estado do domínio do remetente no Resend (exige chave com permissão de leitura). */
export async function senderDomainStatus() {
  const key = process.env.RESEND_API_KEY
  const domain = emailFrom().email.split('@')[1] ?? ''
  if (!key) return { ok: false, message: 'RESEND_API_KEY não está disponível ao processo.' }
  try {
    const res = await fetch(`${resendApi()}/domains`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    const j = await res.json().catch(() => ({})) as { data?: { name: string; status: string; region?: string }[]; name?: string; message?: string }
    if (res.status === 401 && j.name === 'restricted_api_key') return { ok: false, restricted: true, message: 'A chave só tem permissão de envio: confirme o domínio no painel do Resend (Domains) ou use uma chave «Full access» só para este diagnóstico.' }
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'O Resend recusou a chave (inválida ou revogada).' }
    if (!res.ok) return { ok: false, message: `Resend respondeu HTTP ${res.status}.` }
    const d = (j.data ?? []).find(x => x.name.toLowerCase() === domain.toLowerCase())
    if (!d) return { ok: false, domain, message: `O domínio ${domain} não está registado nesta conta do Resend: os envios de ${emailFrom().email} são recusados.` }
    return { ok: d.status === 'verified', domain, status: d.status, region: d.region ?? null, message: d.status === 'verified' ? `Domínio ${domain} verificado no Resend.` : `Domínio ${domain} no estado «${d.status}»: publique/corrija os registos DNS (SPF, DKIM) indicados no Resend.` }
  } catch (e) { return { ok: false, message: `Sem ligação ao Resend: ${(e as Error).message.slice(0, 120)}` } }
}

export async function recentEmails(limit = 20) {
  const [r] = await getPool().query('SELECT id, user_id, kind, recipient, provider_id, status, error, last_event, last_event_at, created_at FROM auth_email_log ORDER BY created_at DESC LIMIT ?', [limit]) as any
  return r as any[]
}

/** Consulta no Resend o último evento (enviado, entregue, devolvido…) das mensagens aceites recentes. */
export async function refreshDeliveryEvents(limit = 20) {
  const [r] = await getPool().query("SELECT provider_id FROM auth_email_log WHERE status = 'accepted' AND provider_id IS NOT NULL AND created_at > CURRENT_TIMESTAMP(6) - INTERVAL 7 DAY ORDER BY created_at DESC LIMIT ?", [limit]) as any
  let updated = 0, failed: string | null = null
  for (const row of r as any[]) {
    const ev = await fetchDeliveryEvent(row.provider_id)
    if (ev.ok) updated++; else failed = ev.error ?? 'erro'
  }
  return { checked: (r as any[]).length, updated, error: failed }
}

export function sendTestEmail(to: string) {
  return sendAuthEmail('test', to, siteUrl())
}

/**
 * Registos DNS públicos que o Resend exige para o domínio do remetente (lidos pelo servidor):
 * MX e SPF (TXT) em send.<domínio> e a chave DKIM em resend._domainkey.<domínio>.
 * Funciona mesmo com uma chave só de envio.
 */
export async function senderDnsRecords() {
  const domain = emailFrom().email.split('@')[1] ?? ''
  if (process.env.EMAIL_DNS_CHECK === 'test' || process.env.EMAIL_DNS_CHECK === 'off') return { domain, checks: [] as { record: string; ok: boolean; detail: string }[], skipped: true }
  const dns = publicResolver()
  const txt = async (n: string) => (await dns.resolveTxt(n).catch(() => [] as string[][])).map(r => r.join(''))
  const mx = await dns.resolveMx(`send.${domain}`).catch(() => [])
  const spf = (await txt(`send.${domain}`)).find(t => t.startsWith('v=spf1'))
  const dkim = (await txt(`resend._domainkey.${domain}`)).find(t => t.includes('p='))
  const checks = [
    { record: `MX send.${domain}`, ok: mx.some(r => /amazonses\.com$/.test(r.exchange)), detail: mx.map(r => r.exchange).join(', ') || 'em falta' },
    { record: `TXT (SPF) send.${domain}`, ok: !!spf && /include:amazonses\.com/.test(spf), detail: spf ?? 'em falta' },
    { record: `TXT (DKIM) resend._domainkey.${domain}`, ok: !!dkim, detail: dkim ? 'publicado' : 'em falta' },
  ]
  return { domain, checks, skipped: false }
}

/** Diagnóstico de um destinatário: conta, domínio de correio e últimas tentativas (só administradores). */
export async function recipientStatus(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase()
  const [[u]] = await getPool().query(`SELECT u.id, u.email_confirmed_at, u.banned_until > CURRENT_TIMESTAMP(6) AS banned, p.role
    FROM auth_users u LEFT JOIN profiles p ON p.id = u.id WHERE u.email = ? LIMIT 1`, [email]) as any
  const [[similar]] = u ? [[null]] : await getPool().query(`SELECT COUNT(*) n FROM auth_users WHERE email LIKE ?`, [`%${email.split('@')[0].replace(/[\\%_]/g, '')}%`]) as any
  const [log] = await getPool().query('SELECT kind, status, error, last_event, created_at, provider_id IS NOT NULL AS has_id FROM auth_email_log WHERE recipient = ? ORDER BY created_at DESC LIMIT 10', [email]) as any
  return {
    email,
    account: u ? { exists: true, verified: !!u.email_confirmed_at, suspended: !!Number(u.banned), role: u.role, eligibleForResend: !u.email_confirmed_at && !Number(u.banned) } : { exists: false, similarAccounts: Number(similar?.n ?? 0) },
    domain: await checkMailDomain(email),
    attempts: log as any[],
  }
}
