import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

async function guard() {
  try {
    await requireAdminRole()
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }
  return null
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied

  const db = createAdminWriteClient()
  const { data, error } = await db
    .from('company_billing_settings')
    .select('*')
    .eq('active', true)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Erro ao carregar definições.' }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function POST(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied

  const body = await req.json()
  const db = createAdminWriteClient()

  const allowed = [
    'company_name', 'email', 'website', 'phone', 'address',
    'bank_name', 'account_holder', 'account_number', 'iban', 'swift',
    'payment_instructions', 'footer_text', 'default_due_days',
    'email_subject_template', 'email_body_template', 'auto_email_on_create',
  ]
  const payload: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) payload[key] = body[key]
  }

  // Check if record exists
  const { data: existing } = await db
    .from('company_billing_settings')
    .select('id')
    .eq('active', true)
    .maybeSingle()

  let error
  if (existing) {
    const result = await db
      .from('company_billing_settings')
      .update(payload)
      .eq('id', existing.id)
    error = result.error
  } else {
    const result = await db
      .from('company_billing_settings')
      .insert({ ...payload, active: true })
    error = result.error
  }

  if (error) return NextResponse.json({ error: 'Erro ao guardar definições.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
