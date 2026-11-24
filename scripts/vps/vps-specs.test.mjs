// Regressão da validação das especificações VPS (regra única do painel e do servidor).
//   node --test scripts/vps/vps-specs.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from '../registrar/load-ts.mjs'

const { compareSpecs, trafficToGb, formatTrafficGb } = await loadTs('src/lib/commerce/vps-shared.ts')
const { specsFromMetadata, specsFromVm } = await loadTs('src/lib/vps/hostinger-specs.ts')

// Metadados do KVM 1 como a Hostinger os devolve (memory/disk/bandwidth em MB, GB × 1024):
// 4 096 000 MB = 4 000 GB anunciados = «4 TB» — o valor que o painel mostrava como 3,90625 TB.
const KVM1 = { cpus: 1, memory: 4096, disk_space: 51200, bandwidth: 4096000 }
const PLAN_KVM1 = { vcpu: 1, ramGb: 4, diskGb: 50, diskType: 'NVMe', traffic: { value: 4, unit: 'TB' } }

test('KVM 1 (hostingercombr-vps-kvm1): bandwidth em MB → 4 000 GB, com valor bruto e unidade', () => {
  const p = specsFromMetadata(KVM1)
  assert.equal(p.trafficGb, 4000)
  assert.equal(p.ramGb, 4)
  assert.equal(p.diskGb, 50)
  assert.deepEqual(p.raw.traffic, { key: 'bandwidth', value: 4096000, unit: 'MB' })
  assert.deepEqual(p.unverified, [])
  assert.equal(formatTrafficGb(p.trafficGb), '4 TB')
})

test('KVM 1: 4 TB anunciados = produto (sem divergência; antes: 4 TB ≠ 3,90625 TB)', () => {
  assert.deepEqual(compareSpecs(PLAN_KVM1, specsFromMetadata(KVM1)), { mismatches: [], unverified: [] })
})

test('unidades decimais: 4 000 GB e 4 TB são equivalentes', () => {
  assert.equal(trafficToGb(4000, 'GB'), trafficToGb(4, 'TB'))
  const p = specsFromMetadata(KVM1)
  assert.deepEqual(compareSpecs({ ...PLAN_KVM1, traffic: { value: 4000, unit: 'GB' } }, p).mismatches, [])
  assert.deepEqual(compareSpecs({ ...PLAN_KVM1, traffic: { value: 4, unit: 'TB' } }, p).mismatches, [])
})

test('unidades binárias: 4 TiB ≠ 4 TB (diferença real de 9,95 %) e 3 725 GiB ≈ 4 TB', () => {
  const p = specsFromMetadata(KVM1)
  const m = compareSpecs({ ...PLAN_KVM1, traffic: { value: 4, unit: 'TiB' } }, p).mismatches
  assert.equal(m.length, 1)
  assert.match(m[0], /4 TiB \(4,398 TB\) ≠ produto 4 TB/)
  assert.ok(Math.abs(trafficToGb(3725.29, 'GiB') - 4000) < 0.5)
})

test('divergência real: 8 TB anunciados num KVM 1 (4 TB) e vCPU diferente', () => {
  const r = compareSpecs({ ...PLAN_KVM1, vcpu: 2, traffic: { value: 8, unit: 'TB' } }, specsFromMetadata(KVM1))
  assert.equal(r.mismatches.length, 2)
  assert.match(r.mismatches.join(' | '), /vCPU anunciado 2 ≠ produto 1/)
  assert.match(r.mismatches.join(' | '), /tráfego anunciado 8 TB ≠ produto 4 TB/)
})

test('«Ilimitado» anunciado num produto com limite é divergência', () => {
  assert.match(compareSpecs({ ...PLAN_KVM1, traffic: { unlimited: true } }, specsFromMetadata(KVM1)).mismatches[0], /ilimitado/)
})

test('unidade de origem desconhecida: valor não validado (nem divergência, nem «coincide»)', () => {
  const p = specsFromMetadata({ cpus: 1, memory: 4096, disk_space: 51200, traffic: 4 })
  assert.equal(p.trafficGb, null)
  assert.deepEqual(p.unverified, ['traffic'])
  assert.deepEqual(p.raw.traffic, { key: 'traffic', value: 4, unit: null })
  const r = compareSpecs(PLAN_KVM1, p)
  assert.deepEqual(r.mismatches, [])
  assert.equal(r.unverified.length, 1)
  assert.match(r.unverified[0], /tráfego: não foi possível validar — unidade do valor da Hostinger desconhecida \(traffic = 4 \(unidade desconhecida\)\)/)
})

test('valor incoerente com MB (memory: 8) fica por validar em vez de dar 0,008 GB', () => {
  const p = specsFromMetadata({ cpus: 2, memory: 8, disk_space: 102400, bandwidth: 8192000 })
  assert.equal(p.ramGb, null)
  assert.deepEqual(p.unverified, ['ram'])
})

test('VM criada (campos documentados em MB) comparada com o anunciado', () => {
  const vm = specsFromVm({ cpus: 1, memory: 4096, disk: 51200, bandwidth: 4096000 })
  assert.deepEqual(compareSpecs(PLAN_KVM1, vm).mismatches, [])
})
