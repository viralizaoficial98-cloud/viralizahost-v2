// Servidores Dedicados Linux e Windows: planos em Catálogo e Preços (criar, editar, ordenar, publicar), ficha com ícones,
// preço base/desconto por período, imagem, pré-visualização; páginas em faixas (desktop + telemóvel); «Comprar agora» →
// fluxo de compra existente → carrinho → checkout com o preço do catálogo; validação do pagamento → activação MANUAL
// (sem qualquer compra na Hostinger). Pagamentos simulados. Repõe o catálogo de dedicados no fim.
//   BASE_URL=http://localhost:3000 OUT=/tmp/dedicados node --env-file=.env.local scripts/mariadb/rehearsal/dedicated-plans-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const MOCK = process.env.HOSTINGER_MOCK || 'http://127.0.0.1:12091'
const OUT = process.env.OUT || './ui-shots-dedicados'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const num = s => Number(String(s ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const totalOf = (base, months, d) => Math.round(Math.round(base * 100) * months * (100 - d) / 100) / 100
const SFX = randomUUID().slice(0, 4)

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json }
  }
}
async function ctxFor(b, opts, cookie) {
  const ctx = await b.newContext({ ...opts })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message))
  p.on('dialog', d => d.accept())
  return { ctx, p }
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const mockStats = async () => { try { return await (await fetch(`${MOCK}/_stats`)).json() } catch { return { vpsPurchaseCalls: 0 } } }

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const val = v => (v != null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v)
  const dedIds = (await all("SELECT id FROM products WHERE category IN ('dedicated','dedicated-windows')")).map(r => r.id)
  const inD = `(${dedIds.map(() => '?').join(',')})`
  const snapProducts = await all(`SELECT * FROM products WHERE id IN ${inD}`, dedIds)
  const snapPrices = await all(`SELECT * FROM product_prices WHERE product_id IN ${inD}`, dedIds)
  const snapFeatures = await all(`SELECT * FROM product_features WHERE product_id IN ${inD}`, dedIds)
  const START = (await one('SELECT DATE_FORMAT(NOW(6), "%Y-%m-%d %H:%i:%s.%f") t')).t
  const history = async () => JSON.stringify([
    await all('SELECT id, status, payment_status, amount FROM orders WHERE created_at < ? ORDER BY id', [START]),
    await all('SELECT id, status, billing_cycle, renewal_price FROM services WHERE created_at < ? ORDER BY id', [START]),
  ])
  const historyBefore = await history()
  const adm = new S(), c1 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  const API = k => `/api/admin/catalog/dedicated-plans?kind=${k}`
  const plans = async k => (await adm.req(API(k))).json.plans
  const b = await chromium.launch()
  const created = []
  try {
    // ── 1. Permissões e validação ──
    console.log('\n1. Permissões e validação no servidor')
    const deny = x => x.status === 401 || x.status === 403
    ok(deny(await anon.req(API('linux'))) && deny(await c1.req(API('linux'))) && deny(await c1.req(API('windows'), { method: 'POST', body: { name: 'x', baseMonthly: 1 } })), 'anónimo e cliente: recusados (ler e criar)')
    ok((await adm.req('/api/admin/catalog/dedicated-plans')).status === 400, 'sem kind=linux|windows → 400')
    const base = { saleStatus: 'draft', baseMonthly: 150000, periods: [{ cycle: 'monthly', discount: 0, publish: true }] }
    const bad = async (k, over, field, label) => { const r = await adm.req(API(k), { method: 'POST', body: { name: `Inválido ${SFX}`, ...base, ...over } }); ok(r.status === 400 && (!field || r.json?.field === field), `${label} → 400${r.json?.field ? ` (${r.json.field})` : ''}`, `${r.status} ${r.json?.error}`) }
    await bad('linux', { specs: { cores: 8, threads: 4 } }, 'threads', 'threads < núcleos')
    await bad('linux', { specs: { raid: 'RAID 7' } }, 'raid', 'RAID inexistente')
    await bad('linux', { specs: { disks: [{ count: 2, sizeGb: 1000, type: 'Fita' }] } }, 'disks', 'tipo de armazenamento inválido')
    await bad('linux', { specs: { license: 'Windows Server 2022 Standard' } }, 'license', 'licença Windows num plano Linux')
    await bad('linux', { features: [{ text: 'x', icon: 'skull' }] }, 'features', 'ícone fora da lista')
    await bad('windows', { baseMonthly: 0 }, 'baseMonthly', 'preço base 0')
    await bad('windows', { saleStatus: 'active', periods: [] }, 'periods', 'publicar sem período')
    ok((await all("SELECT id FROM products WHERE name LIKE ?", [`Inválido ${SFX}%`])).length === 0, 'nada gravado com dados inválidos')

    // ── 2. Criar plano Linux no painel ──
    console.log('\n2. Painel: criar plano Dedicado Linux')
    let { ctx, p } = await ctxFor(b, DESKTOP, adm.cookie)
    await p.goto(BASE + '/admin/site/catalog?cat=dedicado-linux', { waitUntil: 'domcontentloaded' })
    const ed = p.getByTestId('ded-plans-editor-linux'); await ed.waitFor()
    ok(await p.getByTestId('dedicated-plans-admin-windows').count() === 0 && await p.getByTestId('vps-plans-admin').count() === 0, 'separador «Dedicado Linux» só com os planos Linux')
    await ed.getByTestId('ded-plan-create').click()
    const f = ed.getByTestId('ded-plan-new').getByTestId('ded-plan-form')
    const nameL = `Dedicado Ensaio Linux ${SFX}`
    await f.getByTestId('dp-name').fill(nameL); await f.getByTestId('dp-badge').fill('Mais popular'); await f.getByTestId('dp-position').fill('5')
    await f.getByTestId('dp-summary').fill('Para bases de dados e aplicações críticas')
    await f.getByTestId('dp-cpu').fill('AMD EPYC 4344P'); await f.getByTestId('dp-cores').fill('8'); await f.getByTestId('dp-threads').fill('16')
    await f.getByTestId('dp-ram').fill('64'); await f.getByTestId('dp-ram-type').selectOption('DDR5 ECC'); await f.getByTestId('dp-raid').selectOption('RAID 1')
    await f.getByTestId('dp-network').fill('1')
    await f.getByTestId('dp-disk-count').first().fill('2'); await f.getByTestId('dp-disk-size').first().fill('1000')
    await f.getByTestId('dp-add-disk').click(); await f.getByTestId('dp-disk-count').nth(1).fill('2'); await f.getByTestId('dp-disk-size').nth(1).fill('4000'); await f.getByTestId('dp-disk-type').nth(1).selectOption('HDD')
    await f.getByTestId('dp-traffic-mode').selectOption('unlimited')
    await f.getByTestId('dp-os').fill('Ubuntu Server 24.04 LTS'); await f.getByTestId('dp-license').fill('Sem licença (software livre)')
    await f.getByTestId('dp-feature-text').first().fill('Protecção DDoS'); await f.getByTestId('dp-feature-icon').first().selectOption('shield')
    await f.getByTestId('dp-add-feature').click(); await f.getByTestId('dp-feature-text').nth(1).fill('Acesso root e IPMI'); await f.getByTestId('dp-feature-icon').nth(1).selectOption('terminal')
    await f.getByTestId('dp-feature-up').nth(1).click()
    await f.getByTestId('dp-base').fill('150000')
    await f.getByTestId('dp-discount-monthly').fill('0'); await f.getByTestId('dp-publish-monthly').check()
    await f.getByTestId('dp-discount-1year').fill('10'); await f.getByTestId('dp-publish-1year').check()
    await f.getByTestId('dp-discount-2years').fill('15')
    await f.getByTestId('dp-status').selectOption('active')
    await f.getByTestId('dp-preview-1year').click()
    const pv = f.getByTestId('dp-preview')
    ok(num(await f.getByTestId('dp-total-1year').innerText()) === totalOf(150000, 12, 10) && num(await pv.getByTestId('ded-plan-total').innerText()) === totalOf(150000, 12, 10), `pré-visualização antes de publicar: 1 ano = ${await f.getByTestId('dp-total-1year').innerText()}`)
    const pvKeys = await pv.locator('[data-testid^=ded-spec-]').evaluateAll(els => els.map(e => e.dataset.testid.replace('ded-spec-', '')))
    ok(JSON.stringify(pvKeys) === JSON.stringify(['cpu', 'cores', 'ram', 'disk', 'raid', 'traffic', 'network', 'os', 'license']), `pré-visualização: especificações com ícones (${pvKeys.join(', ')})`)
    ok(/2 × 1 TB NVMe \+ 2 × 4 TB HDD/.test(await pv.getByTestId('ded-spec-disk').innerText()) && /8 núcleos · 16 threads/.test(await pv.getByTestId('ded-spec-cores').innerText()), 'discos e núcleos/threads formatados')
    ok((await pv.getByTestId('ded-plan-feature').first().innerText()).includes('Acesso root') && await pv.locator('[data-testid=ded-plan-feature][data-icon=terminal] svg').count() === 1, 'características reordenadas, com ícone')
    await p.addStyleTag({ content: 'header, [class*=sticky], [class*=fixed] { position: relative !important }' })
    await p.setViewportSize({ width: 1440, height: 3200 }); await f.scrollIntoViewIfNeeded(); await p.waitForTimeout(200)
    await f.screenshot({ path: `${OUT}/painel-01-dedicado-linux-novo.png` })
    await p.setViewportSize({ width: 1440, height: 900 })
    await f.getByTestId('dp-save').click()
    await ed.locator(`[data-testid=ded-plan-admin]`).filter({ hasText: nameL }).waitFor({ timeout: 15000 })
    let L = (await plans('linux')).find(x => x.name === nameL)
    created.push(L.id)
    ok(L && L.saleStatus === 'active' && L.specs.cores === 8 && L.specs.disks.length === 2 && L.specs.traffic.unlimited && L.badge === 'Mais popular', 'plano Linux criado e publicado com a ficha completa')
    const y1 = L.periods.find(x => x.cycle === '1year'), y2 = L.periods.find(x => x.cycle === '2years')
    ok(y1.active && y1.price === totalOf(150000, 12, 10) && y2.exists && !y2.active, `1 ano publicado a ${y1.price} Kz; 2 anos guardado mas não publicado`)
    const pr = await one("SELECT category, service_type, provisioning, provider_product_id, provider_mode FROM products WHERE id = ?", [L.id])
    ok(pr.category === 'dedicated' && pr.service_type === 'dedicated' && pr.provisioning === 'manual' && !pr.provider_product_id && pr.provider_mode === 'manual', 'categoria «dedicated», activação manual, sem associação a fornecedor')
    ok(Number((await one("SELECT COUNT(*) n FROM activity_logs WHERE entity_id = ? AND created_at >= ?", [L.id, START])).n) >= 1, 'alteração registada em activity_logs')
    // Imagem
    const ip = await b.newPage({ viewport: { width: 640, height: 480 } })
    await ip.setContent('<body style="margin:0"><div style="width:640px;height:480px;background:linear-gradient(135deg,#111,#374151);display:flex;align-items:center;justify-content:center;font:900 120px sans-serif;color:#F5B700">LNX</div></body>')
    const png = await ip.screenshot({ type: 'png' }); await ip.close()
    const fd = new FormData(); fd.append('productId', L.id); fd.append('file', new Blob([png], { type: 'image/png' }), 'linux.png')
    ok((await fetch(BASE + '/api/admin/catalog/vps-plans/image', { method: 'POST', headers: { cookie: adm.cookie }, body: fd })).status === 200, 'imagem do plano carregada')
    await ctx.close()

    // ── 3. Plano Windows (API) e edição no painel ──
    console.log('\n3. Plano Dedicado Windows: criar e editar')
    const nameW = `Dedicado Ensaio Windows ${SFX}`
    let r = await adm.req(API('windows'), { method: 'POST', body: { name: nameW, description: 'ASP.NET e MS SQL', saleStatus: 'active', position: 1, badge: 'Disponibilidade limitada', baseMonthly: 210000,
      specs: { cpuModel: 'Intel Xeon E-2388G', cores: 8, threads: 16, ramGb: 32, ramType: 'DDR4 ECC', disks: [{ count: 2, sizeGb: 960, type: 'SSD' }], raid: 'RAID 1', traffic: { value: 20, unit: 'TB' }, network: { value: 1, unit: 'Gbps' }, os: 'Windows Server 2022 Standard', license: 'Windows Server 2022 Standard incluída' },
      features: [{ text: 'Plesk incluído', icon: 'panel' }, { text: 'Backups geridos', icon: 'backup' }],
      periods: [{ cycle: 'monthly', discount: 0, publish: true }, { cycle: '6months', discount: 5, publish: true }, { cycle: '1year', discount: 12, publish: true }] } })
    ok(r.status === 201, 'plano Windows criado', r.json?.error)
    let W = (await plans('windows')).find(x => x.name === nameW); created.push(W.id)
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(BASE + '/admin/site/catalog?cat=dedicado-windows', { waitUntil: 'domcontentloaded' })
    const rowW = p.locator(`[data-testid=ded-plan-admin][data-slug="${W.slug}"]`); await rowW.waitFor()
    await rowW.locator('summary').click()
    const fw = rowW.getByTestId('ded-plan-form'); await fw.waitFor()
    await fw.getByTestId('dp-discount-1year').fill('15'); await fw.getByTestId('dp-ram').fill('64')
    await fw.getByTestId('dp-save').click(); await p.waitForTimeout(1500)
    W = (await plans('windows')).find(x => x.id === W.id)
    ok(W.specs.ramGb === 64 && W.periods.find(x => x.cycle === '1year').price === totalOf(210000, 12, 15), `editado no painel: RAM 64 GB e 1 ano = ${W.periods.find(x => x.cycle === '1year').price} Kz`)
    // ordem e publicação (lista)
    const firstSlug = await p.locator('[data-testid=ded-plan-admin]').first().getAttribute('data-slug')
    await p.locator(`[data-testid=ded-plan-admin][data-slug="${W.slug}"]`).getByTestId('ded-toggle-publish').click(); await p.waitForTimeout(800)
    ok((await plans('windows')).find(x => x.id === W.id).saleStatus === 'draft', 'despublicado a partir da lista')
    await p.locator(`[data-testid=ded-plan-admin][data-slug="${W.slug}"]`).getByTestId('ded-toggle-publish').click(); await p.waitForTimeout(800)
    ok((await plans('windows')).find(x => x.id === W.id).saleStatus === 'active', 'publicado de novo')
    const idxW = (await plans('windows')).findIndex(x => x.id === W.id)
    if (idxW > 0) { await p.locator(`[data-testid=ded-plan-admin][data-slug="${W.slug}"]`).getByTestId('ded-up').click(); await p.waitForTimeout(800) }
    ok((await plans('windows')).findIndex(x => x.id === W.id) === Math.max(0, idxW - 1), `ordem alterada na lista (era ${firstSlug} o primeiro)`)
    await ctx.close()

    // ── 4. Páginas públicas ──
    console.log('\n4. Páginas /servidor-dedicado e /servidor-dedicado-windows')
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      ;({ ctx, p } = await ctxFor(b, opts))
      await p.goto(BASE + '/servidor-dedicado', { waitUntil: 'domcontentloaded' })
      const band = p.locator(`[data-testid=ded-plan][data-slug="${L.slug}"]`); await band.waitFor()
      const slugs = await p.locator('[data-testid=ded-plan]').evaluateAll(e => e.map(x => x.dataset.slug))
      ok(slugs.includes(L.slug) && !slugs.includes(W.slug), `${label}: Linux só com planos Linux (${slugs.join(', ')})`)
      const onReq = snapProducts.filter(x => x.category === 'dedicated' && x.sale_status === 'on_request' && Number(x.active))
      for (const o of onReq.slice(0, 1)) {
        const ob = p.locator(`[data-testid=ded-plan][data-slug="${o.slug}"]`)
        ok(await ob.getByTestId('ded-plan-on-request').isVisible() && await ob.getByTestId('ded-plan-quote').getAttribute('href') === `/comprar/${o.slug}` && await ob.getByTestId('ded-plan-total').count() === 0,
          `${label}: plano «sob consulta» (${o.slug}) sem preço, com «Pedir proposta» (fluxo de cotação mantido)`)
      }
      ok(await p.getByTestId('ded-period-2years').count() === 0 && await p.getByTestId('ded-period-1year').count() === 1, `${label}: só períodos publicados`)
      const keys = await band.locator('[data-testid^=ded-spec-]').evaluateAll(els => els.map(e => e.dataset.testid.replace('ded-spec-', '') + (e.querySelector('svg') ? '' : '!')))
      ok(keys.length === 9 && keys.every(k => !k.endsWith('!')), `${label}: especificações com ícone (${keys.join(' ')})`)
      if (label === 'desktop') {
        const [bi, bs, bc] = await Promise.all([band.getByTestId('ded-plan-image').boundingBox(), band.getByTestId('ded-spec-cpu').boundingBox(), band.getByTestId('ded-plan-cta').boundingBox()])
        ok(bi && bs && bc && bi.x < bs.x && bs.x < bc.x, 'faixa horizontal: imagem à esquerda, especificações ao centro, preço e botão à direita')
      } else {
        const [bi, bc] = await Promise.all([band.getByTestId('ded-plan-image').boundingBox(), band.getByTestId('ded-plan-cta').boundingBox()])
        ok(bi && bc && bc.y > bi.y + bi.height - 1 && await overflow(p) <= 0, 'telemóvel: elementos empilhados, sem deslocamento horizontal')
      }
      await p.getByTestId('ded-period-1year').click(); await p.waitForTimeout(150)
      ok(num(await band.getByTestId('ded-plan-total').innerText()) === totalOf(150000, 12, 10) && /Poupe 10%/.test(await band.getByTestId('ded-plan-discount').innerText()) && /Comprar agora/.test(await band.getByTestId('ded-plan-cta').innerText()), `${label}: 1 ano ${await band.getByTestId('ded-plan-total').innerText()}, «Poupe 10%», «Comprar agora»`)
      await p.addStyleTag({ content: 'header, [data-floating] { display: none !important }' })
      await band.scrollIntoViewIfNeeded()
      await band.screenshot({ path: `${OUT}/${label}-01-faixa-linux.png` })
      await p.goto(BASE + '/servidor-dedicado-windows', { waitUntil: 'domcontentloaded' })
      const bw = p.locator(`[data-testid=ded-plan][data-slug="${W.slug}"]`); await bw.waitFor()
      ok(await p.locator(`[data-testid=ded-plan][data-slug="${L.slug}"]`).count() === 0 && /Windows Server 2022 Standard incluída/.test(await bw.getByTestId('ded-spec-license').innerText()), `${label}: Windows só com planos Windows, licença indicada`)
      ok(await p.getByTestId('ded-compatibility').isVisible() && /ASP\.NET/.test(await p.getByTestId('ded-compatibility').innerText()), `${label}: compatibilidade Windows (ASP.NET, MS SQL, RDP)`)
      await p.addStyleTag({ content: 'header, [data-floating] { display: none !important }' })
      await p.locator('[data-testid=ded-plans-section]').screenshot({ path: `${OUT}/${label}-02-planos-windows.png` })
      ok(p.errors.length === 0, `${label}: sem erros JS`, p.errors.join(' | '))
      await ctx.close()
    }

    // ── 5. Comprar agora → carrinho → checkout (preço do catálogo), activação manual ──
    console.log('\n5. Compra: plano e período preservados, preço do catálogo até ao checkout')
    await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente1@ensaio.test'")
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c1.cookie))
    await p.goto(BASE + '/servidor-dedicado', { waitUntil: 'domcontentloaded' })
    await p.getByTestId('ded-period-1year').click()
    await p.locator(`[data-testid=ded-plan][data-slug="${L.slug}"]`).getByTestId('ded-plan-cta').click()
    await p.waitForURL(`**/comprar/${L.slug}?ciclo=1year**`)
    await p.getByTestId('cycle-1year').waitFor()
    ok(await p.getByTestId('cycle-3months').count() === 0 && await p.getByTestId('cycle-2years').count() === 0 && await p.getByTestId('to-options').count() === 0, 'compra: só períodos publicados; sem passo de localização/sistema (não é VPS)')
    ok(num(await p.getByTestId('flow-total').innerText()) === totalOf(150000, 12, 10), `compra: total ${await p.getByTestId('flow-total').innerText()}`)
    await p.getByTestId('add-to-cart').click(); await p.waitForURL('**/carrinho')
    await p.getByTestId('summary-total').waitFor(); await p.waitForTimeout(500)
    ok(num(await p.getByTestId('summary-total').innerText()) === totalOf(150000, 12, 10) && /Anual — 12 meses/.test(await p.getByTestId('cart-line').first().innerText()), 'carrinho: período anual (12 meses) e o mesmo total', `${await p.getByTestId('summary-total').innerText()} | ${(await p.getByTestId('cart-line').first().innerText()).replace(/\s+/g, ' ')}`)
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/pagamento')
    await p.getByTestId('summary-total').waitFor()
    ok(num(await p.getByTestId('summary-total').innerText()) === totalOf(150000, 12, 10) && /1 ano|Anual/.test(await p.locator('body').innerText()), 'checkout: período e total a pagar')
    await p.screenshot({ path: `${OUT}/desktop-03-checkout-dedicado.png`, fullPage: true })
    await ctx.close()
    const ln = [{ type: 'product', slug: L.slug, cycle: '1year', quantity: 1 }]
    const q = (await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: ln } })).json.quote
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: ln, acceptedTotal: q.total - 1000, paymentMethod: 'bank_transfer', proofFile: null } })
    ok(r.status === 409 && r.json?.code === 'price_changed', 'total adulterado → 409 (preço aplicado no servidor)')
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [{ ...ln[0], cycle: '2years' }], acceptedTotal: q.total, paymentMethod: 'bank_transfer', proofFile: null } })
    ok(r.status >= 400, 'período não publicado (2 anos) → recusado')
    const s0 = await mockStats()
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: ln, acceptedTotal: q.total, paymentMethod: 'bank_transfer', proofFile: null } })
    const orderId = r.json?.order?.id
    const oi = await one('SELECT billing_cycle, unit_price, line_total, service_type FROM order_items WHERE order_id = ?', [orderId])
    ok(r.status === 201 && oi.billing_cycle === '1year' && Number(oi.line_total) === totalOf(150000, 12, 10), `encomenda com o plano, o período e o preço do catálogo (${oi?.line_total} Kz)`)
    await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId } })
    const sv = await one("SELECT s.service_type, s.provisioning_status, s.provisioning_error, o.payment_status, (SELECT COUNT(*) FROM vps_provider_orders v WHERE v.service_id = s.id) vps FROM services s JOIN orders o ON o.id = s.order_id WHERE s.order_id = ?", [orderId])
    const s1 = await mockStats()
    ok(sv.payment_status === 'paid' && sv.service_type === 'dedicated' && sv.provisioning_status === 'manual_required' && /Activação manual \(dedicated\)/.test(sv.provisioning_error), `pagamento validado → activação manual pela equipa («${sv.provisioning_error}»)`)
    ok(Number(sv.vps) === 0 && (s1.vpsPurchaseCalls ?? 0) === (s0.vpsPurchaseCalls ?? 0), 'nenhuma compra de VPS na Hostinger (sem operação de fornecedor)')

    // ── 6. Âmbito ──
    console.log('\n6. Âmbito')
    ok((await history()) === historyBefore, 'encomendas e serviços anteriores inalterados')
  } catch (e) { ok(false, 'execução', e.stack) } finally {
    try {
      await db.beginTransaction()
      for (const id of created) {
        await db.query('DELETE FROM product_features WHERE product_id = ?', [id])
        const refs = Number((await one('SELECT (SELECT COUNT(*) FROM order_items WHERE product_id = ?) + (SELECT COUNT(*) FROM services WHERE product_id = ?) n', [id, id])).n)
        if (refs) { await db.query("UPDATE products SET active = 0, sale_status = 'draft' WHERE id = ?", [id]); await db.query('UPDATE product_prices SET active = 0 WHERE product_id = ?', [id]) }
        else { await db.query('DELETE FROM product_prices WHERE product_id = ?', [id]); await db.query('DELETE FROM products WHERE id = ?', [id]) }
      }
      const cols = ['name', 'description', 'sale_status', 'position', 'badge', 'popular', 'base_monthly_price', 'plan_specs', 'image_path', 'service_type', 'provisioning']
      for (const pr of snapProducts) await db.query(`UPDATE products SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => val(pr[c])), pr.id])
      if (dedIds.length) {
        await db.query(`DELETE FROM product_prices WHERE product_id IN ${inD}`, dedIds)
        for (const x of snapPrices) { const k = Object.keys(x); await db.query(`INSERT INTO product_prices (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
        await db.query(`DELETE FROM product_features WHERE product_id IN ${inD}`, dedIds)
        for (const x of snapFeatures) { const k = Object.keys(x); await db.query(`INSERT INTO product_features (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      }
      await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente1@ensaio.test'")
      await db.commit()
      ok(Number((await one("SELECT COUNT(*) n FROM products WHERE category IN ('dedicated','dedicated-windows') AND active = 1 AND sale_status = 'active'")).n) === snapProducts.filter(x => x.sale_status === 'active' && Number(x.active)).length, 'catálogo de dedicados reposto (planos de ensaio retirados)')
    } catch (e) { await db.rollback().catch(() => {}); ok(false, 'reposição', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
