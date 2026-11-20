import 'server-only'
import mysql from 'mysql2/promise'

// Pool de ligações MariaDB. Configuração exclusivamente por variáveis de
// ambiente (nunca NEXT_PUBLIC_*, para não chegar ao navegador):
//   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
//   DB_SOCKET          (opcional) caminho do socket Unix; tem prioridade sobre host/porta
//   DB_POOL_SIZE       (opcional, por omissão 10)
//   DB_SSL             (opcional) "true" para TLS

declare global {
  var __vhPool: mysql.Pool | undefined
}

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Variável de ambiente em falta: ${name}`)
  return v
}

export function getPool(): mysql.Pool {
  if (globalThis.__vhPool) return globalThis.__vhPool
  const socketPath = process.env.DB_SOCKET || undefined
  const pool = mysql.createPool({
    ...(socketPath
      ? { socketPath }
      : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306) }),
    database: required('DB_NAME'),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    charset: 'utf8mb4_unicode_ci',
    // Datas sempre em UTC; DATETIME devolvido como texto para preservar microssegundos.
    timezone: 'Z',
    dateStrings: ['DATETIME', 'DATE', 'TIMESTAMP'],
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    waitForConnections: true,
    enableKeepAlive: true,
    ...(process.env.DB_SSL === 'true' ? { ssl: {} } : {}),
  })
  pool.on('connection', conn => {
    conn.query("SET time_zone = '+00:00', sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'")
  })
  globalThis.__vhPool = pool
  return pool
}

export type Queryable = mysql.Pool | mysql.PoolConnection

/** Executa `fn` numa transacção; faz ROLLBACK em caso de erro. */
export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const out = await fn(conn)
    await conn.commit()
    return out
  } catch (e) {
    try { await conn.rollback() } catch {}
    throw e
  } finally {
    conn.release()
  }
}
