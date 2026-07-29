import { Metadata } from 'next'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BillingManager from '@/components/billing/BillingManager'

export const dynamic   = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: 'Financeiro — ViralizaHost' }

export default async function BillingPage() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const db = createAdminWriteClient()
  const { data: profile } = await db.from('profiles').select('currency').eq('id', user.id).maybeSingle()
  const currency = (profile as any)?.currency ?? 'AKZ'

  return <BillingManager currency={currency} />
}
