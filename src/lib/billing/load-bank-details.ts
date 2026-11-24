import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'
import { bankFromSettings, DEFAULT_BANK, type BankDetails } from './bank-details'

const SQL = 'SELECT bank_name, account_holder, account_number, iban, swift, payment_instructions, bank_card_image_path FROM company_billing_settings WHERE active = 1 LIMIT 1'

/** Dados bancários guardados (Configurações → Facturação). */
export async function loadBankDetails(db: Queryable = getPool()): Promise<BankDetails> {
  try {
    const [rows] = await db.query(SQL) as unknown as [Record<string, string | null>[]]
    return bankFromSettings(rows[0])
  } catch { return DEFAULT_BANK }
}

/** Cópia para guardar numa factura nova (invoices.bank_details): os dados em vigor no momento da emissão. */
export async function bankSnapshotJson(db: Queryable = getPool()): Promise<string> {
  const b = await loadBankDetails(db)
  return JSON.stringify({ bank: b.bank, holder: b.holder, iban: b.iban, accountNumber: b.accountNumber, swift: b.swift, instructions: b.instructions, source: b.source === 'default' ? 'default' : 'settings' })
}
