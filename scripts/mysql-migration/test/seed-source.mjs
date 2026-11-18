#!/usr/bin/env node
/**
 * TESTE — preenche uma réplica LOCAL do schema viralizahost (PostgreSQL) com dados sintéticos
 * que exercitam os casos difíceis da migração: acentos e emoji, microssegundos com fusos variados,
 * valores DECIMAL grandes, JSON aninhado, arrays, NULLs e todas as chaves estrangeiras.
 * NUNCA executar contra o Supabase de produção (recusa ligações que não sejam locais).
 *
 *   PG_URL=postgresql://postgres@localhost/vh_src?host=/tmp/pg&port=55432 node seed-source.mjs [linhas_por_tabela]
 */
import pg from 'pg'
import { randomUUID } from 'node:crypto'

const url = process.env.PG_URL
if (!url || !/localhost|127\.0\.0\.1/.test(url)) { console.error('Só aceita PG_URL local.'); process.exit(1) }
const N = Number(process.argv[2] ?? 40)
const c = new pg.Client({ connectionString: url }); await c.connect()
await c.query("SET search_path TO viralizahost, public")
const q = async (s, p) => (await c.query(s, p)).rows

let seed = 42
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
const pick = a => a[Math.floor(rnd() * a.length)]
const WORDS = ['Ação', 'Luanda', 'São Tomé', 'coração', 'Hospedagem', 'Ñandú', 'Zürich', 'café ☕', 'emoji 🚀', "O'Neil", 'aspas "duplas"', 'barra \\ invertida', 'Pão de Açúcar', 'Benguela']
const text = () => `${pick(WORDS)} ${pick(WORDS)} ${Math.floor(rnd() * 1e6)}`
const ts = () => {
  const d = new Date(Date.UTC(2024 + Math.floor(rnd() * 3), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28), Math.floor(rnd() * 24), Math.floor(rnd() * 60), Math.floor(rnd() * 60)))
  const us = String(Math.floor(rnd() * 1e6)).padStart(6, '0')
  const off = pick(['+00', '+01', '-03', '+05:30'])
  return d.toISOString().slice(0, 19).replace('T', ' ') + '.' + us + off
}

// 1) Utilizadores Auth (o trigger handle_new_user cria profiles + clients)
const users = []
for (let i = 0; i < N; i++) {
  const id = randomUUID()
  users.push(id)
  await q(`INSERT INTO auth.users (id, email, raw_user_meta_data, created_at) VALUES ($1, $2, $3, $4)`,
    [id, `cliente${i}+${pick(['joão', 'ana', 'zé'])}@exemplo.ao`.normalize('NFC'), { full_name: `Cliente ${text()}`, phone: '+244 923 000 ' + i, country: pick(['AO', 'BR', 'PT']), role: i === 0 ? 'admin' : 'client' }, ts()])
}

// 2) Restantes tabelas por ordem de dependência, geradas a partir do catálogo
const cols = await q(`SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, numeric_precision, numeric_scale, is_generated
  FROM information_schema.columns WHERE table_schema = 'viralizahost' ORDER BY table_name, ordinal_position`)
const fks = await q(`SELECT cl.relname AS t, a.attname AS col, fcl.relname AS ref, fn.nspname AS refschema, fa.attname AS refcol
  FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_class fcl ON fcl.oid = con.confrelid JOIN pg_namespace fn ON fn.oid = fcl.relnamespace
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
  JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = con.confkey[1]
  WHERE con.contype = 'f' AND n.nspname = 'viralizahost'`)
const checks = await q(`SELECT cl.relname AS t, pg_get_constraintdef(con.oid) AS def FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace WHERE con.contype = 'c' AND n.nspname = 'viralizahost'`)
const enums = {}; for (const r of await q(`SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid`)) (enums[r.typname] ??= []).push(r.enumlabel)
const allowed = {}
for (const ck of checks) for (const m of ck.def.matchAll(/\((\w+) = ANY \(ARRAY\[(.*?)\]\)\)/g))
  allowed[`${ck.t}.${m[1]}`] = m[2].split(',').map(s => s.trim().replace(/^'|'::\w+$/g, '').replace(/'$/, ''))

const tables = [...new Set(cols.map(r => r.table_name))]
const deps = Object.fromEntries(tables.map(t => [t, fks.filter(f => f.t === t && f.refschema === 'viralizahost' && f.ref !== t).map(f => f.ref)]))
const order = []; const seen = new Set()
const visit = t => { if (seen.has(t)) return; seen.add(t); deps[t].forEach(visit); order.push(t) }
tables.forEach(visit)

const idsOf = {}
const pkOf = {}
for (const r of await q(`SELECT cl.relname AS t, a.attname AS col FROM pg_constraint con JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1] WHERE con.contype = 'p' AND n.nspname = 'viralizahost'`)) pkOf[r.t] = r.col

idsOf.profiles = users
idsOf.clients = (await q('SELECT id::text AS id FROM clients')).map(r => r.id)
let inserted = 0
for (const t of order) {
  if (['profiles', 'clients'].includes(t)) continue // criados pelo trigger
  if (t === 'site_home_hero') { await q(`UPDATE site_home_hero SET mode = 'video', video_url = 'https://cdn.exemplo.ao/vídeo início.mp4', video_file_name = 'vídeo início.mp4', video_size_bytes = 48234567, video_storage_path = NULL WHERE id = 1`); continue }
  if (t === 'company_billing_settings') { /* só pode haver uma linha activa */ }
  const tcols = cols.filter(r => r.table_name === t && r.is_generated === 'NEVER')
  const rowsWanted = t === 'company_billing_settings' ? 2 : N
  for (let i = 0; i < rowsWanted; i++) {
    const names = []; const vals = []
    for (const col of tcols) {
      const key = `${t}.${col.column_name}`
      const fk = fks.find(f => f.t === t && f.col === col.column_name)
      let v
      if (fk) {
        const pool = fk.refschema === 'auth' ? users : (idsOf[fk.ref] ?? [])
        if (!pool.length || (col.is_nullable === 'YES' && rnd() < 0.15)) { if (col.is_nullable === 'YES') continue; else throw new Error(`Sem pais para ${key}`) }
        v = pick(pool)
      } else if (col.column_name === pkOf[t] && col.column_default) continue
      else if (allowed[key]) v = pick(allowed[key])
      else if (col.column_default && rnd() < 0.3) continue // deixa o DEFAULT funcionar
      else if (col.is_nullable === 'YES' && rnd() < 0.15) v = null
      else switch (col.data_type) {
        case 'uuid': v = randomUUID(); break
        case 'text': v = /email/.test(col.column_name) ? `x${i}.${Math.floor(rnd() * 1e9)}@exemplo.ao` : /slug|username|extension|domain|name|number|token|code|key/.test(col.column_name) ? `${t.slice(0, 4)}-${col.column_name.slice(0, 6)}-${i}-${Math.floor(rnd() * 1e9)}` : text(); break
        case 'boolean': v = rnd() < 0.5; break
        case 'integer': v = Math.floor(rnd() * 100000); break
        case 'smallint': v = Math.floor(rnd() * 300); break
        case 'bigint': v = String(Math.floor(rnd() * 9e15)); break
        case 'numeric': {
          const p = col.numeric_precision ?? 12, s = col.numeric_scale ?? 2
          if (key === 'banner_pages.overlay_opacity') { v = (rnd()).toFixed(2); break }
          const maxInt = Math.min(p - s, 10)
          v = (rnd() < 0.2 ? '9'.repeat(maxInt) : String(Math.floor(rnd() * 10 ** Math.min(maxInt, 7)))) + (s ? '.' + String(Math.floor(rnd() * 10 ** s)).padStart(s, '0') : '')
          break
        }
        case 'jsonb': case 'json': v = JSON.stringify({ título: text(), itens: [1, 2.5, 'três', { ok: true, nada: null }], n: Math.floor(rnd() * 1e6) }); break
        case 'ARRAY': v = [text(), 'ç', 'emoji 🚀']; break
        case 'timestamp with time zone': v = ts(); break
        case 'date': v = ts().slice(0, 10); break
        case 'inet': v = pick(['197.149.12.34', '2001:db8::1']); break
        case 'USER-DEFINED': v = pick(enums[col.udt_name]); break
        default: throw new Error(`tipo ${col.data_type} em ${key}`)
      }
      if (key === 'site_home_hero.mode') v = 'carousel'
      if (key === 'company_billing_settings.active') v = i === 0
      names.push(`"${col.column_name}"`); vals.push(v)
    }
    try {
      const r = await q(`INSERT INTO "${t}" (${names.join(', ')}) VALUES (${vals.map((_, k) => `$${k + 1}`).join(', ')}) RETURNING "${pkOf[t]}"::text AS id`, vals)
      ;(idsOf[t] ??= []).push(r[0].id); inserted++
    } catch (e) { if (!/duplicate|violates check/.test(e.message)) throw new Error(`${t}: ${e.message}`) }
  }
}
console.log(`Origem preenchida: ${users.length} utilizadores + ${inserted} linhas em ${order.length} tabelas.`)
await c.end()
