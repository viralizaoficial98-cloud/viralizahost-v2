import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createRpcClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'

// Antes só exigia sessão iniciada; repor o catálogo é uma operação de administrador.
async function requireAdmin() {
  return requireAdminRole()
}

// SQL that the admin can run manually in the Supabase Dashboard if all automatic methods fail.
// This is identical to what setup_product_catalog() does, but as raw SQL.
const MANUAL_SQL = `-- Importe no phpMyAdmin (base viralizahost_viralizaHost):
--   1. database/mariadb/schema.sql
--   2. database/mariadb/seed/product-catalog.sql`

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ success: false, message: 'Não autenticado' }, { status: 401 })
  }

  // ── Step 1: Try calling the RPC function (works after migration is applied) ──
  try {
    const rpc = createRpcClient()
    const { data, error } = await rpc.rpc('setup_product_catalog')
    if (!error && data) {
      const result = data as { success: boolean; products: number }
      return NextResponse.json({
        success: true,
        message: `Catálogo configurado com sucesso. ${result.products} produto(s) disponíveis.`,
      })
    }
  } catch {}

  // ── Step 3: Check if tables already exist (maybe migration was applied) ──
  try {
    const supabase = await createAdminClient()
    const { count, error } = await (supabase as any)
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (!error && count != null) {
      return NextResponse.json({
        success: true,
        message: `A tabela products já existe com ${count} produto(s).`,
      })
    }
  } catch {}

  // ── Step 4: Return migration SQL for manual execution ──
  const migrationPath = 'database/mariadb/seed/product-catalog.sql'
  return NextResponse.json({
    success: false,
    message: 'A migração precisa ser aplicada manualmente. Importe o ficheiro abaixo no phpMyAdmin.',
    migrationFile: migrationPath,
    sql: MANUAL_SQL,
  }, { status: 200 })
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ success: false, message: 'Não autenticado' }, { status: 401 })
  }

  // Try RPC check first
  try {
    const rpc = createRpcClient()
    const { data, error } = await rpc.rpc('check_product_catalog')
    if (!error && data) {
      return NextResponse.json(data)
    }
  } catch {}

  // Fall back to direct query
  try {
    const supabase = await createAdminClient()

    const { count: productsCount, error: productsErr } = await (supabase as any)
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (productsErr) {
      return NextResponse.json({ exists: false, error: productsErr.message })
    }

    const { count: featuresCount } = await (supabase as any)
      .from('product_features')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      exists: true,
      products: productsCount ?? 0,
      features: featuresCount ?? 0,
    })
  } catch (err: any) {
    return NextResponse.json({ exists: false, error: err.message })
  }
}
