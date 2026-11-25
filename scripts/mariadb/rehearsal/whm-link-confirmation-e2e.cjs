// Associação MANUAL de uma conta WHM a um cliente vs. opção «Configurações → Contas → confirmação de e-mail».
//   • desactivada: cliente sem e-mail confirmado (novo ou antigo) é elegível e pode ser associado;
//   • activada: só clientes confirmados (pesquisa e gravação; pedido directo também recusado);
//   • cliente confirmado: associável nos dois modos; caixa de titularidade e permissões continuam obrigatórias;
//   • opção alterada entre a pesquisa e a gravação: decide a opção vigente no servidor;
//   • o estado real de confirmação do cliente nunca é alterado; a hospedagem aparece na Área do Cliente.
// WHM simulado (conta «semdono» / semdono.co.ao) + base de ENSAIO. Repõe a opção, os vínculos e os clientes no fim.
//   BASE_URL=http://localhost:3000 OUT=/tmp/whm-link-conf node --env-file=.env.local scripts/mariadb/rehearsal/whm-link-confirmation-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const { randomUUID } = require('node:crypto')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-whm-link-conf'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : ''}`) }
class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json, text: t }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
}
const USER = 'semdono', DOMAIN = 'semdono.co.ao'
/** Abre «Associar cliente» na linha da conta de ensaio (a lista é paginada: procura página a página em «Sem cliente»). */
async function openLink(p) {
  for (let n = 1; n <= 20; n++) {
    await p.goto(`${BASE}/admin/servers/whm-accounts?linked=false&page=${n}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('whm-row').first().waitFor({ timeout: 15000 }).catch(() => {})
    const row = p.locator(`[data-testid="whm-row"][data-domain="${DOMAIN}"]`)
    if (await row.count()) { await row.getByTestId('whm-link-btn').click(); const dlg = p.getByTestId('link-dialog'); await dlg.waitFor(); return dlg }
    if (!(await p.getByTestId('whm-row').count())) break
  }
  throw new Error(`linha ${DOMAIN} não encontrada em «Sem cliente»`)
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const one = async (sql, a = []) => (await db.query(sql, a))[0][0]
  const snapSettings = await one('SELECT * FROM account_settings WHERE id = 1')
  const adm = new S(), c1 = new S(), anon = new S()
  await adm.login('admin@ensaio.test', 'Admin#Teste2026')
  await c1.login('cliente1@ensaio.test', 'Cliente#Um2026')
  const p1 = (await one("SELECT id FROM profiles WHERE email = 'cliente1@ensaio.test'")).id
  // Clientes por confirmar: um «novo» (registado com a confirmação desactivada: isento no login) e um «antigo» (sem isenção)
  const PW = `Ensaio#${randomUUID().slice(0, 8)}`, hash = await bcrypt.hash(PW, 10)
  const mk = async (label, exempt) => {
    const id = randomUUID(), email = `${label}-${id.slice(0, 6)}@ensaio.test`
    await db.query('INSERT INTO auth_users (id, email, encrypted_password, email_confirmed_at, email_verification_exempt) VALUES (?, ?, ?, NULL, ?)', [id, email, hash, exempt ? 1 : 0])
    await db.query("INSERT INTO profiles (id, email, full_name, role, is_active) VALUES (?, ?, ?, 'client', 1)", [id, email, `Cliente ${label}`])
    return { id, email }
  }
  const novo = await mk('semconf-novo', true), antigo = await mk('semconf-antigo', false)
  const setOption = required => adm.req('/api/admin/settings/accounts', { method: 'PUT', body: { emailConfirmationRequired: required } })
  const search = async q => ((await adm.req(`/api/admin/profiles/search?q=${encodeURIComponent(q)}`)).json?.data ?? [])
  const link = (s, profileId, confirmed = true) => s.req(`/api/admin/whm/accounts/${whm.id}/link`, { method: 'POST', body: { profile_id: profileId, confirmed } })
  /** Repõe a conta de ensaio como «Sem cliente» (apaga só o serviço/alojamento importados por este ensaio). */
  const reset = async () => {
    await db.query("DELETE s FROM services s JOIN hosting_accounts h ON h.service_id = s.id WHERE h.cpanel_username = ? AND s.activation_source = 'import'", [USER])
    await db.query('DELETE FROM hosting_accounts WHERE cpanel_username = ?', [USER])
    await db.query("UPDATE whm_accounts SET profile_id = NULL, service_id = NULL, hosting_account_id = NULL, link_status = 'unlinked', requires_manual_link = 1, linked_by = NULL, linked_at = NULL, link_method = NULL WHERE whm_username = ?", [USER])
  }
  const confirmedAt = async id => (await one('SELECT email_confirmed_at FROM auth_users WHERE id = ?', [id])).email_confirmed_at
  let whm
  const b = await chromium.launch()
  try {
    await adm.req('/api/admin/whm/import', { method: 'POST' })
    whm = await one('SELECT * FROM whm_accounts WHERE whm_username = ?', [USER])
    ok(!!whm, `conta WHM de ensaio importada (${USER} / ${DOMAIN})`)
    await reset()

    // ── 1. Opção DESACTIVADA ──
    console.log('\n1. Confirmação de e-mail DESACTIVADA')
    ok((await setOption(false)).json?.settings?.emailConfirmationRequired === false, 'opção desactivada em Configurações → Contas')
    for (const c of [novo, antigo]) {
      const r = (await search(c.email)).find(x => x.id === c.id)
      ok(r?.eligible === true && r.reason === null && r.email_confirmed === false, `pesquisa: ${c.email.split('-').slice(0, 2).join('-')} sem confirmação → elegível`, r)
    }
    // Browser: modal sem aviso, cliente seleccionável, gravação só depois da caixa de titularidade
    let ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 })
    await ctx.addCookies([{ name: 'vh_session', value: adm.cookie.split('=')[1], url: BASE }])
    let p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message))
    let dlg = await openLink(p)
    await dlg.getByTestId('client-search').fill(novo.email)
    let opt = dlg.getByTestId('client-option').first(); await opt.waitFor({ timeout: 10000 })
    ok(await opt.getAttribute('data-eligible') === '1' && await opt.isEnabled() && await dlg.getByTestId('client-ineligible').count() === 0, 'modal: sem «Não elegível: E-mail ainda não confirmado», cliente seleccionável')
    ok(await dlg.getByTestId('client-unconfirmed-note').count() === 1, 'modal: indica que o e-mail está por confirmar (informativo)')
    await opt.click()
    ok(/semconf-novo/.test(await dlg.getByTestId('sum-client').innerText()) && await dlg.getByTestId('link-save').isDisabled(), 'seleccionado; «Associar cliente» bloqueado até confirmar a titularidade')
    await dlg.getByTestId('link-confirm').check()
    await p.screenshot({ path: `${OUT}/01-desactivada-elegivel.png` })
    await dlg.getByTestId('link-save').click()
    await dlg.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
    let w = await one('SELECT profile_id, link_status, link_method FROM whm_accounts WHERE id = ?', [whm.id])
    ok(w.profile_id === novo.id && w.link_status === 'linked', 'associação gravada (cliente novo sem confirmação)', w)
    ok(await confirmedAt(novo.id) === null, 'estado de confirmação do cliente mantido (email_confirmed_at continua vazio)')
    ok(!!(await one("SELECT 1 x FROM activity_logs WHERE entity_id = ? AND description LIKE 'whm_link:%' AND description LIKE ?", [whm.id, `%${novo.email}%`])), 'auditoria registada (activity_logs)')
    // Área do Cliente: o cliente (isento no login, como os registados com a opção desactivada) vê a hospedagem
    const cn = new S(); const lg = await cn.login(novo.email, PW)
    ok(lg.status === 200, 'cliente novo sem confirmação entra (regra de login inalterada: isenção da conta)', lg.status)
    const cctx = await b.newContext({ viewport: { width: 1366, height: 900 } })
    await cctx.addCookies([{ name: 'vh_session', value: cn.cookie.split('=')[1], url: BASE }])
    const cp = await cctx.newPage()
    await cp.goto(`${BASE}/hosting`, { waitUntil: 'domcontentloaded' }); await cp.getByText(DOMAIN).first().waitFor({ timeout: 15000 }).catch(() => {})
    ok(await cp.getByText(DOMAIN).count() > 0, `Área do Cliente → Hospedagem mostra ${DOMAIN}`)
    await cp.screenshot({ path: `${OUT}/02-area-cliente-hospedagem.png` })
    await cctx.close()
    // Cliente antigo sem confirmação (sem isenção): também associável com a opção desactivada (pedido directo)
    await reset()
    let r = await link(adm, antigo.id)
    ok(r.status === 200 && (await one('SELECT profile_id FROM whm_accounts WHERE id = ?', [whm.id])).profile_id === antigo.id, 'cliente antigo sem confirmação: associação aceite', r.json)
    ok(await confirmedAt(antigo.id) === null, 'cliente antigo: confirmação continua por fazer (não é preenchida)')
    r = await new S().login(antigo.email, PW)
    ok(r.status !== 200, 'regra de login inalterada: conta antiga sem isenção continua a precisar de confirmar o e-mail', r.status)

    // ── 2. Opção ACTIVADA ──
    console.log('\n2. Confirmação de e-mail ACTIVADA')
    await reset()
    ok((await setOption(true)).json?.settings?.emailConfirmationRequired === true, 'opção activada')
    for (const c of [novo, antigo]) {
      const x = (await search(c.email)).find(y => y.id === c.id)
      ok(x?.eligible === false && x.reason === 'E-mail ainda não confirmado no portal', 'pesquisa: sem confirmação → não elegível com a mensagem actual', x)
      r = await link(adm, c.id)
      ok(r.status === 422 && r.json?.code === 'email_not_confirmed' && /confirmação de e-mail está activa/.test(r.json?.error), 'pedido directo recusado pelo servidor (422)', r.json)
    }
    ok(!(await one('SELECT profile_id FROM whm_accounts WHERE id = ?', [whm.id])).profile_id, 'nada gravado')
    dlg = await openLink(p)
    await dlg.getByTestId('client-search').fill(novo.email)
    opt = dlg.getByTestId('client-option').first(); await opt.waitFor({ timeout: 10000 })
    ok(await opt.isDisabled() && /Não elegível: E-mail ainda não confirmado no portal/.test(await opt.innerText()), 'modal: «Não elegível: E-mail ainda não confirmado no portal» e não seleccionável')
    await p.screenshot({ path: `${OUT}/03-activada-nao-elegivel.png` })
    await dlg.getByRole('button', { name: 'Cancelar' }).click()

    // ── 3. Cliente confirmado nos dois modos ──
    console.log('\n3. Cliente confirmado (dois modos)')
    for (const required of [true, false]) {
      await reset(); await setOption(required)
      const x = (await search('cliente1@ensaio')).find(y => y.id === p1)
      r = await link(adm, p1)
      ok(x?.eligible === true && r.status === 200, `opção ${required ? 'activada' : 'desactivada'}: cliente confirmado elegível e associado`, r.json)
    }

    // ── 4. Titularidade e permissões ──
    console.log('\n4. Titularidade e permissões continuam obrigatórias')
    await reset(); await setOption(false)
    r = await link(adm, novo.id, false); ok(r.status === 400 && r.json?.code === 'confirmation_required', 'sem confirmar a titularidade → recusado (400)', r.json)
    r = await link(c1, novo.id); ok(r.status === 403, 'cliente (sem permissão administrativa) → 403', r.status)
    r = await link(anon, novo.id); ok(r.status === 401, 'visitante → 401', r.status)
    r = await c1.req(`/api/admin/profiles/search?q=${encodeURIComponent(novo.email)}`); ok(r.status === 403 || r.status === 401, 'pesquisa de clientes só para administradores', r.status)
    ok(!(await one('SELECT profile_id FROM whm_accounts WHERE id = ?', [whm.id])).profile_id, 'nada gravado')
    await db.query('UPDATE profiles SET is_active = 0 WHERE id = ?', [novo.id])
    const ina = (await search(novo.email)).find(y => y.id === novo.id)
    r = await link(adm, novo.id)
    ok(ina?.eligible === false && ina.reason === 'Conta inactiva' && r.status === 422, 'restantes regras mantidas: conta inactiva não é elegível (mesmo com a opção desactivada)', { ina, r: r.json })
    await db.query('UPDATE profiles SET is_active = 1 WHERE id = ?', [novo.id])
    const admRow = (await search('admin@ensaio')).length
    ok(admRow === 0, 'contas administrativas continuam fora da pesquisa')

    // ── 5. Opção alterada entre a pesquisa e a gravação ──
    console.log('\n5. Opção alterada entre a pesquisa e a gravação')
    await reset(); await setOption(false)
    dlg = await openLink(p)
    await dlg.getByTestId('client-search').fill(novo.email)
    opt = dlg.getByTestId('client-option').first(); await opt.waitFor({ timeout: 10000 })
    await opt.click(); await dlg.getByTestId('link-confirm').check()
    await setOption(true) // outro administrador activa a confirmação com o modal aberto
    await dlg.getByTestId('link-save').click()
    await dlg.getByTestId('link-error').waitFor({ timeout: 10000 })
    ok(/confirmação de e-mail está activa/.test(await dlg.getByTestId('link-error').innerText()), 'gravação recusada com mensagem clara (decisão do servidor)')
    ok(/nenhum/.test(await dlg.getByTestId('sum-client').innerText()) && await dlg.getByTestId('link-save').isDisabled() && await opt.getAttribute('data-eligible') === '0', 'modal: cliente desmarcado e mostrado como não elegível')
    await p.screenshot({ path: `${OUT}/04-alterada-entre-pesquisa-e-gravacao.png` })
    ok(!(await one('SELECT profile_id FROM whm_accounts WHERE id = ?', [whm.id])).profile_id && await confirmedAt(novo.id) === null, 'nada gravado; confirmação do cliente inalterada')
    // Sentido inverso: pesquisa com a opção activa (não elegível), opção desactivada antes de gravar → aceite
    const before = (await search(novo.email)).find(y => y.id === novo.id)
    await setOption(false)
    r = await link(adm, novo.id)
    ok(before?.eligible === false && r.status === 200, 'inverso: desactivada depois da pesquisa → a gravação segue a opção vigente e aceita', r.json)
    ok(errs.length === 0, 'sem erros de JavaScript no painel', errs)
    await ctx.close()
  } catch (e) {
    ok(false, 'excepção no ensaio', e.stack)
  } finally {
    await reset().catch(() => {})
    if (snapSettings) await db.query('UPDATE account_settings SET email_confirmation_required = ?, updated_by = ? WHERE id = 1', [snapSettings.email_confirmation_required, snapSettings.updated_by])
    else await db.query('DELETE FROM account_settings WHERE id = 1')
    for (const c of [novo, antigo]) { await db.query('DELETE FROM notifications WHERE profile_id = ?', [c.id]); await db.query('DELETE FROM auth_sessions WHERE user_id = ?', [c.id]).catch(() => {}); await db.query('DELETE FROM profiles WHERE id = ?', [c.id]); await db.query('DELETE FROM auth_users WHERE id = ?', [c.id]) }
    await b.close(); await db.end()
    console.log(`\n${pass} passaram, ${fail} falharam`)
    process.exitCode = fail ? 1 : 0
  }
})()
