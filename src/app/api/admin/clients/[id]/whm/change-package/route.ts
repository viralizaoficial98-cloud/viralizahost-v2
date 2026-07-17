import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// Internal helper — whmRequest is not exported, reuse pattern from client.ts
async function whmReq(config: { url: string; token: string; username?: string }, fn: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${config.url.replace(/\/$/, '')}/json-api/${fn}`)
  url.searchParams.set('api.version', '1')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  const res = await fetch(url.toString(), {
    headers: { Authorization: `whm ${config.username ?? 'root'}:${config.token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`WHM ${res.status}`)
  const data = await res.json()
  if (data.metadata?.result === 0) throw new Error(data.metadata.reason ?? 'WHM error')
  return data
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const pkg = String(body.package ?? '').trim()
  if (!pkg) return NextResponse.json({ error: 'Pacote obrigatório.' }, { status: 400 })

  const db = createAdminWriteClient()
  const { data: wa } = await db.from('whm_accounts').select('whm_username, id, package_name').eq('profile_id', profileId).maybeSingle()
  const { data: ha } = await db.from('hosting_accounts').select('cpanel_username, id, package_name').eq('profile_id', profileId).maybeSingle()
  const username = wa?.whm_username ?? ha?.cpanel_username
  if (!username) return NextResponse.json({ error: 'Conta WHM não encontrada.' }, { status: 404 })

  const whmCfg = await loadWhmConfig()
  if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

  try {
    await whmReq(whmCfg.config, 'changepackage', { user: username, pkg })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Erro WHM: ${msg}` }, { status: 502 })
  }

  const prevPkg = wa?.package_name ?? ha?.package_name
  const now     = new Date().toISOString()
  if (wa?.id) await db.from('whm_accounts').update({ package_name: pkg, updated_at: now }).eq('id', wa.id)
  if (ha?.id) await db.from('hosting_accounts').update({ package_name: pkg, updated_at: now }).eq('id', ha.id)

  await Promise.resolve(db.from('activity_logs').insert({
    profile_id:  adminId,
    action:      'update',
    entity_type: 'hosting_account',
    entity_id:   profileId,
    description: `Admin alterou pacote de ${prevPkg} para ${pkg} para conta ${username}`,
    metadata:    { action: 'whm_change_package', admin_id: adminId, username, prev: prevPkg, next: pkg },
  })).catch(() => {})

  return NextResponse.json({ success: true })
}

// GET — list available packages
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
  try { await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const whmCfg = await loadWhmConfig()
  if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

  try {
    const data = await whmReq(whmCfg.config, 'listpkgs')
    const packages = (data.data?.pkg ?? []).map((p: any) => ({
      name:       p.name,
      quota:      p.quota,
      max_email:  p.maxpop,
      max_db:     p.maxsql,
      max_sub:    p.maxsub,
      bwlimit:    p.bwlimit,
    }))
    return NextResponse.json({ packages })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
