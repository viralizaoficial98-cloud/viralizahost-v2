import 'server-only'
import { getPool } from '@/lib/db/pool'
import { bankFromSettings, DEFAULT_BANK, type BankDetails } from './bank-details'

/** Dados bancários configurados (Configurações → Facturação) ou os valores por omissão. */
export async function loadBankDetails(): Promise<BankDetails> {
  try {
    const [rows] = await getPool().query('SELECT bank_name, account_holder, account_number, iban, swift, payment_instructions FROM company_billing_settings WHERE active = 1 LIMIT 1') as unknown as [Record<string, string | null>[]]
    return bankFromSettings(rows[0])
  } catch { return DEFAULT_BANK }
}
