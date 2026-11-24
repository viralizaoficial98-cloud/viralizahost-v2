// Servidor VPS — partilhado pelo painel, pela página pública e pelo servidor (sem dependências de servidor).

/** Ciclos que um plano VPS pode publicar (os mesmos do catálogo). */
export const VPS_CYCLES = [
  { cycle: 'monthly', months: 1, label: '1 mês' },
  { cycle: '3months', months: 3, label: '3 meses' },
  { cycle: '6months', months: 6, label: '6 meses' },
  { cycle: '1year', months: 12, label: '1 ano' },
  { cycle: '2years', months: 24, label: '2 anos' },
  { cycle: '3years', months: 36, label: '3 anos' },
] as const
export type VpsCycle = (typeof VPS_CYCLES)[number]['cycle']

/** Lista CONTROLADA de ícones para as características extras (o painel só oferece estes). */
export const VPS_FEATURE_ICONS = {
  check: 'Visto', shield: 'Segurança', backup: 'Cópias de segurança', globe: 'IP / rede', lock: 'Firewall / acesso',
  terminal: 'Acesso root / SSH', zap: 'Desempenho', headphones: 'Suporte', panel: 'Painel de controlo', cloud: 'Snapshots / cloud',
  refresh: 'Migração / reinstalação', bot: 'IA / automação', database: 'Base de dados', mail: 'E-mail',
} as const
export type VpsIcon = keyof typeof VPS_FEATURE_ICONS
export const isVpsIcon = (v: unknown): v is VpsIcon => typeof v === 'string' && v in VPS_FEATURE_ICONS

export type VpsTraffic = { unlimited: true } | { value: number; unit: 'GB' | 'TB' }
export interface VpsSpecs {
  vcpu?: number | null
  ramGb?: number | null
  diskGb?: number | null
  diskType?: 'NVMe' | 'SSD' | null
  traffic?: VpsTraffic | null
  network?: { value: number; unit: 'Mbps' | 'Gbps' } | null
}
export interface VpsFeature { text: string; icon: VpsIcon | null }

const n = (v: number) => v.toLocaleString('pt-PT').replace(/\s/g, ' ')
/** Rótulos visíveis das especificações (vazias omitidas). */
export function vpsSpecLines(s: VpsSpecs): { key: 'vcpu' | 'ram' | 'disk' | 'traffic' | 'network'; label: string; value: string }[] {
  const out: { key: 'vcpu' | 'ram' | 'disk' | 'traffic' | 'network'; label: string; value: string }[] = []
  if (s.vcpu) out.push({ key: 'vcpu', label: 'vCPU', value: `${n(s.vcpu)} ${s.vcpu === 1 ? 'núcleo' : 'núcleos'}` })
  if (s.ramGb) out.push({ key: 'ram', label: 'RAM', value: `${n(s.ramGb)} GB` })
  if (s.diskGb) out.push({ key: 'disk', label: 'Armazenamento', value: `${n(s.diskGb)} GB${s.diskType ? ` ${s.diskType}` : ''}` })
  if (s.traffic) out.push({ key: 'traffic', label: 'Tráfego', value: 'unlimited' in s.traffic ? 'Ilimitado' : `${n(s.traffic.value)} ${s.traffic.unit}/mês` })
  if (s.network) out.push({ key: 'network', label: 'Rede', value: `${n(s.network.value)} ${s.network.unit}` })
  return out
}

/** Especificações do produto do fornecedor que têm de coincidir com as anunciadas. */
export interface ProviderSpecs { vcpu?: number | null; ramGb?: number | null; diskGb?: number | null; trafficGb?: number | null; trafficUnlimited?: boolean | null }
/** Diferenças entre o anunciado e o produto do fornecedor (vazio = coincidem). */
export function specMismatches(s: VpsSpecs, p: ProviderSpecs | null | undefined): string[] {
  if (!p) return []
  const out: string[] = []
  if (p.vcpu != null && s.vcpu != null && Number(s.vcpu) !== Number(p.vcpu)) out.push(`vCPU anunciado ${s.vcpu} ≠ produto ${p.vcpu}`)
  if (p.ramGb != null && s.ramGb != null && Number(s.ramGb) !== Number(p.ramGb)) out.push(`RAM anunciada ${s.ramGb} GB ≠ produto ${p.ramGb} GB`)
  if (p.diskGb != null && s.diskGb != null && Number(s.diskGb) !== Number(p.diskGb)) out.push(`armazenamento anunciado ${s.diskGb} GB ≠ produto ${p.diskGb} GB`)
  if (s.traffic && 'unlimited' in s.traffic && p.trafficUnlimited === false) out.push('tráfego anunciado «ilimitado» mas o produto tem limite')
  if (s.traffic && 'value' in s.traffic && p.trafficGb != null) {
    const gb = s.traffic.unit === 'TB' ? s.traffic.value * 1024 : s.traffic.value
    if (Math.abs(gb - Number(p.trafficGb)) > 0.5) out.push(`tráfego anunciado ${s.traffic.value} ${s.traffic.unit} ≠ produto ${p.trafficGb >= 1024 ? `${p.trafficGb / 1024} TB` : `${p.trafficGb} GB`}`)
  }
  return out
}

/** Opções da encomenda (localização e sistema operativo/imagem). */
export interface VpsOption { id: string; label: string }
export interface VpsOptions { locations: VpsOption[]; images: VpsOption[] }
