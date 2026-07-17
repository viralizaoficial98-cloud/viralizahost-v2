import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  try { await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()
  const { data: logs } = await db
    .from('activity_logs')
    .select('id, action, entity_type, entity_id, description, metadata, created_at')
    .eq('entity_id', profileId)
    .order('created_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ logs: logs ?? [] })
}
