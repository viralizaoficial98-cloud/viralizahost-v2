import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/server'
import { AccountStep } from '@/components/checkout/AccountStep'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Criar conta', robots: { index: false } }

// Visitante sem sessão → cadastro (com «Já tenho conta»). Com sessão, segue para o passo certo.
export default async function ContaPage() {
  if (await getSessionUser()) redirect('/carrinho/finalizar')
  return <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10"><AccountStep /></div>
}
