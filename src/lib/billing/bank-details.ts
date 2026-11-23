// Dados bancários para transferência: fonte única para o checkout, a página da encomenda, a Área do Cliente e o PDF.
// Origem: Configurações → Facturação (company_billing_settings, linha activa). Sem dados configurados, usa os
// valores abaixo, tal como foram fornecidos. Os dígitos NÃO são completados nem reformatados: confirmar com o
// titular da conta se «005100002477517910141» é o IBAN completo (em Angola o IBAN costuma ter o prefixo AO06
// seguido dos 21 dígitos) ou o número de conta, antes de publicar.

export interface BankDetails {
  bank: string
  holder: string
  /** IBAN tal como configurado (sem completar) */
  iban: string | null
  /** Número de conta, quando configurado sem IBAN */
  accountNumber: string | null
  swift: string | null
  instructions: string | null
  source: 'settings' | 'default'
}

export const DEFAULT_BANK: BankDetails = {
  bank: 'Banco BIC',
  holder: 'VIRALIZA FÁCIL ANGOLA LDA',
  iban: '005100002477517910141',
  accountNumber: null,
  swift: null,
  instructions: null,
  source: 'default',
}

type Row = { bank_name?: string | null; account_holder?: string | null; account_number?: string | null; iban?: string | null; swift?: string | null; payment_instructions?: string | null }
const t = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Linha de company_billing_settings → dados bancários (só se tiver IBAN ou número de conta). */
export function bankFromSettings(row: Row | null | undefined): BankDetails {
  if (!row || (!t(row.iban) && !t(row.account_number))) return DEFAULT_BANK
  return {
    bank: t(row.bank_name) ?? DEFAULT_BANK.bank,
    holder: t(row.account_holder) ?? DEFAULT_BANK.holder,
    iban: t(row.iban),
    accountNumber: t(row.iban) ? null : t(row.account_number),
    swift: t(row.swift),
    instructions: t(row.payment_instructions),
    source: 'settings',
  }
}
