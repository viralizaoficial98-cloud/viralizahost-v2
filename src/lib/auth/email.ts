import 'server-only'
import { Resend } from 'resend'

// E-mails de autenticação (antes enviados pelo Supabase Auth).
// Usa a mesma conta Resend das facturas: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME.

type Kind = 'recovery' | 'signup'

const TEMPLATES: Record<Kind, { subject: string; title: string; text: string; cta: string }> = {
  recovery: {
    subject: 'Redefinir a sua senha — ViralizaHost',
    title: 'Redefinição de senha',
    text: 'Recebemos um pedido para redefinir a senha da sua conta ViralizaHost. O link é válido durante 60 minutos. Se não fez este pedido, ignore este e-mail.',
    cta: 'Redefinir senha',
  },
  signup: {
    subject: 'Confirme o seu e-mail — ViralizaHost',
    title: 'Confirme o seu e-mail',
    text: 'Obrigado por criar a sua conta na ViralizaHost. Confirme o seu endereço de e-mail para activar a conta. O link é válido durante 24 horas.',
    cta: 'Confirmar e-mail',
  },
}

export async function sendAuthEmail(kind: Kind, to: string, link: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error(`[auth/email] RESEND_API_KEY em falta — e-mail "${kind}" não enviado`)
    return { ok: false, error: 'Serviço de e-mail não configurado.' }
  }
  const t = TEMPLATES[kind]
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'comercial@viralizahost.com'
  const fromName = process.env.RESEND_FROM_NAME ?? 'ViralizaHost'
  const html = `<!doctype html><html><body style="margin:0;background:#0D0D0D;font-family:Arial,sans-serif;color:#fff">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="100%" style="max-width:520px;background:#141414;border:1px solid rgba(245,183,0,.25);border-radius:16px">
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;color:#F5B700">${t.title}</h1>
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#ccc">${t.text}</p>
<a href="${link}" style="display:inline-block;background:#F5B700;color:#000;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:10px">${t.cta}</a>
<p style="margin:24px 0 0;font-size:12px;color:#777;word-break:break-all">Se o botão não funcionar, copie este endereço: ${link}</p>
</td></tr></table></td></tr></table></body></html>`
  try {
    const resend = new Resend(key)
    const { error } = await resend.emails.send({ from: `${fromName} <${fromEmail}>`, to, subject: t.subject, html })
    if (error) {
      console.error(`[auth/email] falha ao enviar "${kind}":`, error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e) {
    console.error(`[auth/email] erro ao enviar "${kind}":`, (e as Error).message)
    return { ok: false, error: 'Falha ao enviar e-mail.' }
  }
}
