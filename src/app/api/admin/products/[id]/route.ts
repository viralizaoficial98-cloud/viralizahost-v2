import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { revalidatePath } from 'next/cache'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole()
    const { id } = await params
    const body = await req.json()
    const { product_features, ...productData } = body

    const supabase = await createAdminClient()
    const { data, error } = await (supabase as any)
      .from('products')
      .update({ ...productData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    // Replace all features atomically
    if (product_features !== undefined) {
      await (supabase as any).from('product_features').delete().eq('product_id', id)
      if (product_features?.length) {
        const { error: featErr } = await (supabase as any).from('product_features').insert(
          product_features.map((f: any, i: number) => ({
            product_id: id,
            feature: f.feature,
            included: f.included ?? true,
            position: i,
          }))
        )
        if (featErr) console.error('[products] feature replace error:', featErr.message)
      }
    }

    revalidatePath('/', 'layout')
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

    const supabase = await createAdminClient()
    const { error } = await (supabase as any).from('products').delete().eq('id', id)
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    revalidatePath('/', 'layout')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    const status = (err as any).status ?? 500
    return NextResponse.json({ success: false, message: err.message }, { status })
  }
}
