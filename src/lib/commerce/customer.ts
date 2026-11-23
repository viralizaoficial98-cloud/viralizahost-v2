import 'server-only'
import { randomUUID } from 'node:crypto'
import { getPool, type Queryable } from '@/lib/db/pool'
import { FIELD_LABEL, REQUIRED_FIELDS, fieldError, missingFields, type CustomerData, type CustomerField } from './customer-fields'

export { FIELD_LABEL, REQUIRED_FIELDS, missingFields, type CustomerData, type CustomerField }

// Dados do cliente exigidos para encomendar (titular do domínio e da factura).
// Fonte: profiles (nome, telefone, país) + clients (morada, cidade, província, empresa, NIF).
// Ter comprado antes não basta: a decisão usa SEMPRE os valores efectivamente guardados.

/* eslint-disable @typescript-eslint/no-explicit-any */
const clean = (v: unknown, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export async function loadCustomer(userId: string, db: Queryable = getPool()): Promise<{ email: string; data: CustomerData; missing: CustomerField[] } | null> {
  const [rows] = await db.query(
    `SELECT p.email, p.full_name, p.phone, p.country, c.address, c.city, c.state, c.company_name, c.tax_id
     FROM profiles p LEFT JOIN clients c ON c.profile_id = p.id WHERE p.id = ?`, [userId]) as any
  const r = rows[0]
  if (!r) return null
  const data: CustomerData = {
    full_name: clean(r.full_name), phone: clean(r.phone, 40), country: clean(r.country, 8) || 'AO', address: clean(r.address), city: clean(r.city, 120),
    state: clean(r.state, 120), company_name: clean(r.company_name), tax_id: clean(r.tax_id, 20),
  }
  return { email: r.email, data, missing: missingFields(data) }
}

export class CustomerError extends Error { constructor(public errors: Partial<Record<CustomerField, string>>) { super('Dados do cliente inválidos.') } }

/**
 * Valida e guarda só os campos enviados (os restantes ficam como estão).
 * O e-mail e a senha nunca passam por aqui: a identidade vem da sessão.
 */
export async function saveCustomer(userId: string, input: Partial<Record<CustomerField, unknown>>, db: Queryable = getPool()) {
  const cur = await loadCustomer(userId, db)
  if (!cur) throw new CustomerError({ full_name: 'Conta inexistente.' })
  const next: CustomerData = { ...cur.data }
  for (const f of Object.keys(FIELD_LABEL) as CustomerField[]) {
    if (f in input) next[f] = clean(input[f], f === 'phone' ? 40 : f === 'tax_id' ? 20 : 200)
  }
  const errors: Partial<Record<CustomerField, string>> = {}
  for (const f of Object.keys(FIELD_LABEL) as CustomerField[]) {
    if (!(f in input) && !REQUIRED_FIELDS.includes(f)) continue
    const e = fieldError(f, next[f])
    if (e) errors[f] = e
  }
  if (Object.keys(errors).length) throw new CustomerError(errors)
  await db.query('UPDATE profiles SET full_name = ?, phone = ?, country = ? WHERE id = ?', [next.full_name, next.phone, next.country, userId])
  await db.query(
    `INSERT INTO clients (id, profile_id, address, city, state, company_name, tax_id) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE address = VALUES(address), city = VALUES(city), state = VALUES(state), company_name = VALUES(company_name), tax_id = VALUES(tax_id)`,
    [randomUUID(), userId, next.address, next.city, next.state || null, next.company_name || null, next.tax_id || null],
  )
  return next
}

/** Cópia dos dados para a encomenda (billing_details), tirada no servidor no momento da compra. */
export function billingSnapshot(email: string, d: CustomerData) {
  return { name: d.company_name || d.full_name, contact: d.full_name, email, phone: d.phone, nif: d.tax_id || null, address: d.address, city: d.city, state: d.state || null, country: d.country }
}
