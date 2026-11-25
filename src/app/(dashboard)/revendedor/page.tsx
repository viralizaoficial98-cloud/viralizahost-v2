import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResellerClientArea } from '@/components/reseller/ResellerClientArea'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Revenda' }

export default async function ResellerAreaPage() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) redirect('/login')
  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-[#0B0B0D]">Revenda de Hospedagem</h1>
        <p className="text-sm text-[#64748B] mt-1">Estado dos pedidos, acesso ao WHM e cPanel, consumo e contas dos seus clientes.</p>
      </div>
      <ResellerClientArea />
    </div>
  )
}
