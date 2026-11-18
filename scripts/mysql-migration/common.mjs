/* Funções partilhadas pelos scripts de migração (schema, conversão e normalização de valores). */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const SCHEMA = JSON.parse(readFileSync(join(HERE, 'schema.json'), 'utf8'))
export const PG_SCHEMA = 'viralizahost'

/* ─── Normalização de valores ─────────────────────────────────────────── */
/** "2026-01-02 03:04:05.123456+01" → "2026-01-02 02:04:05.123456" (UTC, microssegundos preservados) */
export function pgTsToUtc(s) {
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?([+-]\d{2})(?::?(\d{2}))?(?::?(\d{2}))?$/)
  if (!m) {
    const n = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/) // sem fuso (timestamp)
    if (!n) throw new Error(`Data inválida: ${s}`)
    return `${n[1]} ${n[2]}${(n[3] ?? '.0').padEnd(7, '0').slice(0, 7)}`
  }
  const [, d, hh, mm, ss, frac = '.0', oh, om = '00', os = '00'] = m
  const sign = oh.startsWith('-') ? -1 : 1
  const offsetSec = sign * (Math.abs(Number(oh)) * 3600 + Number(om) * 60 + Number(os))
  const base = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), +hh, +mm, +ss) - offsetSec * 1000
  const iso = new Date(base).toISOString() // YYYY-MM-DDTHH:MM:SS.000Z
  if (+d.slice(0, 4) < 1000) throw new Error(`Ano fora do intervalo suportado: ${s}`)
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}${frac.padEnd(7, '0').slice(0, 7)}`
}

/** Converte um valor lido do PostgreSQL para o formato de escrita no MySQL. */
export function toMysql(kind, v) {
  if (v === null || v === undefined) return null
  switch (kind) {
    case 'bool': return v ? 1 : 0
    case 'json': return JSON.stringify(v)
    case 'array': return JSON.stringify(v)
    case 'datetime': return pgTsToUtc(v)
    default: return v
  }
}

/** Representação canónica para comparar origem e destino. */
export function canon(kind, v, scale) {
  if (v === null || v === undefined) return null
  switch (kind) {
    case 'bool': return v === true || v === 1 || v === '1' || v === 't'
    case 'json': case 'array': return stableJson(typeof v === 'string' ? JSON.parse(v) : v)
    case 'datetime': return /[+-]\d{2}(:?\d{2})?$/.test(v) ? pgTsToUtc(v) : `${v.replace('T', ' ')}`.padEnd(26, '0').slice(0, 26)
    case 'decimal': return normDecimal(String(v), scale)
    case 'int': case 'bigint': return String(v)
    case 'float': return Number(v)
    case 'date': return String(v).slice(0, 10)
    default: return String(v)
  }
}
export function normDecimal(s, scale) {
  if (!/^-?\d+(\.\d+)?$/.test(s)) return s
  if (scale == null) return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  const [i, f = ''] = s.split('.')
  return `${i}.${f.padEnd(scale, '0').slice(0, scale)}`.replace(/\.$/, '')
}
export function stableJson(v) {
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']'
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}'
  return JSON.stringify(v)
}

export const qi = s => '`' + s.replace(/`/g, '``') + '`'
export const pqi = s => '"' + s.replace(/"/g, '""') + '"'
export const writableCols = t => Object.entries(SCHEMA[t].columns).filter(([, c]) => !c.generated).map(([n]) => n)


/** Soma exata de valores decimais em texto (sem arredondamentos de vírgula flutuante). */
export function sumDecimals(values, scale) {
  const sc = scale ?? Math.max(0, ...values.map(v => (String(v).split('.')[1] ?? '').length))
  let total = 0n
  for (const v of values) {
    if (v === null || v === undefined) continue
    const s = String(v); const neg = s.startsWith('-')
    const [i, f = ''] = s.replace(/^[-+]/, '').split('.')
    const n = BigInt(i + f.padEnd(sc, '0').slice(0, sc))
    total += neg ? -n : n
  }
  const neg = total < 0n; const digits = (neg ? -total : total).toString().padStart(sc + 1, '0')
  return (neg ? '-' : '') + (sc ? digits.slice(0, -sc) + '.' + digits.slice(-sc) : digits)
}

/** Hash canónico de uma linha (para comparar origem e destino). ignore = colunas a não comparar. */
export function hashRow(meta, cols, r, ignore = []) {
  const h = createHash('sha256')
  for (const c of cols) if (!ignore.includes(c)) h.update(c + '=' + JSON.stringify(canon(meta.columns[c].kind, r[c], meta.columns[c].scale)) + ';')
  return h.digest('hex')
}
