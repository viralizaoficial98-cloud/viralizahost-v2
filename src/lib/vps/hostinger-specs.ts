import type { ProviderSpecs } from '../commerce/vps-shared'

/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Unidades da Hostinger (ver docs/hostinger-vps-api.md, «Unidades»):
 *  - VirtualMachineResource: memory, disk e bandwidth documentados «in megabytes». Os exemplos oficiais mostram
 *    que a Hostinger converte GB → MB multiplicando por 1024 (memory 8192 = 8 GB; disk 51200 = 50 GB), e o
 *    tráfego segue a mesma regra (KVM 1: 4 000 GB anunciados «4 TB» ↔ 4 096 000 MB). Logo GB = MB / 1024, e o GB
 *    resultante é o GB que a própria Hostinger anuncia (4 000 GB = 4 TB, decimal).
 *  - Billing CatalogItemResource.metadata: chaves NÃO documentadas («varia por categoria»). Só se assume uma unidade
 *    para as chaves com o mesmo nome dos campos documentados da VM (ou com sufixo de unidade explícito). Qualquer
 *    outra chave fica com unidade desconhecida: o valor bruto é guardado e o campo marcado como «não validado».
 */
type Field = 'vcpu' | 'ram' | 'disk' | 'traffic'
const KEYS: Record<Field, { key: string; unit: 'count' | 'MB' | 'GB' | null }[]> = {
  vcpu: [{ key: 'cpus', unit: 'count' }, { key: 'vcpus', unit: 'count' }, { key: 'vcpu', unit: 'count' }, { key: 'cpu', unit: 'count' }, { key: 'cores', unit: 'count' }],
  ram: [{ key: 'memory', unit: 'MB' }, { key: 'memory_mb', unit: 'MB' }, { key: 'ram_mb', unit: 'MB' }, { key: 'memory_gb', unit: 'GB' }, { key: 'ram_gb', unit: 'GB' }, { key: 'ram', unit: null }],
  disk: [{ key: 'disk', unit: 'MB' }, { key: 'disk_space', unit: 'MB' }, { key: 'disk_mb', unit: 'MB' }, { key: 'disk_gb', unit: 'GB' }, { key: 'storage', unit: null }],
  traffic: [{ key: 'bandwidth', unit: 'MB' }, { key: 'bandwidth_mb', unit: 'MB' }, { key: 'bandwidth_gb', unit: 'GB' }, { key: 'traffic_gb', unit: 'GB' }, { key: 'traffic', unit: null }],
}
const round3 = (v: number) => Math.round(v * 1000) / 1000
/** MB da Hostinger → GB anunciados (÷ 1024); GB → GB. */
const toGb = (v: number, unit: 'MB' | 'GB') => round3(unit === 'MB' ? v / 1024 : v)

/** Especificações do produto a partir dos metadados do catálogo, com o valor bruto e a unidade de origem. */
export function specsFromMetadata(meta: Record<string, unknown> | null | undefined): ProviderSpecs | null {
  if (!meta || typeof meta !== 'object') return null
  const out: ProviderSpecs = { vcpu: null, ramGb: null, diskGb: null, trafficGb: null, trafficUnlimited: null, unverified: [], raw: {} }
  let any = false
  for (const f of ['vcpu', 'ram', 'disk', 'traffic'] as Field[]) {
    const hit = KEYS[f].find(k => (meta as any)[k.key] != null && (meta as any)[k.key] !== '')
    if (!hit) continue
    const rawV = (meta as any)[hit.key]
    if (f === 'traffic' && (rawV === -1 || /^(unlimited|ilimitado)$/i.test(String(rawV)))) { out.trafficUnlimited = true; out.raw!.traffic = { key: hit.key, value: -1, unit: null }; any = true; continue }
    const v = Number(rawV)
    if (!Number.isFinite(v) || v <= 0) continue
    any = true
    out.raw![f] = { key: hit.key, value: v, unit: hit.unit === 'count' ? 'vCPU' : hit.unit }
    if (hit.unit === 'count') { out.vcpu = v; continue }
    // Sem unidade conhecida, ou valor incoerente com MB (ex.: «memory: 8» seria 8 MB): não se adivinha — fica por validar
    const MIN_MB = { ram: 256, disk: 1024, traffic: 1024 } as const
    if (!hit.unit || (hit.unit === 'MB' && f !== 'vcpu' && v < MIN_MB[f])) { out.raw![f]!.unit = null; out.unverified!.push(f); continue }
    const gb = toGb(v, hit.unit)
    if (f === 'ram') out.ramGb = gb
    else if (f === 'disk') out.diskGb = gb
    else { out.trafficGb = gb; out.trafficUnlimited = false }
  }
  return any ? out : null
}

/** Especificações reais de uma VM (campos documentados em MB → GB anunciados) para comparar com o anunciado. */
export const specsFromVm = (vm: { cpus?: number | null; memory?: number | null; disk?: number | null; bandwidth?: number | null }): ProviderSpecs => ({
  vcpu: vm.cpus ?? null, ramGb: vm.memory ? toGb(vm.memory, 'MB') : null, diskGb: vm.disk ? toGb(vm.disk, 'MB') : null,
  trafficGb: vm.bandwidth ? toGb(vm.bandwidth, 'MB') : null, trafficUnlimited: vm.bandwidth ? false : null,
})
