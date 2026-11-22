import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool } from '@/lib/db/pool'
import { checkMailDomain } from './mail-domain'

// E-mails de autenticação (verificação de conta, recuperação de senha, teste do painel).
// Variáveis lidas pelo processo em execução: RESEND_API_KEY (obrigatória),
// RESEND_FROM_EMAIL e RESEND_FROM_NAME (com valores por omissão). RESEND_API_URL só no ensaio.
// Cada pedido fica em auth_email_log com o id devolvido pelo Resend — nunca o link nem o token.
// «Aceite» (o Resend devolveu um id) ≠ «entregue» (evento do Resend, consultado depois).

export type Kind = 'recovery' | 'signup' | 'test'

const TEMPLATES: Record<Kind, { subject: string; title: string; text: string; cta: string }> = {
  recovery: {
    subject: 'Redefinir a sua senha — ViralizaHost',
    title: 'Redefinição de senha',
    text: 'Recebemos um pedido para redefinir a senha da sua conta ViralizaHost. O link é válido durante 60 minutos e só pode ser usado uma vez. Se não fez este pedido, ignore este e-mail.',
    cta: 'Redefinir senha',
  },
  signup: {
    subject: 'Confirme o seu e-mail — ViralizaHost',
    title: 'Confirme o seu e-mail',
    text: 'Obrigado por criar a sua conta na ViralizaHost. Confirme o seu endereço de e-mail para activar a conta. O link é válido durante 24 horas e só pode ser usado uma vez.',
    cta: 'Confirmar e-mail',
  },
  test: {
    subject: 'Teste de envio — ViralizaHost',
    title: 'Teste de envio',
    text: 'Mensagem de teste enviada a partir do painel de administração da ViralizaHost para confirmar a entrega de e-mails.',
    cta: 'Abrir a ViralizaHost',
  },
}

export const resendApi = () => (process.env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '')
export const emailFrom = () => ({ email: process.env.RESEND_FROM_EMAIL || 'comercial@viralizahost.com', name: process.env.RESEND_FROM_NAME || 'ViralizaHost' })
const clean = (s: unknown) => String(s ?? '').replace(/re_[A-Za-z0-9_]{8,}/g, '[chave]').replace(/https?:\/\/\S+/g, '[url]').slice(0, 300)

export type LogStatus = 'accepted' | 'failed' | 'not_configured' | 'skipped' | 'rate_limited' | 'undeliverable'

/** Regista uma tentativa (também as que não chegam ao Resend). Nunca guarda o link nem o token. */
export async function record(kind: Kind, to: string, userId: string | null, status: LogStatus, providerId: string | null, error: string | null) {
  await getPool().query('INSERT INTO auth_email_log (id, user_id, kind, recipient, provider_id, status, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), userId, kind, to.toLowerCase(), providerId, status, error]).catch(e => console.error('[auth/email] registo falhou:', (e as Error).message))
}

export async function sendAuthEmail(kind: Kind, to: string, link: string, userId: string | null = null): Promise<{ ok: boolean; id?: string; error?: string; undeliverable?: boolean }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error(`[auth/email] RESEND_API_KEY em falta — e-mail "${kind}" não enviado`)
    await record(kind, to, userId, 'not_configured', null, 'RESEND_API_KEY em falta no processo')
    return { ok: false, error: 'Serviço de e-mail não configurado.' }
  }
  // Domínio de destino sem servidor de correio na Internet: não chamar o Resend (a mensagem
  // seria devolvida e o endereço ficaria suprimido). A conta continua por verificar.
  const dest = await checkMailDomain(to)
  if (dest.deliverable === false) {
    console.warn(`[auth/email] "${kind}" não enviado: ${dest.message}`)
    await record(kind, to, userId, 'undeliverable', null, dest.message)
    return { ok: false, error: dest.message, undeliverable: true }
  }
  const t = TEMPLATES[kind]
  const from = emailFrom()
  const html = `<!doctype html><html><body style="margin:0;background:#0D0D0D;font-family:Arial,sans-serif;color:#fff">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="100%" style="max-width:520px;background:#141414;border:1px solid rgba(245,183,0,.25);border-radius:16px">
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;color:#F5B700">${t.title}</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#ccc">${t.text}</p>
<a href="${link}" style="display:inline-block;background:#F5B700;color:#000;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:10px">${t.cta}</a>
<p style="margin:24px 0 0;font-size:12px;color:#777;word-break:break-all">Se o botão não funcionar, copie este endereço: ${link}</p>
</td></tr></table></td></tr></table></body></html>`
  const text = `${t.title}\n\n${t.text}\n\n${t.cta}: ${link}\n`
  try {
    const res = await fetch(`${resendApi()}/emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${from.name} <${from.email}>`, to: [to], subject: t.subject, html, text }),
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    const j = await res.json().catch(() => ({})) as { id?: string; message?: string; name?: string }
    if (!res.ok || !j.id) {
      const err = clean(`HTTP ${res.status}${j.name ? ` ${j.name}` : ''}: ${j.message ?? 'sem detalhe'}`)
      console.error(`[auth/email] Resend recusou "${kind}": ${err}`)
      await record(kind, to, userId, 'failed', null, err)
      return { ok: false, error: err }
    }
    await record(kind, to, userId, 'accepted', j.id, null)
    return { ok: true, id: j.id }
  } catch (e) {
    const err = clean((e as Error).name === 'TimeoutError' ? 'Sem resposta do Resend (timeout)' : (e as Error).message)
    console.error(`[auth/email] erro ao enviar "${kind}": ${err}`)
    await record(kind, to, userId, 'failed', null, err)
    return { ok: false, error: err }
  }
}

/** Estado de entrega de uma mensagem aceite (evento mais recente no Resend). */
export async function fetchDeliveryEvent(providerId: string): Promise<{ ok: boolean; lastEvent?: string; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, error: 'RESEND_API_KEY em falta' }
  try {
    const res = await fetch(`${resendApi()}/emails/${encodeURIComponent(providerId)}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000), cache: 'no-store' })
    const j = await res.json().catch(() => ({})) as { last_event?: string; message?: string; name?: string }
    if (!res.ok) return { ok: false, error: clean(`HTTP ${res.status}${j.name ? ` ${j.name}` : ''}: ${j.message ?? ''}`) }
    if (j.last_event) await getPool().query('UPDATE auth_email_log SET last_event = ?, last_event_at = CURRENT_TIMESTAMP(6) WHERE provider_id = ?', [j.last_event, providerId])
    return { ok: true, lastEvent: j.last_event }
  } catch (e) { return { ok: false, error: clean((e as Error).message) } }
}
