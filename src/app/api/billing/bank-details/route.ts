import { NextResponse } from 'next/server'
import { loadBankDetails } from '@/lib/billing/load-bank-details'

export const dynamic = 'force-dynamic'

// Dados públicos para transferência (os mesmos do checkout e da factura).
export async function GET() {
  return NextResponse.json({ bank: await loadBankDetails() }, { headers: { 'Cache-Control': 'no-store' } })
}
