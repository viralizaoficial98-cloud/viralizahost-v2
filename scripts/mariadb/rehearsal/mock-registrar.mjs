#!/usr/bin/env node
/**
 * REGISTRADOR SIMULADO para ensaio (nunca usar em produção). Nenhum domínio é
 * registado e nada é cobrado. Responde à API usada por src/lib/registrar/simulated.ts.
 *
 *   MOCK_REGISTRAR_TOKEN=... node scripts/mariadb/rehearsal/mock-registrar.mjs [--port=12089] [--delay=4000]
 *
 * Cenários pelo nome do domínio:
 *   ocupado*  → indisponível            incerto*  → consulta falha (inconclusivo)
 *   lento*    → o registo é feito mas a resposta chega depois do tempo limite
 *   perdido*  → o 1.º pedido perde-se (não é registado) e dá timeout
 *   ambiguo*  → timeout no registo e a consulta de estado também falha
 *   pendente* → aceite como «pending»; a consulta seguinte devolve «active»
 *   recusa*   → registo recusado (erro 422)
 * GET /v1/_stats devolve quantas vezes cada domínio foi efectivamente registado.
 */
import http from 'node:http'

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')] }))
const PORT = Number(args.port || 12089)
const DELAY = Number(args.delay || 4000)
const TOKEN = process.env.MOCK_REGISTRAR_TOKEN || 'registrador-de-ensaio'
const EXTENSIONS = ['.ao', '.co.ao', '.com', '.net', '.org']
const ops = new Map()          // clientRef → operação
const registered = new Map()   // domínio → n.º de registos efectivos
const lostOnce = new Set()
let seq = 1000

const label = d => d.split('.')[0]
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
const body = req => new Promise(r => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')) } catch { r({}) } }) })
const sleep = ms => new Promise(r => setTimeout(r, ms))

function record(kind, domain, clientRef, status = 'active') {
  const op = { id: `SIM-${kind.toUpperCase()}-${++seq}`, kind, domain, clientRef, status }
  ops.set(clientRef, op)
  if (kind === 'register') registered.set(domain, (registered.get(domain) ?? 0) + 1)
  return op
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (url.pathname === '/v1/_stats') return send(res, 200, { registrations: Object.fromEntries(registered), operations: ops.size })
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' })
  const p = url.pathname
  if (req.method === 'GET' && p === '/v1/account') return send(res, 200, { account: 'ensaio', balance: 0, extensions: EXTENSIONS })
  if (req.method === 'GET' && p === '/v1/check') {
    const d = url.searchParams.get('domain') ?? ''
    if (label(d).startsWith('incerto')) return send(res, 503, { error: 'registry unavailable' })
    return send(res, 200, { domain: d, available: !(label(d).startsWith('ocupado') || registered.has(d)) })
  }
  if (req.method === 'GET' && p.startsWith('/v1/operations/')) {
    const ref = decodeURIComponent(p.split('/').pop())
    const op = ops.get(ref)
    if (op && label(op.domain).startsWith('ambiguo')) return send(res, 500, { error: 'status service down' })
    if (!op) return send(res, 404, { error: 'not found' })
    if (op.status === 'pending') op.status = 'active' // concluído no registo entre o pedido e a consulta
    return send(res, 200, op)
  }
  if (req.method === 'POST' && (p === '/v1/domains' || p === '/v1/transfers' || /\/renew$/.test(p))) {
    const b = await body(req)
    const kind = p === '/v1/domains' ? 'register' : p === '/v1/transfers' ? 'transfer' : 'renew'
    const domain = kind === 'renew' ? decodeURIComponent(p.split('/')[3]) : String(b.domain ?? '')
    if (!b.clientRef) return send(res, 400, { error: 'clientRef obrigatório' })
    if (ops.has(b.clientRef)) return send(res, 200, ops.get(b.clientRef)) // idempotente
    const l = label(domain)
    if (l.startsWith('recusa')) return send(res, 422, { error: 'Registry rejected the request' })
    if (kind === 'register' && (l.startsWith('ocupado') || registered.has(domain))) return send(res, 409, { error: 'Domain not available' })
    if (kind === 'transfer' && !b.authCode) return send(res, 400, { error: 'authCode obrigatório' })
    if (l.startsWith('perdido') && !lostOnce.has(domain)) { lostOnce.add(domain); await sleep(DELAY); return send(res, 504, { error: 'lost' }) }
    const op = record(kind, domain, b.clientRef, l.startsWith('pendente') ? 'pending' : 'active')
    if (l.startsWith('lento') || l.startsWith('ambiguo')) { await sleep(DELAY); return send(res, 200, op) }
    return send(res, kind === 'register' ? 201 : 200, op)
  }
  send(res, 404, { error: 'not found' })
}).listen(PORT, '127.0.0.1', () => console.log(`Registrador simulado em http://127.0.0.1:${PORT}`))
