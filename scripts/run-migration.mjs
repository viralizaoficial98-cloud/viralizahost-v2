/**
 * ViralizaHost — Script de migration Supabase
 * Executar: node scripts/run-migration.mjs
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const envRaw = readFileSync(join(__dir, '../.env.local'), 'utf-8')
const env = Object.fromEntries(
  envRaw.split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

const URL = env['NEXT_PUBLIC_SUPABASE_URL']
const KEY = env['SUPABASE_SERVICE_ROLE_KEY']

if (!URL || !KEY || URL === 'your_supabase_url') {
  console.error('❌ Credenciais Supabase não configuradas em .env.local')
  process.exit(1)
}

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'viralizahost' }
})

console.log('🚀 ViralizaHost — Executando migration no Supabase')
console.log(`📡 Projeto: ${URL}`)

const sql = readFileSync(join(__dir, '../supabase/migrations/001_viralizahost_schema.sql'), 'utf-8')

// Usar a API de management do Supabase para executar SQL
const projectRef = URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${KEY}`
  },
  body: JSON.stringify({ query: sql })
})

if (!res.ok) {
  const err = await res.text()
  console.log('⚠️  Tentando via RPC alternativo...')

  // Tentar executar por partes via REST
  const { data, error } = await supabase
    .schema('viralizahost')
    .from('plans')
    .select('count')
    .limit(1)

  if (error && error.code === 'PGRST106') {
    console.error('❌ Schema viralizahost não existe ainda.')
    console.error('👉 Execute o SQL manualmente no Supabase Dashboard > SQL Editor:')
    console.error('   supabase/migrations/001_viralizahost_schema.sql')
  } else if (!error) {
    console.log('✅ Schema viralizahost já existe e está funcional!')
    await validateSchema(supabase)
  }
} else {
  console.log('✅ Migration executada com sucesso!')
  await validateSchema(supabase)
}

async function validateSchema(db) {
  console.log('\n📋 Validando estrutura...')

  const tables = ['profiles', 'plans', 'services', 'domains', 'tickets', 'invoices']
  for (const t of tables) {
    const { error } = await db.schema('viralizahost').from(t).select('count').limit(1)
    if (error) {
      console.log(`  ❌ viralizahost.${t}: ${error.message}`)
    } else {
      console.log(`  ✅ viralizahost.${t}: OK`)
    }
  }

  const { data: plans } = await db.schema('viralizahost').from('plans').select('slug,name,price_usd').order('sort_order')
  console.log(`\n📦 Planos disponíveis (${plans?.length ?? 0}):`)
  plans?.forEach(p => console.log(`  - ${p.name} (${p.slug}): $${p.price_usd}/mês`))
}
