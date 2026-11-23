// Testes de regressão da selecção de produto/preço do catálogo Hostinger.
// Exemplos de produtos devolvidos pela API REAL ao filtrar por prefixo (nomes reais; preços fictícios).
//   node --test scripts/registrar/hostinger-catalog.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'

const { selectDomainPrice, productExtension, normalizeExtension, periodYears } = await loadTs('src/lib/registrar/hostinger-catalog.ts')

const price = (id, period, unit, first, renew, currency = 'USD') => ({ id, name: id, currency, first_period_price: first, price: renew, period, period_unit: unit })
const product = (name, prices, extra = {}) => ({ id: `item-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, category: 'DOMAIN', prices, ...extra })
const yearly = tag => [price(`${tag}-1y`, 1, 'year', 999, 1599), price(`${tag}-2y`, 2, 'year', 2598, 3198)]

// Respostas reais do filtro por prefixo (nomes dos produtos)
const COM = [product('.COM Domain', yearly('com')), product('.COM.BR Domain', yearly('combr')), product('.COM.ES Domain', yearly('comes')), product('.COMPANY Domain', yearly('company'))]
const NET = [product('.NET Domain', yearly('net')), product('.NET.IN Domain', yearly('netin')), product('.NETWORK Domain', yearly('network'))]
const ORG = [product('.ORG Domain', yearly('org')), product('.ORG.BR Domain', yearly('orgbr')), product('.ORG.UK Domain', yearly('orguk'))]
const SHOP = [product('.SHOP Domain', yearly('shop')), product('.SHOPPING Domain', yearly('shopping'))]
// .AI: o teste real só listou um período diferente de 1 ano
const AI = [product('.AI Domain', [price('ai-2y', 2, 'year', 15998, 15998)])]

test('.com escolhe «.COM Domain», nunca .COM.BR / .COM.ES / .COMPANY', () => {
  const r = selectDomainPrice(COM, '.com', 1)
  assert.equal(r.ok, true)
  assert.equal(r.item.name, '.COM Domain')
  assert.equal(r.price.id, 'com-1y')
  assert.equal(r.amountMinor, 999)
  assert.equal(r.renewalMinor, 1599)
  assert.equal(r.currency, 'USD')
  // em qualquer ordem
  assert.equal(selectDomainPrice([...COM].reverse(), '.com', 1).item.name, '.COM Domain')
})

test('extensões compostas escolhem o produto exacto', () => {
  assert.equal(selectDomainPrice(COM, '.com.br', 1).item.name, '.COM.BR Domain')
  assert.equal(selectDomainPrice(COM, '.COM.ES', 1).item.name, '.COM.ES Domain')
  assert.equal(selectDomainPrice(ORG, '.org.uk', 1).item.name, '.ORG.UK Domain')
  assert.equal(selectDomainPrice(NET, '.net.in', 1).item.name, '.NET.IN Domain')
})

test('.net → «.NET Domain» (não .NET.IN nem .NETWORK)', () => {
  const r = selectDomainPrice(NET, '.net', 1)
  assert.equal(r.ok && r.item.name, '.NET Domain')
  assert.equal(r.price.id, 'net-1y')
})

test('.org → «.ORG Domain» (não .ORG.BR nem .ORG.UK)', () => {
  const r = selectDomainPrice(ORG, 'ORG', 1)
  assert.equal(r.ok && r.item.name, '.ORG Domain')
})

test('.shop → «.SHOP Domain» (não .SHOPPING)', () => {
  const r = selectDomainPrice(SHOP, '.shop', 1)
  assert.equal(r.ok && r.item.name, '.SHOP Domain')
})

test('.ai sem preço de 1 ano → revisão manual (sem escolher outro período)', () => {
  const r = selectDomainPrice(AI, '.ai', 1)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'no_price')
  assert.match(r.issue, /\.AI Domain/)
  assert.match(r.issue, /2 year/)
  // 2 anos existe, mas o pedido é de 1 ano: nunca usar outro período
  assert.equal(selectDomainPrice(AI, '.ai', 2).ok, true)
})

test('comparação normalizada e sem distinguir maiúsculas', () => {
  assert.equal(normalizeExtension(' .Com.BR. '), '.com.br')
  assert.equal(normalizeExtension('COM'), '.com')
  assert.equal(productExtension({ name: '  .com   domain ' }), '.com')
  assert.equal(productExtension({ name: '.COM Domain Transfer' }), null)
  assert.equal(productExtension({ name: 'Renewal .COM Domain' }), null)
  assert.equal(productExtension({ name: '.COM Domain', category: 'VPS' }), null)
  assert.equal(selectDomainPrice(COM, '.CoM', 1).item.name, '.COM Domain')
})

test('sem produto exacto → revisão manual', () => {
  const r = selectDomainPrice(COM, '.co', 1)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'no_product')
  assert.equal(selectDomainPrice([], '.com', 1).reason, 'no_product')
})

test('dois produtos com a mesma extensão exacta → revisão manual', () => {
  const r = selectDomainPrice([...COM, product('.COM Domain', yearly('com-eur'), { id: 'outro' })], '.com', 1)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'ambiguous_product')
})

test('mais de um preço para o período → revisão manual; o mesmo id repetido conta uma vez', () => {
  const two = [product('.COM Domain', [price('com-1y-usd', 1, 'year', 999, 1599), price('com-1y-eur', 1, 'year', 899, 1499, 'EUR')])]
  assert.equal(selectDomainPrice(two, '.com', 1).reason, 'ambiguous_price')
  const dup = [product('.COM Domain', [price('com-1y', 1, 'year', 999, 1599), price('com-1y', 1, 'year', 999, 1599)])]
  assert.equal(selectDomainPrice(dup, '.com', 1).ok, true)
})

test('12 meses conta como 1 ano; 6 meses não', () => {
  assert.equal(periodYears({ period: 12, period_unit: 'month' }), 1)
  assert.equal(periodYears({ period: 6, period_unit: 'months' }), null)
  assert.equal(periodYears({ period: 1, period_unit: 'YEAR' }), 1)
  const r = selectDomainPrice([product('.XYZ Domain', [price('xyz-12m', 12, 'month', 199, 1499)])], '.xyz', 1)
  assert.equal(r.ok && r.price.id, 'xyz-12m')
})

test('moeda e unidades menores preservadas; valores inválidos → manual', () => {
  const r = selectDomainPrice([product('.COM Domain', [price('com-1y-brl', 1, 'year', 4999, 7999, 'BRL')])], '.com', 1)
  assert.equal(r.ok && r.currency, 'BRL')
  assert.equal(r.amountMinor, 4999)
  assert.equal(selectDomainPrice([product('.COM Domain', [price('x', 1, 'year', 9.99, 15.99)])], '.com', 1).reason, 'invalid_price')
  assert.equal(selectDomainPrice([product('.COM Domain', [price('x', 1, 'year', 999, 1599, '')])], '.com', 1).reason, 'invalid_price')
  // sem first_period_price usa o preço base
  const base = selectDomainPrice([product('.COM Domain', [{ id: 'b', currency: 'USD', price: 1299, period: 1, period_unit: 'year' }])], '.com', 1)
  assert.equal(base.ok && base.amountMinor, 1299)
})
