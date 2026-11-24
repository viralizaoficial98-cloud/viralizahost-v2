// Servidor VPS — partilhado pelo painel, pela página pública e pelo servidor (sem dependências de servidor).

/** Ciclos que um plano VPS pode publicar (os mesmos do catálogo). */
/** Ciclos à venda para novos VPS. «3 meses» foi retirado: encomendas, facturas e renovações já contratadas mantêm-se. */
export const VPS_CYCLES = [
  { cycle: 'monthly', months: 1, label: '1 mês' },
  { cycle: '6months', months: 6, label: '6 meses' },
  { cycle: '1year', months: 12, label: '1 ano' },
  { cycle: '2years', months: 24, label: '2 anos' },
  { cycle: '3years', months: 36, label: '3 anos' },
] as const
export type VpsCycle = (typeof VPS_CYCLES)[number]['cycle']
/** Ciclos retirados da venda de VPS (servidor recusa-os em novas compras). */
export const VPS_RETIRED_CYCLES: readonly string[] = ['3months']
export const isVpsCycleForSale = (c: unknown) => VPS_CYCLES.some(x => x.cycle === c)

/** Lista CONTROLADA de ícones para as características extras (o painel só oferece estes). */
export const VPS_FEATURE_ICONS = {
  check: 'Visto', shield: 'Segurança', backup: 'Cópias de segurança', globe: 'IP / rede', lock: 'Firewall / acesso',
  terminal: 'Acesso root / SSH', zap: 'Desempenho', headphones: 'Suporte', panel: 'Painel de controlo', cloud: 'Snapshots / cloud',
  refresh: 'Migração / reinstalação', bot: 'IA / automação', database: 'Base de dados', mail: 'E-mail',
} as const
export type VpsIcon = keyof typeof VPS_FEATURE_ICONS
export const isVpsIcon = (v: unknown): v is VpsIcon => typeof v === 'string' && v in VPS_FEATURE_ICONS

/**
 * Unidades do tráfego anunciado. Decimais: GB = 10⁹ B, TB = 1000 GB. Binárias: GiB = 2³⁰ B, TiB = 1024 GiB.
 * As comparações fazem-se sempre em GB decimais (ver trafficToGb).
 */
export const TRAFFIC_UNITS = ['GB', 'TB', 'GiB', 'TiB'] as const
export type TrafficUnit = (typeof TRAFFIC_UNITS)[number]
export const isTrafficUnit = (u: unknown): u is TrafficUnit => typeof u === 'string' && (TRAFFIC_UNITS as readonly string[]).includes(u)
const GB_PER: Record<TrafficUnit, number> = { GB: 1, TB: 1000, GiB: 2 ** 30 / 1e9, TiB: 2 ** 40 / 1e9 }
/** Valor do plano convertido para GB decimais. */
export const trafficToGb = (value: number, unit: TrafficUnit) => value * GB_PER[unit]
export type VpsTraffic = { unlimited: true } | { value: number; unit: TrafficUnit }
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

/** Valor bruto lido do fornecedor, com a unidade de origem (null = não foi possível determinar). */
export interface ProviderRaw { key: string; value: number; unit: string | null }
/**
 * Especificações do produto do fornecedor, já normalizadas: RAM e disco em GB, tráfego em GB DECIMAIS
 * (1 TB = 1000 GB). Um campo com unidade de origem desconhecida fica a null e consta de `unverified`.
 */
export interface ProviderSpecs {
  vcpu?: number | null; ramGb?: number | null; diskGb?: number | null; trafficGb?: number | null; trafficUnlimited?: boolean | null
  unverified?: ('vcpu' | 'ram' | 'disk' | 'traffic')[]
  raw?: Partial<Record<'vcpu' | 'ram' | 'disk' | 'traffic', ProviderRaw>>
}
const fmtNum = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 3 }).replace(/\s/g, ' ')
/** Tráfego em GB decimais com o rótulo adequado (≥ 1000 GB → TB). */
export const formatTrafficGb = (gb: number) => gb >= 1000 ? `${fmtNum(gb / 1000)} TB` : `${fmtNum(gb)} GB`
export const formatRaw = (r: ProviderRaw | undefined) => r ? `${r.key} = ${fmtNum(r.value)}${r.unit ? ` ${r.unit}` : ' (unidade desconhecida)'}` : ''
const SAME = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.5, Math.abs(b) * 0.001)

/**
 * Regra ÚNICA de comparação (painel e servidor). `mismatches`: divergências reais entre o anunciado e o produto;
 * `unverified`: valores do produto cuja unidade não foi possível determinar (não validados).
 */
export function compareSpecs(s: VpsSpecs, p: ProviderSpecs | null | undefined): { mismatches: string[]; unverified: string[] } {
  const mismatches: string[] = [], unverified: string[] = []
  if (!p) return { mismatches, unverified }
  const unv = new Set(p.unverified ?? [])
  if (p.vcpu != null && s.vcpu != null && Number(s.vcpu) !== Number(p.vcpu)) mismatches.push(`vCPU anunciado ${s.vcpu} ≠ produto ${p.vcpu}`)
  if (p.ramGb != null && s.ramGb != null && !SAME(Number(s.ramGb), Number(p.ramGb))) mismatches.push(`RAM anunciada ${fmtNum(Number(s.ramGb))} GB ≠ produto ${fmtNum(Number(p.ramGb))} GB`)
  if (p.diskGb != null && s.diskGb != null && !SAME(Number(s.diskGb), Number(p.diskGb))) mismatches.push(`armazenamento anunciado ${fmtNum(Number(s.diskGb))} GB ≠ produto ${fmtNum(Number(p.diskGb))} GB`)
  if (s.traffic && 'unlimited' in s.traffic && p.trafficUnlimited === false) mismatches.push('tráfego anunciado «ilimitado» mas o produto tem limite')
  if (s.traffic && 'value' in s.traffic && p.trafficGb != null) {
    const gb = trafficToGb(Number(s.traffic.value), s.traffic.unit)
    if (!SAME(gb, Number(p.trafficGb))) {
      const said = `${fmtNum(Number(s.traffic.value))} ${s.traffic.unit}`, norm = formatTrafficGb(gb)
      mismatches.push(`tráfego anunciado ${said}${norm === said ? '' : ` (${norm})`} ≠ produto ${formatTrafficGb(Number(p.trafficGb))}`)
    }
  }
  const label = { vcpu: 'vCPU', ram: 'RAM', disk: 'armazenamento', traffic: 'tráfego' } as const
  const given = { vcpu: s.vcpu != null, ram: s.ramGb != null, disk: s.diskGb != null, traffic: !!s.traffic }
  for (const k of ['vcpu', 'ram', 'disk', 'traffic'] as const) {
    if (unv.has(k) && given[k]) unverified.push(`${label[k]}: não foi possível validar — unidade do valor da Hostinger desconhecida${p.raw?.[k] ? ` (${formatRaw(p.raw[k])})` : ''}`)
  }
  return { mismatches, unverified }
}
/** Só as divergências reais (ex.: VM criada vs anunciado). */
export const specMismatches = (s: VpsSpecs, p: ProviderSpecs | null | undefined) => compareSpecs(s, p).mismatches

/** Opções da encomenda (localização e sistema operativo/imagem). */
export interface VpsOption { id: string; label: string }
export interface VpsOptions { locations: VpsOption[]; images: VpsOption[] }
