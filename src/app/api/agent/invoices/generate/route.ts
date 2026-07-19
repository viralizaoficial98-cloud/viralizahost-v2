import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
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
      .select('id, invoice_number, status, currency, subtotal, discount, tax, total, due_date, issue_date, paid_at, notes, created_at, profile_id, service_id')
      .eq('id', invoice_id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (invErr || !inv) return NextResponse.json({ error: 'Factura não encontrada.' }, { status: 404 })

    // Get items
    const { data: items } = await db
      .from('invoice_items')
      .select('description, quantity, unit_price, subtotal, position')
      .eq('invoice_id', invoice_id)
      .order('position')

    // Get client profile
    const { data: profile } = await db
      .from('profiles')
      .select('full_name, email, phone, country')
      .eq('id', user.id)
      .maybeSingle()

    // Get company billing settings
    const { data: billing } = await db
      .from('company_billing_settings')
      .select('company_name, logo_url, email, website, phone, address, bank_name, account_holder, account_number, iban, swift, payment_instructions, footer_text')
      .eq('active', true)
      .maybeSingle()

    const billingData = billing ?? {
      company_name: 'ViralizaHost',
      email: 'comercial@viralizahost.com',
      website: 'viralizahost.com',
      phone: null,
      address: null,
      logo_url: null,
      bank_name: null,
      account_holder: null,
      account_number: null,
      iban: null,
      swift: null,
      payment_instructions: null,
      footer_text: 'ViralizaHost — Hospedagem Web, Domínios e E-mails Corporativos',
    }
    const profileData = profile ?? { full_name: 'Cliente', email: user.email ?? '', phone: null, country: null }

    // Generate PDF
    const pdfElement = React.createElement(InvoicePDF, {
      invoice: inv, items: items ?? [], profile: profileData, billing: billingData,
    }) as unknown as React.ReactElement<{ title?: string }>
    const pdfBuffer = await renderToBuffer(pdfElement)

    // Store PDF in Supabase Storage
    const storagePath = `invoices/${user.id}/${inv.invoice_number}.pdf`
    const { error: uploadErr } = await db.storage
      .from('invoices')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (!uploadErr) {
      // Update invoice with storage path
      await db.from('invoices').update({ pdf_storage_path: storagePath }).eq('id', invoice_id)
    }

    // Create signed URL (valid 1 hour)
    const { data: signedUrl } = await db.storage
      .from('invoices')
      .createSignedUrl(storagePath, 3600)

    return NextResponse.json({
      success: true,
      invoice_number: inv.invoice_number,
      download_url: signedUrl?.signedUrl ?? null,
      storage_path: storagePath,
    })
  } catch (err) {
    console.error('[/api/agent/invoices/generate]', err)
    return NextResponse.json({ error: 'Erro ao gerar PDF da factura.' }, { status: 500 })
  }
}
