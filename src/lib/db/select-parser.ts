// Analisador da sintaxe de select do PostgREST:
//   '*, profiles(full_name, email), plan:plans(name), ticket_messages(count)'

export interface SelectColumn { name: string; alias: string }
export interface SelectEmbed {
  alias: string
  relation: string
  hint?: string
  inner?: boolean
  tree: SelectTree
}
export interface SelectTree {
  star: boolean
  columns: SelectColumn[]
  embeds: SelectEmbed[]
  /** `rel(count)` */
  countOnly: boolean
}

function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (depth === 0 && ch === ',') { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (depth !== 0) throw new Error(`Select inválido: ${s}`)
  out.push(cur)
  return out.map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

export function parseSelect(input: string | undefined): SelectTree {
  const tree: SelectTree = { star: false, columns: [], embeds: [], countOnly: false }
  const src = (input ?? '*').trim() || '*'
  for (const part of splitTop(src)) {
    const embed = part.match(/^(?:([\w]+)\s*:\s*)?([\w]+)((?:![\w]+)*)\s*\(([\s\S]*)\)$/)
    if (embed) {
      const [, alias, relation, modifiers, inner] = embed
      const mods = modifiers.split('!').filter(Boolean)
      tree.embeds.push({
        alias: alias ?? relation,
        relation,
        hint: mods.find(m => m !== 'inner' && m !== 'left'),
        inner: mods.includes('inner'),
        tree: parseSelect(inner),
      })
      continue
    }
    if (part === '*') { tree.star = true; continue }
    const col = part.match(/^(?:([\w]+)\s*:\s*)?([\w]+)(?:::[\w]+)?$/)
    if (!col) throw new Error(`Coluna de select não suportada: ${part}`)
    const [, alias, name] = col
    if (name === 'count' && !alias && src.trim() === 'count') { tree.countOnly = true; continue }
    tree.columns.push({ name, alias: alias ?? name })
  }
  return tree
}
