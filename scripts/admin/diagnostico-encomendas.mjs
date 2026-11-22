#!/usr/bin/env node
/**
 * Diagnóstico de encomendas, receita e estados de serviço — SÓ LEITURA por omissão.
 *
 *   node --env-file=.env.local scripts/admin/diagnostico-encomendas.mjs [--order=VH-ORD-202611-0001]
 *   node --env-file=.env.local scripts/admin/diagnostico-encomendas.mjs --reconcile            (pré-visualização)
 *   node --env-file=.env.local scripts/admin/diagnostico-encomendas.mjs --reconcile --apply --confirm=N
 *
 * Mostra, para cada encomenda: comprador (papel da conta), factura, pagamentos (estado,
 * moeda, data de validação, quem validou), serviços e domínios. Não imprime segredos,
 * comprovativos nem dados de facturação; os e-mails aparecem parcialmente ocultos.
 *
 * --reconcile lista correcções de ESTADO de serviços (nunca de facturas ou pagamentos):
 *   A) domínio marcado activo sem referência do registo → volta a «a aguardar registo»
 *   B) serviço com status 'active' mas activação não concluída → status 'pending'
 * Só aplica com --apply e --confirm=<n.º exacto de alterações mostradas>.
 * Encomendas sem conta ou de contas da equipa são apenas LISTADAS para decisão da equipa:
 * nenhuma conta é criada e nenhuma encomenda é associada por coincidência de e-mail.
 */
import mysql from 'mysql2/promise'

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true] }))
const mask = e => { const [u, d] = String(e ?? '').split('@'); return d ? `${u.slice(0, 2)}***@${d}` : '—' }
const kz = n => `Kz ${Number(n ?? 0).toLocaleString('pt-PT').replace(/\s/g, ' ')}`
const money = (c, n) => (c === 'AKZ' ? kz(n) : `${c} ${n}`)

const db = await mysql.createConnection({ host: process.env.DB_HOST, port: +(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true, timezone: 'Z' })
await db.query("SET time_zone = '+00:00'")
const q = async (sql, p = []) => (await db.query(sql, p))[0]

console.log(`Base: ${process.env.DB_NAME} · ${new Date().toISOString()}\n`)

const orders = await q(`SELECT o.id, o.order_number, o.status, o.payment_status, o.activation_status, o.hold_reason, o.amount, o.currency, o.created_at, o.paid_at,
    o.review_flag, o.user_id, p.email, p.role, p.created_at AS profile_created
  FROM orders o LEFT JOIN profiles p ON p.id = o.user_id
  ${args.order ? 'WHERE o.order_number = ?' : "WHERE o.payment_status = 'paid' OR o.created_at >= NOW() - INTERVAL 45 DAY"}
  ORDER BY o.created_at`, args.order ? [args.order] : [])
if (!orders.length) console.log('Nenhuma encomenda encontrada.')

for (const o of orders) {
  console.log(`■ ${o.order_number} — ${money(o.currency, o.amount)} · encomenda ${o.status} · pagamento ${o.payment_status} · activação ${o.activation_status}${o.hold_reason ? ` · retida (${o.hold_reason})` : ''}${o.review_flag ? ` · marcada: ${o.review_flag}` : ''}`)
  console.log(`  Criada ${o.created_at} UTC${o.paid_at ? ` · paga ${o.paid_at} UTC` : ''}`)
  console.log(`  Comprador: ${o.user_id ? `${mask(o.email)} (papel: ${o.role ?? 'sem perfil'})` : 'SEM CONTA'}${o.role === 'admin' ? '  ⚠ conta da equipa — possível encomenda de teste (decisão da equipa)' : ''}`)
  const invs = await q('SELECT id, invoice_number, status, currency, total, amount_paid, paid_at FROM invoices WHERE order_id = ?', [o.id])
  for (const i of invs) {
    console.log(`  Factura ${i.invoice_number}: ${i.status} · ${money(i.currency, i.total)} · pago ${money(i.currency, i.amount_paid)}${i.paid_at ? ` em ${i.paid_at} UTC` : ''}`)
    const pays = await q(`SELECT p.status, p.method, p.amount, p.currency, p.paid_at, p.created_at, p.gateway_event_id IS NOT NULL AS gateway, r.role AS reviewer_role, p.proof_url IS NOT NULL AS has_proof
      FROM payments p LEFT JOIN profiles r ON r.id = p.reviewed_by WHERE p.invoice_id = ? ORDER BY p.created_at`, [i.id])
    if (!pays.length) console.log('    (sem registos de pagamento)')
    for (const p of pays) console.log(`    Pagamento ${p.status} · ${p.method} · ${money(p.currency, p.amount)} · ${p.paid_at ? `validado ${p.paid_at} UTC` : `criado ${p.created_at} UTC`} · ${p.gateway ? 'via gateway' : p.reviewer_role ? `validado por conta ${p.reviewer_role}` : 'sem validador registado'}${p.has_proof ? ' · com comprovativo' : ''}`)
    const approved = pays.filter(p => p.status === 'approved')
    if (i.status === 'paid' && !approved.length) console.log('    ⚠ factura paga sem pagamento aprovado')
    if (approved.length > 1) console.log(`    ⚠ ${approved.length} pagamentos aprovados para a mesma factura (duplicado?)`)
  }
  const svcs = await q(`SELECT s.id, s.service_type, s.service_name, s.domain, s.status, s.provisioning_status, s.provisioning_error, s.external_ref, s.activation_source FROM services s WHERE s.order_id = ?`, [o.id])
  for (const s of svcs) {
    console.log(`  Serviço ${s.service_type}: ${s.service_name}${s.domain ? ` (${s.domain})` : ''} · status ${s.status} · activação ${s.provisioning_status}${s.external_ref ? ` · ref ${s.external_ref}` : ''}${s.activation_source ? ` · origem ${s.activation_source}` : ''}`)
    if (s.provisioning_error) console.log(`    motivo: ${String(s.provisioning_error).slice(0, 200)}`)
  }
  const doms = await q('SELECT CONCAT(name, extension) d, status, registered_at, expires_at FROM domains WHERE order_id = ?', [o.id])
  for (const d of doms) console.log(`  Domínio ${d.d}: ${d.status}${d.expires_at ? ` · expira ${d.expires_at}` : ''}`)
  console.log('')
}

// Resumo dos indicadores do painel antigo vs novo
const [[clients]] = await db.query("SELECT COUNT(*) n FROM profiles WHERE role = 'client'")
const [[buyers]] = await db.query("SELECT COUNT(DISTINCT user_id) n, SUM(p.role = 'admin') staff FROM orders o LEFT JOIN profiles p ON p.id = o.user_id WHERE o.payment_status = 'paid'")
const [[guests]] = await db.query('SELECT COUNT(*) n FROM orders WHERE user_id IS NULL')
console.log(`Contas de cliente (role client): ${clients.n} · compradores com encomenda paga: ${buyers.n} (das quais da equipa: ${buyers.staff ?? 0}) · encomendas sem conta: ${guests.n}`)

if (args.reconcile) {
  console.log('\n— Reconciliação de estados (pré-visualização) —')
  const a = await q(`SELECT s.id, s.domain, COALESCE(o.order_number, LEFT(o.id, 8)) AS order_number FROM services s JOIN orders o ON o.id = s.order_id
    WHERE s.service_type = 'domain' AND s.provisioning_status = 'active' AND (s.external_ref IS NULL OR TRIM(s.external_ref) = '') AND (s.activation_source IS NULL OR s.activation_source = 'manual')`)
  const b = await q(`SELECT s.id, s.service_name, COALESCE(o.order_number, LEFT(o.id, 8)) AS order_number, s.provisioning_status FROM services s JOIN orders o ON o.id = s.order_id
    WHERE s.status = 'active' AND s.provisioning_status <> 'active' AND s.order_id IS NOT NULL`)
  for (const r of a) console.log(`  A) ${r.order_number} · ${r.domain}: activo sem referência do registo → a aguardar registo`)
  for (const r of b) console.log(`  B) ${r.order_number} · ${r.service_name}: status 'active' com activação ${r.provisioning_status} → status 'pending'`)
  const n = a.length + b.length
  console.log(`  Total: ${n} alteração(ões). Facturas e pagamentos não são alterados.`)
  if (args.apply) {
    if (Number(args.confirm) !== n) { console.log(`\nRecusado: use --confirm=${n} para aplicar exactamente estas alterações.`); process.exitCode = 2 }
    else if (n) {
      await db.beginTransaction()
      for (const r of a) {
        await db.query("UPDATE services SET provisioning_status = 'manual_required', status = 'pending', provisioning_error = 'Reposto: domínio marcado activo sem referência do registo. Confirmar no registrador e marcar com a referência.' WHERE id = ?", [r.id])
        await db.query("UPDATE domains SET status = 'pending' WHERE service_id = ? AND status = 'active'", [r.id])
      }
      for (const r of b) await db.query("UPDATE services SET status = 'pending' WHERE id = ?", [r.id])
      await db.query(`UPDATE orders o SET activation_status = 'manual_required' WHERE o.activation_status = 'active' AND EXISTS (SELECT 1 FROM services s WHERE s.order_id = o.id AND s.provisioning_status <> 'active')`)
      await db.commit()
      console.log(`\nAplicado: ${n} alteração(ões).`)
    }
  }
}
await db.end()
