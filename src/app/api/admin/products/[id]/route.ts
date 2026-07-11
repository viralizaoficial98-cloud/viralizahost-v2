import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createAuthClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
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

    if (error) return NextResponse.json({ success: false, message: error.message, details: error.details }, { status: 400 })

    if (product_features !== undefined) {
      await (supabase as any).from('product_features').delete().eq('product_id', id)
      if (product_features?.length) {
        await (supabase as any).from('product_features').insert(
          product_features.map((f: any, i: number) => ({ product_id: id, feature: f.feature, included: f.included, position: i }))
        )
      }
    }

    revalidatePath('/admin/site/products')


    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.message === 'Não autenticado' ? 401 : 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    const supabase = await createAdminClient()
    const { error } = await (supabase as any).from('products').delete().eq('id', id)
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    revalidatePath('/admin/site/products')


    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.message === 'Não autenticado' ? 401 : 500 })
  }
}
