import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    await requireAdminRole()
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

    if (q.length < 2) {
      return NextResponse.json({ data: [] })
    }

    const db = createAdminWriteClient()
    const { data, error } = await db
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'client')
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(10)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data ?? [] })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}
