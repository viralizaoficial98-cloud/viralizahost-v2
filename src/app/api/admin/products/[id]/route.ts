import { NextRequest, NextResponse } from 'next/server'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { revalidatePath } from 'next/cache'

function normalizeText(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function normalizePrice(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole()
    const { id } = await params
    const body = await req.json()
    const { product_features, id: _id, ...raw } = body

    const productData: Record<string, unknown> = {
      slug:          normalizeText(raw.slug),
      name:          normalizeText(raw.name),
      category:      normalizeText(raw.category),
      description:   normalizeText(raw.description),
      badge:         normalizeText(raw.badge),
      popular:       Boolean(raw.popular),
      active:        raw.active !== undefined ? Boolean(raw.active) : true,
      position:      raw.position !== null && raw.position !== undefined ? Number(raw.position) : 0,
      price_monthly: normalizePrice(raw.price_monthly),
      price_6months: normalizePrice(raw.price_6months),
      price_1year:   normalizePrice(raw.price_1year),
      price_2years:  normalizePrice(raw.price_2years),
      price_3years:  normalizePrice(raw.price_3years),
      color:         normalizeText(raw.color),
      href_override: normalizeText(raw.href_override),
      updated_at:    new Date().toISOString(),
    }

    // Remove undefined keys
    Object.keys(productData).forEach(k => productData[k] === undefined && delete productData[k])

    const supabase = createAdminWriteClient()
    const { data, error } = await (supabase as any)
      .from('products')
      .update(productData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[UPDATE PRODUCT] Erro produto:', { message: error.message, code: error.code, details: error.details })
      return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: 400 })
    }

    // Replace all features atomically
    if (product_features !== undefined) {
      await (supabase as any).from('product_features').delete().eq('product_id', id)

      const cleanFeatures = Array.isArray(product_features)
        ? product_features
            .filter((f: any) => typeof f.feature === 'string' && f.feature.trim())
            .map((f: any, i: number) => ({
              product_id: id,
              feature:    f.feature.trim(),
              included:   f.included !== false,
              position:   i,
            }))
        : []

      if (cleanFeatures.length > 0) {
        const { error: featErr } = await (supabase as any).from('product_features').insert(cleanFeatures)
        if (featErr) {
          console.error('[UPDATE PRODUCT] Erro funcionalidades:', featErr.message)
          return NextResponse.json(
            { success: false, message: `Produto guardado mas erro nas funcionalidades: ${featErr.message}` },
            { status: 500 }
          )
        }
      }
    }

    revalidatePath('/', 'layout')
    revalidatePath('/hospedagem-de-sites')
    revalidatePath('/admin/site/products')

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    const status = (err as any).status ?? 500
    return NextResponse.json({ success: false, message: err.message }, { status })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole()
    const { id } = await params

    const supabase = createAdminWriteClient()
    const { error } = await (supabase as any).from('products').delete().eq('id', id)
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    revalidatePath('/', 'layout')
    revalidatePath('/hospedagem-de-sites')
    revalidatePath('/admin/site/products')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    const status = (err as any).status ?? 500
    return NextResponse.json({ success: false, message: err.message }, { status })
  }
}
