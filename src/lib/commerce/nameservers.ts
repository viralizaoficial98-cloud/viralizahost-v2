// Nameservers de um domínio: validação partilhada pelo navegador e pelo servidor.
// O servidor volta sempre a validar (configuração, carrinho e encomenda).

export interface NameserverChoice { useDefault: boolean; ns: string[] }

export const FALLBACK_NAMESERVERS = ['ns1.viralizahost.com', 'ns2.viralizahost.com']
export const MIN_NAMESERVERS = 2
export const MAX_NAMESERVERS = 4

const HOST_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/

export const normalizeHost = (raw: unknown) => String(raw ?? '').trim().toLowerCase().replace(/\.$/, '')

export type NameserverResult =
  | { ok: true; value: NameserverChoice }
  | { ok: false; message: string; field?: number }

/**
 * Valida a escolha de nameservers para `domain`.
 * - padrão: não leva lista (o servidor usa os nameservers configurados na plataforma);
 * - próprios: 2 a 4 nomes de anfitrião válidos, sem repetidos e fora do próprio domínio
 *   (nameservers dentro do domínio exigem registos «glue» tratados pela equipa).
 */
export function validateNameservers(input: unknown, domain?: string): NameserverResult {
  const c = (input ?? {}) as { useDefault?: unknown; ns?: unknown }
  if (c.useDefault !== false) return { ok: true, value: { useDefault: true, ns: [] } }
  const list = (Array.isArray(c.ns) ? c.ns : []).slice(0, 8).map(normalizeHost)
  const filled = list.filter(Boolean)
  if (filled.length < MIN_NAMESERVERS) return { ok: false, message: `Indique pelo menos ${MIN_NAMESERVERS} nameservers.`, field: list.findIndex(x => !x) }
  if (filled.length > MAX_NAMESERVERS) return { ok: false, message: `Indique no máximo ${MAX_NAMESERVERS} nameservers.` }
  for (const [i, ns] of list.entries()) {
    if (!ns) continue
    if (!HOST_RE.test(ns)) return { ok: false, message: `«${ns}» não é um nameserver válido (exemplo: ns1.fornecedor.com).`, field: i }
    if (domain && (ns === domain || ns.endsWith(`.${domain}`))) {
      return { ok: false, message: `«${ns}» pertence ao próprio domínio e precisa de registos glue. Use nameservers de outro domínio ou contacte o suporte.`, field: i }
    }
  }
  if (new Set(filled).size !== filled.length) return { ok: false, message: 'Há nameservers repetidos.' }
  return { ok: true, value: { useDefault: false, ns: filled } }
}
