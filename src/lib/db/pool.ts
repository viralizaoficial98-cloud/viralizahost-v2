import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
import mysql, { type Pool, type PoolConnection } from 'mysql2/promise'

// Ligação MariaDB. Credenciais apenas por variáveis de ambiente do servidor:
//   MYSQL_HOST (localhost) | MYSQL_PORT (3306) | MYSQL_SOCKET (opcional, ex.: /var/lib/mysql/mysql.sock)
//   MYSQL_DATABASE (viralizahost_viralizaHost) | MYSQL_USER | MYSQL_PASSWORD
//   MYSQL_POOL_SIZE (10)

const g = globalThis as unknown as { __vhPool?: Pool }

export function getPool(): Pool {
  if (g.__vhPool) return g.__vhPool
  const password = process.env.MYSQL_PASSWORD
  if (password === undefined) throw new Error('MYSQL_PASSWORD não está definida no ambiente do servidor')
  const pool = mysql.createPool({
    host: process.env.MYSQL_SOCKET ? undefined : (process.env.MYSQL_HOST || 'localhost'),
    port: Number(process.env.MYSQL_PORT || 3306),
    socketPath: process.env.MYSQL_SOCKET || undefined,
    database: process.env.MYSQL_DATABASE || 'viralizahost_viralizaHost',
    user: process.env.MYSQL_USER || 'viralizahost_userViralizaHost',
    password,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    dateStrings: true,          // a conversão para ISO-8601 é feita em codec.ts
    decimalNumbers: false,      // DECIMAL chega como string exata; codec decide
    supportBigNumbers: true,
    bigNumberStrings: false,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
    enableKeepAlive: true,
    namedPlaceholders: false,
  })
  // Garante UTC e modo estrito em todas as ligações (as datas são guardadas em UTC).
  pool.on('connection', (conn) => {
    conn.query(
      "SET time_zone = '+00:00', sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
    )
  })
  g.__vhPool = pool
  return pool
}

export type Conn = Pick<PoolConnection, 'query' | 'execute'>

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const out = await fn(conn)
    await conn.commit()
    return out
  } catch (e) {
    try { await conn.rollback() } catch { /* ignore */ }
    throw e
  } finally {
    conn.release()
  }
}

export async function sql<T = any>(query: string, params: unknown[] = [], conn?: Conn): Promise<T[]> {
  const [rows] = await (conn ?? getPool()).query(query, params as any[])
  return rows as T[]
}
