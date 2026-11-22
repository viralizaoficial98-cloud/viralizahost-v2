#!/usr/bin/env node
/**
 * RESEND SIMULADO para ensaio (nunca usar em produção). Nada sai para a Internet.
 *   node scripts/mariadb/rehearsal/mock-resend.mjs [--port=12090] [--domain-status=verified]
 * A aplicação de ensaio aponta para ele com RESEND_API_URL=http://127.0.0.1:12090.
 * Cenários pelo destinatário: «falha-envio» → recusado (422); «devolvido» → aceite e depois «bounced».
 * Chave terminada em «restrita» → só envio (listar domínios devolve 401 restricted_api_key).
 * GET /_outbox?to=… devolve a última mensagem (só para os testes extraírem o link).
 */
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')] }))
const PORT = Number(args.port || 12090)
const DOMAIN_STATUS = args['domain-status'] || 'verified'
const sent = new Map()
const outbox = []
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
const body = req => new Promise(r => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')) } catch { r({}) } }) })

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (url.pathname === '/_outbox') {
    const to = (url.searchParams.get('to') || '').toLowerCase()
    const list = outbox.filter(m => m.to.includes(to))
    return send(res, 200, { count: list.length, last: list[list.length - 1] ?? null })
  }
  const auth = req.headers.authorization || ''
  if (!/^Bearer re_/.test(auth)) return send(res, 401, { name: 'missing_api_key', message: 'Missing API key' })
  if (req.method === 'POST' && url.pathname === '/emails') {
    const b = await body(req)
    const to = String((b.to || [])[0] || '').toLowerCase()
    if (to.includes('falha-envio')) return send(res, 422, { name: 'validation_error', message: 'The recipient address was rejected (simulado).' })
    const id = randomUUID()
    sent.set(id, { to, event: to.includes('devolvido') ? 'bounced' : 'delivered' })
    outbox.push({ id, to, from: b.from, subject: b.subject, html: b.html, at: new Date().toISOString() })
    return send(res, 200, { id })
  }
  if (req.method === 'GET' && url.pathname.startsWith('/emails/')) {
    const m = sent.get(url.pathname.split('/').pop())
    return m ? send(res, 200, { object: 'email', last_event: m.event, to: [m.to] }) : send(res, 404, { name: 'not_found', message: 'Email not found' })
  }
  if (req.method === 'GET' && url.pathname === '/domains') {
    if (/restrita$/.test(auth)) return send(res, 401, { name: 'restricted_api_key', message: 'This API key is restricted to only send emails' })
    return send(res, 200, { data: [{ id: 'd1', name: 'viralizahost.com', status: DOMAIN_STATUS, region: 'eu-west-1' }] })
  }
  send(res, 404, { name: 'not_found', message: 'Not found' })
}).listen(PORT, '127.0.0.1', () => console.log(`Resend simulado em http://127.0.0.1:${PORT}`))
