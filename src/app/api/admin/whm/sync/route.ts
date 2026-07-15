import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { syncWhmAccounts } from '@/lib/whm/sync'

export async function POST() {
  try {
    await requireAdminRole()
    const result = await syncWhmAccounts()
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    console.error('[whm/sync] error:', e.message)
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}
