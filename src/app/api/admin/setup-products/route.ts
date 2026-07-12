import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createAuthClient, createRpcClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

// SQL that the admin can run manually in the Supabase Dashboard if all automatic methods fail.
// This is identical to what setup_product_catalog() does, but as raw SQL.
const MANUAL_SQL = `-- Run this in Supabase Dashboard → SQL Editor
-- It creates the products catalog tables and seeds all products.
-- Copy from: supabase/migrations/20260712_000000_products_rpc.sql

SELECT public.setup_product_catalog();

-- If the function doesn't exist yet, run the full migration file first:
-- supabase/migrations/20260712_000000_products_rpc.sql`

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

  // ── Step 2: Try Supabase Management API with SUPABASE_ACCESS_TOKEN ──
  const pat = process.env.SUPABASE_ACCESS_TOKEN
  if (pat) {
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
      .replace('https://', '').split('.')[0]

    try {
      const mgmtRes = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pat}`,
          },
          body: JSON.stringify({ query: 'SELECT public.setup_product_catalog()' }),
        }
      )
      if (mgmtRes.ok) {
        return NextResponse.json({
          success: true,
          message: 'Tabelas criadas e catálogo carregado com sucesso via Management API.',
        })
      }
    } catch {}
  }

  // ── Step 3: Check if tables already exist (maybe migration was applied) ──
  try {
    const supabase = await createAdminClient()
    const { count, error } = await (supabase as any)
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (!error && count != null) {
      return NextResponse.json({
        success: true,
        message: `A tabela viralizahost.products já existe com ${count} produto(s).`,
      })
    }
  } catch {}

  // ── Step 4: Return migration SQL for manual execution ──
  const migrationPath = 'supabase/migrations/20260712_000000_products_rpc.sql'
  return NextResponse.json({
    success: false,
    message: 'A migração precisa ser aplicada manualmente. Execute o ficheiro abaixo no Supabase Dashboard.',
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
