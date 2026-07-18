import { NextRequest, NextResponse } from 'next/server'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  try {
    await requireAdminRole()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const supabase = createAdminWriteClient()
    let query = (supabase as any)
      .from('products')
      .select('*, product_features(id, feature, included, position)')
      .order('category').order('position')

    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) {
      console.error('[api/admin/products] DB error:', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      return NextResponse.json({ success: false, message: error.message, code: error.code, details: error.details, hint: error.hint }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err: any) {
    const status = (err as any).status ?? 500
    return NextResponse.json({ success: false, message: err.message }, { status })
  }
}

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

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole()
    const body = await req.json()
    const { product_features, id: _id, ...raw } = body

    // Normalize payload — map frontend field names to DB column names
    const productData: Record<string, unknown> = {
      slug:          normalizeText(raw.slug),
      name:          normalizeText(raw.name),
      category:      normalizeText(raw.category) ?? 'hosting',
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
    }

    if (!productData.slug) {
      return NextResponse.json({ success: false, message: 'O campo Slug é obrigatório.' }, { status: 400 })
    }
    if (!productData.name) {
      return NextResponse.json({ success: false, message: 'O campo Nome é obrigatório.' }, { status: 400 })
    }

    console.log('[CREATE PRODUCT] Payload normalizado:', JSON.stringify(productData))

    const supabase = createAdminWriteClient()

    // Check slug uniqueness before inserting
    const { data: existing } = await (supabase as any)
      .from('products')
      .select('id')
      .eq('slug', productData.slug)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, message: `Já existe um produto com o slug '${productData.slug}'. Escolha outro slug.` },
        { status: 409 }
      )
    }

    const { data: created, error: productError } = await (supabase as any)
      .from('products')
      .insert(productData)
      .select()
      .single()

    if (productError) {
      console.error('[CREATE PRODUCT] Erro produto:', {
        message: productError.message,
        code: productError.code,
        details: productError.details,
        hint: productError.hint,
      })
      return NextResponse.json(
        { success: false, message: productError.message, details: productError.details, hint: productError.hint },
        { status: productError.code === '23505' ? 409 : 400 }
      )
    }

    // Insert features — rollback product if this fails
    if (Array.isArray(product_features) && product_features.length > 0) {
      const cleanFeatures = product_features
        .filter((f: any) => typeof f.feature === 'string' && f.feature.trim())
        .map((f: any, i: number) => ({
          product_id: created.id,
          feature:    f.feature.trim(),
          included:   f.included !== false,
          position:   i,
        }))

      if (cleanFeatures.length > 0) {
        const { error: featErr } = await (supabase as any)
          .from('product_features')
          .insert(cleanFeatures)

        if (featErr) {
          console.error('[CREATE PRODUCT] Erro funcionalidades:', {
            message: featErr.message,
            code: featErr.code,
            details: featErr.details,
          })
          // Rollback: delete the product we just created
          await (supabase as any).from('products').delete().eq('id', created.id)
          return NextResponse.json(
            { success: false, message: `Produto criado mas erro ao guardar funcionalidades: ${featErr.message}` },
            { status: 500 }
          )
        }
      }
    }

    revalidatePath('/', 'layout')
    revalidatePath('/hospedagem-de-sites')
    revalidatePath('/admin/site/products')

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (err: any) {
    const status = (err as any).status ?? 500
    console.error('[CREATE PRODUCT] Erro inesperado:', err.message)
    return NextResponse.json({ success: false, message: err.message }, { status })
  }
}
