import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createRpcClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAdminRole()
    const supabase = createRpcClient()
    const { data, error } = await supabase.rpc('check_banner_pages')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, ...(data as object) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST() {
  try {
    await requireAdminRole()
    const supabase = createRpcClient()
    const { data, error } = await supabase.rpc('setup_banner_pages')
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, ...(data as object) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status ?? 500 })
  }
}
