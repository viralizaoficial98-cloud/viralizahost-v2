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
 *
 * Revenda (WHM API 1): verify_new_username, listresellers, setupreseller, setacls, setresellerlimits,
 * setresellerpackagelimit, acctcounts, resellerstats, suspendreseller, unsuspendreseller, listacls, getpkginfo,
 * create_user_session (whostmgrd/cpaneld) e passwd por POST. «getresellerprivs» NÃO existe (responde como função
 * desconhecida). Injecção de falhas pelo domínio da revenda:
 *   "lento"        → o createacct demora MOCK_WHM_SLOW_MS (omissão 6 s) e CRIA a conta (tempo limite do cliente)
 *   "parcial"      → o setacls falha na 1.ª tentativa (falha parcial: a conta já existe; a repetição retoma)
 *   "verificacao"  → o setresellerlimits grava um limite de contas errado (a verificação tem de falhar)
 * Senhas: o passwd e o createacct recusam senhas no URL (só aceites no corpo do POST).
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
  ['comerc', acct('comerc', 'lojacomercial.ao', 'comercial@ensaio.test', 'business')],        // contacto comercial ≠ e-mail do cliente → associação manual
  ['testeadm', acct('testeadm', 'testeadmin.ao', 'admin@ensaio.test', 'start')],              // e-mail de conta administrativa → nunca candidata
])

// Revendedor de laboratório (nunca usado comercialmente pela aplicação) com uma conta-filha
accounts.set('vhreslab', acct('vhreslab', 'revenda-lab.viralizahost.com', 'lab@ensaio.test', 'viraliza_reseller_lab', { disklimit: '512M' }))
accounts.set('labfilho1', acct('labfilho1', 'cliente-lab1.ao', 'lab1@ensaio.test', 'viraliza_rev_cliente_5g', { owner: 'vhreslab', disklimit: '5120M' }))
const resellers = new Map([['vhreslab', { acl: 'viraliza_reseller_lab_acl', limits: { account_limit: 2, diskspace_limit: 1024, bandwidth_limit: 10240, enable_overselling: 0 }, pkgs: { viraliza_rev_cliente_5g: 1 }, suspended: false }]])
const PKGS = {
  viraliza_reseller_lab: { QUOTA: '512', BWLIMIT: '10240' }, viraliza_rev_main: { QUOTA: '1024', BWLIMIT: '10240' },
  viraliza_rev_cliente_2g: { QUOTA: '2048', BWLIMIT: '20480' }, viraliza_rev_cliente_5g: { QUOTA: '5120', BWLIMIT: '51200' },
}
const LAB_PRIVS = ['acct-summary', 'basic-system-info', 'basic-whm-functions', 'cpanel-api', 'create-acct', 'create-user-session', 'digest-auth', 'generate-email-config', 'list-accts', 'list-pkgs', 'mysql-info', 'passwd', 'public-contact', 'show-bandwidth', 'ssl', 'ssl-info', 'suspend-acct', 'track-email']
const ACLS = {
  viraliza_reseller_lab_acl: LAB_PRIVS,
  viraliza_reseller_std_acl: [...LAB_PRIVS],
  acl_perigosa: [...LAB_PRIVS, 'all', 'allow-unlimited-pkgs'],
}
const mb = v => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : 0 }
const failedOnce = new Set()
const ok = (data = {}, extra = {}) => ({ metadata: { result: 1, reason: 'OK', version: 1 }, data, ...extra })
const fail = reason => ({ metadata: { result: 0, reason, version: 1 } })

const server = https.createServer({ cert: readFileSync(args.cert), key: readFileSync(args.key) }, (req, res) => {
  let raw = ''
  req.on('data', c => { raw += c })
  req.on('end', () => handle(req, res, raw).catch(e => { res.writeHead(500); res.end(String(e)) }))
})
async function handle(req, res, raw) {
  const url = new URL(req.url, `https://127.0.0.1:${PORT}`)
  const fn = url.pathname.replace('/json-api/', '')
  const inUrl = Object.fromEntries(url.searchParams)
  const q = { ...inUrl, ...(req.method === 'POST' ? Object.fromEntries(new URLSearchParams(raw)) : {}) }
  // Registo: função, método e NOMES dos parâmetros (no URL e no corpo) — nunca valores
  if (args.log) appendFileSync(args.log, JSON.stringify({ t: new Date().toISOString(), fn, method: req.method, params: Object.keys(inUrl), body: req.method === 'POST' ? [...new URLSearchParams(raw).keys()] : [] }) + '\n')
  const send = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (req.headers.authorization !== `whm root:${TOKEN}`) return send({ cpanelresult: { error: 'Access denied' } }, 403)
  switch (fn) {
    case 'version': return send(ok({ version: '11.120.0.10' }))
    case 'listpkgs': return send(ok({ pkg: [
      ...Object.entries(PKGS).map(([name, p]) => ({ name, QUOTA: p.QUOTA, BWLIMIT: p.BWLIMIT, MAXPOP: '10', MAXSQL: '5', MAXADDON: '0' })),
      { name: 'start', QUOTA: '10240', BWLIMIT: 'unlimited', MAXPOP: '10', MAXSQL: '5', MAXADDON: '0' },
      { name: 'business', QUOTA: '51200', BWLIMIT: 'unlimited', MAXPOP: '50', MAXSQL: '20', MAXADDON: '5' },
      { name: 'email_only', QUOTA: '5120', BWLIMIT: 'unlimited', MAXPOP: '25', MAXSQL: '0', MAXADDON: '0' },
      { name: 'email5', QUOTA: '5120', BWLIMIT: 'unlimited', MAXPOP: '5', MAXSQL: '0', MAXADDON: '0' },
    ] }))
    case 'listaccts': {
      let list = [...accounts.values()]
      if (q.searchtype === 'owner' && q.search) list = list.filter(a => a.owner === q.search)
      if (q.searchtype === 'domain' && q.search) list = list.filter(a => q.searchmethod === 'exact' ? a.domain === q.search : a.domain.includes(q.search))
      return send(ok({ acct: list }))
    }
    case 'accountsummary': {
      const a = accounts.get(q.user)
      return send(a ? ok({ acct: [a] }) : fail(`Account "${q.user}" does not exist.`))
    }
    case 'createacct': {
      if (q.password) return send(fail('Ensaio: a aplicação não deve enviar senha no createacct'))
      if (/lento/.test(q.domain)) await new Promise(r => setTimeout(r, Number(process.env.MOCK_WHM_SLOW_MS || 6000)))
      if (/falha/.test(q.domain)) return send(fail('Simulated provider failure'))
      if (/retentar/.test(q.domain) && !failedOnce.has(q.domain)) { failedOnce.add(q.domain); return send(fail('Simulated transient failure')) }
      if (accounts.has(q.username)) return send(fail(`Sorry, a group for that username (${q.username}) already exists.`))
      if ([...accounts.values()].some(a => a.domain === q.domain)) return send(fail(`(XID x) The domain "${q.domain}" already exists in the userdata.`))
      accounts.set(q.username, acct(q.username, q.domain, q.contactemail, q.plan, q.quota ? { disklimit: `${q.quota}M`, diskused: '0M' } : {}))
      return send(ok({}, { metadata: { result: 1, reason: 'Account Creation Ok', version: 1 } }))
    }
    case 'create_user_session': {
      if (q.service === 'whostmgrd' && !resellers.has(q.user)) return send(fail(`The user "${q.user}" is not a reseller.`))
      return send(ok({ url: `https://127.0.0.1:${PORT}/cpsess0000/login/?session=ensaio-${q.service || 'cpaneld'}`, expires: now + 900, expire: 900 }))
    }
    case 'passwd': {
      if (inUrl.password) return send(fail('Ensaio: senha no URL recusada (usar POST)'))
      if (!accounts.has(q.user) && !String(q.user).includes('@')) return send(fail(`User "${q.user}" does not exist.`))
      return send(ok())
    }
    case 'suspendacct': case 'unsuspendacct': case 'removeacct': return send(ok())
    // ── Revenda ──
    case 'verify_new_username': return send(accounts.has(q.user) || !/^[a-z][a-z0-9]{0,15}$/.test(q.user || '') ? fail(`The name "${q.user}" is not available.`) : ok({}))
    case 'listresellers': return send(ok({ reseller: [...resellers.keys()] }))
    case 'setupreseller': {
      if (!accounts.has(q.user)) return send(fail(`User "${q.user}" does not exist.`))
      if (!resellers.has(q.user)) resellers.set(q.user, { acl: null, limits: {}, pkgs: {}, suspended: false })
      return send(ok())
    }
    case 'setacls': {
      const r = resellers.get(q.reseller)
      if (!r) return send(fail(`"${q.reseller}" is not a reseller.`))
      if (!ACLS[q.acllist]) return send(fail(`The ACL list "${q.acllist}" does not exist.`))
      const d = accounts.get(q.reseller)?.domain ?? ''
      if (/parcial/.test(d) && !failedOnce.has(`acl:${q.reseller}`)) { failedOnce.add(`acl:${q.reseller}`); return send(fail('Simulated partial failure (setacls)')) }
      r.acl = q.acllist; return send(ok())
    }
    case 'setresellerlimits': {
      const r = resellers.get(q.user)
      if (!r) return send(fail(`"${q.user}" is not a reseller.`))
      const d = accounts.get(q.user)?.domain ?? ''
      r.limits = { account_limit: Number(q.account_limit) + (/verificacao/.test(d) ? 1 : 0), diskspace_limit: mb(q.diskspace_limit), bandwidth_limit: mb(q.bandwidth_limit),
        enable_overselling: Number(q.enable_overselling ?? 0), enable_overselling_bandwidth: Number(q.enable_overselling_bandwidth ?? 0), enable_overselling_diskspace: Number(q.enable_overselling_diskspace ?? 0) }
      return send(ok())
    }
    case 'setresellerpackagelimit': {
      const r = resellers.get(q.user)
      if (!r) return send(fail(`"${q.user}" is not a reseller.`))
      if (!PKGS[q.package]) return send(fail(`The package "${q.package}" does not exist.`))
      r.pkgs[q.package] = Number(q.allowed); return send(ok())
    }
    case 'acctcounts': {
      const r = resellers.get(q.user)
      if (!r) return send(fail(`"${q.user}" is not a reseller.`))
      const own = [...accounts.values()].filter(a => a.owner === q.user)
      return send(ok({ reseller: { account: own.length, active: own.filter(a => !a.suspended).length, suspended: own.filter(a => a.suspended).length, limit: r.limits.account_limit ?? 'unlimited' } }))
    }
    case 'resellerstats': {
      const r = resellers.get(q.user)
      if (!r) return send(fail(`"${q.user}" is not a reseller.`))
      const own = [...accounts.values()].filter(a => a.owner === q.user)
      return send(ok({ reseller: { user: q.user, diskused: own.reduce((t, a) => t + mb(a.diskused), 0), totaldiskalloc: own.reduce((t, a) => t + mb(a.disklimit), 0), diskquota: r.limits.diskspace_limit ?? 0,
        totalbwused: 0, totalbwalloc: 0, bandwidthlimit: r.limits.bandwidth_limit ?? 0, acct: own } }))
    }
    case 'suspendreseller': case 'unsuspendreseller': {
      const r = resellers.get(q.user)
      if (!r) return send(fail(`"${q.user}" is not a reseller.`))
      const susp = fn === 'suspendreseller'
      r.suspended = susp
      for (const a of accounts.values()) if (a.user === q.user || a.owner === q.user) { a.suspended = susp ? 1 : 0; a.suspendreason = susp ? (q.reason || '') : '' }
      return send(ok())
    }
    case 'listacls': return send(ok({ acl: Object.entries(ACLS).map(([name, privs]) => ({ name, privileges: Object.fromEntries(privs.map(p => [p, 1])) })) }))
    case 'getpkginfo': return send(PKGS[q.pkg] ? ok({ pkg: { name: q.pkg, ...PKGS[q.pkg] } }) : fail(`The package "${q.pkg}" does not exist.`))
    case 'getdiskusage': return send(ok({ accounts: [] }))
    case 'loadavg': return send({ one: '0.1', five: '0.1', fifteen: '0.1' })
    default: return send(fail(`Função ${fn} não simulada`))
  }
}
server.listen(PORT, '127.0.0.1', () => console.log(`WHM simulado em https://127.0.0.1:${PORT}`))
