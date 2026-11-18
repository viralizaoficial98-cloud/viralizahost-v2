import mysql from 'mysql2/promise'

/*
 * Pool de ligações MySQL/MariaDB (só servidor).
 * Credenciais no ambiente do servidor (.env.local), nunca no código:
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, [MYSQL_SOCKET], [MYSQL_POOL_SIZE]
 */
type G = typeof globalThis & { __vhMysqlPool?: mysql.Pool }

export function getPool(): mysql.Pool {
  const g = globalThis as G
  if (g.__vhMysqlPool) return g.__vhMysqlPool
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_SOCKET, MYSQL_POOL_SIZE } = process.env
  if (!MYSQL_DATABASE || !MYSQL_USER) throw new Error('Configuração MySQL em falta (MYSQL_DATABASE / MYSQL_USER).')
  g.__vhMysqlPool = mysql.createPool({
    host: MYSQL_SOCKET ? undefined : (MYSQL_HOST ?? 'localhost'),
    port: Number(MYSQL_PORT ?? 3306),
    socketPath: MYSQL_SOCKET || undefined,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    connectionLimit: Number(MYSQL_POOL_SIZE ?? 10),
    waitForConnections: true,
    enableKeepAlive: true,
  })
  // Sessão sempre em UTC e em modo estrito (como o PostgreSQL: erro em vez de truncar)
  g.__vhMysqlPool.on('connection', conn => {
    conn.query("SET time_zone = '+00:00'")
    conn.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")
  })
  return g.__vhMysqlPool
}

export type Conn = mysql.PoolConnection | mysql.Pool
