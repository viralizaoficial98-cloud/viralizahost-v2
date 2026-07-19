import { NextRequest, NextResponse } from 'next/server'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Resend event types that we handle
type ResendEvent =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'

interface ResendWebhookPayload {
  type: ResendEvent
  created_at: string
  data: {
    email_id: string
    from?: string
    to?: string[]
    subject?: string
    created_at?: string
  }
}

const EVENT_TO_STATUS: Record<ResendEvent, string> = {
  'email.sent':             'sent',
  'email.delivered':        'delivered',
  'email.delivery_delayed': 'sending',
  'email.bounced':          'bounced',
  'email.complained':       'complained',
}

export async function POST(req: NextRequest) {
  try {
    // Validate webhook secret (optional but recommended)
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = req.headers.get('svix-signature') ?? req.headers.get('x-resend-signature')
      if (!signature || !signature.includes(webhookSecret.slice(0, 8))) {
        return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
      }
    }

    const payload = await req.json() as ResendWebhookPayload
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

    // Update invoice by provider_message_id
    const updates: Record<string, unknown> = { email_status: newStatus }
    if (type === 'email.delivered') updates.email_delivered_at = now
    if (type === 'email.bounced')   updates.email_bounced_at   = now

    const { error: invErr } = await db
      .from('invoices')
      .update(updates)
      .eq('email_provider_id', data.email_id)

    if (invErr) {
      console.warn('[resend-webhook] Invoice update failed:', invErr.message)
    }

    // Update invoice_send_logs
    await db
      .from('invoice_send_logs')
      .update({ status: newStatus, updated_at: now })
      .eq('provider_message_id', data.email_id)

    return NextResponse.json({ ok: true, event: type, email_id: data.email_id, status: newStatus })

  } catch (err) {
    console.error('[resend-webhook]', err)
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
  }
}
