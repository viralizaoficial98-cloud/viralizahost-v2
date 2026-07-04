import { Metadata } from 'next'
import { Globe } from 'lucide-react'

export const metadata: Metadata = { title: 'Domínios — Admin ViralizaHost' }

const domains = [
  { name: 'meusite.com',  client: 'Maria Santos', status: 'Ativo',    expiry: '15 Jul 2026', ns: 'ViralizaHost', tld: '.com' },
  { name: 'loja.ao',      client: 'Maria Santos', status: 'Ativo',    expiry: '20 Ago 2026', ns: 'ViralizaHost', tld: '.ao' },
  { name: 'empresa.ao',   client: 'João Silva',   status: 'Ativo',    expiry: '10 Set 2026', ns: 'ViralizaHost', tld: '.ao' },
  { name: 'blog.net',     client: 'Ana Costa',    status: 'Expirado', expiry: '01 Jan 2026', ns: 'Externo',      tld: '.net' },
]

const thStyle = { padding: '12px 20px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }
const card    = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' as const }

export default function AdminDomainsPage() {
  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.20)' }}>
            <Globe size={20} style={{ color: '#2563EB' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Domínios</h1>
            <p className="text-sm" style={{ color: '#64748B' }}>Gestão de todos os domínios da plataforma</p>
          </div>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.20)' }}>
          1.247 domínios
        </span>
      </div>

      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <Globe size={16} style={{ color: '#2563EB' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Todos os Domínios</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>{['Domínio', 'TLD', 'Cliente', 'Nameservers', 'Expira em', 'Status', 'Ações'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {domains.map((d, i) => (
                <tr key={d.name} style={{ borderBottom: i < domains.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: 14, color: '#0B0B0D' }}>{d.name}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563EB', border: '1px solid rgba(37,99,235,0.15)' }}>{d.tld}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: '#64748B' }}>{d.client}</td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#94A3B8' }}>{d.ns}</td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#94A3B8' }}>{d.expiry}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={d.status === 'Ativo'
                        ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                        : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <button className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Gerir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
