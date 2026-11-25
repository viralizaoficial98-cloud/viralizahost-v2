#!/usr/bin/env node
/**
 * Ensaio da associação MANUAL de contas WHM importadas a clientes (WHM simulado + base de ENSAIO).
 * Nunca contra produção: importa contas do WHM simulado, cria e remove um cliente por confirmar.
 *   BASE_URL=http://localhost:3100 node --env-file=.env.local scripts/mariadb/rehearsal/whm-link-e2e.mjs
 * Cenários (mock-whm.mjs): comerc → contacto comercial@ensaio.test (≠ e-mail do cliente);
 * testeadm → e-mail de conta administrativa; mariaacu → candidata por e-mail (cliente2).
 */
import mysql from 'mysql2/promise'
import { randomUUID } from 'node:crypto'

const BASE = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const r = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of r.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : '' }
    const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch {}
    return { status: r.status, json, text }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
}
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
const one = async (sql, p = []) => (await db.query(sql, p))[0][0]

// Estado limpo para as contas de ensaio deste conjunto (só existem no WHM simulado)
const TEST_USERS = ['comerc', 'testeadm', 'mariaacu']
await db.query(`DELETE s FROM services s JOIN hosting_accounts h ON h.service_id = s.id WHERE h.cpanel_username IN (${TEST_USERS.map(() => '?').join(',')})`, TEST_USERS)
await db.query(`DELETE FROM hosting_accounts WHERE cpanel_username IN (${TEST_USERS.map(() => '?').join(',')})`, TEST_USERS)
await db.query(`DELETE FROM whm_accounts WHERE whm_username IN (${TEST_USERS.map(() => '?').join(',')})`, TEST_USERS)
await db.query("DELETE FROM domains WHERE CONCAT(name, extension) IN ('lojacomercial.ao','testeadmin.ao','mariaacucar.com') AND order_id IS NULL")

const adm = new S(), adm2 = new S(), c1 = new S(), c2 = new S(), anon = new S()
ok((await adm.login('admin@ensaio.test', 'Admin#Teste2026')).status === 200, 'login administrador (sessão 1)')
ok((await adm2.login('admin@ensaio.test', 'Admin#Teste2026')).status === 200, 'login administrador (sessão 2)')
ok((await c1.login('cliente1@ensaio.test', 'Cliente#Um2026')).status === 200, 'login cliente 1')
ok((await c2.login('cliente2@ensaio.test', 'Cliente#Dois2026')).status === 200, 'login cliente 2')
const id = async email => (await one('SELECT id FROM profiles WHERE email = ?', [email])).id
const p1 = await id('cliente1@ensaio.test'), p2 = await id('cliente2@ensaio.test'), pAdm = await id('admin@ensaio.test')
// Este conjunto testa a regra com a confirmação de e-mail ACTIVA (Configurações → Contas); a regra com a opção
// desactivada está em whm-link-confirmation-e2e.cjs. A opção é reposta no fim.
const snapAccountSettings = await one('SELECT * FROM account_settings WHERE id = 1')
await adm.req('/api/admin/settings/accounts', { method: 'PUT', body: { emailConfirmationRequired: true } })
// Cliente registado mas com e-mail por confirmar (não elegível)
const pNC = randomUUID(), ncEmail = `porconfirmar-${pNC.slice(0, 6)}@ensaio.test`
await db.query('INSERT INTO auth_users (id, email, encrypted_password, email_confirmed_at) VALUES (?, ?, NULL, NULL)', [pNC, ncEmail])
await db.query("INSERT INTO profiles (id, email, full_name, role) VALUES (?, ?, 'Cliente Por Confirmar', 'client')", [pNC, ncEmail])

try {
  console.log('\n1. Importação e candidatas por e-mail')
  let r = await adm.req('/api/admin/whm/import', { method: 'POST' })
  ok(r.status === 200, 'sincronização importa as contas do WHM')
  const w = async u => one('SELECT * FROM whm_accounts WHERE whm_username = ?', [u])
  const comerc = await w('comerc'), tadm = await w('testeadm'), maria = await w('mariaacu')
  ok(comerc && !comerc.profile_id && comerc.contact_email === 'comercial@ensaio.test', 'conta com contacto comercial@ fica «Sem cliente» e o contacto é preservado')
  ok(tadm && !tadm.profile_id && !tadm.link_candidate_profile_id && tadm.link_status === 'unlinked', 'e-mail de conta administrativa NÃO gera candidata')
  ok(maria?.link_status === 'pending_validation' && maria.link_candidate_profile_id === p2 && !maria.profile_id, 'e-mail de cliente confirmado → candidata por validar (sem associação automática)')

  console.log('\n2. Permissões e elegibilidade')
  r = await anon.req(`/api/admin/whm/accounts/${comerc.id}/link`, { method: 'POST', body: { profile_id: p2, confirmed: true } })
  ok(r.status === 401, `visitante não associa (${r.status})`)
  r = await c1.req(`/api/admin/whm/accounts/${comerc.id}/link`, { method: 'POST', body: { profile_id: p1, confirmed: true } })
  ok(r.status === 403 || r.status === 401, `cliente não associa (${r.status})`)
  r = await c1.req('/api/admin/profiles/search?q=cliente')
  ok(r.status === 403 || r.status === 401, 'cliente não pesquisa clientes')
  r = await adm.req('/api/admin/profiles/search?q=admin')
  ok(r.status === 200 && !(r.json?.data ?? []).some(c => c.id === pAdm || c.email === 'admin@ensaio.test'), 'pesquisa não mostra contas administrativas')
  r = await adm.req('/api/admin/profiles/search?q=cliente2%40ensaio')
  const opts = r.json?.data ?? []
  ok(opts.some(c => c.id === p2 && c.eligible) && !opts.some(c => c.id === pAdm), 'pesquisa por e-mail encontra clientes elegíveis')
  r = await adm.req(`/api/admin/profiles/search?q=${encodeURIComponent(ncEmail)}`)
  const nc = (r.json?.data ?? []).find(c => c.id === pNC)
  ok(nc && !nc.eligible && /confirmado/.test(nc.reason ?? ''), 'cliente com e-mail por confirmar aparece como não elegível, com o motivo')
  r = await adm.req('/api/admin/profiles/search?q=Maria')
  ok(r.status === 200 && Array.isArray(r.json?.data), 'pesquisa por nome')
  r = await adm.req(`/api/admin/whm/accounts/${tadm.id}/link`, { method: 'POST', body: { profile_id: pAdm, confirmed: true } })
  ok(r.status === 422 && /administrativas/.test(r.json?.error ?? ''), 'servidor recusa associar a uma conta administrativa')
  r = await adm.req(`/api/admin/whm/accounts/${comerc.id}/link`, { method: 'POST', body: { profile_id: pNC, confirmed: true } })
  ok(r.status === 422, 'servidor recusa cliente com e-mail por confirmar')
  r = await adm.req(`/api/admin/whm/accounts/${comerc.id}/link`, { method: 'POST', body: { profile_id: p2 } })
  ok(r.status === 400 && r.json?.code === 'confirmation_required', 'sem confirmação explícita não grava')
  ok(!(await w('comerc')).profile_id, 'conta continua «Sem cliente» depois das recusas')

  console.log('\n3. Associação manual com e-mail diferente e corrida entre dois administradores')
  r = await adm.req(`/api/admin/whm/accounts/${comerc.id}/link`)
  ok(r.status === 200 && r.json?.account?.primary_domain === 'lojacomercial.ao' && r.json.account.whm_username === 'comerc' && r.json.account.contact_email === 'comercial@ensaio.test' && r.json.account.server && r.json.account.server !== '__whm_config__', `resumo para confirmação: domínio, utilizador, servidor (${r.json?.account?.server}) e contacto WHM`)
  const [a, b] = await Promise.all([
    adm.req(`/api/admin/whm/accounts/${comerc.id}/link`, { method: 'POST', body: { profile_id: p2, confirmed: true } }),
    adm2.req(`/api/admin/whm/accounts/${comerc.id}/link`, { method: 'POST', body: { profile_id: p1, confirmed: true } }),
  ])
  const statuses = [a.status, b.status].sort().join(',')
  const winner = a.status === 200 ? p2 : p1, loser = a.status === 200 ? b : a
  ok(statuses === '200,409' && loser.json?.code === 'already_linked' && loser.json?.conflict?.currentClient?.email, `gravação simultânea: uma vence, a outra recebe conflito com o titular actual (${statuses})`)
  const cAfter = await w('comerc')
  const has = Number((await one("SELECT COUNT(*) n FROM hosting_accounts WHERE cpanel_username = 'comerc'")).n)
  ok(cAfter.profile_id === winner && cAfter.link_status === 'linked' && has === 1 && cAfter.service_id && cAfter.hosting_account_id, 'conta WHM com um único titular, um serviço e uma conta de alojamento')
  ok(cAfter.linked_by === pAdm && cAfter.linked_at && cAfter.link_method === 'manual', 'regista quem associou, quando e como (manual)')
  ok(cAfter.contact_email === 'comercial@ensaio.test', 'contacto do WHM preservado tal como veio')
  ok(!!(await one("SELECT 1 x FROM activity_logs WHERE entity_id = ? AND description LIKE 'whm_link:%'", [comerc.id])), 'associação registada no histórico')
  const svc = await one('SELECT * FROM services WHERE id = ?', [cAfter.service_id])
  ok(svc.profile_id === winner && svc.status === 'active' && svc.provisioning_status === 'active' && Number(svc.price) === 0 && svc.renewal_price === null && svc.activation_source === 'import', 'serviço importado criado sem preço nem renovação (sem cobranças)')
  ok(Number((await one('SELECT COUNT(*) n FROM invoices WHERE service_id = ?', [svc.id])).n) === 0, 'nenhuma factura criada')
  r = await adm.req(`/api/admin/whm/accounts/${comerc.id}/link`, { method: 'POST', body: { profile_id: winner === p2 ? p1 : p2, confirmed: true } })
  ok(r.status === 409, 'nova tentativa para outro cliente → conflito para revisão, nada alterado')

  console.log('\n4. Contadores e filtros')
  r = await adm.req('/api/admin/whm/accounts?linked=true')
  ok(r.json?.data?.some(x => x.id === comerc.id), 'aparece em «Com cliente»')
  r = await adm.req('/api/admin/whm/accounts?linked=false')
  ok(!r.json?.data?.some(x => x.id === comerc.id) && r.json?.data?.some(x => x.id === tadm.id), 'sai de «Sem cliente» (a conta testeadm continua lá)')
  ok(typeof r.json?.counts?.unlinked === 'number' && r.json.counts.linked >= 1, `contadores: ${JSON.stringify(r.json?.counts)}`)
  r = await adm.req('/api/admin/whm/accounts?linked=pending')
  ok(r.json?.data?.some(x => x.id === maria.id) && r.json.data.every(x => !x.profile_id && x.link_status === 'pending_validation'), '«Candidatas» lista só contas com cliente sugerido por e-mail')
  r = await adm.req('/admin/servers/whm-accounts?linked=false')
  ok(r.status === 200 && r.text.includes('data-testid="whm-link-btn"') && r.text.includes('Associar cliente'), 'página: «Associar cliente» nas contas sem cliente (incluindo sem candidata)')
  ok(/sem cliente associado/.test(r.text) && /não basta/.test(r.text), 'aviso explica que o e-mail de contacto não basta para associar')

  console.log('\n5. Sincronização preserva o vínculo e continua a actualizar os dados')
  await db.query("UPDATE whm_accounts SET disk_used_mb = 1, package_name = 'antigo' WHERE id = ?", [comerc.id])
  r = await adm.req('/api/admin/whm/sync', { method: 'POST' })
  const cSync = await w('comerc')
  ok(r.status === 200 && cSync.profile_id === winner && cSync.link_status === 'linked' && cSync.service_id === cAfter.service_id && cSync.linked_by === pAdm, 'vínculo, serviço e autoria preservados após sincronizar')
  ok(Number(cSync.disk_used_mb) === 120 && cSync.package_name === 'business' && cSync.contact_email === 'comercial@ensaio.test', 'dados do WHM actualizados (uso, pacote) e contacto preservado')

  console.log('\n6. Área do Cliente: só o titular vê e abre a hospedagem')
  const owner = winner === p2 ? c2 : c1, other = winner === p2 ? c1 : c2
  r = await owner.req('/services')
  ok(r.status === 200 && r.text.includes('lojacomercial.ao'), 'titular vê a hospedagem importada em Serviços')
  r = await other.req('/services')
  ok(r.status === 200 && !r.text.includes('lojacomercial.ao'), 'outro cliente não vê a hospedagem')
  r = await owner.req(`/api/client/hosting/${svc.id}/cpanel-sso`, { method: 'POST' })
  ok(r.status === 200 && /cpsess/.test(r.json?.redirectUrl ?? ''), 'titular abre o cPanel')
  r = await owner.req(`/api/client/hosting/${svc.id}/webmail-sso`, { method: 'POST' })
  ok(r.status === 200 && !!r.json?.redirectUrl, 'titular abre o Webmail')
  r = await other.req(`/api/client/hosting/${svc.id}/cpanel-sso`, { method: 'POST' })
  ok(r.status === 404, 'outro cliente não abre o cPanel (404)')
  r = await other.req('/api/db', { method: 'POST', body: { table: 'hosting_accounts', op: 'select', select: 'id', conditions: [{ column: 'cpanel_username', op: 'eq', value: 'comerc' }], order: [] } })
  ok((r.json?.data ?? []).length === 0, 'outro cliente não lê a conta pela API de dados')

  console.log('\n7. Candidata por e-mail: confirmação manual')
  r = await adm.req(`/api/admin/whm/accounts/${maria.id}/link`, { method: 'POST', body: { profile_id: p2, confirmed: true } })
  const mAfter = await w('mariaacu')
  ok(r.status === 200 && mAfter.profile_id === p2 && mAfter.link_method === 'candidate' && !mAfter.link_candidate_profile_id, 'candidata confirmada → associada (método «candidata»)')
  r = await adm.req(`/api/admin/whm/accounts/${tadm.id}/candidate`, { method: 'POST' })
  ok(r.status === 200 && !(await w('testeadm')).profile_id, 'recusar sugestão mantém «Sem cliente»')
} finally {
  if (snapAccountSettings) await db.query('UPDATE account_settings SET email_confirmation_required = ?, updated_by = ? WHERE id = 1', [snapAccountSettings.email_confirmation_required, snapAccountSettings.updated_by])
  else await db.query('DELETE FROM account_settings WHERE id = 1')
  await db.query('DELETE FROM profiles WHERE id = ?', [pNC])
  await db.query('DELETE FROM auth_users WHERE id = ?', [pNC])
  await db.end()
}
console.log(`\n${pass} passaram, ${fail} falharam`)
process.exit(fail ? 1 : 0)
