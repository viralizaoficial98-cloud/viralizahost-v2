import Link from 'next/link'
import { Server } from 'lucide-react'
import { InfraServers } from '@/components/admin/reseller/InfraServers'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Infraestrutura — Servidores — Admin' }

// Infraestrutura → Servidores: ficha, licença, categorias, sincronização WHM e capacidade (revenda incluída).
export default function AdminServersPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
          <Server size={20} style={{ color: '#D9A300' }} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Infraestrutura — Servidores</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Capacidade = armazenamento, compromissos existentes, licenciamento e reserva operacional — não só o uso actual</p>
        </div>
        <Link href="/admin/settings/integrations/whm" className="text-xs font-bold underline">WHM/cPanel</Link>
        <Link href="/admin/servers/whm-accounts" className="text-xs font-bold underline">Contas</Link>
      </div>
      <InfraServers />
    </div>
  )
}
