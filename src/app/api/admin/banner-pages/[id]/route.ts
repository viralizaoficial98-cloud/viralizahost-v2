import { NextRequest, NextResponse } from 'next/server'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { revalidatePath } from 'next/cache'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole()
    const { id } = await params
    const rawBody = await req.json()
    // Strip immutable columns — never send id/timestamps to UPDATE
    const { id: _id, created_at: _ca, updated_at: _ts, ...updatePayload } = rawBody

    const supabase = createAdminWriteClient()
    const { data, error } = await supabase
      .from('banner_pages' as any)
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[api/admin/banner-pages] PUT error:', { message: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint })
      return NextResponse.json({
        success: false,
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      }, { status: 500 })
    }

    revalidatePath('/', 'layout')
    revalidatePath('/admin/site/banner-pages')
    if ((data as any)?.page_slug) revalidatePath(`/${(data as any).page_slug}`)
    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status ?? 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole()
    const { id } = await params

    const supabase = createAdminWriteClient()
    const { error } = await supabase
      .from('banner_pages' as any)
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[api/admin/banner-pages] DELETE error:', { message: error.message, code: (error as any).code })
      return NextResponse.json({ success: false, message: error.message, code: (error as any).code }, { status: 500 })
    }

    revalidatePath('/', 'layout')
    revalidatePath('/admin/site/banner-pages')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status ?? 500 })
  }
}
