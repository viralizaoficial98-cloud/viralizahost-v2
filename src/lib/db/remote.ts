/*
 * Executor do browser: envia a consulta recolhida para /api/db, que a executa no servidor com a sessão
 * do utilizador e as políticas de acesso. O browser nunca fala diretamente com o MySQL.
 */
import { QueryBuilder } from './query'
import type { DbQuery, DbResult } from './types'

async function remoteExec(q: DbQuery): Promise<DbResult> {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-VH-DB': '1' },
      credentials: 'same-origin',
      body: JSON.stringify(q),
    })
    return (await res.json()) as DbResult
  } catch (e) {
    return { data: null, error: { message: (e as Error).message ?? 'Falha de rede', code: 'NETWORK', details: null, hint: null }, count: null, status: 0, statusText: 'Network error' }
  }
}

export function remoteFrom(table: string) {
  return new QueryBuilder(table, remoteExec)
}

/** Envolve o cliente do browser: .from() vai para /api/db, o resto (auth, storage) continua no Supabase. */
export function makeBrowserHybrid<T extends object>(sb: T): T {
  return new Proxy(sb, {
    get(target, prop, recv) {
      if (prop === 'from') return remoteFrom
      if (prop === 'rpc') return () => Promise.resolve({ data: null, error: { message: 'RPC não disponível no browser', code: 'PGRST202', details: null, hint: null } })
      return Reflect.get(target, prop, recv)
    },
  })
}
