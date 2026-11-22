import Link from 'next/link'
import { Server, CheckCircle2, XCircle } from 'lucide-react'
import { getPool } from '@/lib/db/pool'
import { WHM_CONFIG_NAME } from '@/lib/whm/config'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Servidores — Admin' }

// Servidores registados na base (antes: lista fixa de exemplo com números inventados).
// Carga e contas reais vêm do WHM em Integrações → WHM/cPanel.
/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminServersPage() {
  const [servers] = await getPool().query(
    `SELECT s.id, s.name, s.hostname, s.location, s.is_active, s.whm_url IS NOT NULL AND s.whm_api_token IS NOT NULL AS has_whm,
       (SELECT COUNT(*) FROM hosting_accounts h WHERE h.server_id = s.id) AS accounts
     FROM servers s ORDER BY s.name = ? DESC, s.name`, [WHM_CONFIG_NAME]) as any
  const card = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18 }
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
          <Server size={20} style={{ color: '#D9A300' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Servidores</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Servidores registados no portal e contas de alojamento associadas</p>
        </div>
      </div>
      {(servers as any[]).length === 0 ? (
        <div className="p-8 text-center text-sm" style={{ ...card, color: '#64748B' }}>
          Nenhum servidor registado. <Link href="/admin/settings/integrations/whm" className="underline font-bold">Configurar o WHM</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {(servers as any[]).map(s => (
            <li key={s.id} className="p-5 flex flex-wrap items-center gap-4" style={card} data-testid="server-row">
              {s.is_active ? <CheckCircle2 size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-600" />}
              <div className="flex-1 min-w-0">
                <p className="font-bold" style={{ color: '#0B0B0D' }}>{s.name === WHM_CONFIG_NAME ? `${s.hostname} (WHM principal)` : s.name}</p>
                <p className="text-xs" style={{ color: '#64748B' }}>{s.hostname} · {s.location} · {Number(s.accounts)} conta(s) associada(s) · {Number(s.has_whm) ? 'API WHM configurada' : 'sem API WHM'}</p>
              </div>
              <Link href="/admin/settings/integrations/whm" className="text-xs font-bold underline">WHM/cPanel</Link>
              <Link href="/admin/servers/whm-accounts" className="text-xs font-bold underline">Contas</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
