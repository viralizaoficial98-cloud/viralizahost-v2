import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAdminRole()
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  const { data: conversations, error } = await db
    .from('ai_conversations')
    .select('id, title, user_level, status, profile_id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Erro ao carregar conversas.' }, { status: 500 })
  }

  // Fetch profiles for conversations that have a profile_id
  const profileIds = [...new Set(conversations.filter(c => c.profile_id).map(c => c.profile_id!))]
  const profileMap: Record<string, { full_name: string | null; email: string | null }> = {}

  if (profileIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds)
    profiles?.forEach(p => { profileMap[p.id] = { full_name: p.full_name, email: p.email } })
  }

  const enriched = conversations.map(c => ({
    ...c,
    profile: c.profile_id ? profileMap[c.profile_id] ?? null : null,
  }))

  const stats = {
    total: enriched.length,
    active: enriched.filter(c => c.status === 'active').length,
    visitors: enriched.filter(c => c.user_level === 'visitor').length,
    clients: enriched.filter(c => c.user_level === 'client').length,
    admins: enriched.filter(c => c.user_level === 'admin').length,
  }

  return NextResponse.json({ conversations: enriched, stats })
}
