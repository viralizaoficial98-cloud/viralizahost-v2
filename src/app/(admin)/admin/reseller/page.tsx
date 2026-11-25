import { Layers } from 'lucide-react'
import { ResellerAdmin } from '@/components/admin/reseller/ResellerAdmin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Revenda de Hospedagem — Admin' }

// Revenda de Hospedagem: pedidos, aprovação técnica, pagamento, aprovisionamento WHM, revendedores e configuração.
export default async function AdminResellerPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const { pedido } = await searchParams
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}><Layers size={20} style={{ color: '#D9A300' }} /></div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Revenda de Hospedagem</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Pedidos com aprovação, capacidade dos servidores, activação WHM e revendedores</p>
        </div>
      </div>
      <ResellerAdmin initialRef={pedido ?? null} />
    </div>
  )
}
