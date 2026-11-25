import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { getPool } from '@/lib/db/pool'
import { whmSearchOr } from '@/lib/whm/account-search'

export async function GET(req: NextRequest) {
  try {
    await requireAdminRole()

    const { searchParams } = new URL(req.url)
    const status  = searchParams.get('status')  // active | suspended | missing_from_whm
    const linked  = searchParams.get('linked')  // true | false
    const search  = searchParams.get('search')?.toLowerCase()
    const pkg     = searchParams.get('package')
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit   = 50

    const db = createAdminWriteClient()

    let q = db
      .from('whm_accounts')
      .select(`
        id, server_id, whm_username, primary_domain, contact_email,
        package_name, ip_address, disk_used_mb, disk_limit_mb,
        is_suspended, suspension_reason, status, last_synced_at,
        profile_id, service_id, hosting_account_id, link_status, link_candidate_profile_id, linked_at,
        profiles(id, full_name, email)
      `, { count: 'exact' })
      .order('primary_domain', { ascending: true })
      .range((page - 1) * limit, page * limit - 1)

    if (status) q = q.eq('status', status)
    if (pkg)    q = q.eq('package_name', pkg)
    if (linked === 'true')  q = q.not('profile_id', 'is', null)
    if (linked === 'false') q = q.is('profile_id', null)
    // «pending» = sem cliente e com candidata por e-mail a validar
    if (linked === 'pending') q = q.is('profile_id', null).eq('link_status', 'pending_validation')

    // Pesquisa na base, antes da paginação (abrange todas as páginas)
    const searchOr = await whmSearchOr(search)
    if (searchOr) q = q.or(searchOr)

    const { data, count, error } = await q

    if (error) {
      console.error('[whm/accounts GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filtered = data ?? []

    // Contadores globais (independentes do filtro): com cliente, sem cliente, candidatas por validar
    const [[c]] = await getPool().query(`SELECT COUNT(*) total, SUM(profile_id IS NOT NULL) linked, SUM(profile_id IS NULL) unlinked,
      SUM(profile_id IS NULL AND link_status = 'pending_validation') candidates, SUM(profile_id IS NULL AND contact_email IS NOT NULL) unlinked_with_email
      FROM whm_accounts WHERE status <> 'missing_from_whm'`) as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const counts = { total: Number(c.total ?? 0), linked: Number(c.linked ?? 0), unlinked: Number(c.unlinked ?? 0), candidates: Number(c.candidates ?? 0), unlinkedWithEmail: Number(c.unlinked_with_email ?? 0) }
    return NextResponse.json({ data: filtered, total: count ?? 0, page, limit, counts })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}
