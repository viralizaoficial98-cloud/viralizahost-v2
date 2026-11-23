import { NextResponse } from 'next/server'
import { loadBankDetails } from '@/lib/billing/load-bank-details'

export const dynamic = 'force-dynamic'

// Métodos de pagamento disponíveis no checkout. Só a transferência bancária com
// comprovativo está operacional; os restantes dependem de um gateway por contratar.
// Dados bancários: fonte única (Configurações → Facturação, ou os valores por omissão em lib/billing/bank-details).

export async function GET() {
  const bank = await loadBankDetails()
  return NextResponse.json({
    methods: [
      { id: 'bank_transfer', label: 'Transferência bancária', available: true, requiresProof: true, bank },
      { id: 'multicaixa_express', label: 'Multicaixa Express', available: false, reason: 'Gateway de pagamento ainda não configurado.' },
      { id: 'card', label: 'Cartão', available: false, reason: 'Gateway de pagamento ainda não configurado.' },
      { id: 'paypal', label: 'PayPal', available: false, reason: 'Integração PayPal ainda não configurada.' },
    ],
  })
}
