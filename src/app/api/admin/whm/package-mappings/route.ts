import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

const WHM_CONFIG_NAME = '__whm_config__'

export async function GET() {
  try {
    await requireAdminRole()
    const db = createAdminWriteClient()

    const { data: server } = await db
      .from('servers')
      .select('id')
      .eq('name', WHM_CONFIG_NAME)
      .maybeSingle()

    const { data, error } = await db
      .from('whm_package_mappings')
      .select('id, server_id, whm_package_name, plan_id, label, plans(id, name, slug)')
      .order('whm_package_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Also return plans list for mapping UI
    const { data: plans } = await db
      .from('plans')
      .select('id, name, slug, type')
      .eq('is_active', true)
      .order('name')

    return NextResponse.json({ data: data ?? [], plans: plans ?? [], serverId: server?.id ?? null })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminRole()
    const body = await req.json() as {
      server_id: string
      whm_package_name: string
      plan_id: string | null
      label?: string
    }

    if (!body.server_id || !body.whm_package_name) {
      return NextResponse.json({ error: 'server_id e whm_package_name são obrigatórios.' }, { status: 400 })
    }

    const db = createAdminWriteClient()
    const now = new Date().toISOString()

    const { error } = await db.from('whm_package_mappings').upsert({
      server_id:        body.server_id,
      whm_package_name: body.whm_package_name,
      plan_id:          body.plan_id ?? null,
      label:            body.label ?? null,
      updated_at:       now,
    }, { onConflict: 'server_id,whm_package_name' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Re-apply mapping: find services linked to this package with no plan, update them
    if (body.plan_id) {
      const { data: haRows } = await db
        .from('hosting_accounts')
        .select('service_id')
        .eq('package_name', body.whm_package_name)
      const serviceIds = ((haRows ?? []) as Array<{ service_id: string }>)
        .map(r => r.service_id)
        .filter(Boolean)
      if (serviceIds.length > 0) {
        await db.from('services')
          .update({ plan_id: body.plan_id, updated_at: now })
          .is('plan_id', null)
          .in('id', serviceIds)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}
