import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/server'
import { loadCustomer } from '@/lib/commerce/customer'
import { COUNTRIES } from '@/lib/commerce/customer-fields'
import { PaymentFlow } from '@/components/checkout/PaymentFlow'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pagamento', robots: { index: false } }

// Só com sessão e dados obrigatórios completos (validados aqui, no servidor).
export default async function PagamentoPage({ searchParams }: { searchParams: Promise<{ verificado?: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/checkout/conta')
  const c = await loadCustomer(user.id)
  if (!c || c.missing.length) redirect('/checkout/dados')
  const { verificado } = await searchParams
  const d = c.data
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
      <PaymentFlow verified={verificado === '1'} customer={{ email: c.email, name: d.full_name, phone: d.phone, address: d.address, city: d.city, country: COUNTRIES[d.country] ?? d.country, nif: d.tax_id || null, company: d.company_name || null }} />
    </div>
  )
}
