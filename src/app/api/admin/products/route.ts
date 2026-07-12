import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  try {
    await requireAdminRole()
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const supabase = await createAdminClient()
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

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole()
    const body = await req.json()
    const { product_features, ...productData } = body

    const supabase = await createAdminClient()
    const { data: created, error } = await (supabase as any)
      .from('products')
      .insert(productData)
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: 400 })

    if (product_features?.length && created) {
      const { error: featErr } = await (supabase as any).from('product_features').insert(
        product_features.map((f: any, i: number) => ({
          product_id: created.id,
          feature: f.feature,
          included: f.included ?? true,
          position: i,
        }))
      )
      if (featErr) console.error('[products] feature insert error:', featErr.message)
    }

    revalidatePath('/', 'layout')
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (err: any) {
    const status = (err as any).status ?? 500
    return NextResponse.json({ success: false, message: err.message }, { status })
  }
}
