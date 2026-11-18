/**
 * Base de dados ativa:
 *   NEXT_PUBLIC_DATA_BACKEND=supabase  → PostgreSQL do Supabase (comportamento original)
 *   NEXT_PUBLIC_DATA_BACKEND=mysql     → MySQL/MariaDB (Auth e Storage continuam no Supabase)
 * O valor é fixado no `npm run build` (prefixo NEXT_PUBLIC_), por isso mudar exige recompilar.
 */
export type DataBackend = 'supabase' | 'mysql'

export function dataBackend(): DataBackend {
  return process.env.NEXT_PUBLIC_DATA_BACKEND === 'mysql' ? 'mysql' : 'supabase'
}

export const isMysqlBackend = () => dataBackend() === 'mysql'
