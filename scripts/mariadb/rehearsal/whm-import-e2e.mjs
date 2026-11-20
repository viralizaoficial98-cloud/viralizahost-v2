#!/usr/bin/env node
/**
 * Ensaio da importação WHM (WHM simulado + base de ensaio). Nunca contra produção.
 *   BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/mariadb/rehearsal/whm-import-e2e.mjs
 */
import mysql from 'mysql2/promise'

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
let cookie = ''
const req = async (path, method = 'GET', body) => {
  const r = await fetch(BASE + path, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  for (const c of r.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') cookie = v ? `vh_session=${v}` : '' }
  return { status: r.status, json: await r.json().catch(() => null) }
}
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
const n = async (sql, p = []) => Number(Object.values((await db.query(sql, p))[0][0])[0])

const usersBefore = await n('SELECT COUNT(*) FROM auth_users')
ok((await req('/api/admin/whm/import')).status === 401, 'sem sessão: pré-visualização recusada')
await req('/api/auth/login', 'POST', { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' })
ok((await req('/api/admin/whm/import')).status === 403, 'cliente: pré-visualização recusada (403)')
cookie = ''
await req('/api/auth/login', 'POST', { email: 'admin@ensaio.test', password: 'Admin#Teste2026' })

console.log('\nPré-visualização')
const before = await n('SELECT COUNT(*) FROM whm_accounts')
let r = await req('/api/admin/whm/import')
const p = r.json?.plan
ok(r.status === 200 && p, 'pré-visualização devolvida', JSON.stringify(r.json))
ok(await n('SELECT COUNT(*) FROM whm_accounts') === before, 'pré-visualização não grava nada')
console.log(`    encontradas ${p.found} · novas ${p.new} · actualizar ${p.updated} · já associadas ${p.alreadyLinked} · automáticas ${p.autoLinked} · validação ${p.pendingValidation} · por associar ${p.unlinked} · conflitos ${p.conflicts.length}`)
const by = u => p.items.find(i => i.username === u)
ok(by('joaoconc')?.link === 'pending_validation' && by('joaoconc')?.conflicts.length > 0, 'joaoconc: tem serviço, mas o domínio aparece noutra conta → validação pendente (não associa às cegas)')
ok(p.items.filter(i => i.link === 'linked').every(i => i.conflicts.length === 0), 'contas associadas não têm conflitos')
ok(by('mariaacu')?.link === 'pending_validation' && !p.items.find(i => i.username === 'mariaacu').linkedProfile, 'mariaacu: e-mail igual a cliente → só candidata, não associada')
ok(by('semdono')?.link === 'unlinked', 'semdono: por associar')
ok(by('dupdom')?.conflicts.length > 0, `dupdom: conflito indicado — ${by('dupdom')?.conflicts[0]}`)

console.log('\nAplicar (2 vezes)')
r = await req('/api/admin/whm/import', 'POST')
ok(r.status === 200 && r.json?.applied, 'importação aplicada')
const after1 = await n('SELECT COUNT(*) FROM whm_accounts')
r = await req('/api/admin/whm/import', 'POST')
const after2 = await n('SELECT COUNT(*) FROM whm_accounts')
ok(after1 === after2 && after1 >= p.found, `repetir não duplica e guarda todas as contas (${after1} → ${after2}, encontradas ${p.found})`)
ok((await db.query("SELECT package_name FROM whm_accounts WHERE whm_username = 'joaoconc'"))[0][0].package_name === 'start', 'conta com domínio em conflito não sobrescreve a outra')
ok(r.json?.plan?.new === 0, 'segunda importação: 0 novas')
const maria = (await db.query("SELECT profile_id, link_status, link_candidate_profile_id FROM whm_accounts WHERE whm_username = 'mariaacu'"))[0][0]
ok(!maria.profile_id && maria.link_status === 'pending_validation' && maria.link_candidate_profile_id, 'mariaacu gravada sem cliente, com candidata para validação')
ok(await n('SELECT COUNT(*) FROM auth_users') === usersBefore, 'nenhuma conta de cliente criada pela importação')
ok(await n("SELECT COUNT(*) FROM whm_accounts WHERE raw_metadata LIKE '%pass%'") === 0, 'nenhuma senha importada')

console.log('\nValidação pelo administrador')
const mid = (await db.query("SELECT id, link_candidate_profile_id c FROM whm_accounts WHERE whm_username = 'mariaacu'"))[0][0]
r = await req(`/api/admin/whm/accounts/${mid.id}/link`, 'POST', { profile_id: mid.c })
ok(r.status === 200, 'admin confirma a candidata', JSON.stringify(r.json))
ok((await db.query("SELECT link_status FROM whm_accounts WHERE id = ?", [mid.id]))[0][0].link_status === 'linked' && await n("SELECT COUNT(*) FROM hosting_accounts WHERE cpanel_username = 'mariaacu'") === 1, 'conta associada e visível como serviço do cliente')
const sid = (await db.query("SELECT id FROM whm_accounts WHERE whm_username = 'semdono'"))[0][0].id
r = await req('/api/admin/whm/import', 'POST')
ok((await db.query("SELECT link_status FROM whm_accounts WHERE id = ?", [mid.id]))[0][0].link_status === 'linked', 'nova importação mantém a associação validada')
void sid
await db.end()
console.log(`\n${pass} OK, ${fail} falhadas`)
process.exit(fail ? 1 : 0)
