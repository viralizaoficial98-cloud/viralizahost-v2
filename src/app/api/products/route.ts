import { NextRequest, NextResponse } from 'next/server'
import { createAdminWriteClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category    = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')

    const supabase = createAdminWriteClient()
    let query = (supabase as any)
      .from('products')
      .select('*, product_features(feature, included, position), product_prices(cycle, months, price, renewal_price, active, discount_pct, renewal_discount_pct)')
      .eq('active', true)
      .neq('sale_status', 'draft')
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

    // Preços de apresentação derivados SEMPRE de product_prices (valor mensal equivalente por ciclo)
    const cols: Record<string, string> = { monthly: 'price_monthly', '6months': 'price_6months', '1year': 'price_1year', '2years': 'price_2years', '3years': 'price_3years' }
    for (const p of (data ?? []) as any[]) {
      const pp = ((p.product_prices ?? []) as any[]).filter(r => Number(r.active) === 1)
      if (!pp.length) continue
      for (const [cycle, col] of Object.entries(cols)) {
        const r = pp.find(x => x.cycle === cycle)
        p[col] = r ? Math.round((Number(r.price) / Number(r.months)) * 100) / 100 : null
      }
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
