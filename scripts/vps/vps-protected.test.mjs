// Regressão: a VM de produção 1564781 nunca recebe pedidos de alteração pelo cliente da API Hostinger.
//   node --test scripts/vps/vps-protected.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from '../registrar/load-ts.mjs'

const { PROTECTED_VM_IDS, protectedVmInRequest } = await loadTs('src/lib/vps/protected.ts')
const VM = '/api/vps/v1/virtual-machines/1564781'

test('a VM 1564781 está na lista permanente', () => assert.ok(PROTECTED_VM_IDS.includes('1564781')))
test('alterações à VM protegida são bloqueadas', () => {
  for (const [m, p] of [['POST', `${VM}/start`], ['POST', `${VM}/stop`], ['POST', `${VM}/restart`], ['POST', `${VM}/recreate`], ['PUT', `${VM}/root-password`],
    ['POST', `${VM}/public-keys`], ['POST', `${VM}/setup`], ['PUT', `${VM}/hostname`], ['POST', `${VM}/snapshot`], ['DELETE', `${VM}/snapshot`], ['POST', `${VM}/snapshot/restore`],
    ['POST', `${VM}/backups/9/restore`], ['DELETE', VM], ['post', `${VM}?x=1`], ['POST', '/api/vps/v1/firewall/7/activate/1564781'], ['POST', '/api/vps/v1/firewall/7/deactivate/1564781'], ['POST', '/api/vps/v1/firewall/7/sync/1564781']])
    assert.equal(protectedVmInRequest(m, p), '1564781', `${m} ${p}`)
})
test('leituras continuam permitidas (inventário, métricas)', () => {
  assert.equal(protectedVmInRequest('GET', VM), null)
  assert.equal(protectedVmInRequest('GET', `${VM}/metrics?date_from=a`), null)
})
test('outras VMs (incluindo ids que contêm 1564781) não são afectadas', () => {
  assert.equal(protectedVmInRequest('POST', '/api/vps/v1/virtual-machines/15647810/start'), null)
  assert.equal(protectedVmInRequest('POST', '/api/vps/v1/virtual-machines/21564781/start'), null)
  assert.equal(protectedVmInRequest('POST', '/api/vps/v1/virtual-machines'), null)
  assert.equal(protectedVmInRequest('POST', '/api/vps/v1/firewall/7/activate/1570001'), null)
})
