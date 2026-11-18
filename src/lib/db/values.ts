/*
 * Conversão de valores entre o formato JSON que a aplicação usa (o mesmo que o PostgREST devolvia)
 * e o formato guardado no MySQL/MariaDB.
 */
import type { ColumnMeta } from './types'

export class ValueError extends Error {
  constructor(message: string, public code = '22P02') { super(message) }
}

/** "2026-01-02T03:04:05.123456+01:00" | Date → "2026-01-02 02:04:05.123456" (UTC) */
export function toMysqlDatetime(v: unknown): string {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) throw new ValueError('Data inválida')
    return v.toISOString().replace('T', ' ').replace('Z', '') + '000'
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i)
  if (!m) {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) throw new ValueError(`invalid input syntax for type timestamp with time zone: "${s}"`)
    return toMysqlDatetime(d)
  }
  const [, Y, Mo, D, h = '00', mi = '00', se = '00', frac = '', tz = 'Z'] = m
  let offsetMin = 0
  if (tz && tz.toUpperCase() !== 'Z') {
    const sign = tz.startsWith('-') ? -1 : 1
    const digits = tz.slice(1).replace(':', '')
    offsetMin = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || 0))
  }
  const ms = Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +se) - offsetMin * 60_000
  const iso = new Date(ms).toISOString()
  const micro = (frac.slice(1) + '000000').slice(0, 6)
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}.${micro}`
}

/** "2026-01-02 02:04:05.123400" → "2026-01-02T02:04:05.1234+00:00" (formato do PostgREST) */
export function fromMysqlDatetime(v: unknown): string | null {
  if (v == null) return null
  const s = v instanceof Date ? v.toISOString().replace('T', ' ').replace('Z', '') : String(v)
  const [date, time = '00:00:00'] = s.split(/[ T]/)
  const [hms, rawFrac = ''] = time.split('.')
  const frac = rawFrac.replace(/0+$/, '')
  return `${date}T${hms}${frac ? '.' + frac : ''}+00:00`
}

export function toMysqlDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // timestamps com fuso → data UTC (o Supabase usa a sessão em UTC)
  return toMysqlDatetime(s).slice(0, 10)
}

export function toBool(v: unknown): 0 | 1 {
  if (v === true || v === 1 || v === '1') return 1
  if (v === false || v === 0 || v === '0') return 0
  if (typeof v === 'string') {
    const s = v.toLowerCase()
    if (['t', 'true', 'yes', 'on', 'y'].includes(s)) return 1
    if (['f', 'false', 'no', 'off', 'n'].includes(s)) return 0
  }
  throw new ValueError(`invalid input syntax for type boolean: "${String(v)}"`)
}

/** Valor da aplicação → parâmetro SQL. */
export function toDb(meta: ColumnMeta, v: unknown): unknown {
  if (v === null || v === undefined) return null
  switch (meta.kind) {
    case 'bool': return toBool(v)
    case 'json': case 'array': return JSON.stringify(v)
    case 'datetime': return toMysqlDatetime(v)
    case 'date': return toMysqlDate(v)
    case 'decimal': case 'float': case 'int': case 'bigint': {
      if (typeof v === 'number' || typeof v === 'bigint') return String(v)
      const s = String(v).trim()
      if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) throw new ValueError(`invalid input syntax for type numeric: "${s}"`)
      return s
    }
    case 'enum': {
      const s = String(v)
      if (meta.values && !meta.values.includes(s)) throw new ValueError(`invalid input value for enum: "${s}"`)
      return s
    }
    case 'uuid': {
      const s = String(v)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw new ValueError(`invalid input syntax for type uuid: "${s}"`)
      return s.toLowerCase()
    }
    default:
      return typeof v === 'object' ? JSON.stringify(v) : String(v)
  }
}

/** Valor lido do MySQL → valor da aplicação (como o PostgREST devolvia). */
export function fromDb(meta: ColumnMeta, v: unknown): unknown {
  if (v === null || v === undefined) return null
  switch (meta.kind) {
    case 'bool': return Number(v) === 1
    case 'json': case 'array': {
      if (typeof v === 'string') { try { return JSON.parse(v) } catch { return v } }
      if (Buffer.isBuffer(v)) return JSON.parse(v.toString('utf8'))
      return v
    }
    case 'datetime': return fromMysqlDatetime(v)
    case 'date': return String(v).slice(0, 10)
    case 'decimal': case 'float': case 'int': case 'bigint': return Number(v)
    default: return Buffer.isBuffer(v) ? v.toString('utf8') : v
  }
}
