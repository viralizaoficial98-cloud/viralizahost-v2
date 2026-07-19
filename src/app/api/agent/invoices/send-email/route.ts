import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
import { Resend } from 'resend'
import React from 'react'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const auth = await createAuthClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { invoice_id } = await req.json()
    if (!invoice_id) return NextResponse.json({ error: 'invoice_id é obrigatório.' }, { status: 400 })

    const db = createAdminWriteClient()

    // Verify invoice ownership
    const { data: inv, error: invErr } = await db
      .from('invoices')
      .select('id, invoice_number, status, currency, subtotal, discount, tax, total, due_date, issue_date, paid_at, notes, created_at, profile_id, emailed_at')
      .eq('id', invoice_id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (invErr || !inv) return NextResponse.json({ error: 'Factura não encontrada.' }, { status: 404 })

    // Fetch everything needed
    const [itemsResult, profileResult, billingResult] = await Promise.all([
      db.from('invoice_items').select('description, quantity, unit_price, subtotal, position').eq('invoice_id', invoice_id).order('position'),
      db.from('profiles').select('full_name, email, phone, country').eq('id', user.id).maybeSingle(),
      db.from('company_billing_settings').select('company_name, logo_url, email, website, phone, address, bank_name, account_holder, account_number, iban, swift, payment_instructions, footer_text, email_subject_template, email_body_template').eq('active', true).maybeSingle(),
    ])

    const items = itemsResult.data ?? []
    const profile = profileResult.data ?? { full_name: 'Cliente', email: user.email ?? '', phone: null, country: null }
    const billing = billingResult.data ?? {
      company_name: 'ViralizaHost', email: 'comercial@viralizahost.com', website: 'viralizahost.com',
      phone: null, address: null, logo_url: null, bank_name: null, account_holder: null,
      account_number: null, iban: null, swift: null, payment_instructions: null,
      footer_text: null, email_subject_template: null, email_body_template: null,
    }

    if (!profile.email && !user.email) {
      return NextResponse.json({ error: 'Endereço de e-mail do cliente não encontrado.' }, { status: 400 })
    }

    // Generate PDF
    const pdfElement = React.createElement(InvoicePDF, { invoice: inv, items, profile, billing }) as unknown as React.ReactElement<{ title?: string }>
    const pdfBuffer = await renderToBuffer(pdfElement)

    // Build email subject
    const subject = (billing.email_subject_template ?? 'Factura ViralizaHost nº {invoice_number}')
      .replace('{invoice_number}', inv.invoice_number)
      .replace('{service_name}', 'Serviços ViralizaHost')

    const toEmail = (profile.email || user.email) as string
    const clientName = profile.full_name ?? 'Cliente'

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: 'Serviço de e-mail não configurado. Contacte o suporte.' }, { status: 503 })
    }

    const resend = new Resend(resendKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@viralizahost.com'

    const bodyHtml = `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><style>
body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
.container { max-width: 560px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; }
.header { background: #0A0A0A; padding: 24px 32px; }
.header h1 { color: #F5B700; margin: 0; font-size: 20px; }
.header p { color: #ccc; margin: 4px 0 0; font-size: 13px; }
.body { padding: 32px; }
.body p { color: #333; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
.info-box { background: #f9f9f9; border: 1px solid #e8e8e8; border-radius: 6px; padding: 16px; margin: 20px 0; }
.info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
.info-row:last-child { margin-bottom: 0; }
.info-label { color: #888; }
.info-value { color: #0A0A0A; font-weight: bold; }
.total-row { border-top: 2px solid #F5B700; padding-top: 10px; margin-top: 10px; }
.footer { background: #f4f4f4; padding: 16px 32px; font-size: 11px; color: #aaa; text-align: center; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>${billing.company_name}</h1>
    <p>Hospedagem Web · Domínios · E-mails Corporativos</p>
  </div>
  <div class="body">
    <p>Olá, <strong>${clientName}</strong>,</p>
    <p>${billing.email_body_template ?? `Segue em anexo a sua factura nº <strong>${inv.invoice_number}</strong>. Por favor efectue o pagamento até à data de vencimento indicada.`}</p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Nº Factura</span>
        <span class="info-value">${inv.invoice_number}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Data de Emissão</span>
        <span class="info-value">${new Date(inv.issue_date ?? inv.created_at).toLocaleDateString('pt-PT')}</span>
      </div>
      ${inv.due_date ? `<div class="info-row"><span class="info-label">Vencimento</span><span class="info-value">${new Date(inv.due_date).toLocaleDateString('pt-PT')}</span></div>` : ''}
      <div class="info-row total-row">
        <span class="info-label" style="font-size:15px;font-weight:bold;color:#0A0A0A;">TOTAL</span>
        <span class="info-value" style="font-size:15px;color:#0A0A0A;">${inv.currency} ${(inv.total ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
    ${billing.payment_instructions ? `<p style="font-size:13px;color:#555;">${billing.payment_instructions}</p>` : ''}
    <p>Caso tenha alguma questão, responda a este e-mail ou contacte <a href="mailto:${billing.email}" style="color:#F5B700;">${billing.email}</a>.</p>
    <p>Obrigado pela preferência,<br><strong>Equipa ${billing.company_name}</strong></p>
  </div>
  <div class="footer">${billing.footer_text ?? `${billing.company_name} · ${billing.email} · ${billing.website}`}</div>
</div>
</body></html>`

    const { error: emailErr } = await resend.emails.send({
      from: `${billing.company_name} <${fromEmail}>`,
      to: toEmail,
      subject,
      html: bodyHtml,
      attachments: [
        {
          filename: `factura-${inv.invoice_number}.pdf`,
          content: Buffer.from(pdfBuffer),
        },
      ],
    })

    if (emailErr) {
      console.error('[send-email] Resend error:', emailErr)
      return NextResponse.json({ error: 'Erro ao enviar e-mail. Tente novamente.' }, { status: 500 })
    }

    // Record email sent
    await db.from('invoices').update({ emailed_at: new Date().toISOString() }).eq('id', invoice_id)

    return NextResponse.json({
      success: true,
      sent_to: toEmail,
      invoice_number: inv.invoice_number,
    })
  } catch (err) {
    console.error('[/api/agent/invoices/send-email]', err)
    return NextResponse.json({ error: 'Erro interno ao enviar factura.' }, { status: 500 })
  }
}
