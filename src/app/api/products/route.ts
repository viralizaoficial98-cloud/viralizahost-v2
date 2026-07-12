import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category    = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')

    const supabase = await createAdminClient()
    let query = (supabase as any)
      .from('products')
      .select('*, product_features(feature, included, position)')
      .eq('active', true)
      .order('position', { ascending: true })

    if (category)    query = query.eq('category', category)
    if (subcategory) query = query.eq('subcategory', subcategory)

    const { data, error } = await query

    if (error) {
      console.error('[api/products] DB error:', error.message)
      return NextResponse.json(
        { success: false, message: 'Falha ao carregar produtos', details: error.message },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(
      { success: true, data: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    console.error('[api/products] error:', err.message)
    return NextResponse.json(
      { success: false, message: 'Erro interno', details: err.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
