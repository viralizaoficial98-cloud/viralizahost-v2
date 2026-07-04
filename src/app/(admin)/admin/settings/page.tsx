import { Metadata } from 'next'
import { Settings, Server, Globe, CreditCard, Mail } from 'lucide-react'

export const metadata: Metadata = { title: 'Configurações — Admin ViralizaHost' }

const inputStyle = { width: '100%', padding: '9px 13px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0B0B0D', fontSize: 14, outline: 'none' }
const labelStyle = { display: 'block' as const, fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 5 }
const card       = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', padding: 24 }
const btnPrimary = { display: 'inline-flex' as const, alignItems: 'center' as const, gap: 6, padding: '9px 18px', borderRadius: 12, fontWeight: 700, fontSize: 13, color: '#000', background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)', cursor: 'pointer' as const, border: 'none' as const }

const gateways = [
  { name: 'Mercado Pago',               enabled: true },
  { name: 'PayPal',                      enabled: true },
  { name: 'Stripe',                      enabled: false },
  { name: 'Referência Multicaixa (AO)', enabled: true },
]

export default function AdminSettingsPage() {
  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(100,116,139,0.10)', border: '1px solid rgba(100,116,139,0.20)' }}>
          <Settings size={20} style={{ color: '#475569' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Configurações do Sistema</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Configurações globais da plataforma ViralizaHost</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WHM */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
              <Server size={15} style={{ color: '#D9A300' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>WHM / cPanel API</h2>
          </div>
          <div className="space-y-3">
            <div><label style={labelStyle}>URL do Servidor WHM</label><input type="url" placeholder="https://servidor.viralizahost.com:2087" style={inputStyle} /></div>
            <div><label style={labelStyle}>API Token WHM</label><input type="password" placeholder="••••••••••••••••" style={inputStyle} /></div>
            <div><label style={labelStyle}>Username Admin</label><input type="text" placeholder="root" style={inputStyle} /></div>
            <button style={btnPrimary}>Salvar & Testar</button>
          </div>
        </div>

        {/* Domínios */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.20)' }}>
              <Globe size={15} style={{ color: '#2563EB' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Registrador de Domínios</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Provedor</label>
              <select style={inputStyle}><option>ResellerClub</option><option>Namecheap</option><option>GoDaddy</option><option>ANGT (Angola)</option></select>
            </div>
            <div><label style={labelStyle}>API Key</label><input type="password" placeholder="••••••••••••••••" style={inputStyle} /></div>
            <div><label style={labelStyle}>Nameservers Padrão</label><input type="text" defaultValue="ns1.viralizahost.com, ns2.viralizahost.com" style={inputStyle} /></div>
            <button style={btnPrimary}>Salvar</button>
          </div>
        </div>

        {/* Pagamentos */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)' }}>
              <CreditCard size={15} style={{ color: '#059669' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Gateways de Pagamento</h2>
          </div>
          <div className="space-y-1">
            {gateways.map((gw, i) => (
              <div key={gw.name} className="flex items-center justify-between py-3" style={{ borderBottom: i < gateways.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <span className="text-sm font-medium" style={{ color: '#0B0B0D' }}>{gw.name}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={gw.enabled} className="sr-only peer" />
                  <div className="w-10 h-5 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-400" style={{ background: '#E2E8F0' }} />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* SMTP */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.20)' }}>
              <Mail size={15} style={{ color: '#7C3AED' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Email SMTP</h2>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label style={labelStyle}>Host SMTP</label><input type="text" placeholder="smtp.gmail.com" style={inputStyle} /></div>
              <div><label style={labelStyle}>Porta</label><input type="number" defaultValue={587} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Email remetente</label><input type="email" placeholder="noreply@viralizahost.com" style={inputStyle} /></div>
            <div><label style={labelStyle}>Senha</label><input type="password" placeholder="••••••••" style={inputStyle} /></div>
            <button style={btnPrimary}>Salvar & Testar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
