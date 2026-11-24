// Dados bancários para transferência: fonte ÚNICA para o checkout, a página da encomenda, a Área do Cliente,
// o PDF e o e-mail das facturas. Origem: Configurações → Facturação (company_billing_settings, linha activa),
// gerida pelo administrador (IBAN validado no servidor ao guardar; imagem decorativa opcional do cartão).
// Cada factura nova guarda uma cópia (invoices.bank_details): alterações posteriores não mudam facturas emitidas.
// DEFAULT_BANK só é usado se a configuração não puder ser lida (a migração 17 guardou estes valores na base).
import { checkIban, formatIban } from './iban'

export interface BankDetails {
  bank: string
  holder: string
  /** IBAN tal como guardado (compacto, sem completar) */
  iban: string | null
  /** Número de conta, quando configurado sem IBAN (configuração antiga) */
  accountNumber: string | null
  swift: string | null
  instructions: string | null
  /** Imagem decorativa do cartão (URL público) — opcional; os dados aparecem sempre em texto */
  cardImageUrl?: string | null
  source: 'settings' | 'default' | 'invoice'
}

export const DEFAULT_BANK: BankDetails = {
  bank: 'Banco BIC',
  holder: 'VIRALIZA FÁCIL ANGOLA LDA',
  iban: '005100002477517910141',
  accountNumber: null,
  swift: null,
  instructions: null,
  cardImageUrl: null,
  source: 'default',
}

export const CARD_IMAGE_BUCKET = 'billing-assets'
export const cardImageUrl = (path: string | null | undefined) =>
  path ? `/storage/v1/object/public/${CARD_IMAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}` : null

type Row = { bank_name?: string | null; account_holder?: string | null; account_number?: string | null; iban?: string | null; swift?: string | null; payment_instructions?: string | null; bank_card_image_path?: string | null }
const t = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Linha de company_billing_settings → dados bancários (só se tiver IBAN ou número de conta). */
export function bankFromSettings(row: Row | null | undefined): BankDetails {
  if (!row || (!t(row.iban) && !t(row.account_number))) return { ...DEFAULT_BANK, cardImageUrl: cardImageUrl(t(row?.bank_card_image_path)) }
  return {
    bank: t(row.bank_name) ?? DEFAULT_BANK.bank,
    holder: t(row.account_holder) ?? DEFAULT_BANK.holder,
    iban: t(row.iban),
    accountNumber: t(row.iban) ? null : t(row.account_number),
    swift: t(row.swift),
    instructions: t(row.payment_instructions),
    cardImageUrl: cardImageUrl(t(row.bank_card_image_path)),
    source: 'settings',
  }
}

/** Cópia guardada numa factura (invoices.bank_details) → dados bancários dessa factura. */
export function bankFromSnapshot(v: unknown): BankDetails | null {
  if (!v) return null
  try {
    const o = typeof v === 'string' ? JSON.parse(v) : v as Record<string, unknown>
    if (!o || (!t(o.iban) && !t(o.accountNumber))) return null
    return { bank: t(o.bank) ?? DEFAULT_BANK.bank, holder: t(o.holder) ?? DEFAULT_BANK.holder, iban: t(o.iban), accountNumber: t(o.iban) ? null : t(o.accountNumber),
      swift: t(o.swift), instructions: t(o.instructions), cardImageUrl: null, source: 'invoice' }
  } catch { return null }
}

/** Texto a mostrar: IBAN válido em grupos de 4 (leitura); valor antigo/inválido exactamente como guardado. */
export function displayAccount(b: BankDetails): { label: 'IBAN' | 'N.º de conta'; text: string; copy: string } {
  if (b.iban) {
    const ok = checkIban(b.iban).ok
    return { label: 'IBAN', text: ok ? formatIban(b.iban) : b.iban, copy: ok ? b.iban.replace(/\s+/g, '') : b.iban }
  }
  return { label: 'N.º de conta', text: b.accountNumber ?? '', copy: b.accountNumber ?? '' }
}
