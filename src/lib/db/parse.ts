// Parsers da gramática PostgREST usada pelo código existente:
//   select: "*, profiles(full_name, email), plan:plans!fk(name), ticket_messages(count)"
//   or():   "email.ilike.%x%,full_name.ilike.%x%,and(a.eq.1,b.is.null)"

export type SelectNode =
  | { type: 'star' }
  | { type: 'count'; alias?: string }
  | { type: 'col'; name: string; alias?: string; jsonPath?: { path: string[]; asText: boolean } }
  | { type: 'embed'; name: string; alias?: string; hint?: string; inner?: boolean; children: SelectNode[] }

function splitTopLevel(s: string, sep = ','): string[] {
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
  if (cur.trim() !== '') out.push(cur)
  return out
}

function parseColRef(raw: string): { name: string; jsonPath?: { path: string[]; asText: boolean } } {
  const name = raw.replace(/::[a-z0-9_ ]+$/i, '') // ignora casts ::text
  const m = name.split(/(->>|->)/)
  if (m.length === 1) return { name: name.trim() }
  const base = m[0].trim()
  const path: string[] = []
  let asText = false
  for (let i = 1; i < m.length; i += 2) { path.push(m[i + 1].trim().replace(/^'|'$/g, '')); asText = m[i] === '->>' }
  return { name: base, jsonPath: { path, asText } }
}

export function parseSelect(select: string | undefined): SelectNode[] {
  const s = (select ?? '*').replace(/\s+/g, ' ').trim() || '*'
  return splitTopLevel(s).map((part) => parseItem(part.trim())).filter(Boolean) as SelectNode[]
}

function parseItem(item: string): SelectNode | null {
  if (!item) return null
  if (item === '*') return { type: 'star' }
  const paren = item.indexOf('(')
  // alias:  "alias:resto" (o ':' tem de vir antes de '(' e não pode ser '::')
  let alias: string | undefined
  let rest = item
  const colon = item.search(/(?<!:):(?!:)/)
  if (colon > 0 && (paren < 0 || colon < paren)) { alias = item.slice(0, colon).trim(); rest = item.slice(colon + 1).trim() }

  if (rest === 'count' || rest === 'count()') return { type: 'count', alias }
  const p = rest.indexOf('(')
  if (p > 0 && rest.endsWith(')')) {
    const head = rest.slice(0, p).trim()
    const inner = rest.slice(p + 1, -1)
    const [name, ...hints] = head.split('!').map((x) => x.trim())
    let hint: string | undefined
    let isInner = false
    for (const h of hints) {
      if (h === 'inner') isInner = true
      else if (h === 'left') { /* padrão */ }
      else hint = h
    }
    return { type: 'embed', name, alias, hint, inner: isInner, children: parseSelect(inner) }
  }
  const { name, jsonPath } = parseColRef(rest)
  return { type: 'col', name, alias: alias ?? (jsonPath ? jsonPath.path[jsonPath.path.length - 1] : undefined), jsonPath }
}

// ── filtros em texto (or / filter / not) ───────────────────────────────────
export type ParsedCond =
  | { kind: 'cond'; column: string; op: string; value: string; negate: boolean }
  | { kind: 'group'; logic: 'and' | 'or'; negate: boolean; items: ParsedCond[] }

export function parseLogicTree(expr: string, logic: 'and' | 'or' = 'or', negate = false): ParsedCond {
  return { kind: 'group', logic, negate, items: splitTopLevel(expr).map((p) => parseCond(p.trim())) }
}

function parseCond(s: string): ParsedCond {
  let negate = false
  let rest = s
  if (rest.startsWith('not.')) { negate = true; rest = rest.slice(4) }
  const g = rest.match(/^(and|or)\(([\s\S]*)\)$/)
  if (g) return parseLogicTree(g[2], g[1] as 'and' | 'or', negate)
  // coluna.operador.valor (a coluna pode ter -> e o valor pode ter pontos)
  const m = rest.match(/^([^.]+(?:->>?[^.]+)*)\.(not\.)?([a-z]+)\.([\s\S]*)$/)
  if (!m) throw new Error(`Filtro inválido: ${s}`)
  return { kind: 'cond', column: m[1], op: m[3], value: m[4], negate: negate !== Boolean(m[2]) }
}

/** "(a,b,"c,d")" → ['a','b','c,d'] */
export function parseInList(v: string): string[] {
  const inner = v.trim().replace(/^\(/, '').replace(/\)$/, '')
  if (inner === '') return []
  return splitTopLevel(inner).map((x) => x.trim().replace(/^"([\s\S]*)"$/, '$1'))
}
