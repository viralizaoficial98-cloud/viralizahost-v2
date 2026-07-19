/**
 * send-invoice-email.ts
 *
 * Função central e autoritativa para geração e envio de facturas por e-mail.
 * APENAS o backend deve chamar esta função — nunca expor ao frontend.
 */
import { renderToBuffer } from '@react-pdf/renderer'
import { Resend } from 'resend'
import React from 'react'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface SendInvoiceOptions {
  invoiceId: string
  customerId: string               // UUID autenticado no servidor — nunca do frontend
  db: AnySupabaseClient            // cliente admin (service_role)
  initiatedByUserId?: string       // quem disparou (agente ou admin)
  initiatedByAgent?: boolean
  orderId?: string
  ticketId?: string
  forceResend?: boolean            // reenvio explícito ignora idempotência
}

export interface SendInvoiceResult {
  success: boolean
  invoiceId: string
  invoiceNumber?: string
  sentTo?: string
  providerMessageId?: string
  downloadUrl?: string | null
  code?: string
  message?: string
  details?: string
}

// ─────────────────────────────────────────────────────────────
// Constantes de erro estruturadas
// ─────────────────────────────────────────────────────────────
const ERR = {
  NO_API_KEY:           { code: 'RESEND_KEY_MISSING',        message: 'Serviço de e-mail não configurado no servidor.' },
  INVOICE_NOT_FOUND:    { code: 'INVOICE_NOT_FOUND',         message: 'Factura não encontrada ou não pertence ao cliente.' },
  EMAIL_NOT_FOUND:      { code: 'CUSTOMER_EMAIL_MISSING',    message: 'E-mail do cliente não encontrado na base de dados.' },
  ALREADY_SENT:         { code: 'INVOICE_ALREADY_SENT',      message: 'Esta factura já foi enviada. Use forceResend=true para reenviar.' },
  PDF_GENERATION_FAILED:{ code: 'PDF_GENERATION_FAILED',     message: 'Falha ao gerar o PDF da factura.' },
  STORAGE_UPLOAD_FAILED:{ code: 'STORAGE_UPLOAD_FAILED',     message: 'Falha ao guardar o PDF no armazenamento.' },
  RESEND_ERROR:         { code: 'INVOICE_EMAIL_FAILED',       message: 'Não foi possível enviar a factura por e-mail.' },
  DOMAIN_NOT_VERIFIED:  { code: 'RESEND_DOMAIN_NOT_VERIFIED', message: 'O domínio do remetente não está verificado no Resend.' },
} as const

// ─────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────

export async function sendInvoiceEmail(opts: SendInvoiceOptions): Promise<SendInvoiceResult> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { invoiceId, customerId, db, initiatedByUserId, initiatedByAgent = false, orderId, ticketId, forceResend = false } = opts

  // ── 1. Verificar chave Resend ──────────────────────────────
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey || resendKey.trim() === '' || resendKey.startsWith('re_YOUR')) {
    await logAttempt(db, { invoiceId, customerId, orderId, ticketId, initiatedByUserId, initiatedByAgent,
      status: 'failed', error: ERR.NO_API_KEY.message })
    return { success: false, invoiceId, ...ERR.NO_API_KEY }
  }

  // ── 2. Carregar factura (verifica propriedade) ─────────────
  const { data: inv, error: invErr } = await db
    .from('invoices')
    .select('id, invoice_number, status, currency, subtotal, discount, tax, total, due_date, issue_date, paid_at, notes, created_at, profile_id, email_to, email_provider_id, email_status, email_attempts, pdf_storage_path, order_id, ticket_id')
    .eq('id', invoiceId)
    .eq('profile_id', customerId)
    .maybeSingle()

  if (invErr || !inv) {
    return { success: false, invoiceId, ...ERR.INVOICE_NOT_FOUND }
  }

  // ── 3. Idempotência — prevenir envio duplicado ─────────────
  if (!forceResend && inv.email_status === 'sent' && inv.email_provider_id) {
    // Gerar nova URL assinada mas não reenviar
    const storagePath = inv.pdf_storage_path
    let downloadUrl: string | null = null
    if (storagePath) {
      const { data: signed } = await db.storage.from('invoices').createSignedUrl(storagePath, 3600)
      downloadUrl = signed?.signedUrl ?? null
    }
    return {
      success: true,
      invoiceId,
      invoiceNumber: inv.invoice_number,
      sentTo: inv.email_to ?? undefined,
      providerMessageId: inv.email_provider_id ?? undefined,
      downloadUrl,
      code: 'ALREADY_SENT_PREVIOUSLY',
      message: `Factura já enviada anteriormente para ${inv.email_to}. Use reenvio para mandar novamente.`,
    }
  }

  // ── 4. Carregar perfil do cliente ─────────────────────────
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email, phone, country')
    .eq('id', customerId)
    .maybeSingle()

  // Nunca confiar no e-mail enviado pelo frontend — buscar sempre da DB
  const toEmail = profile?.email?.trim()
  if (!toEmail) {
    return { success: false, invoiceId, ...ERR.EMAIL_NOT_FOUND }
  }

  const clientName = profile?.full_name ?? 'Cliente'

  // ── 5. Carregar itens e dados de facturação ───────────────
  const [itemsResult, billingResult, orderResult] = await Promise.all([
    db.from('invoice_items').select('description, quantity, unit_price, subtotal, position').eq('invoice_id', invoiceId).order('position'),
    db.from('company_billing_settings').select('company_name, logo_url, email, website, phone, address, bank_name, account_holder, account_number, iban, swift, payment_instructions, footer_text, email_subject_template, email_body_template').eq('active', true).maybeSingle(),
    orderId ? db.from('orders').select('id, billing_cycle, domain_name, domain_action, amount, created_at').eq('id', orderId).maybeSingle() : Promise.resolve({ data: null }),
    ticketId ? db.from('ticket_messages') : null,
  ])

  const items = itemsResult.data ?? []
  const order = orderResult.data ?? null
  const billing = billingResult.data ?? {
    company_name: 'ViralizaHost', email: 'comercial@viralizahost.com',
    website: 'viralizahost.com', phone: null, address: null, logo_url: null,
    bank_name: null, account_holder: null, account_number: null,
    iban: null, swift: null, payment_instructions: null, footer_text: null,
    email_subject_template: null, email_body_template: null,
  }

  // ── 6. Gerar PDF ──────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    const pdfEl = React.createElement(InvoicePDF, {
      invoice: inv,
      items,
      profile: { full_name: profile?.full_name ?? null, email: toEmail, phone: profile?.phone ?? null, country: profile?.country ?? null },
      billing,
      order: order ? { billing_cycle: order.billing_cycle, domain_name: order.domain_name } : undefined,
    }) as unknown as React.ReactElement<{ title?: string }>
    pdfBuffer = Buffer.from(await renderToBuffer(pdfEl))
  } catch (pdfErr) {
    console.error('[sendInvoiceEmail] PDF error:', pdfErr)
    await logAttempt(db, { invoiceId, customerId, orderId, ticketId, initiatedByUserId, initiatedByAgent,
      status: 'failed', error: `PDF: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}` })
    return { success: false, invoiceId, ...ERR.PDF_GENERATION_FAILED }
  }

  // ── 7. Guardar PDF no Storage ─────────────────────────────
  const storagePath = `invoices/${customerId}/${inv.invoice_number}.pdf`
  let downloadUrl: string | null = null

  const { error: uploadErr } = await db.storage
    .from('invoices')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  if (uploadErr) {
    console.warn('[sendInvoiceEmail] Storage upload failed:', uploadErr.message)
    // Continua mesmo sem Storage — o PDF vai como anexo de qualquer forma
  } else {
    const { data: signed } = await db.storage.from('invoices').createSignedUrl(storagePath, 3600)
    downloadUrl = signed?.signedUrl ?? null
    await db.from('invoices').update({ pdf_storage_path: storagePath }).eq('id', invoiceId)
  }

  // ── 8. Construir e-mail ────────────────────────────────────
  const fromEmail  = process.env.RESEND_FROM_EMAIL ?? 'comercial@viralizahost.com'
  const fromName   = process.env.RESEND_FROM_NAME  ?? billing.company_name ?? 'ViralizaHost Comercial'
  const fromField  = `${fromName} <${fromEmail}>`

  const subject = (billing.email_subject_template ?? 'Fatura ViralizaHost #{invoice_number}')
    .replace(/{invoice_number}/g, inv.invoice_number)
    .replace(/{service_name}/g,   order?.domain_name ?? 'Serviços ViralizaHost')

  const totalFormatted = `${inv.currency} ${(inv.total ?? 0).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`
  const dueDateFormatted = inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-PT') : '—'
  const issueDateFormatted = new Date(inv.issue_date ?? inv.created_at).toLocaleDateString('pt-PT')

  const orderBlock = order ? `
      <div class="info-row">
        <span class="info-label">Referência do Pedido</span>
        <span class="info-value">#${String(order.id).slice(0, 8).toUpperCase()}</span>
      </div>
      ${order.domain_name ? `<div class="info-row"><span class="info-label">Domínio</span><span class="info-value">${order.domain_name}</span></div>` : ''}
      ${order.billing_cycle ? `<div class="info-row"><span class="info-label">Período</span><span class="info-value">${order.billing_cycle}</span></div>` : ''}
  ` : ''

  const bankBlock = billing.iban || billing.account_number ? `
    <div class="bank-box">
      <p class="bank-title">Dados para Transferência Bancária</p>
      ${billing.bank_name ? `<p><strong>Banco:</strong> ${billing.bank_name}</p>` : ''}
      ${billing.account_holder ? `<p><strong>Titular:</strong> ${billing.account_holder}</p>` : ''}
      ${billing.account_number ? `<p><strong>Nº de Conta:</strong> ${billing.account_number}</p>` : ''}
      ${billing.iban ? `<p><strong>IBAN:</strong> ${billing.iban}</p>` : ''}
      ${billing.swift ? `<p><strong>SWIFT/BIC:</strong> ${billing.swift}</p>` : ''}
    </div>
  ` : ''

  const bodyHtml = `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#F2F4F7;color:#1A1A1A}
.wrapper{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)}
.header{background:#0A0A0A;padding:28px 36px;border-bottom:4px solid #F5B700}
.header h1{color:#F5B700;font-size:22px;font-weight:800;letter-spacing:-0.3px}
.header p{color:#999;font-size:12px;margin-top:4px}
.body{padding:32px 36px}
.greeting{font-size:15px;color:#333;margin-bottom:20px;line-height:1.6}
.info-box{background:#F8F9FB;border:1px solid #E5E7EB;border-radius:8px;padding:20px;margin:20px 0}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #EEF0F3;font-size:13px}
.info-row:last-child{border-bottom:none}
.info-label{color:#888}
.info-value{color:#0A0A0A;font-weight:700;text-align:right}
.total-row{background:#0A0A0A;border-radius:6px;padding:14px 16px;margin-top:12px;display:flex;justify-content:space-between;align-items:center}
.total-label{color:#F5B700;font-size:14px;font-weight:800}
.total-value{color:#fff;font-size:18px;font-weight:800}
.bank-box{background:#FFFBEA;border:1px solid #F5E88C;border-radius:8px;padding:16px;margin:16px 0;font-size:13px;line-height:1.8;color:#555}
.bank-title{font-weight:700;color:#0A0A0A;margin-bottom:8px;font-size:14px}
.instructions{font-size:13px;color:#555;line-height:1.7;margin:16px 0}
.cta{display:inline-block;background:#F5B700;color:#0A0A0A;padding:12px 28px;border-radius:8px;font-weight:800;font-size:14px;text-decoration:none;margin:8px 0}
.signature{font-size:13px;color:#444;line-height:1.8;margin-top:24px;border-top:1px solid #EEE;padding-top:16px}
.footer{background:#F8F9FB;padding:16px 36px;font-size:11px;color:#AAA;text-align:center;line-height:1.7;border-top:1px solid #E5E7EB}
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>${billing.company_name ?? 'ViralizaHost'}</h1>
    <p>Hospedagem Web · Domínios · E-mails Corporativos</p>
  </div>
  <div class="body">
    <p class="greeting">Prezado(a) <strong>${clientName}</strong>,</p>
    <p class="greeting">Segue em anexo a sua fatura referente aos serviços ViralizaHost. Por favor, efectue o pagamento até à data de vencimento indicada.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Nº Fatura</span>
        <span class="info-value">${inv.invoice_number}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Data de Emissão</span>
        <span class="info-value">${issueDateFormatted}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Data de Vencimento</span>
        <span class="info-value">${dueDateFormatted}</span>
      </div>
      ${orderBlock}
      <div class="total-row">
        <span class="total-label">TOTAL A PAGAR</span>
        <span class="total-value">${totalFormatted}</span>
      </div>
    </div>

    ${bankBlock}

    ${billing.payment_instructions ? `<p class="instructions">${billing.payment_instructions}</p>` : ''}

    <p class="instructions">Após efectuar o pagamento, envie o comprovativo através do painel da ViralizaHost ou responda a este e-mail com a referência.</p>

    <div class="signature">
      Atenciosamente,<br>
      <strong>Equipa Comercial ${billing.company_name ?? 'ViralizaHost'}</strong><br>
      <a href="mailto:${fromEmail}" style="color:#F5B700">${fromEmail}</a> · <a href="https://${billing.website ?? 'viralizahost.com'}" style="color:#888">${billing.website ?? 'viralizahost.com'}</a>
    </div>
  </div>
  <div class="footer">${billing.footer_text ?? `${billing.company_name ?? 'ViralizaHost'} · ${fromEmail} · ${billing.website ?? 'viralizahost.com'}`}</div>
</div>
</body></html>`

  // ── 9. Marcar como "sending" (rastreio) ───────────────────
  await db.from('invoices').update({
    email_to:       toEmail,
    email_from:     fromField,
    email_provider: 'resend',
    email_status:   'sending',
    email_attempts: (inv.email_attempts ?? 0) + 1,
  }).eq('id', invoiceId)

  // ── 10. Enviar via Resend ─────────────────────────────────
  const resend = new Resend(resendKey)
  let providerMessageId: string | undefined

  try {
    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: fromField,
      to: [toEmail],
      subject,
      html: bodyHtml,
      attachments: [{
        filename: `fatura-${inv.invoice_number}.pdf`,
        content: pdfBuffer,
      }],
    })

    if (emailErr) {
      // Extrair mensagem de erro do Resend (pode ser objeto)
      const errMsg = typeof emailErr === 'object'
        ? ((emailErr as Record<string, unknown>).message as string ?? JSON.stringify(emailErr))
        : String(emailErr)

      // Detectar erro de domínio não verificado
      const isDomainErr = errMsg.toLowerCase().includes('domain') || errMsg.toLowerCase().includes('verify') || errMsg.toLowerCase().includes('sender')

      await db.from('invoices').update({
        email_status:     'failed',
        email_last_error: errMsg,
      }).eq('id', invoiceId)

      await logAttempt(db, { invoiceId, customerId, orderId, ticketId, recipient: toEmail,
        initiatedByUserId, initiatedByAgent, status: 'failed', error: errMsg })

      void db.from('email_logs').insert({
        profile_id: customerId, invoice_id: invoiceId, order_id: orderId ?? null,
        recipient: toEmail, sender: fromField, subject, provider: 'resend',
        status: 'failed', error_message: errMsg,
        attempts: (inv.email_attempts ?? 0) + 1,
        initiated_by_agent: initiatedByAgent, initiated_by: initiatedByUserId ?? null,
        failed_at: new Date().toISOString(),
      })

      if (isDomainErr) {
        return { success: false, invoiceId, ...ERR.DOMAIN_NOT_VERIFIED, details: errMsg }
      }
      return { success: false, invoiceId, ...ERR.RESEND_ERROR, details: errMsg }
    }

    providerMessageId = emailData?.id

    // ── 11. Registar sucesso ───────────────────────────────
    const now = new Date().toISOString()
    await db.from('invoices').update({
      email_status:       'sent',
      email_provider_id:  providerMessageId ?? null,
      email_sent_at:      now,
      email_last_error:   null,
      emailed_at:         now,
    }).eq('id', invoiceId)

    const logId = await logAttempt(db, {
      invoiceId, customerId, orderId, ticketId, recipient: toEmail,
      initiatedByUserId, initiatedByAgent, status: 'sent',
      providerMessageId,
    })
    void logId // used by ticket attachment if needed

    // Also write to email_logs table
    void db.from('email_logs').insert({
      profile_id:          customerId,
      invoice_id:          invoiceId,
      order_id:            orderId ?? null,
      recipient:           toEmail,
      sender:              fromField,
      subject,
      provider:            'resend',
      provider_message_id: providerMessageId ?? null,
      status:              'sent',
      attempts:            (inv.email_attempts ?? 0) + 1,
      initiated_by_agent:  initiatedByAgent,
      initiated_by:        initiatedByUserId ?? null,
      sent_at:             new Date().toISOString(),
    })

    // ── 12. Associar ao ticket se existir ─────────────────
    if (ticketId) {
      // Não-fatal: ignorar erros no ticket
      void db.from('ticket_messages').insert({
        ticket_id:   ticketId,
        profile_id:  customerId,
        message:     `✅ Fatura **${inv.invoice_number}** gerada e enviada por e-mail para ${toEmail}.\nValor: ${totalFormatted} | Vencimento: ${dueDateFormatted}`,
        is_staff:    false,
        is_internal: false,
      })

      // Registar anexo no ticket_attachments se tiver PDF
      if (storagePath && !uploadErr) {
        void db.from('ticket_attachments').insert({
          ticket_id:    ticketId,
          invoice_id:   invoiceId,
          file_name:    `fatura-${inv.invoice_number}.pdf`,
          storage_path: storagePath,
          mime_type:    'application/pdf',
          uploaded_by:  initiatedByUserId ?? customerId,
        })
      }
    }

    return {
      success: true,
      invoiceId,
      invoiceNumber: inv.invoice_number,
      sentTo: toEmail,
      providerMessageId,
      downloadUrl,
    }

  } catch (unexpectedErr) {
    const errMsg = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr)
    console.error('[sendInvoiceEmail] Unexpected error:', errMsg)

    await db.from('invoices').update({
      email_status:     'failed',
      email_last_error: errMsg,
    }).eq('id', invoiceId)

    await logAttempt(db, { invoiceId, customerId, orderId, ticketId, recipient: toEmail,
      initiatedByUserId, initiatedByAgent, status: 'failed', error: errMsg })

    return { success: false, invoiceId, ...ERR.RESEND_ERROR, details: errMsg }
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: registar log de tentativa
// ─────────────────────────────────────────────────────────────
async function logAttempt(db: AnySupabaseClient, opts: {
  invoiceId: string
  customerId: string
  orderId?: string
  ticketId?: string
  recipient?: string
  initiatedByUserId?: string
  initiatedByAgent?: boolean
  status: string
  error?: string
  providerMessageId?: string
}): Promise<string | null> {
  const result = await db.from('invoice_send_logs').insert({
    invoice_id:          opts.invoiceId,
    order_id:            opts.orderId ?? null,
    ticket_id:           opts.ticketId ?? null,
    customer_id:         opts.customerId,
    recipient:           opts.recipient ?? 'unknown',
    provider:            'resend',
    provider_message_id: opts.providerMessageId ?? null,
    status:              opts.status,
    error_message:       opts.error ?? null,
    initiated_by:        opts.initiatedByUserId ?? null,
    initiated_by_agent:  opts.initiatedByAgent ?? false,
  }).select('id').single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result?.data as any)?.id ?? null
}
