/*
 * Analisadores da sintaxe PostgREST usada pelo código existente:
 *   - lista de colunas do select():  "*, plan:plans(name, type), hosting_accounts(id), ticket_messages(count)"
 *   - expressões lógicas do or():     "email.ilike.%x%,and(status.eq.open,id.eq.1)"
 *   - listas de valores:               "(a,b,\"c,d\")"
 */
import type { FilterOp } from './types'

export type SelectItem =
  | { type: 'star' }
  | { type: 'column'; name: string; alias: string }
  | { type: 'count'; alias: string }
  | { type: 'embed'; alias: string; table: string; hint?: string; inner: boolean; items: SelectItem[] }

export class ParseError extends Error {
  code = 'PGRST100'
}

/** Divide por vírgulas de nível superior, respeitando parênteses e aspas. */
export function splitTopLevel(s: string, sep = ','): string[] {
  const out: string[] = []
  let depth = 0, quote = false, cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"' && s[i - 1] !== '\\') quote = !quote
    if (!quote) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue }
    }
    cur += ch
  }
  if (depth !== 0 || quote) throw new ParseError(`"failed to parse" ${s}`)
  out.push(cur)
  return out.map(x => x.trim()).filter(x => x.length > 0)
}

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export function parseSelect(spec: string | undefined): SelectItem[] {
  const s = (spec ?? '*').replace(/\s+/g, ' ').trim()
  if (!s) return [{ type: 'star' }]
  return splitTopLevel(s).map(parseItem)
}

function parseItem(raw: string): SelectItem {
  const item = raw.trim()
  if (item === '*') return { type: 'star' }
  const paren = item.indexOf('(')
  if (paren >= 0) {
    if (!item.endsWith(')')) throw new ParseError(`"failed to parse select parameter" (${item})`)
    let head = item.slice(0, paren).trim()
    const inside = item.slice(paren + 1, -1)
    let alias: string | undefined
    if (head.includes(':')) [alias, head] = head.split(':').map(x => x.trim())
    let hint: string | undefined; let inner = false
    const parts = head.split('!')
    const table = parts[0].trim()
    for (const p of parts.slice(1)) { if (p === 'inner') inner = true; else if (p === 'left') inner = false; else hint = p }
    if (!IDENT.test(table) || (alias && !IDENT.test(alias))) throw new ParseError(`"failed to parse select parameter" (${item})`)
    if (table === 'count' && inside.trim() === '') return { type: 'count', alias: alias ?? 'count' }
    const items = inside.trim() === '' ? [{ type: 'star' } as SelectItem] : splitTopLevel(inside).map(parseItem)
    return { type: 'embed', alias: alias ?? table, table, hint, inner, items }
  }
  let name = item, alias: string | undefined
  if (name.includes(':') && !name.includes('::')) [alias, name] = name.split(':').map(x => x.trim())
  name = name.replace(/::\w+$/, '').trim() // casts são ignorados
  if (name === 'count') return { type: 'count', alias: alias ?? 'count' }
  if (!IDENT.test(name) || (alias && !IDENT.test(alias))) throw new ParseError(`"failed to parse select parameter" (${item})`)
  return { type: 'column', name, alias: alias ?? name }
}

/* ─── or() ──────────────────────────────────────────────────────────────── */
export type LogicNode =
  | { type: 'and' | 'or'; negate: boolean; children: LogicNode[] }
  | { type: 'cond'; col: string; op: FilterOp; value: unknown; negate: boolean }

const OPS: Record<string, FilterOp> = { eq: 'eq', neq: 'neq', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', like: 'like', ilike: 'ilike', in: 'in', is: 'is', cs: 'cs', cd: 'cd' }

export function parseLogic(expr: string, type: 'and' | 'or' = 'or', negate = false): LogicNode {
  return { type, negate, children: splitTopLevel(expr).map(parseLogicItem) }
}

function parseLogicItem(raw: string): LogicNode {
  let s = raw.trim()
  let negate = false
  if (s.startsWith('not.')) { negate = true; s = s.slice(4) }
  const group = s.match(/^(and|or)\(([\s\S]*)\)$/)
  if (group) return parseLogic(group[2], group[1] as 'and' | 'or', negate)
  const dot1 = s.indexOf('.')
  if (dot1 < 0) throw new ParseError(`"failed to parse logic tree" (${raw})`)
  const col = s.slice(0, dot1)
  let rest = s.slice(dot1 + 1)
  if (rest.startsWith('not.')) { negate = !negate; rest = rest.slice(4) }
  const dot2 = rest.indexOf('.')
  if (dot2 < 0) throw new ParseError(`"failed to parse logic tree" (${raw})`)
  const opName = rest.slice(0, dot2)
  const op = OPS[opName]
  if (!op || !IDENT.test(col)) throw new ParseError(`"failed to parse logic tree" (${raw})`)
  let value: unknown = rest.slice(dot2 + 1)
  if (op === 'in') value = parseList(String(value))
  else if (op === 'is') value = parseIsValue(value)
  else value = unquote(String(value))
  return { type: 'cond', col, op, value, negate }
}

function unquote(v: string): string {
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"') : v
}

/** "(a,b,\"c,d\")" → ['a','b','c,d'] */
export function parseList(v: string): string[] {
  const s = v.trim().replace(/^\(/, '').replace(/\)$/, '')
  if (!s) return []
  return splitTopLevel(s).map(unquote)
}

export function parseIsValue(v: unknown): null | boolean | 'unknown' {
  if (v === null) return null
  if (typeof v === 'boolean') return v
  const s = String(v).toLowerCase()
  if (s === 'null') return null
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'unknown') return 'unknown'
  throw new ParseError(`"failed to parse filter (is.${String(v)})"`)
}
