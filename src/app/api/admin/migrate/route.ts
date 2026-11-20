/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
import { NextResponse } from 'next/server'
import { adminGuard } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

// Antes: aplicava DDL no Supabase pela Management API.
// Agora o schema MariaDB é aplicado com database/mariadb/schema.sql (phpMyAdmin ou
// scripts/mariadb/migrate-data.mjs --apply-schema). Esta rota só verifica o estado.
const TABLES = ['profiles', 'plans', 'services', 'domains', 'tickets', 'invoices', 'notifications', 'activity_logs']

async function inspect() {
  const db = createAdminWriteClient()
  const tables: Record<string, { ok: boolean; count?: number; error?: string }> = {}
  for (const table of TABLES) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
    tables[table] = { ok: !error, count: count ?? 0, error: error?.message }
  }
  const { data: plans } = await db.from('plans').select('slug, name, price_usd, is_active').order('sort_order')
  return { tables, plans: plans ?? [] }
}

export async function POST() {
  const denied = await adminGuard()
  if (denied) return denied
  try {
    const { tables, plans } = await inspect()
    const missing = Object.entries(tables).filter(([, v]) => !v.ok).map(([k]) => k)
    const results = [
      {
        step: 'migration_sql',
        ok: missing.length === 0,
        error: missing.length ? `Tabelas em falta (${missing.join(', ')}): importe database/mariadb/schema.sql` : undefined,
      },
      { step: 'validate_plans', ok: !tables.plans?.error, error: tables.plans?.error },
    ]
    return NextResponse.json({ success: results.every(r => r.ok), results, plans })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  const denied = await adminGuard()
  if (denied) return denied
  try {
    const { tables, plans } = await inspect()
    return NextResponse.json({ connected: true, schema: process.env.DB_NAME ?? 'mariadb', tables, plans })
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message }, { status: 500 })
  }
}
