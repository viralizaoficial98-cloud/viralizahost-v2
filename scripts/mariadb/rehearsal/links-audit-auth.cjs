// Auditoria de links com sessão (Área do Cliente e painel admin). Ensaio apenas.
//   BASE_URL=http://localhost:3000 node scripts/mariadb/rehearsal/links-audit-auth.cjs
const { chromium } = require('playwright')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
async function crawl(b, email, password, starts, prefixes) {
  const ctx = await b.newContext(); const p = await ctx.newPage()
  const r = await p.request.post(BASE + '/api/auth/login', { data: { email, password } })
  if (!r.ok()) throw new Error('login falhou ' + email)
  const seen = new Map(), queue = [...starts], refs = new Map(), consoleErr = []
  p.on('pageerror', e => consoleErr.push(`${p.url()} ${e.message}`))
  while (queue.length && seen.size < 120) {
    const path = queue.shift(); if (seen.has(path)) continue
    let status
    try { const res = await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 25000 }); status = res?.status() ?? 0; await p.waitForTimeout(1200) } catch { status = 'erro' }
    seen.set(path, status)
    if (status !== 200) continue
    for (const h of await p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))) {
      if (!h || !h.startsWith('/') || h.startsWith('/api/') || h.startsWith('/storage/')) continue
      const u = new URL(h, BASE); const k = u.pathname
      if (!refs.has(k)) refs.set(k, path)
      if (prefixes.some(x => k.startsWith(x)) && !seen.has(k) && !queue.includes(k)) queue.push(k)
    }
  }
  await ctx.close()
  return { seen, refs, consoleErr }
}
;(async () => {
  const b = await chromium.launch(); let bad = 0
  for (const [who, email, pw, starts, prefixes] of [
    ['Cliente', 'cliente1@ensaio.test', 'Cliente#Um2026', ['/dashboard', '/services', '/orders', '/domains', '/hosting', '/email', '/tickets', '/billing', '/settings'], ['/dashboard', '/services', '/orders', '/domains', '/hosting', '/email', '/tickets', '/billing', '/settings']],
    ['Admin', 'admin@ensaio.test', 'Admin#Teste2026', ['/admin'], ['/admin']],
  ]) {
    const { seen, refs, consoleErr } = await crawl(b, email, pw, starts, prefixes)
    const errs = [...seen].filter(([, s]) => s !== 200)
    console.log(`${who}: ${seen.size} páginas; com erro: ${errs.length}; erros JS: ${consoleErr.length}`)
    for (const [k, s] of errs) console.log(`  ✗ ${s} ${k} ← ${refs.get(k) ?? ''}`)
    for (const e of consoleErr.slice(0, 10)) console.log(`  ✗ JS ${e.slice(0, 200)}`)
    bad += errs.length + consoleErr.length
  }
  await b.close(); process.exit(bad ? 1 : 0)
})()
