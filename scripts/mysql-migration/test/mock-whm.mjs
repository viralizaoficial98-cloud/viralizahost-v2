#!/usr/bin/env node
/**
 * TESTE — WHM simulado (JSON API v1) em HTTPS para validar a integração WHM/cPanel sem um servidor real.
 *   TLS_KEY=srv.key TLS_CERT=srv.pem PORT=2087 TOKEN=… node mock-whm.mjs
 * A app tem de confiar no certificado: arrancar com NODE_EXTRA_CA_CERTS=<ca.pem>.
 */
import https from 'node:https'
import { readFileSync } from 'node:fs'

const PORT = Number(process.env.PORT ?? 2087)
const TOKEN = process.env.TOKEN ?? 'WHMTESTTOKEN'
const accounts = [
  { user: 'clientea', domain: 'minhaempresa-teste.com', email: 'cliente.a@exemplo.ao', plan: 'start', diskused: '120M', disklimit: '10240M', ip: '197.149.1.10', suspended: 0, suspendreason: 'not suspended', unix_startdate: 1767225600, maxpop: 'unlimited', maxsub: 'unlimited' },
  { user: 'loja', domain: 'lojadoze.ao', email: 'ze@lojadoze.ao', plan: 'business', diskused: '2048M', disklimit: '20480M', ip: '197.149.1.11', suspended: 0, suspendreason: 'not suspended', unix_startdate: 1767312000, maxpop: 'unlimited', maxsub: 'unlimited' },
  { user: 'antigo', domain: 'antigo.co.ao', email: 'admin@antigo.co.ao', plan: 'start', diskused: '0M', disklimit: '10240M', ip: '197.149.1.12', suspended: 1, suspendreason: 'Falta de pagamento', unix_startdate: 1704067200, maxpop: '10', maxsub: '5' },
]
const calls = []
const ok = (data = {}) => ({ metadata: { result: 1, reason: 'OK', version: 1 }, data })

https.createServer({ key: readFileSync(process.env.TLS_KEY), cert: readFileSync(process.env.TLS_CERT) }, (req, res) => {
  const url = new URL(req.url, `https://localhost:${PORT}`)
  const fn = url.pathname.replace(/^\/json-api\//, '')
  const q = Object.fromEntries(url.searchParams)
  if (url.pathname === '/__calls') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(calls)) }
  calls.push({ fn, q })
  const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.headers.authorization !== `whm root:${TOKEN}`) return send(403, { metadata: { result: 0, reason: 'Access denied' } })
  const acct = accounts.find(a => a.user === q.user)
  switch (fn) {
    case 'version': return send(200, ok({ version: '11.130.0.5' }))
    case 'listaccts': return send(200, ok({ acct: accounts }))
    case 'accountsummary': return send(200, acct ? ok({ acct: [acct] }) : { metadata: { result: 0, reason: 'Conta não existe' } })
    case 'suspendacct': if (acct) { acct.suspended = 1; acct.suspendreason = q.reason } return send(200, ok())
    case 'unsuspendacct': if (acct) { acct.suspended = 0; acct.suspendreason = 'not suspended' } return send(200, ok())
    case 'changepackage': if (acct) acct.plan = q.pkg; return send(200, ok())
    case 'passwd': case 'removeacct': case 'createacct': return send(200, ok())
    case 'listpkgs': return send(200, ok({ pkg: [{ name: 'start' }, { name: 'business' }] }))
    case 'getdiskusage': return send(200, ok({ accounts: [{ user: q.user, blocks_used: 1000, blocks_limit: 10000 }] }))
    case 'loadavg': return send(200, ok({ one: '0.10', five: '0.12', fifteen: '0.09' }))
    case 'create_user_session': return send(200, ok({ url: `https://localhost:2083/cpsess0001/login/?session=${q.user}:teste`, expire: 300 }))
    case 'cpanel': return send(200, { cpanelresult: { data: [], event: { result: 1 } }, result: { status: 1, data: [], errors: null } })
    case 'uapi_cpanel': return send(200, ok({ uapi: { status: 1, data: [], errors: null } }))
    default: return send(200, ok())
  }
}).listen(PORT, () => console.log(`mock WHM em https://localhost:${PORT}`))
