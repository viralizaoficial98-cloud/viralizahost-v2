// Auditoria de links (ensaio): percorre o site como visitante, regista páginas com erro,
// âncoras sem alvo e verifica cada botão de compra (/checkout?…) — o carrinho tem de
// ficar com um item válido segundo a cotação do servidor.
//   BASE_URL=http://localhost:3000 node scripts/mariadb/rehearsal/links-audit.cjs
const { chromium } = require('playwright')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage()
  const seen = new Map(), queue = ['/'], refs = new Map(), anchors = []
  while (queue.length && seen.size < 250) {
    const path = queue.shift(); if (seen.has(path)) continue
    let status = 0
    try { const r = await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 }); status = r?.status() ?? 0; await p.waitForTimeout(500) } catch { status = 'erro' }
    seen.set(path, status)
    if (status !== 200 || path.startsWith('/checkout')) continue
    const links = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ h: a.getAttribute('href'), t: (a.textContent || '').trim().slice(0, 40) })))
    for (const { h, t } of links) {
      if (!h || /^(mailto|tel|javascript):/.test(h) || (h.startsWith('http') && !h.startsWith(BASE))) continue
      if (h.startsWith('#')) { if (h.length > 1) anchors.push([path, h, t]); continue }
      const u = new URL(h, BASE + path); if (u.origin !== BASE) continue
      const key = u.pathname + u.search
      if (!refs.has(key)) refs.set(key, `${path} «${t}»`)
      if (u.hash.length > 1) anchors.push([u.pathname, u.hash, t])
      if (!seen.has(key) && !queue.includes(key) && !key.startsWith('/api/') && !key.startsWith('/storage/') && !key.startsWith('/checkout?')) queue.push(key)
    }
  }
  const bad = [...seen].filter(([, s]) => s !== 200 && !(typeof s === 'number' && s >= 300 && s < 400))
  console.log(`Páginas visitadas: ${seen.size}; com erro: ${bad.length}`)
  for (const [k, s] of bad) console.log(`  ✗ ${s}  ${k}   ← ${refs.get(k) ?? ''}`)
  const missing = new Set()
  for (const [path, hash, t] of anchors) {
    if (seen.get(path) !== 200) continue
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' }).catch(() => {}); await p.waitForTimeout(300)
    if (!(await p.evaluate(h => !!document.getElementById(decodeURIComponent(h.slice(1))), hash))) missing.add(`${path}${hash} «${t}»`)
  }
  console.log(`Âncoras sem alvo: ${missing.size}`); for (const m of missing) console.log('  ✗ ' + m)

  const comprar = [...refs.keys()].filter(k => k.startsWith('/comprar/'))
  const badComprar = comprar.filter(k => seen.get(k) !== 200)
  console.log(`Botões «Escolher plano» (/comprar): ${comprar.length}; com erro: ${badComprar.length}`)
  for (const k of badComprar) console.log(`  ✗ ${k} ← ${refs.get(k)}`)
  const buys = [...refs.keys()].filter(k => k.startsWith('/checkout?'))
  let okN = 0; const fails = []
  for (const u of buys) {
    const ctx = await b.newContext(); const pg = await ctx.newPage()
    await pg.goto(BASE + u, { waitUntil: 'networkidle' }).catch(() => {}); await pg.waitForTimeout(800)
    const res = await pg.evaluate(async () => {
      const st = JSON.parse(localStorage.getItem('viralizahost-cart-v2') || '{}').state
      const lines = (st?.lines ?? []).map(l => l.type === 'domain' ? { type: 'domain', domain: l.domain, operation: l.operation } : { type: 'product', slug: l.slug, cycle: l.cycle, quantity: l.quantity, domain: 'teste-auditoria.com', domainMode: 'existing' })
      if (!lines.length) return { empty: true }
      const q = await (await fetch('/api/checkout/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines }) })).json()
      return { lines: q.quote.lines.map(l => `${l.slug ?? l.domain}:${l.cycle ?? ''}:${l.error ? 'ERRO ' + l.error.code : l.lineTotal}`) }
    }).catch(e => ({ err: e.message }))
    const good = res.lines && res.lines.every(x => !x.includes('ERRO'))
    const domainSearch = res.empty && /plan=domain|tld=/.test(u)
    if (good || domainSearch) okN++; else fails.push(`${u} → ${res.empty ? 'carrinho vazio' : res.err ?? res.lines.join(', ')}   ← ${refs.get(u)}`)
    await ctx.close()
  }
  console.log(`Botões de compra: ${buys.length}; válidos: ${okN}; com problema: ${fails.length}`)
  for (const f of fails) console.log('  ✗ ' + f)
  await b.close()
  process.exit(bad.length || fails.length || badComprar.length || missing.size ? 1 : 0)
})()
