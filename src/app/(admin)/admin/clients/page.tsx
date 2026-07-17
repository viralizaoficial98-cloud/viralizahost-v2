import { Metadata } from 'next'
import { requireAdminRole } from '@/lib/api/require-admin'
import { redirect } from 'next/navigation'
import ClientsManager from '@/components/admin/clients/ClientsManager'

export const metadata: Metadata = { title: 'Clientes — Admin ViralizaHost' }
export const dynamic   = 'force-dynamic'
export const revalidate = 0

export default async function AdminClientsPage() {
  try {
    await requireAdminRole()
  } catch {
    redirect('/login')
  }

  return <ClientsManager />
}
