// Conversão de valores entre o formato JSON da API (igual ao do PostgREST) e o MariaDB.
import type { ColumnMeta } from './types'

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/** Date/ISO → 'YYYY-MM-DD HH:MM:SS.ffffff' em UTC (formato DATETIME(6)). */
export function toDbDatetime(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'string') {
    // já em formato MariaDB/sem fuso → assume UTC
    const plain = v.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?)?$/)
    if (plain) {
      const time = plain[2] ? (plain[2].length === 5 ? plain[2] + ':00' : plain[2]) : '00:00:00'
      const frac = (plain[3] ?? '.').slice(1).padEnd(6, '0').slice(0, 6)
      return `${plain[1]} ${time}.${frac}`
    }
    // ISO com fuso: preservar microssegundos quando existirem
    const iso = v.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}(?::?\d{2})?)$/)
    if (iso) {
      const frac = (iso[3] ?? '.').slice(1).padEnd(6, '0').slice(0, 6)
      const d = new Date(`${iso[1]}T${iso[2]}${iso[4].length === 3 ? iso[4] + ':00' : iso[4]}`)
      if (!isNaN(d.getTime())) return `${fmtUtc(d)}.${frac}`
    }
  }
  const d = v instanceof Date ? v : new Date(String(v))
  if (isNaN(d.getTime())) throw Object.assign(new Error(`invalid input syntax for type timestamp: "${String(v)}"`), { pgCode: '22007' })
  return `${fmtUtc(d)}.${pad(d.getUTCMilliseconds(), 3)}000`
}

function fmtUtc(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export function toDbDate(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const dt = toDbDatetime(v)
  return dt ? dt.slice(0, 10) : null
}

/** Converte um array literal PostgreSQL ('{a,"b c"}') num array JS. */
function pgArrayLiteral(s: string): string[] | null {
  const m = s.match(/^\{([\s\S]*)\}$/)
  if (!m) return null
  if (m[1] === '') return []
  return m[1].split(',').map(x => x.trim().replace(/^"(.*)"$/, '$1'))
}

export function toDb(meta: ColumnMeta | undefined, v: unknown): unknown {
  if (v === undefined) return undefined
  if (v === null) return null
  switch (meta?.kind) {
    case 'bool':
      return v === true || v === 'true' || v === 't' || v === 1 || v === '1' ? 1 : 0
    case 'json':
      return JSON.stringify(v)
    case 'array':
      if (typeof v === 'string') return JSON.stringify(pgArrayLiteral(v) ?? [v])
      return JSON.stringify(v)
    case 'timestamp':
      return toDbDatetime(v)
    case 'date':
      return toDbDate(v)
    default:
      if (typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v)
      return v
  }
}

/** 'YYYY-MM-DD HH:MM:SS.ffffff' → '2026-07-01T12:00:00.123+00:00' (como o PostgreSQL). */
export function fromDbDatetime(s: string): string {
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/)
  if (!m) return s
  const frac = (m[3] ?? '').replace(/0+$/, '')
  return `${m[1]}T${m[2]}${frac ? '.' + frac : ''}+00:00`
}

export function fromDb(meta: ColumnMeta | undefined, v: unknown): unknown {
  if (v == null) return null
  switch (meta?.kind) {
    case 'bool': return v === 1 || v === true || v === '1'
    case 'json':
    case 'array':
      if (typeof v === 'string') { try { return JSON.parse(v) } catch { return v } }
      return v
    case 'timestamp': return typeof v === 'string' ? fromDbDatetime(v) : v
    case 'int':
    case 'number': return typeof v === 'string' && v !== '' && !isNaN(Number(v)) ? Number(v) : v
    default: return v
  }
}
