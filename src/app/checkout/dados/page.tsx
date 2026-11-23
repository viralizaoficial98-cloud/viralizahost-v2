import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/server'
import { CustomerStep } from '@/components/checkout/CustomerStep'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Dados do cliente', robots: { index: false } }

export default async function DadosPage({ searchParams }: { searchParams: Promise<{ verificado?: string; editar?: string }> }) {
  if (!(await getSessionUser())) redirect('/checkout/conta')
  const { verificado, editar } = await searchParams
  return <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10"><CustomerStep verified={verificado === '1'} editAll={editar === '1'} /></div>
}
