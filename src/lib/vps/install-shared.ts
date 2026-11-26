// Opções de instalação do VPS (sistema operativo, painel de controlo, aplicação) — módulo partilhado (cliente e servidor).
//
// A API da Hostinger (OpenAPI 3.7.0, GET /api/vps/v1/templates) só devolve {id, name, description, documentation}:
// NÃO indica categoria, versão, licença, preço nem compatibilidade com planos ou centros de dados. Por isso:
//   • categoria, versão e sistema incluído são deduzidos do nome («Ubuntu 24.04 with cPanel») e podem ser corrigidos
//     pelo administrador em Integrações → Hostinger VPS;
//   • licenças pagas (ex.: cPanel, Plesk) e o seu preço de venda são definidos pelo administrador;
//   • a compatibilidade por localização e por plano (RAM mínima / planos) é configurada pelo administrador.
// Em activação manual, o administrador pode criar opções próprias (source 'manual') que a equipa sabe entregar.

export type InstallCategory = 'os' | 'panel' | 'app'
export const INSTALL_CATEGORIES: { id: InstallCategory; label: string }[] = [
  { id: 'os', label: 'Sistema operativo' }, { id: 'panel', label: 'Painel de controlo' }, { id: 'app', label: 'Aplicações' },
]
/** Grupos do catálogo (organização no painel e no configurador). Deduzidos do nome; o administrador pode corrigir. */
export const INSTALL_GROUPS = [
  { id: 'linux', label: 'Sistemas operativos Linux' }, { id: 'panels', label: 'Painéis de gestão' }, { id: 'automation', label: 'Aplicações de automação' },
  { id: 'ai', label: 'Inteligência artificial' }, { id: 'business', label: 'Aplicações empresariais' }, { id: 'databases', label: 'Bases de dados' },
  { id: 'dev', label: 'Desenvolvimento' }, { id: 'containers', label: 'Containers' }, { id: 'other', label: 'Outros' },
] as const
export type InstallGroup = (typeof INSTALL_GROUPS)[number]['id']
export const isInstallGroup = (v: unknown): v is InstallGroup => INSTALL_GROUPS.some(g => g.id === v)
const GROUP_WORDS: [InstallGroup, string[]][] = [
  ['ai', ['ollama', 'openwebui', 'llama', 'deepseek', 'anythingllm', 'flowise', 'langflow', 'dify', 'comfyui', 'stablediffusion', 'openclaw', 'agent', 'gpt', ' ai']],
  ['automation', ['n8n', 'nodered', 'activepieces', 'windmill', 'huginn', 'evolution', 'typebot', 'chatwoot', 'botpress']],
  ['containers', ['docker', 'portainer', 'kubernetes', 'k3s', 'podman', 'coolify', 'dokploy', 'easypanel', 'caprover']],
  ['databases', ['mysql', 'mariadb', 'postgres', 'mongodb', 'redis', 'clickhouse', 'supabase']],
  ['business', ['odoo', 'erpnext', 'nextcloud', 'mautic', 'wordpress', 'woocommerce', 'prestashop', 'magento', 'moodle', 'suitecrm', 'dolibarr', 'mattermost', 'rocketchat']],
  ['dev', ['nodejs', 'node.js', 'python', 'django', 'laravel', 'gitlab', 'gitea', 'jenkins', 'lamp', 'lemp', 'openlitespeed', 'ruby', 'golang', 'java']],
]
export function templateGroup(label: string, category?: InstallCategory): InstallGroup {
  const k = ` ${String(label ?? '').toLowerCase()}`
  const extra = (k.match(/\s(?:with|com|\+)\s(.+)$/) ?? [])[1] ?? (category === 'os' ? '' : k)
  for (const [g, words] of GROUP_WORDS) if (words.some(w => extra.replace(/[^a-z0-9. ]/g, '').includes(w.trim()) || (w.startsWith(' ') && extra.includes(w.trim())))) return g
  if (category === 'panel' || PANELS.some(p => extra.replace(/[^a-z0-9]/g, '').startsWith(p))) return 'panels'
  if (/windows|freebsd/.test(k)) return 'other'
  if ((category ?? 'os') === 'os' && OS.some(o => k.replace(/[^a-z0-9]/g, '').startsWith(o))) return 'linux'
  return 'other'
}
export interface InstallLicense { type: 'included' | 'paid'; monthlyKz?: number | null; note?: string | null }

/** Opção como o administrador a guarda (vps_provider_settings.options.images). */
export interface InstallOptionRow {
  id: string; label: string; enabled: boolean; detail?: string | null
  source?: 'api' | 'manual'
  category?: InstallCategory; name?: string; version?: string | null; icon?: string | null
  /** Painel/aplicação: sistema operativo incluído na imagem (uma única escolha). */
  includedOs?: string | null
  license?: InstallLicense
  /** Ids de localização onde a imagem pode ser instalada (vazio = todas). */
  locations?: string[]
  /** RAM mínima do plano (GB) e/ou lista de planos permitidos (slugs; vazio = todos). */
  minRamGb?: number | null; plans?: string[]
  /** Endereço de acesso ao painel/aplicação, com {ip} (ex.: https://{ip}:8090). */
  accessUrl?: string | null
  /** Utilizador SSH (por omissão root). */
  sshUser?: string | null
  /** Grupo do catálogo (Cloud VPS → Sistemas operativos e aplicações). */
  group?: InstallGroup | null
}
/** Opção publicada para o cliente. */
export interface InstallOption {
  id: string; label: string; category: InstallCategory; group?: InstallGroup; name: string; version: string | null; icon: string
  includedOs: string | null; license: { type: 'included' | 'paid'; monthlyKz: number }
  locations: string[]; description: string | null
}
export interface PublicVpsOptions {
  locations: { id: string; label: string; /** ISO alfa-2 minúsculo do país do centro, ou null */ country?: string | null }[]
  images: InstallOption[]
  /** «Escolher mais tarde» permitido (activação suporta escolher depois do pagamento). */
  allowChooseLater: boolean
}

const PANELS = ['cpanel', 'plesk', 'cyberpanel', 'cloudpanel', 'aapanel', 'webmin', 'virtualmin', 'hestiacp', 'hestia', 'fastpanel', 'directadmin', 'ispconfig', 'coolify', 'easypanel', 'dokploy', 'cloudron', 'runcloud']
const PAID = ['cpanel', 'plesk', 'directadmin']
const OS = ['ubuntu', 'debian', 'almalinux', 'rocky', 'centos', 'alpine', 'arch', 'cloudlinux', 'fedora', 'opensuse', 'kali', 'windows', 'freebsd']

/** Classificação a partir do nome do template da Hostinger (só heurística; o administrador pode corrigir). */
export function classifyTemplate(name: string): Pick<InstallOptionRow, 'category' | 'name' | 'version' | 'includedOs' | 'icon' | 'license'> {
  const n = String(name ?? '').trim()
  const m = n.match(/^(.*?)\s+(?:with|com|\+)\s+(.+)$/i)
  if (m) {
    const os = m[1].trim(), extra = m[2].trim()
    const key = extra.toLowerCase().replace(/[^a-z0-9]/g, '')
    const panel = PANELS.some(p => key.startsWith(p))
    const vm = extra.match(/^(.*?)\s+v?(\d[\w.]*)$/)
    return {
      category: panel ? 'panel' : 'app', name: vm ? vm[1] : extra, version: vm ? vm[2] : null, includedOs: os,
      icon: iconKey(extra), license: PAID.some(p => key.startsWith(p)) ? { type: 'paid', monthlyKz: null } : { type: 'included' },
    }
  }
  const vm = n.match(/^(.*?)\s+v?(\d[\w.]*(?:\s*LTS)?)$/i)
  return { category: 'os', name: vm ? vm[1] : n, version: vm ? vm[2] : null, includedOs: null, icon: iconKey(n), license: { type: 'included' } }
}
export function iconKey(name: string) {
  const k = String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return [...PANELS, ...OS, 'docker', 'n8n', 'wordpress', 'nodejs', 'odoo', 'openlitespeed', 'ollama', 'nextcloud', 'gitlab', 'mautic', 'minecraft']
    .find(p => k.startsWith(p) || k.includes(p)) ?? 'generic'
}

/** Normaliza uma linha guardada (linhas antigas só tinham {id,label,enabled,detail}). */
export function normalizeRow(r: InstallOptionRow): Required<Omit<InstallOptionRow, 'detail'>> & { detail: string | null } {
  const guess = classifyTemplate(r.label)
  const lic = r.license ?? guess.license ?? { type: 'included' }
  return {
    id: String(r.id), label: r.label, enabled: !!r.enabled, detail: r.detail ?? null, source: r.source ?? 'api',
    category: r.category ?? guess.category ?? 'os', name: r.name ?? guess.name ?? r.label, version: r.version !== undefined ? r.version : guess.version ?? null,
    icon: r.icon ?? guess.icon ?? 'generic', includedOs: r.includedOs !== undefined ? r.includedOs : guess.includedOs ?? null,
    license: { type: lic.type === 'paid' ? 'paid' : 'included', monthlyKz: lic.type === 'paid' && lic.monthlyKz != null ? Number(lic.monthlyKz) : null, note: lic.note ?? null },
    locations: Array.isArray(r.locations) ? r.locations.map(String) : [], minRamGb: r.minRamGb != null && Number(r.minRamGb) > 0 ? Number(r.minRamGb) : null,
    plans: Array.isArray(r.plans) ? r.plans.map(String) : [], accessUrl: r.accessUrl ?? null, sshUser: r.sshUser || 'root',
    group: isInstallGroup(r.group) ? r.group : templateGroup(r.label, r.category ?? guess.category ?? 'os'),
  }
}
/** Uma licença paga sem preço definido não pode ser vendida. */
export const sellable = (r: ReturnType<typeof normalizeRow>) => r.enabled && (r.license.type === 'included' || (r.license.monthlyKz ?? 0) > 0)

/** Compatível com o plano (slug e RAM do plano)? */
export function fitsPlan(r: { plans?: string[]; minRamGb?: number | null }, plan: { slug: string; ramGb?: number | null }) {
  if (r.plans?.length && !r.plans.includes(plan.slug)) return false
  if (r.minRamGb && plan.ramGb != null && plan.ramGb < r.minRamGb) return false
  return true
}
export const fitsLocation = (img: { locations?: string[] }, locationId?: string | null) => !img.locations?.length || !locationId || img.locations.includes(String(locationId))

/** Preço da licença para um período (Kz): mensal × meses × quantidade. */
export const licenseTotal = (img: { license: { type: string; monthlyKz?: number | null } } | null | undefined, months: number, qty = 1) =>
  img && img.license.type === 'paid' ? Math.round(Number(img.license.monthlyKz ?? 0) * months * qty * 100) / 100 : 0

/** Endereço de acesso ao painel/aplicação (só com IP). */
export const accessUrlFor = (tpl: string | null | undefined, ip: string | null | undefined) =>
  tpl && ip && /^https?:\/\//.test(tpl) ? tpl.replace(/\{ip\}/g, ip) : null

/* ───────────── Estado mostrado ao cliente ───────────── */

export type VpsClientState = 'awaiting_payment' | 'payment_review' | 'preparing' | 'ready' | 'intervention'
export const VPS_CLIENT_STATE: Record<VpsClientState, { label: string; tone: 'gray' | 'amber' | 'blue' | 'green' | 'red'; help: string }> = {
  awaiting_payment: { label: 'A aguardar pagamento', tone: 'gray', help: 'Conclua o pagamento para iniciarmos a preparação do VPS.' },
  payment_review: { label: 'Pagamento em validação', tone: 'amber', help: 'Recebemos o comprovativo. A equipa está a validar o pagamento.' },
  preparing: { label: 'A preparar o VPS', tone: 'blue', help: 'O servidor está a ser criado e a instalação escolhida está em curso.' },
  ready: { label: 'Pronto a utilizar', tone: 'green', help: 'O VPS está activo e a instalação concluída.' },
  intervention: { label: 'Necessita de intervenção', tone: 'red', help: 'A activação precisa de uma acção (sua ou da equipa).' },
}

/** Deriva o estado do cliente a partir da encomenda e do serviço (sem expor detalhes internos). */
export function vpsClientState(x: { payment_status?: string | null; service_status?: string | null; provisioning_status?: string | null; provisioning_error?: string | null; awaiting_choice?: boolean }): VpsClientState {
  if (x.service_status === 'active' && x.provisioning_status === 'active') return 'ready'
  if (x.payment_status === 'proof_submitted') return 'payment_review'
  if (x.payment_status !== 'paid') return 'awaiting_payment'
  if (x.awaiting_choice) return 'intervention'
  if (x.provisioning_status === 'failed') return 'intervention'
  // Activação manual planeada («Tarefa da equipa…»): o cliente não precisa de agir. Resultado por confirmar,
  // VM com problema ou configuração falhada: intervenção (da equipa; o cliente pode pedir suporte).
  if (x.provisioning_status === 'manual_required') return /^Tarefa da equipa/.test(x.provisioning_error ?? '') ? 'preparing' : 'intervention'
  return 'preparing'
}
/** Mensagem de «escolher mais tarde» (serviço pago à espera da escolha do cliente). */
export const AWAITING_CHOICE_MSG = 'A aguardar a escolha da instalação pelo cliente (Os meus VPS).'

/** Texto das escolhas de um VPS (carrinho, checkout, encomenda). */
export function describeVpsOptions(o: { location?: { label: string } | null; image?: { label: string; name?: string; version?: string | null; category?: string; includedOs?: string | null; license?: { type: string; monthlyKz?: number; total?: number } } | null; later?: boolean } | null | undefined, fmt: (n: number) => string = n => `${n} Kz`): string | null {
  if (!o) return null
  const img = o.image
  const what = img ? `${img.category === 'panel' ? 'Painel' : img.category === 'app' ? 'Aplicação' : 'Sistema'}: ${img.name ? `${img.name}${img.version ? ` ${img.version}` : ''}` : img.label}${img.includedOs ? ` (inclui ${img.includedOs})` : ''}` : null
  const lic = img?.license?.type === 'paid' ? `licença ${fmt(img.license.monthlyKz ?? 0)}/mês${img.license.total ? ` (${fmt(img.license.total)} no período)` : ''}` : null
  const parts = [o.location ? `Localização: ${o.location.label}` : null, what, lic, o.later ? 'Instalação: escolher depois do pagamento' : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
