// Servidores Dedicados Linux e Windows (sem dependências de servidor: painel, página pública e servidor).
// Mesma faixa visual dos VPS, mas sem qualquer ligação à compra automática de VPS na Hostinger: a activação é manual
// (products.provisioning = 'manual', service_type = 'dedicated').
import { TRAFFIC_UNITS, isTrafficUnit, type VpsTraffic } from './vps-shared'

export const DEDICATED_KINDS = {
  linux: { kind: 'linux', category: 'dedicated', label: 'Servidor Dedicado Linux', short: 'Dedicado Linux', page: '/servidor-dedicado', prefix: 'ded-linux' },
  windows: { kind: 'windows', category: 'dedicated-windows', label: 'Servidor Dedicado Windows', short: 'Dedicado Windows', page: '/servidor-dedicado-windows', prefix: 'ded-windows' },
} as const
export type DedicatedKind = keyof typeof DEDICATED_KINDS
export const isDedicatedKind = (k: unknown): k is DedicatedKind => k === 'linux' || k === 'windows'
export const kindOfCategory = (c: unknown): DedicatedKind | null => c === 'dedicated' ? 'linux' : c === 'dedicated-windows' ? 'windows' : null

/** Períodos de contratação dos servidores dedicados. */
export const DEDICATED_CYCLES = [
  { cycle: 'monthly', months: 1, label: '1 mês' },
  { cycle: '3months', months: 3, label: '3 meses' },
  { cycle: '6months', months: 6, label: '6 meses' },
  { cycle: '1year', months: 12, label: '1 ano' },
  { cycle: '2years', months: 24, label: '2 anos' },
  { cycle: '3years', months: 36, label: '3 anos' },
] as const

export const STORAGE_TYPES = ['NVMe', 'SSD', 'HDD'] as const
export const RAID_LEVELS = ['Sem RAID', 'RAID 0', 'RAID 1', 'RAID 5', 'RAID 6', 'RAID 10'] as const
export const RAM_TYPES = ['DDR4', 'DDR5', 'DDR4 ECC', 'DDR5 ECC'] as const
export { TRAFFIC_UNITS }

export interface DedicatedDisk { count: number; sizeGb: number; type: (typeof STORAGE_TYPES)[number] }
export interface DedicatedSpecs {
  cpuModel?: string | null
  cores?: number | null
  threads?: number | null
  ramGb?: number | null
  ramType?: (typeof RAM_TYPES)[number] | null
  disks?: DedicatedDisk[] | null
  raid?: (typeof RAID_LEVELS)[number] | null
  traffic?: VpsTraffic | null
  network?: { value: number; unit: 'Mbps' | 'Gbps' } | null
  os?: string | null
  license?: string | null
}

export class DedicatedSpecError extends Error { constructor(message: string, public field: string) { super(message) } }
const isEmpty = (v: unknown) => v === '' || v === null || v === undefined
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const int = (v: unknown, field: string, label: string, min: number, max: number) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new DedicatedSpecError(`${label}: indique um número inteiro entre ${min} e ${max.toLocaleString('pt-PT')}.`, field)
  return n
}

/** Validação no servidor (o painel usa os mesmos limites). */
export function validateDedicatedSpecs(raw: unknown, kind: DedicatedKind): DedicatedSpecs {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: DedicatedSpecs = {}
  if (!isEmpty(s.cpuModel)) out.cpuModel = clean(s.cpuModel, 80)
  if (!isEmpty(s.cores)) out.cores = int(s.cores, 'cores', 'Núcleos', 1, 512)
  if (!isEmpty(s.threads)) out.threads = int(s.threads, 'threads', 'Threads', 1, 1024)
  if (out.cores && out.threads && out.threads < out.cores) throw new DedicatedSpecError('Threads: não pode ser inferior ao número de núcleos.', 'threads')
  if (!isEmpty(s.ramGb)) out.ramGb = int(s.ramGb, 'ramGb', 'RAM (GB)', 1, 16384)
  if (!isEmpty(s.ramType)) { if (!(RAM_TYPES as readonly string[]).includes(s.ramType)) throw new DedicatedSpecError('Tipo de RAM inválido.', 'ramType'); out.ramType = s.ramType }
  if (Array.isArray(s.disks)) {
    const disks = (s.disks as any[]).filter(d => d && !isEmpty(d.sizeGb)) // eslint-disable-line @typescript-eslint/no-explicit-any
    if (disks.length > 6) throw new DedicatedSpecError('No máximo 6 grupos de discos.', 'disks')
    out.disks = disks.map(d => {
      if (!(STORAGE_TYPES as readonly string[]).includes(d.type)) throw new DedicatedSpecError('Tipo de armazenamento: NVMe, SSD ou HDD.', 'disks')
      return { count: int(d.count ?? 1, 'disks', 'Quantidade de discos', 1, 24), sizeGb: int(d.sizeGb, 'disks', 'Capacidade do disco (GB)', 1, 100000), type: d.type }
    })
    if (!out.disks.length) delete out.disks
  }
  if (!isEmpty(s.raid)) { if (!(RAID_LEVELS as readonly string[]).includes(s.raid)) throw new DedicatedSpecError('Nível de RAID inválido.', 'raid'); out.raid = s.raid }
  const t = s.traffic
  if (t && typeof t === 'object' && (t.unlimited === true || !isEmpty(t.value))) {
    if (t.unlimited === true) { if (!isEmpty(t.value)) throw new DedicatedSpecError('Tráfego: escolha um valor OU «Ilimitado».', 'traffic'); out.traffic = { unlimited: true } }
    else { if (!isTrafficUnit(t.unit)) throw new DedicatedSpecError('Tráfego: unidade GB, TB, GiB ou TiB.', 'traffic'); out.traffic = { value: int(t.value, 'traffic', 'Tráfego mensal', 1, 1_000_000), unit: t.unit } }
  }
  const nw = s.network
  if (nw && typeof nw === 'object' && !isEmpty(nw.value)) {
    if (!['Mbps', 'Gbps'].includes(nw.unit)) throw new DedicatedSpecError('Velocidade de rede: Mbps ou Gbps.', 'network')
    out.network = { value: int(nw.value, 'network', 'Velocidade de rede', 1, 100000), unit: nw.unit }
  }
  if (!isEmpty(s.os)) out.os = clean(s.os, 80)
  if (!isEmpty(s.license)) out.license = clean(s.license, 120)
  // Linux não leva licença Windows; Windows pede a licença quando o sistema é Windows Server
  if (kind === 'linux' && out.license && /windows/i.test(out.license)) throw new DedicatedSpecError('Licença Windows num plano Linux: use um plano Dedicado Windows.', 'license')
  return out
}

const n = (v: number) => v.toLocaleString('pt-PT').replace(/\s/g, ' ')
const size = (gb: number) => gb >= 1000 && gb % 1000 === 0 ? `${n(gb / 1000)} TB` : `${n(gb)} GB`
export type DedicatedSpecKey = 'cpu' | 'cores' | 'ram' | 'disk' | 'raid' | 'traffic' | 'network' | 'os' | 'license'
/** Linhas visíveis (com ícone na faixa), pela ordem da ficha. */
export function dedicatedSpecLines(s: DedicatedSpecs): { key: DedicatedSpecKey; label: string; value: string }[] {
  const out: { key: DedicatedSpecKey; label: string; value: string }[] = []
  if (s.cpuModel) out.push({ key: 'cpu', label: 'Processador', value: s.cpuModel })
  if (s.cores || s.threads) out.push({ key: 'cores', label: 'Núcleos / threads', value: [s.cores && `${n(s.cores)} ${s.cores === 1 ? 'núcleo' : 'núcleos'}`, s.threads && `${n(s.threads)} threads`].filter(Boolean).join(' · ') })
  if (s.ramGb) out.push({ key: 'ram', label: 'RAM', value: `${n(s.ramGb)} GB${s.ramType ? ` ${s.ramType}` : ''}` })
  if (s.disks?.length) out.push({ key: 'disk', label: 'Armazenamento', value: s.disks.map(d => `${d.count > 1 ? `${d.count} × ` : ''}${size(d.sizeGb)} ${d.type}`).join(' + ') })
  if (s.raid) out.push({ key: 'raid', label: 'RAID', value: s.raid })
  if (s.traffic) out.push({ key: 'traffic', label: 'Tráfego', value: 'unlimited' in s.traffic ? 'Ilimitado' : `${n(s.traffic.value)} ${s.traffic.unit}/mês` })
  if (s.network) out.push({ key: 'network', label: 'Rede', value: `${n(s.network.value)} ${s.network.unit}` })
  if (s.os) out.push({ key: 'os', label: 'Sistema operativo', value: s.os })
  if (s.license) out.push({ key: 'license', label: 'Licença', value: s.license })
  return out
}
