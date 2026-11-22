#!/usr/bin/env node
/**
 * Ensaio: verificação de e-mail (registo → token → pedido ao Resend SIMULADO → link → confirmação)
 * e eliminação/suspensão de contas de cliente. Base de ENSAIO apenas; contas fictícias criadas aqui.
 *   BASE_URL=http://localhost:3100 RESEND_SIM=http://127.0.0.1:12090 \
 *     node --env-file=.env.local scripts/mariadb/rehearsal/account-email-e2e.mjs
 * O Next de ensaio corre com RESEND_API_URL=$RESEND_SIM e uma chave fictícia «re_…».
 */
import mysql from 'mysql2/promise'
import { randomBytes } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

const BASE = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/$/, '')
const SIM = process.env.RESEND_SIM || 'http://127.0.0.1:12090'
const WHM_LOG = process.env.WHM_LOG || '/tmp/claude-0/work/whm/requests.log'
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
class S {
  cookie = ''
  async req(path, { method = 'GET', body, raw = false } = {}) {
    const r = await fetch(path.startsWith('http') ? path : BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of r.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : '' }
    const text = raw ? '' : await r.text(); let json = null; try { json = JSON.parse(text) } catch {}
    return { status: r.status, json, text, location: r.headers.get('location') }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
}
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
const one = async (sql, p = []) => (await db.query(sql, p))[0][0]
const tag = randomBytes(3).toString('hex')
const PW = 'Ensaio#Conta2026'
const signup = (s, email, name = 'Conta Ensaio') => s.req('/api/auth/signup', { method: 'POST', body: { email, password: PW, options: { data: { full_name: name, role: 'admin' } } } })
const lastMail = async to => (await (await fetch(`${SIM}/_outbox?to=${encodeURIComponent(to)}`)).json())
const linkOf = m => (m?.last?.html?.match(/href="([^"]+)"/) ?? [])[1]?.replace(/&amp;/g, '&')
const whmLogBefore = existsSync(WHM_LOG) ? readFileSync(WHM_LOG, 'utf8').length : 0

const adm = new S(), anon = new S(), c1 = new S()
ok((await adm.login('admin@ensaio.test', 'Admin#Teste2026')).status === 200, 'login administrador')
ok((await c1.login('cliente1@ensaio.test', 'Cliente#Um2026')).status === 200, 'login cliente 1')
const created = []

try {
  console.log('\n1. Registo com falha de envio (reproduz «o e-mail não chega»)')
  const failEmail = `falha-envio-${tag}@ensaio.test`; created.push(failEmail)
  let r = await signup(anon, failEmail)
  ok(r.status === 200 && r.json?.email_sent === false && r.json?.session === null, 'conta criada, resposta indica que o e-mail não foi enviado (antes: erro 500 sem saída)')
  const fu = await one('SELECT u.id, u.email_confirmed_at, p.role FROM auth_users u JOIN profiles p ON p.id = u.id WHERE u.email = ?', [failEmail])
  ok(fu && !fu.email_confirmed_at && fu.role === 'client', 'conta fica por verificar e com papel cliente (o papel enviado pelo navegador é ignorado)')
  const fl = await one('SELECT status, error, provider_id FROM auth_email_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [fu.id])
  ok(fl?.status === 'failed' && /422/.test(fl.error ?? '') && !fl.provider_id, `falha registada com a resposta do Resend: ${fl?.error}`)
  r = await anon.login(failEmail, PW)
  ok(r.status === 400 && r.json?.error?.code === 'email_not_confirmed', 'login recusado: e-mail por confirmar')

  console.log('\n2. Registo, link e confirmação')
  const em = `ensaio-${tag}@ensaio.test`; created.push(em)
  r = await signup(anon, em, 'Conta Verificar')
  ok(r.status === 200 && r.json?.email_sent === true, 'registo: pedido aceite pelo Resend')
  const u = await one('SELECT id FROM auth_users WHERE email = ?', [em])
  const lg = await one('SELECT status, provider_id, error FROM auth_email_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [u.id])
  ok(lg?.status === 'accepted' && lg.provider_id, 'registo do envio guarda o id do Resend (sem link nem token)')
  const logText = JSON.stringify(await one('SELECT * FROM auth_email_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [u.id]))
  ok(!/token_hash|verify\?/.test(logText), 'o link não fica guardado no registo de envios')
  const m1 = await lastMail(em)
  const link1 = linkOf(m1)
  ok(m1.count === 1 && link1 && link1.startsWith(`${BASE}/api/auth/verify?type=signup&token_hash=`), `link aponta para o endereço público configurado (${BASE}/api/auth/verify…)`)
  ok(/comercial@viralizahost\.com/.test(m1.last.from), `remetente ${m1.last.from}`)
  // reenvio: o link anterior deixa de valer
  r = await anon.req('/api/auth/resend-verification', { method: 'POST', body: { email: em } })
  const generic = r.json?.message
  ok(r.status === 200 && /Se este endereço/.test(generic ?? ''), 'reenvio: resposta pública genérica')
  const m2 = await lastMail(em)
  const link2 = linkOf(m2)
  ok(m2.count === 2 && link2 && link2 !== link1, 'reenvio gera um novo link')
  r = await anon.req(link1)
  ok(r.status === 307 && /\/verificar-email\?estado=expirado/.test(r.location ?? ''), 'link anterior ao reenvio → «Link expirado» com opção de reenviar')
  const v = new S()
  r = await v.req(link2)
  ok(r.status === 307 && /\/dashboard\?verificado=1/.test(r.location ?? '') && !!v.cookie, 'link válido confirma a conta e inicia sessão')
  ok(!!(await one('SELECT email_confirmed_at FROM auth_users WHERE id = ?', [u.id])).email_confirmed_at, 'auth_users.email_confirmed_at preenchido')
  r = await anon.req(link2)
  ok(r.status === 307 && /estado=ja-confirmado/.test(r.location ?? ''), 'link reutilizado → «E-mail já confirmado»')
  r = await anon.req('/api/auth/verify?type=signup&token_hash=inexistente123')
  ok(r.status === 307 && /estado=invalido/.test(r.location ?? ''), 'link inválido → «Link inválido»')
  // link expirado (24 h) numa conta ainda por verificar
  const em3 = `expira-${tag}@ensaio.test`; created.push(em3)
  await signup(anon, em3)
  const link3 = linkOf(await lastMail(em3))
  const u3 = await one('SELECT id FROM auth_users WHERE email = ?', [em3])
  await db.query("UPDATE auth_tokens SET expires_at = CURRENT_TIMESTAMP(6) - INTERVAL 1 MINUTE WHERE user_id = ? AND type = 'signup'", [u3.id])
  r = await anon.req(link3)
  ok(r.status === 307 && /estado=expirado/.test(r.location ?? '') && !(await one('SELECT email_confirmed_at FROM auth_users WHERE id = ?', [u3.id])).email_confirmed_at, 'link com mais de 24 h → «Link expirado», conta continua por verificar')
  r = await anon.req('/verificar-email?estado=expirado')
  ok(r.status === 200 && /Link expirado/.test(r.text) && /Reenviar e-mail de verificação/.test(r.text), 'página /verificar-email mostra o motivo e o reenvio')

  console.log('\n3. Reenvio: não revela contas e tem limite')
  const unknown = `naoexiste-${tag}@ensaio.test`
  const rA = await anon.req('/api/auth/resend-verification', { method: 'POST', body: { email: unknown } })
  const rB = await anon.req('/api/auth/resend-verification', { method: 'POST', body: { email: em } }) // já verificado
  ok(rA.status === 200 && rB.status === 200 && rA.json?.message === generic && rB.json?.message === generic, 'mesma resposta para endereço inexistente, verificado ou por verificar')
  ok((await lastMail(unknown)).count === 0 && (await lastMail(em)).count === 2, 'nada é enviado para endereços inexistentes ou já verificados')
  const rl = `limite-${tag}@ensaio.test`
  const codes = []
  for (let i = 0; i < 4; i++) codes.push((await anon.req('/api/auth/resend-verification', { method: 'POST', body: { email: rl } })).status)
  ok(codes.slice(0, 3).every(c => c === 200) && codes[3] === 429, `limite por endereço (${codes.join(',')})`)

  console.log('\n4. Recuperação de senha mantém-se')
  r = await anon.req('/api/auth/recover', { method: 'POST', body: { email: em } })
  const rec = linkOf(await lastMail(em))
  ok(r.status === 200 && /type=recovery/.test(rec ?? ''), 'pedido de recuperação envia link')
  r = await new S().req(rec)
  ok(r.status === 307 && /\/reset-password\?type=recovery/.test(r.location ?? ''), 'link de recuperação abre a redefinição de senha')

  console.log('\n5. Conta por verificar não é elegível para associação WHM')
  r = await adm.req(`/api/admin/profiles/search?q=${encodeURIComponent(em3)}`)
  const opt = (r.json?.data ?? []).find(x => x.email === em3)
  ok(opt && !opt.eligible && /confirmado/.test(opt.reason ?? ''), 'pesquisa mostra «E-mail ainda não confirmado»')
  const anyWhm = await one("SELECT id FROM whm_accounts WHERE profile_id IS NULL AND status <> 'missing_from_whm' LIMIT 1")
  if (anyWhm) {
    r = await adm.req(`/api/admin/whm/accounts/${anyWhm.id}/link`, { method: 'POST', body: { profile_id: u3.id, confirmed: true } })
    ok(r.status === 422 && !(await one('SELECT profile_id FROM whm_accounts WHERE id = ?', [anyWhm.id])).profile_id, 'associação recusada no servidor')
  } else ok(true, 'sem conta WHM livre para o teste de associação (coberto em whm-link-e2e)')

  console.log('\n6. Diagnóstico no painel (Integrações → E-mail)')
  r = await c1.req('/api/admin/integrations/email')
  ok([401, 403].includes(r.status), `cliente sem acesso ao diagnóstico (${r.status})`)
  r = await adm.req('/api/admin/integrations/email')
  ok(r.status === 200 && r.json?.config?.keyPresent === true && r.json.config.fromEmail === 'comercial@viralizahost.com' && !/re_ensaio/.test(r.text), 'configuração do processo (chave presente, remetente) sem expor a chave')
  ok(r.json?.recent?.some(x => x.recipient === failEmail && x.status === 'failed'), 'últimos envios incluem a falha do registo')
  r = await adm.req('/api/admin/integrations/email', { method: 'POST', body: { action: 'domain' } })
  ok(r.json?.ok === true && /verificado/.test(r.json.message), `domínio do remetente: ${r.json?.message}`)
  const bounce = `devolvido-${tag}@ensaio.test`
  r = await adm.req('/api/admin/integrations/email', { method: 'POST', body: { action: 'test', to: bounce } })
  ok(r.json?.ok === true && r.json.id, 'e-mail de teste aceite pelo Resend')
  r = await adm.req('/api/admin/integrations/email', { method: 'POST', body: { action: 'refresh' } })
  const evs = Object.fromEntries((r.json?.recent ?? []).filter(x => x.last_event).map(x => [x.recipient, x.last_event]))
  ok(evs[em] === 'delivered' && evs[bounce] === 'bounced', `«aceite» ≠ «entregue»: estado consultado (entregue / devolvido)`)

  console.log('\n7. Clientes: estado do e-mail e reenvio pelo administrador')
  r = await adm.req('/api/admin/clients?filter=unverified')
  ok(r.json?.clients?.some(c => c.email === em3 && c.email_verified === false) && !r.json.clients.some(c => c.email === em), 'filtro «E-mail por verificar»')
  r = await adm.req('/api/admin/clients')
  const admRow = r.json?.clients?.find(c => c.email === 'admin@ensaio.test')
  ok(admRow?.role === 'admin', 'conta administrativa listada com papel «admin» (assinalada, fora dos contadores de clientes)')
  const before = r.json?.stats
  r = await adm.req(`/api/admin/clients/${u3.id}/resend-verification`, { method: 'POST' })
  ok(r.status === 200 && r.json?.ok, 'administrador reenvia a verificação')

  console.log('\n8. Eliminação de contas')
  const delEmail = `eliminar-${tag}@ensaio.test`
  await signup(anon, delEmail, 'Conta Para Eliminar')
  const del = await one('SELECT id FROM auth_users WHERE email = ?', [delEmail])
  const dl = new S(); await db.query('UPDATE auth_users SET email_confirmed_at = CURRENT_TIMESTAMP(6) WHERE id = ?', [del.id])
  ok((await dl.login(delEmail, PW)).status === 200, 'conta fictícia com sessão aberta')
  r = await c1.req(`/api/admin/clients/${del.id}`, { method: 'DELETE', body: { confirm_email: delEmail } })
  ok([401, 403].includes(r.status), `cliente não elimina contas (${r.status})`)
  r = await adm.req(`/api/admin/clients/${del.id}/deletion`)
  ok(r.json?.eligible === true && r.json.blockers.length === 0, 'conta sem dependências: elegível')
  r = await adm.req(`/api/admin/clients/${del.id}`, { method: 'DELETE', body: { confirm_email: 'outro@ensaio.test' } })
  ok(r.status === 400 && r.json?.code === 'confirmation_mismatch', 'sem o e-mail exacto não elimina')
  r = await adm.req(`/api/admin/clients/${del.id}`, { method: 'DELETE', body: { confirm_email: delEmail.toUpperCase() } })
  ok(r.status === 200 && r.json?.deleted, 'eliminada com confirmação')
  ok(!(await one('SELECT id FROM auth_users WHERE id = ?', [del.id])) && !(await one('SELECT id FROM profiles WHERE id = ?', [del.id])) && !(await one('SELECT id FROM auth_sessions WHERE user_id = ?', [del.id])) && !(await one('SELECT id FROM clients WHERE profile_id = ?', [del.id])), 'autenticação, perfil, sessões e registo de cliente removidos')
  ok((await dl.req('/api/auth/user')).json?.user == null, 'a sessão aberta deixa de funcionar')
  r = await adm.req('/api/admin/clients')
  ok(r.json?.stats?.total === before.total && !r.json.clients.some(c => c.email === delEmail), `lista e contadores actualizados (${r.json?.stats?.total} clientes)`)
  ok(!!(await one("SELECT 1 x FROM activity_logs WHERE description LIKE ?", [`client_delete: conta ${delEmail}%`])), 'eliminação registada no histórico')

  const admId = (await one("SELECT id FROM profiles WHERE email = 'admin@ensaio.test'")).id
  r = await adm.req(`/api/admin/clients/${admId}/deletion`)
  ok(r.json?.eligible === false && r.json.blockers.some(b => b.code === 'protected_role') && r.json.blockers.some(b => b.code === 'self'), 'conta administrativa: protegida')
  r = await adm.req(`/api/admin/clients/${admId}`, { method: 'DELETE', body: { confirm_email: 'admin@ensaio.test' } })
  ok(r.status === 409 && !!(await one('SELECT id FROM auth_users WHERE id = ?', [admId])), 'eliminação de conta administrativa recusada no servidor')
  r = await adm.req(`/api/admin/clients/${admId}/access`, { method: 'POST', body: { active: false } })
  ok(r.status === 403, 'acesso de conta administrativa não pode ser suspenso aqui')

  const c1Id = (await one("SELECT id FROM profiles WHERE email = 'cliente1@ensaio.test'")).id
  const deps = { inv: (await one('SELECT COUNT(*) n FROM invoices WHERE profile_id = ?', [c1Id])).n, ha: (await one('SELECT COUNT(*) n FROM hosting_accounts WHERE profile_id = ?', [c1Id])).n }
  r = await adm.req(`/api/admin/clients/${c1Id}/deletion`)
  const codes1 = (r.json?.blockers ?? []).map(b => b.code)
  ok(r.json?.eligible === false && codes1.includes('invoices') && codes1.includes('hosting') && r.json.canSuspend, `cliente com histórico: bloqueado (${r.json?.blockers?.map(b => b.label).join('; ')})`)
  r = await adm.req(`/api/admin/clients/${c1Id}`, { method: 'DELETE', body: { confirm_email: 'cliente1@ensaio.test' } })
  ok(r.status === 409 && Array.isArray(r.json?.blockers), 'eliminação recusada com os motivos')
  ok((await one('SELECT COUNT(*) n FROM invoices WHERE profile_id = ?', [c1Id])).n === deps.inv && (await one('SELECT COUNT(*) n FROM hosting_accounts WHERE profile_id = ?', [c1Id])).n === deps.ha, 'facturas e hospedagem intactas')
  const whmAfter = existsSync(WHM_LOG) ? readFileSync(WHM_LOG, 'utf8').slice(whmLogBefore) : ''
  ok(!/"fn":"(removeacct|suspendacct)"/.test(whmAfter), 'nenhum pedido de remoção ou suspensão enviado ao WHM')

  // Suspender e reactivar o acesso ao portal (conta por verificar fictícia)
  await db.query('UPDATE auth_users SET email_confirmed_at = CURRENT_TIMESTAMP(6) WHERE id = ?', [u3.id])
  const s3 = new S(); ok((await s3.login(em3, PW)).status === 200, 'conta fictícia entra')
  r = await adm.req(`/api/admin/clients/${u3.id}/access`, { method: 'POST', body: { active: false } })
  ok(r.status === 200 && (await s3.req('/api/auth/user')).json?.user == null, 'suspender termina a sessão aberta')
  r = await new S().login(em3, PW)
  ok(r.status === 400 && r.json?.error?.code === 'user_banned', 'login recusado com acesso suspenso')
  r = await adm.req('/api/admin/clients?filter=suspended')
  ok(r.json?.clients?.some(c => c.email === em3 && c.portal_suspended), 'aparece como «Acesso suspenso»')
  await adm.req(`/api/admin/clients/${u3.id}/access`, { method: 'POST', body: { active: true } })
  ok((await new S().login(em3, PW)).status === 200, 'reactivar devolve o acesso')

  console.log('\n9. Pedidos que não chegam ao Resend ficam registados (resposta pública igual)')
  // Registo com domínio sem correio na Internet (EMAIL_DNS_CHECK=test: «semmx» = inexistente)
  const nx = `cliente@semmx-${tag}.ao`
  r = await signup(anon, nx)
  ok(r.status === 400 && r.json?.error?.code === 'email_domain_undeliverable' && !(await one('SELECT id FROM auth_users WHERE email = ?', [nx])), 'registo recusado com explicação quando o domínio não recebe correio (nenhuma conta criada)')
  // Conta antiga por verificar num domínio sem correio → reenvio não chama o Resend
  const nxOld = `antiga@semmx-${tag}.ao`; created.push(nxOld)
  await db.query("INSERT INTO auth_users (id, email, encrypted_password) VALUES (UUID(), ?, NULL)", [nxOld])
  await db.query("INSERT INTO profiles (id, email, full_name, role) SELECT id, email, 'Conta Antiga', 'client' FROM auth_users WHERE email = ?", [nxOld])
  r = await anon.req('/api/auth/resend-verification', { method: 'POST', body: { email: nxOld } })
  const nxLog = await one('SELECT status, error FROM auth_email_log WHERE recipient = ? ORDER BY created_at DESC LIMIT 1', [nxOld])
  ok(r.status === 200 && r.json?.message === generic && nxLog?.status === 'undeliverable' && /não existe no DNS/.test(nxLog.error ?? '') && (await lastMail(nxOld)).count === 0, 'conta por verificar com domínio inexistente: resposta genérica, Resend não chamado, motivo registado')
  const ghost = `fantasma-${tag}@ensaio.test`
  await anon.req('/api/auth/resend-verification', { method: 'POST', body: { email: ghost } })
  const gl = await one('SELECT status, error FROM auth_email_log WHERE recipient = ? ORDER BY created_at DESC LIMIT 1', [ghost])
  ok(gl?.status === 'skipped' && /Sem conta/.test(gl.error ?? ''), 'endereço sem conta: registado «sem conta» (a resposta pública não o revela)')
  const vl = await one("SELECT status, error FROM auth_email_log WHERE recipient = ? AND status = 'skipped' ORDER BY created_at DESC LIMIT 1", [em])
  ok(vl && /já verificado/.test(vl.error ?? ''), 'conta já verificada: registado «já verificado»')
  const rlRows = (await db.query("SELECT COUNT(*) n FROM auth_email_log WHERE recipient = ? AND status = 'rate_limited'", [rl]))[0][0].n
  await anon.req('/api/auth/resend-verification', { method: 'POST', body: { email: rl } })
  const rlRows2 = (await db.query("SELECT COUNT(*) n FROM auth_email_log WHERE recipient = ? AND status = 'rate_limited'", [rl]))[0][0].n
  ok(Number(rlRows) === 1 && Number(rlRows2) === 1, 'limite atingido registado uma vez por hora (não enche o registo)')
  r = await adm.req('/api/admin/integrations/email', { method: 'POST', body: { action: 'recipient', to: nxOld } })
  ok(r.status === 200 && r.json?.account?.exists && r.json.account.eligibleForResend && r.json.domain?.deliverable === false && r.json.attempts?.some(a => a.status === 'undeliverable'), 'painel: diagnóstico do destinatário (conta por verificar, domínio sem correio, tentativas)')
  r = await adm.req('/api/admin/integrations/email', { method: 'POST', body: { action: 'recipient', to: ghost } })
  ok(r.json?.account?.exists === false && r.json.attempts?.[0]?.status === 'skipped', 'painel: endereço sem conta identificado')
  r = await c1.req('/api/admin/integrations/email', { method: 'POST', body: { action: 'recipient', to: em } })
  ok([401, 403].includes(r.status), 'cliente não usa o diagnóstico')
} finally {
  // Remove as contas fictícias deste ensaio (nenhuma tem dependências)
  for (const e of created) {
    const x = await one('SELECT id FROM auth_users WHERE email = ?', [e])
    if (x) { await db.query('DELETE FROM auth_email_log WHERE user_id = ?', [x.id]); await db.query('DELETE FROM auth_users WHERE id = ?', [x.id]) }
  }
  await db.end()
}
console.log(`\n${pass} passaram, ${fail} falharam`)
process.exit(fail ? 1 : 0)
