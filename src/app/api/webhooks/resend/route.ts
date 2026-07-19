import { NextRequest, NextResponse } from 'next/server'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { createHmac } from 'crypto'

export const runtime = 'nodejs'

type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.failed'

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from?: string
    to?: string[]
    subject?: string
    created_at?: string
    bounce?: { message?: string }
  }
}

const EVENT_TO_STATUS: Record<string, string> = {
  'email.sent':             'sent',
  'email.delivered':        'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced':          'bounced',
  'email.complained':       'complained',
  'email.failed':           'failed',
}

/**
 * Validate Resend/Svix webhook signature.
 * Resend uses Svix — headers: svix-id, svix-timestamp, svix-signature
 * Signature format: v1,<base64-hmac-sha256(svix-id.svix-timestamp.body, secret)>
 */
function validateSvixSignature(
  body: string,
  headers: Headers,
  secret: string,
): boolean {
  const msgId        = headers.get('svix-id')
  const msgTimestamp = headers.get('svix-timestamp')
  const msgSignature = headers.get('svix-signature')

  if (!msgId || !msgTimestamp || !msgSignature) return false

  // Reject messages older than 5 minutes
  const ts = parseInt(msgTimestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  // Strip the "whsec_" prefix if present, then base64-decode the secret
  const secretBytes = Buffer.from(
    secret.startsWith('whsec_') ? secret.slice(6) : secret,
    'base64',
  )

  const toSign = `${msgId}.${msgTimestamp}.${body}`
  const computed = createHmac('sha256', secretBytes).update(toSign).digest('base64')

  // svix-signature may contain multiple signatures separated by spaces
  const signatures = msgSignature.split(' ')
  return signatures.some(sig => {
    const [, sigValue] = sig.split(',')
    return sigValue === computed
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret) {
      const valid = validateSvixSignature(body, req.headers, webhookSecret)
      if (!valid) {
        console.warn('[resend-webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
      }
    }

    let payload: ResendWebhookPayload
    try {
      payload = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
    }

    const { type, data } = payload

    if (!data?.email_id) {
      return NextResponse.json({ ok: true, note: 'No email_id, ignored.' })
    }

    const newStatus = EVENT_TO_STATUS[type]
    if (!newStatus) {
      return NextResponse.json({ ok: true, note: `Event ${type} not handled.` })
    }

    const db = createAdminWriteClient()
    const now = new Date().toISOString()

    // Update invoices table by provider_message_id
    const invoiceUpdates: Record<string, unknown> = { email_status: newStatus }
    if (type === 'email.delivered') invoiceUpdates.email_delivered_at = now
    if (type === 'email.bounced')   invoiceUpdates.email_bounced_at   = now

    const { error: invErr } = await db
      .from('invoices')
      .update(invoiceUpdates)
      .eq('email_provider_id', data.email_id)

    if (invErr) {
      console.warn('[resend-webhook] Invoice update error:', invErr.message)
    }

    // Update invoice_send_logs
    await db
      .from('invoice_send_logs')
      .update({ status: newStatus, updated_at: now })
      .eq('provider_message_id', data.email_id)

    // Update email_logs
    const emailLogUpdates: Record<string, unknown> = { status: newStatus, updated_at: now }
    if (type === 'email.delivered') emailLogUpdates.delivered_at = now
    if (type === 'email.bounced' || type === 'email.failed') {
      emailLogUpdates.failed_at      = now
      emailLogUpdates.error_message  = data.bounce?.message ?? type
    }

    await db
      .from('email_logs')
      .update(emailLogUpdates)
      .eq('provider_message_id', data.email_id)

    return NextResponse.json({ ok: true, event: type, email_id: data.email_id, status: newStatus })

  } catch (err) {
    console.error('[resend-webhook]', err)
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
  }
}
