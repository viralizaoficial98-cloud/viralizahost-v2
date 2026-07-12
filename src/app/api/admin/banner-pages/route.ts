import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { revalidatePath } from 'next/cache'

export async function GET() {
  try {
    await requireAdminRole()
    const supabase = await createAdminClient()
    const { data, error } = await (supabase as any)
      .from('banner_pages')
      .select('*')
      .order('page_name', { ascending: true })

    if (error) {
      console.error('[api/admin/banner-pages] GET error:', error.message)
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole()
    const body = await req.json()

    const supabase = await createAdminClient()
    const { data, error } = await (supabase as any)
      .from('banner_pages')
      .insert(body)
      .select()
      .single()

    if (error) {
      console.error('[api/admin/banner-pages] POST error:', error.message)
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }

    revalidatePath('/', 'layout')
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status ?? 500 })
  }
}
