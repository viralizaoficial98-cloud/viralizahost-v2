import { Cloud } from 'lucide-react'
import { CloudNav } from '@/components/admin/cloud-vps/CloudNav'

export const dynamic = 'force-dynamic'

// Painel → Cloud VPS: comercialização, aquisição, aprovisionamento e gestão de VPS.
export default function CloudVpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}><Cloud size={20} style={{ color: '#D9A300' }} /></div>
        <div><h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Cloud VPS</h1><p className="text-sm" style={{ color: '#64748B' }}>Pedidos, aquisição, aprovisionamento, servidores, custos e fornecedor</p></div>
      </div>
      <CloudNav />
      {children}
    </div>
  )
}
