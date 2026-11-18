#!/usr/bin/env node
/**
 * Confirma a ligação MariaDB com as MESMAS variáveis que o processo Next.js/PM2 usa.
 *   cd /var/www/viralizahost && node scripts/mariadb/check-connection.mjs
 * ou, para ler o ambiente do processo PM2:
 *   pm2 env <id> | grep -E '^MYSQL_' (não partilhar a saída: contém a palavra-passe)
 */
import mysql from 'mysql2/promise'

const cfg = {
  host: process.env.MYSQL_SOCKET ? undefined : process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  socketPath: process.env.MYSQL_SOCKET || undefined,
  database: process.env.MYSQL_DATABASE || 'viralizahost_viralizaHost',
  user: process.env.MYSQL_USER || 'viralizahost_userViralizaHost',
  password: process.env.MYSQL_PASSWORD,
}
if (cfg.password === undefined) { console.error('✗ MYSQL_PASSWORD não está no ambiente deste processo'); process.exit(1) }
console.log(`→ ${cfg.user}@${cfg.socketPath ?? `${cfg.host}:${cfg.port}`} / ${cfg.database}`)
try {
  const c = await mysql.createConnection({ ...cfg, charset: 'utf8mb4_unicode_ci' })
  const [[v]] = await c.query("SELECT VERSION() v, CURRENT_USER() u, @@character_set_server cs, @@collation_server co, @@time_zone tz, @@sql_mode sm, @@log_bin lb, @@log_bin_trust_function_creators tf, @@max_allowed_packet mp")
  console.log(`✔ ligado: MariaDB ${v.v} como ${v.u}`)
  console.log(`  charset servidor ${v.cs}/${v.co}, time_zone ${v.tz}, log_bin ${v.lb}, max_allowed_packet ${Math.round(v.mp / 1048576)} MB`)
  const [grants] = await c.query('SHOW GRANTS FOR CURRENT_USER()')
  const g = grants.map((r) => Object.values(r)[0])
  const dbGrant = g.find((x) => !/^GRANT USAGE /.test(x) && (x.includes(`\`${cfg.database.replace(/_/g, '\\_')}\``) || x.includes(`\`${cfg.database}\``) || x.includes('ON *.*')))
  console.log(dbGrant ? `✔ utilizador associado à base: ${dbGrant.replace(/IDENTIFIED BY PASSWORD '[^']+'/, "IDENTIFIED BY PASSWORD '***'")}` : '✗ o utilizador NÃO tem privilégios nesta base — no cPanel: MySQL® Databases → Add User To Database → ALL PRIVILEGES')
  const need = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'INDEX', 'REFERENCES']
  const all = g.join(' ')
  const missing = all.includes('ALL PRIVILEGES') ? [] : need.filter((p) => !all.includes(p))
  console.log(missing.length ? `✗ privilégios em falta: ${missing.join(', ')}` : '✔ privilégios suficientes (SELECT/INSERT/UPDATE/DELETE/CREATE/ALTER/INDEX/REFERENCES)')
  const [t] = await c.query('SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE()')
  console.log(`  tabelas existentes: ${t[0].n}${t[0].n ? ' (o schema é idempotente; a importação atualiza por chave primária)' : ''}`)
  await c.end()
} catch (e) {
  console.error(`✗ ${e.code ?? ''} ${e.message}`)
  if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('  Confirme a palavra-passe e o host do utilizador (cPanel cria utilizadores @localhost). Com ligação TCP 127.0.0.1 e skip-name-resolve, use MYSQL_SOCKET=/var/lib/mysql/mysql.sock.')
  if (e.code === 'ECONNREFUSED' || e.code === 'ENOENT') console.error('  O MariaDB não está a ouvir neste host/porta/socket. Veja: ls -l /var/lib/mysql/mysql.sock ; ss -ltnp | grep 3306')
  if (e.code === 'ER_DBACCESS_DENIED_ERROR' || e.code === 'ER_BAD_DB_ERROR') console.error('  Associe o utilizador à base no cPanel (MySQL® Databases → Add User To Database).')
  process.exit(1)
}
