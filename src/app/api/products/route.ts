import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')

    const supabase = await createClient()
    let query = (supabase as any)
      .from('products')
      .select('*, product_features(feature, included, position)')
      .eq('active', true)
      .order('position', { ascending: true })

    if (category) query = query.eq('category', category)
    if (subcategory) query = query.eq('subcategory', subcategory)
    else if (category) query = query.is('subcategory', null)

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, message: 'Falha ao carregar produtos', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Erro interno', details: err.message },
      { status: 500 }
    )
  }
}
