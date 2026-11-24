import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyVps } from '@/lib/vps/manage'
import { VpsManager } from '@/components/vps/VpsManager'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Gerir VPS' }

export default async function VpsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')
  const id = (await params).id
  // Só VPS do próprio cliente: outro id (de outro cliente ou inexistente) → 404
  const vps = await getMyVps(user.id, id).catch(() => null)
  if (!vps) notFound()
  return <VpsManager initial={vps} />
}
