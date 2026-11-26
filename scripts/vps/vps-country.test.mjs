// Regressão: país de um centro de dados → bandeira (só o código de país dos dados, nunca o código técnico do centro).
//   node --test scripts/vps/vps-country.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from '../registrar/load-ts.mjs'

const { countryOf, normalizeCountry } = await loadTs('src/lib/vps/country.ts')

test('normaliza maiúsculas e minúsculas', () => {
  for (const v of ['lt', 'LT', 'Lt', ' lt ']) assert.equal(normalizeCountry(v), 'lt')
  assert.equal(normalizeCountry('UK'), 'gb')   // alias comum
})
test('valores inválidos → sem país', () => {
  for (const v of [null, undefined, '', 'L', 'LTU', 'L1', '--', 42, {}]) assert.equal(normalizeCountry(v), null)
})
test('usa o campo country; o nome técnico do centro (detail) nunca é lido', () => {
  assert.equal(countryOf({ country: 'DE', label: 'Düsseldorf, de', detail: 'us' }), 'de')
  assert.equal(countryOf({ country: 'LT', label: 'Vilnius', detail: 'bnk' }), 'lt')
  assert.equal(countryOf({ label: 'Mumbai 2', detail: 'mum2' }), null)
  assert.equal(countryOf({ label: 'Manchester', detail: 'fast' }), null)
})
test('linhas guardadas antes do campo country: código no fim do rótulo', () => {
  assert.equal(countryOf({ label: 'Vilnius, LT' }), 'lt')
  assert.equal(countryOf({ label: 'Boston 2, us' }), 'us')
  assert.equal(countryOf({ label: 'Mumbai 2 (IN)' }), 'in')
  assert.equal(countryOf({ label: 'Kuala Lumpur, MY' }), 'my')
})
test('sem código reconhecível → null (cidade continua visível, ícone neutro)', () => {
  for (const label of ['Frankfurt', 'Centro 19', 'Rio de Janeiro', 'São Paulo, Brasil', '']) assert.equal(countryOf({ label }), null)
})
