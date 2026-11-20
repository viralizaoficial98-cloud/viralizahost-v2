import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

// Métodos de pagamento disponíveis no checkout. Só a transferência bancária com
// comprovativo está operacional; os restantes dependem de um gateway por contratar.
const FALLBACK_BANK = { bank_name: 'Banco BIC', account_holder: 'VIRALIZA FÁCIL ANGOLA, LDA', account_number: '005100002477517910141', iban: null, swift: null, payment_instructions: null }

export async function GET() {
  const [rows] = await getPool().query('SELECT bank_name, account_holder, account_number, iban, swift, payment_instructions FROM company_billing_settings WHERE active = 1 LIMIT 1') as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const s = rows[0]
  const bank = s && (s.account_number || s.iban) ? s : FALLBACK_BANK
  return NextResponse.json({
    methods: [
      { id: 'bank_transfer', label: 'Transferência bancária', available: true, requiresProof: true, bank },
      { id: 'multicaixa_express', label: 'Multicaixa Express', available: false, reason: 'Gateway de pagamento ainda não configurado.' },
      { id: 'card', label: 'Cartão', available: false, reason: 'Gateway de pagamento ainda não configurado.' },
      { id: 'paypal', label: 'PayPal', available: false, reason: 'Integração PayPal ainda não configurada.' },
    ],
  })
}
