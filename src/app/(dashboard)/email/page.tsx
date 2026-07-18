export const dynamic = 'force-dynamic'
import { Metadata } from 'next'
import { createAuthClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmailManager from '@/components/email/EmailManager'

export const metadata: Metadata = { title: 'Emails — ViralizaHost' }

export default async function EmailPage() {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) redirect('/login')

  return <EmailManager />
}
