#!/usr/bin/env node
/**
 * WHM SIMULADO para ensaio (nunca usar em produção). Responde às chamadas
 * json-api que a aplicação usa, guarda as contas em memória e regista cada
 * pedido (sem cabeçalhos de autenticação) para verificar que não há senhas no URL.
 *
 *   node scripts/mariadb/rehearsal/mock-whm.mjs --cert=cert.pem --key=key.pem [--port=2087] [--log=whm.log]
 *
 * Domínios que contenham "falha" fazem o createacct falhar (teste de erro de activação).
 * Domínios que contenham "retentar" falham só na primeira tentativa (repetição segura).
 */
import https from 'node:https'
import { readFileSync, appendFileSync } from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')] }))
const PORT = Number(args.port || 2087)
const TOKEN = process.env.MOCK_WHM_TOKEN || 'token-de-ensaio'
const now = Math.floor(Date.now() / 1000)
const acct = (user, domain, email, plan, extra = {}) => ({ user, domain, email, plan, diskused: '120M', disklimit: '20480M', ip: '10.0.0.10', suspended: 0, maxpop: '10', maxsub: '5', maxsql: '5', maxftp: '5', phpversion: 'ea-php82', suspendreason: '', unix_startdate: now - 86400 * 200, owner: 'root', partition: 'home', theme: 'jupiter', uuid: `uuid-${user}`, ...extra })
// Contas existentes no servidor (cenários de importação)
const accounts = new Map([
  ['joaoconc', acct('joaoconc', 'joaoconceicao.ao', 'cliente1@ensaio.test', 'start')],          // já associada (hosting_accounts)
  ['mariaacu', acct('mariaacu', 'mariaacucar.com', 'cliente2@ensaio.test', 'business')],       // e-mail coincide com cliente → só candidata
  ['semdono', acct('semdono', 'semdono.co.ao', 'desconhecido@exemplo.invalid', 'start')],      // sem cliente → pendente
  ['dupdom', acct('dupdom', 'joaoconceicao.ao', 'outro@exemplo.invalid', 'start', { suspended: 1, suspendreason: 'Falta de pagamento' })], // conflito de domínio
])

const failedOnce = new Set()
const ok = (data = {}, extra = {}) => ({ metadata: { result: 1, reason: 'OK', version: 1 }, data, ...extra })
const fail = reason => ({ metadata: { result: 0, reason, version: 1 } })

const server = https.createServer({ cert: readFileSync(args.cert), key: readFileSync(args.key) }, (req, res) => {
  const url = new URL(req.url, `https://127.0.0.1:${PORT}`)
  const fn = url.pathname.replace('/json-api/', '')
  const q = Object.fromEntries(url.searchParams)
  if (args.log) appendFileSync(args.log, JSON.stringify({ t: new Date().toISOString(), fn, params: Object.keys(q) }) + '\n')
  const send = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.headers.authorization !== `whm root:${TOKEN}`) return send({ cpanelresult: { error: 'Access denied' } }, 403)
  switch (fn) {
    case 'version': return send(ok({ version: '11.120.0.10' }))
    case 'listpkgs': return send(ok({ pkg: [
      { name: 'start', QUOTA: '10240', BWLIMIT: 'unlimited', MAXPOP: '10', MAXSQL: '5', MAXADDON: '0' },
      { name: 'business', QUOTA: '51200', BWLIMIT: 'unlimited', MAXPOP: '50', MAXSQL: '20', MAXADDON: '5' },
      { name: 'email_only', QUOTA: '5120', BWLIMIT: 'unlimited', MAXPOP: '25', MAXSQL: '0', MAXADDON: '0' },
      { name: 'email5', QUOTA: '5120', BWLIMIT: 'unlimited', MAXPOP: '5', MAXSQL: '0', MAXADDON: '0' },
    ] }))
    case 'listaccts': return send(ok({ acct: [...accounts.values()] }))
    case 'accountsummary': {
      const a = accounts.get(q.user)
      return send(a ? ok({ acct: [a] }) : fail(`Account "${q.user}" does not exist.`))
    }
    case 'createacct': {
      if (q.password) return send(fail('Ensaio: a aplicação não deve enviar senha no createacct'))
      if (/falha/.test(q.domain)) return send(fail('Simulated provider failure'))
      if (/retentar/.test(q.domain) && !failedOnce.has(q.domain)) { failedOnce.add(q.domain); return send(fail('Simulated transient failure')) }
      if (accounts.has(q.username)) return send(fail(`Sorry, a group for that username (${q.username}) already exists.`))
      if ([...accounts.values()].some(a => a.domain === q.domain)) return send(fail(`(XID x) The domain "${q.domain}" already exists in the userdata.`))
      accounts.set(q.username, acct(q.username, q.domain, q.contactemail, q.plan))
      return send(ok({}, { metadata: { result: 1, reason: 'Account Creation Ok', version: 1 } }))
    }
    case 'create_user_session': return send(ok({ url: `https://127.0.0.1:${PORT}/cpsess0000/login/?session=ensaio`, expire: 900 }))
    case 'suspendacct': case 'unsuspendacct': case 'passwd': case 'removeacct': return send(ok())
    case 'getdiskusage': return send(ok({ accounts: [] }))
    case 'loadavg': return send({ one: '0.1', five: '0.1', fifteen: '0.1' })
    default: return send(fail(`Função ${fn} não simulada`))
  }
})
server.listen(PORT, '127.0.0.1', () => console.log(`WHM simulado em https://127.0.0.1:${PORT}`))
