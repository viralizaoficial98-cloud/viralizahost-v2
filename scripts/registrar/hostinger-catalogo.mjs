#!/usr/bin/env node
/**
 * Consulta SÓ DE LEITURA do catálogo da Hostinger (GET /api/billing/v1/catalog). Nunca compra,
 * nunca regista, nunca altera DNS: este script só faz pedidos GET (verificado antes de cada pedido).
 * Para cada extensão lista os produtos devolvidos pelo filtro por prefixo, o produto EXACTO e TODOS os
 * seus períodos/preços (unidades menores + moeda), e o resultado da selecção usada pela integração.
 *
 *   read -rsp "Token Hostinger: " HOSTINGER_TOKEN; echo
 *   HOSTINGER_TOKEN="$HOSTINGER_TOKEN" node scripts/registrar/hostinger-catalogo.mjs .ai [.com .net …] [--anos=1]
 *   unset HOSTINGER_TOKEN
 * Ensaio: HOSTINGER_API_URL=http://127.0.0.1:12091 (API simulada).
 */
import { loadTs } from './load-ts.mjs'

const { selectDomainPrice, productExtension, normalizeExtension, periodYears } = await loadTs('src/lib/registrar/hostinger-catalog.ts')
const args = process.argv.slice(2)
const years = Number((args.find(a => a.startsWith('--anos=')) ?? '--anos=1').split('=')[1])
const exts = args.filter(a => !a.startsWith('--')).map(normalizeExtension).filter(Boolean)
const BASE = (process.env.HOSTINGER_API_URL || 'https://developers.hostinger.com').replace(/\/+$/, '')
const TOKEN = process.env.HOSTINGER_TOKEN
if (!TOKEN) { console.error('Defina HOSTINGER_TOKEN (o token não é mostrado nem guardado).'); process.exit(2) }

async function get(path) {
  const method = 'GET'
  if (method !== 'GET') throw new Error('Só leituras.')
  const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

for (const ext of exts.length ? exts : ['.ai']) {
  const filter = `${ext.toUpperCase()}*`
  const r = await get(`/api/billing/v1/catalog?name=${encodeURIComponent(filter)}`)
  console.log(`\n══ ${ext} — GET catalog?name=${filter} → HTTP ${r.status}`)
  if (r.status !== 200) { console.log(`   ${JSON.stringify(r.json?.message ?? r.json)}`); continue }
  const items = Array.isArray(r.json) ? r.json : r.json?.data ?? []
  console.log(`   Produtos devolvidos (${items.length}): ${items.map(i => i.name).join(' · ') || '—'}`)
  const exact = items.filter(i => productExtension(i) === ext)
  if (!exact.length) console.log(`   Produto exacto «${ext.toUpperCase()} Domain»: NÃO ENCONTRADO`)
  for (const it of exact) {
    console.log(`   Produto exacto: «${it.name}» [${it.id}] categoria ${it.category ?? '—'}`)
    for (const p of it.prices ?? []) {
      const y = periodYears(p)
      console.log(`     - ${p.id} · ${p.period} ${p.period_unit}${y ? ` (= ${y} ano${y > 1 ? 's' : ''})` : ''} · 1.º período ${p.first_period_price ?? '—'} · preço ${p.price} · ${p.currency} (unidades menores)`)
    }
  }
  const sel = selectDomainPrice(items, ext, years)
  console.log(sel.ok
    ? `   Selecção para ${years} ano(s): ${sel.item.name} · ${sel.price.id} · ${sel.amountMinor} ${sel.currency} (renovação ${sel.renewalMinor})`
    : `   Selecção para ${years} ano(s): REVISÃO MANUAL — ${sel.issue}`)
}
