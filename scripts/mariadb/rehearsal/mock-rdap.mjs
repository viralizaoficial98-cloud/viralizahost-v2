#!/usr/bin/env node
/**
 * RDAP simulado para o ensaio (RDAP_BOOTSTRAP_URL=http://127.0.0.1:12088/dns.json).
 * - nomes começados por «ocupado» ou «google» → registado (200)
 * - nomes começados por «lento» → não responde a tempo (timeout → «A confirmar»)
 * - nomes começados por «erro» → 503 (→ «A confirmar»)
 * - restantes → livre (404)
 * Extensões .ao/.co.ao/... não constam do bootstrap (como no RDAP real) → «A confirmar pela equipa».
 */
import http from 'node:http'
const PORT = Number(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || 12088)
const TLDS = ['com', 'net', 'org', 'online', 'shop', 'store', 'xyz', 'io', 'tech', 'ai']
http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (url.pathname === '/dns.json') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ services: [[TLDS, [`http://127.0.0.1:${PORT}/rdap/`]]] }))
  }
  const m = url.pathname.match(/^\/rdap\/domain\/(.+)$/)
  if (!m) { res.writeHead(404); return res.end() }
  const d = decodeURIComponent(m[1]).toLowerCase()
  if (/^lento/.test(d)) return setTimeout(() => { res.writeHead(404); res.end() }, 15000)
  if (/^erro/.test(d)) { res.writeHead(503); return res.end() }
  if (/^(ocupado|google)/.test(d)) { res.writeHead(200, { 'content-type': 'application/rdap+json' }); return res.end(JSON.stringify({ objectClassName: 'domain', ldhName: d })) }
  res.writeHead(404, { 'content-type': 'application/rdap+json' }); res.end(JSON.stringify({ errorCode: 404 }))
}).listen(PORT, '127.0.0.1', () => console.log(`RDAP simulado em http://127.0.0.1:${PORT}`))
