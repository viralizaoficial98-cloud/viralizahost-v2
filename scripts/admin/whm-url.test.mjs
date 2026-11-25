// Regressão: endereço do WHM usado pelo «Testar ligação» (normalizeWhmUrl).
//   node --test scripts/admin/whm-url.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from '../registrar/load-ts.mjs'

const { normalizeWhmUrl } = await loadTs('src/lib/whm/client.ts')

test('sem porta ou com porta do cPanel/Webmail → 2087', () => {
  assert.equal(normalizeWhmUrl('servidor.exemplo.ao'), 'https://servidor.exemplo.ao:2087')
  assert.equal(normalizeWhmUrl('https://servidor.exemplo.ao/'), 'https://servidor.exemplo.ao:2087')
  for (const p of ['2082', '2083', '2086', '2095', '2096']) assert.equal(normalizeWhmUrl(`http://servidor.exemplo.ao:${p}/cpsess/x`), 'https://servidor.exemplo.ao:2087')
})
test('2087 mantém-se', () => assert.equal(normalizeWhmUrl('https://servidor.exemplo.ao:2087'), 'https://servidor.exemplo.ao:2087'))
test('porta explícita diferente (proxy, ensaio) é mantida — o teste usa o mesmo endereço das operações', () => {
  assert.equal(normalizeWhmUrl('https://127.0.0.1:12087'), 'https://127.0.0.1:12087')
  assert.equal(normalizeWhmUrl('https://whm.exemplo.ao:8443/'), 'https://whm.exemplo.ao:8443')
})
