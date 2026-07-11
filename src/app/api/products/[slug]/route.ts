import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data, error } = await (supabase as any)
      .from('products')
      .select('*, product_features(feature, included, position)')
      .eq('slug', slug)
      .eq('active', true)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: 'Produto não encontrado', details: error?.message ?? 'slug inválido ou produto inactivo' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: 'Erro interno', details: err.message },
      { status: 500 }
    )
  }
}
