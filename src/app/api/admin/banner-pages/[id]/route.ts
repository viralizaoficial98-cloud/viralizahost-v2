import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
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
    // Strip immutable columns so Supabase never tries to UPDATE the primary key
    const { id: _id, created_at: _ca, updated_at: _ts, ...updatePayload } = rawBody

    const supabase = await createAdminClient()
    const { data, error } = await (supabase as any)
      .from('banner_pages')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[api/admin/banner-pages] PUT error:', error.message)
      return NextResponse.json({ success: false, message: error.message }, { status: 400 })
    }

    revalidatePath('/', 'layout')
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

    const supabase = await createAdminClient()
    const { error } = await (supabase as any)
      .from('banner_pages')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 })

    revalidatePath('/', 'layout')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.status ?? 500 })
  }
}
