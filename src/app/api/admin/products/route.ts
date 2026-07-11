import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createAuthClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    const supabase = await createAdminClient()
    let query = (supabase as any)
      .from('products')
      .select('*, product_features(id, feature, included, position)')
      .order('category').order('position')

    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.message === 'Não autenticado' ? 401 : 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
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
      await (supabase as any).from('product_features').insert(
        product_features.map((f: any, i: number) => ({ product_id: created.id, feature: f.feature, included: f.included, position: i }))
      )
    }

    revalidatePath('/admin/site/products')


    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.message === 'Não autenticado' ? 401 : 500 })
  }
}
