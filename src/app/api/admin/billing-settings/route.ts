import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { getPool } from '@/lib/db/pool'
import { checkHolder, checkIban, compactIban } from '@/lib/billing/iban'
import { cardImageUrl } from '@/lib/billing/bank-details'

// Configurações → Facturação. Só administradores (verificado aqui, no servidor). Cada alteração fica em activity_logs.
// Transferência bancária: IBAN validado ao GUARDAR uma alteração (espaços aceites, zeros iniciais mantidos, nunca
// completado). Um valor antigo inválido não é alterado automaticamente: o painel mostra um aviso para o corrigir.

async function guard(): Promise<NextResponse | string> {
  try { return await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }
}

/** Estado do IBAN guardado (para o aviso no painel). */
function ibanStatus(s: { iban?: string | null; account_number?: string | null } | null) {
  const iban = (s?.iban ?? '').trim()
  if (!iban) return s?.account_number ? { valid: false, message: 'Está guardado só um número de conta, sem IBAN. Indique o IBAN completo da conta.' } : { valid: false, message: 'Ainda não há IBAN guardado.' }
  const c = checkIban(iban)
  return c.ok ? { valid: true, message: null } : { valid: false, message: `O IBAN guardado («${iban}») não é um IBAN válido: ${c.error} Corrija-o e guarde; nada é alterado automaticamente.` }
}

export async function GET() {
  const g = await guard(); if (typeof g !== 'string') return g
  const db = createAdminWriteClient()
  const { data, error } = await db.from('company_billing_settings').select('*').eq('active', true).maybeSingle()
  if (error) return NextResponse.json({ error: 'Erro ao carregar definições.' }, { status: 500 })
  return NextResponse.json({ settings: data, bankCheck: ibanStatus(data), cardImageUrl: cardImageUrl(data?.bank_card_image_path ?? null) }, { headers: { 'Cache-Control': 'no-store' } })
}

const ALLOWED = [
  'company_name', 'email', 'website', 'phone', 'address',
  'bank_name', 'account_holder', 'account_number', 'iban', 'swift',
  'payment_instructions', 'footer_text', 'default_due_days',
  'email_subject_template', 'email_body_template', 'auto_email_on_create', 'tax_rate', 'tax_label',
] as const
const LABEL: Record<string, string> = { iban: 'IBAN', account_holder: 'Titular da conta', bank_name: 'Banco', swift: 'SWIFT', account_number: 'N.º de conta', payment_instructions: 'Instruções de pagamento', tax_rate: 'Imposto' }

export async function POST(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  const db = createAdminWriteClient()
  const { data: existing } = await db.from('company_billing_settings').select('*').eq('active', true).maybeSingle()
  const cur = (existing ?? {}) as Record<string, unknown>

  const payload: Record<string, unknown> = {}
  for (const key of ALLOWED) if (key in body) payload[key] = body[key]

  if ('tax_rate' in payload) {
    const t = Number(payload.tax_rate)
    if (!Number.isFinite(t) || t < 0 || t > 100) return NextResponse.json({ error: 'Taxa de imposto inválida.', field: 'tax_rate' }, { status: 400 })
    payload.tax_rate = Math.round(t * 100) / 100
  }
  // IBAN: validado só quando muda (um valor antigo inválido não bloqueia outras alterações nem é reescrito)
  if ('iban' in payload) {
    const changed = compactIban(payload.iban) !== compactIban(cur.iban)
    if (changed) {
      const c = checkIban(payload.iban)
      if (!c.ok) return NextResponse.json({ error: c.error, field: 'iban', code: c.code }, { status: 400 })
      payload.iban = c.iban
    } else delete payload.iban
  }
  if ('account_holder' in payload) {
    const changed = String(payload.account_holder ?? '').trim() !== String(cur.account_holder ?? '').trim()
    if (changed) {
      const h = checkHolder(payload.account_holder)
      if (!h.ok) return NextResponse.json({ error: h.error, field: 'account_holder' }, { status: 400 })
      payload.account_holder = h.holder
    } else delete payload.account_holder
  }
  if ('bank_name' in payload && String(payload.bank_name ?? '').length > 80) return NextResponse.json({ error: 'Nome do banco demasiado longo (máx. 80).', field: 'bank_name' }, { status: 400 })
  for (const k of ['bank_name', 'swift', 'payment_instructions'] as const) if (k in payload && typeof payload[k] === 'string') payload[k] = String(payload[k]).replace(/[<>]/g, '').trim()

  const changes = Object.keys(payload).filter(k => String(payload[k] ?? '') !== String(cur[k] ?? ''))
  if (existing) {
    const { error } = await db.from('company_billing_settings').update({ ...payload, updated_by: adminId }).eq('id', (existing as { id: string }).id)
    if (error) return NextResponse.json({ error: 'Erro ao guardar definições.' }, { status: 500 })
  } else {
    const { error } = await db.from('company_billing_settings').insert({ ...payload, active: true, updated_by: adminId })
    if (error) return NextResponse.json({ error: 'Erro ao guardar definições.' }, { status: 500 })
  }
  if (changes.length) {
    const desc = changes.map(k => k === 'iban' ? `IBAN: «${cur.iban ?? '—'}» → «${payload.iban}»` : k === 'account_holder' ? `Titular: «${cur.account_holder ?? '—'}» → «${payload.account_holder}»` : (LABEL[k] ?? k)).join('; ')
    await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'billing_settings', ?, ?)",
      [adminId, (existing as { id?: string } | null)?.id ?? null, `Facturação: ${desc}`.slice(0, 1000)]).catch(() => {})
  }
  const { data: saved } = await db.from('company_billing_settings').select('*').eq('active', true).maybeSingle()
  return NextResponse.json({ success: true, settings: saved, bankCheck: ibanStatus(saved), changed: changes })
}
