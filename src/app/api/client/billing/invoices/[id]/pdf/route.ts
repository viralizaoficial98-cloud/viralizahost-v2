import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { renderToBuffer, DocumentProps } from '@react-pdf/renderer'
import { InvoicePDF } from '@/lib/pdf/invoice-pdf'
import React, { JSXElementConstructor, ReactElement } from 'react'

export const runtime    = 'nodejs'
export const dynamic    = 'force-dynamic'
export const maxDuration = 30

const DEFAULT_BILLING = {
  company_name:        'ViralizaHost',
  logo_url:            null,
  email:               'suporte@viralizahost.com',
  website:             'www.viralizahost.com',
  phone:               '+244 951 008 653',
  address:             'Angola',
  bank_name:           'BIC — Banco BIC Angola',
  account_holder:      'VIRALIZA FÁCIL ANGOLA, LDA',
  account_number:      '005100002477517910141',
  iban:                null,
  swift:               null,
  payment_instructions: null,
  footer_text:         'ViralizaHost · suporte@viralizahost.com · www.viralizahost.com',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const db = createAdminWriteClient()

  // Load invoice (must belong to requesting user)
  const { data: inv, error: invErr } = await db
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (invErr || !inv) return new NextResponse('Fatura não encontrada.', { status: 404 })

  // Load profile
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email, phone, country')
    .eq('id', user.id)
    .maybeSingle()

  // Load order items
  const { data: orderItemsRaw } = inv.order_id
    ? await db.from('order_items')
        .select('service_name, service_type, price, quantity')
        .eq('order_id', inv.order_id)
    : { data: [] }

  // Build invoice_items for PDF (normalised)
  const pdfItems = (orderItemsRaw ?? []).map((oi: any, i: number) => ({
    description: `${oi.service_name ?? 'Serviço'}${oi.service_type ? ` (${oi.service_type})` : ''}`,
    quantity:    oi.quantity ?? 1,
    unit_price:  Number(oi.price ?? 0),
    subtotal:    Number(oi.price ?? 0) * (oi.quantity ?? 1),
    position:    i,
  }))

  // Fallback: use items JSONB from invoice if no order_items
  const jsonbItems: any[] = Array.isArray(inv.items) ? inv.items : []
  const displayItems = pdfItems.length > 0 ? pdfItems : jsonbItems.map((it: any, i: number) => ({
    description: it.name ?? it.description ?? 'Serviço',
    quantity:    it.quantity ?? 1,
    unit_price:  Number(it.unit_price ?? it.price ?? 0),
    subtotal:    Number(it.unit_price ?? it.price ?? 0) * (it.quantity ?? 1),
    position:    i,
  }))

  // Load billing settings
  const { data: billingSettings } = await db
    .from('company_billing_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  const billing = billingSettings ? { ...DEFAULT_BILLING, ...billingSettings } : DEFAULT_BILLING

  // Load order for domain/cycle info
  const { data: order } = inv.order_id
    ? await db.from('orders').select('billing_cycle, domain_name').eq('id', inv.order_id).maybeSingle()
    : { data: null }

  try {
    const element = React.createElement(InvoicePDF, {
      invoice: inv as any,
      items:   displayItems,
      profile: {
        full_name: profile?.full_name ?? null,
        email:     profile?.email ?? null,
        phone:     profile?.phone ?? null,
        country:   profile?.country ?? null,
      },
      billing,
      order:   order ?? undefined,
    }) as ReactElement<DocumentProps, string | JSXElementConstructor<unknown>>
    const buffer = await renderToBuffer(element)

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="factura-${inv.invoice_number}.pdf"`,
        'Cache-Control':       'no-store',
      },
    })
  } catch (err) {
    console.error('[invoice PDF]', err)
    return new NextResponse('Erro ao gerar PDF.', { status: 500 })
  }
}
