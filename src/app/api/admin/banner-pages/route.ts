import { NextRequest, NextResponse } from 'next/server'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { revalidatePath } from 'next/cache'

export async function GET() {
  try {
    await requireAdminRole()
    const supabase = createAdminWriteClient()
    const { data, error } = await supabase
      .from('banner_pages' as any)
      .select('*')
      .order('page_name', { ascending: true })

    if (error) {
      console.error('[api/admin/banner-pages] GET error:', { message: error.message, code: (error as any).code, details: (error as any).details })
      return NextResponse.json({ success: false, message: error.message, code: (error as any).code }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole()
    const rawBody = await req.json()
    const { id: _id, created_at: _ca, updated_at: _ts, ...insertPayload } = rawBody

    const supabase = createAdminWriteClient()
    const { data, error } = await supabase
      .from('banner_pages' as any)
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('[api/admin/banner-pages] POST error:', { message: error.message, code: (error as any).code, details: (error as any).details })
      return NextResponse.json({ success: false, message: error.message, code: (error as any).code }, { status: 400 })
    }

    revalidatePath('/', 'layout')
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status ?? 500 })
  }
}
