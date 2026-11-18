// Conversão de valores entre o formato da aplicação (o que o PostgREST devolvia)
// e o formato MariaDB.
import type { ColumnMeta } from './types'

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Qualquer data/ISO → 'YYYY-MM-DD HH:MM:SS.ffffff' em UTC (preserva microssegundos). */
export function toMysqlDatetime(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    if (isNaN(v.getTime())) throw new Error('Data inválida')
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}.${pad(v.getUTCMilliseconds(), 3)}000`
  }
  const s = String(v).trim()
  // só data
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00.000000`
  // ISO com fração e fuso explícito
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(?:\.(\d{1,9}))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i)
  if (m) {
    const frac = (m[3] ?? '').padEnd(6, '0').slice(0, 6)
    const time = m[2].length === 5 ? `${m[2]}:00` : m[2]
    const tz = m[4]
    if (!tz || /^(Z|\+00(:?00)?|-00(:?00)?)$/i.test(tz)) return `${m[1]} ${time}.${frac}`
    const d = new Date(`${m[1]}T${time}${tz.length === 3 ? tz + ':00' : tz}`)
    const base = toMysqlDatetime(d)!
    return base.slice(0, 20) + frac
  }
  const d = new Date(s)
  if (isNaN(d.getTime())) throw new Error(`Data inválida: ${s}`)
  return toMysqlDatetime(d)
}

export function toMysqlDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return toMysqlDatetime(v)!.slice(0, 10)
}

/** Valor da aplicação → parâmetro SQL para a coluna. */
export function encodeValue(col: ColumnMeta | undefined, v: unknown): unknown {
  if (v === undefined) return null
  if (v === null) return null
  if (!col) return typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v
  switch (col.type) {
    case 'json':
    case 'array':
      return JSON.stringify(v)
    case 'bool':
      if (typeof v === 'string') return v === 'true' || v === 't' || v === '1' ? 1 : 0
      return v ? 1 : 0
    case 'datetime':
      return toMysqlDatetime(v)
    case 'date':
      return toMysqlDate(v)
    case 'int':
      return typeof v === 'number' ? Math.trunc(v) : (v === '' ? null : Number(v))
    case 'decimal':
    case 'float':
      return typeof v === 'number' ? v : (v === '' ? null : String(v))
    default:
      return typeof v === 'object' ? JSON.stringify(v) : v
  }
}

/** Valor para comparação em filtros (sem serializar texto como JSON). */
export function encodeFilterValue(col: ColumnMeta | undefined, v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (!col) return v
  if (col.type === 'json' || col.type === 'array') return typeof v === 'string' ? v : JSON.stringify(v)
  if (col.type === 'bool') return v === true || v === 'true' || v === 't' || v === 1 || v === '1' ? 1 : 0
  if (col.type === 'datetime') { try { return toMysqlDatetime(v) } catch { return v } }
  if (col.type === 'date') { try { return toMysqlDate(v) } catch { return v } }
  return v
}

/** Valor MariaDB → valor como o PostgREST o devolvia. */
export function decodeValue(col: ColumnMeta | undefined, v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (!col) return v
  switch (col.type) {
    case 'json':
    case 'array':
      if (typeof v !== 'string') return v
      try { return JSON.parse(v) } catch { return v }
    case 'bool':
      return v === 1 || v === '1' || v === true
    case 'datetime': {
      // '2026-07-01 10:00:00.123456' → '2026-07-01T10:00:00.123456+00:00'
      const s = String(v)
      const [d, t = '00:00:00'] = s.split(' ')
      const [hms, frac] = t.split('.')
      const f = frac ? '.' + frac.replace(/0+$/, '') : ''
      return `${d}T${hms}${f === '.' ? '' : f}+00:00`
    }
    case 'date':
      return String(v).slice(0, 10)
    case 'int':
    case 'float':
    case 'decimal':
      return typeof v === 'number' ? v : Number(v)
    default:
      return v
  }
}
