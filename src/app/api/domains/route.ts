import { NextResponse } from 'next/server'
import { createAdminWriteClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createAdminWriteClient()
    const { data, error } = await supabase
      .from('site_domains')
      .select('extension, price_annual, price_monthly, currency, popular, label, active')
      .eq('active', true)
      .order('position')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(
      { domains: data ?? [] },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
