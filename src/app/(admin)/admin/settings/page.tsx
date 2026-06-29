import { Metadata } from 'next'
import { Settings, Server, Globe, CreditCard, Mail, Shield, Bell } from 'lucide-react'

export const metadata: Metadata = { title: 'Configurações — Admin ViralizaHost' }

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Configurações do Sistema</h1>
        <p className="text-gray-500 text-sm mt-1">Configurações globais da plataforma ViralizaHost</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Server size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">WHM / cPanel API</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">URL do Servidor WHM</label>
              <input type="url" placeholder="https://servidor.viralizahost.com:2087" className="input-brand w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">API Token WHM</label>
              <input type="password" placeholder="••••••••••••••••" className="input-brand w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Username Admin</label>
              <input type="text" placeholder="root" className="input-brand w-full text-sm" />
            </div>
            <button className="btn-primary px-5 py-2 rounded-xl text-sm font-bold">Salvar & Testar</button>
          </div>
        </div>

        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Registrador de Domínios</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Provedor</label>
              <select className="input-brand w-full text-sm">
                <option>ResellerClub</option>
                <option>Namecheap</option>
                <option>GoDaddy</option>
                <option>ANGT (Angola)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">API Key</label>
              <input type="password" placeholder="••••••••••••••••" className="input-brand w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Nameservers Padrão</label>
              <input type="text" defaultValue="ns1.viralizahost.com, ns2.viralizahost.com" className="input-brand w-full text-sm" />
            </div>
            <button className="btn-primary px-5 py-2 rounded-xl text-sm font-bold">Salvar</button>
          </div>
        </div>

        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <CreditCard size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Pagamentos</h2>
          </div>
          <div className="space-y-4">
            {[
              { name: 'Mercado Pago', enabled: true },
              { name: 'PayPal', enabled: true },
              { name: 'Stripe', enabled: false },
              { name: 'Referência Multicaixa (AO)', enabled: true },
            ].map((gw) => (
              <div key={gw.name} className="flex items-center justify-between py-2 border-b border-[#1A1A1A] last:border-0">
                <span className="text-sm text-white">{gw.name}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={gw.enabled} className="sr-only peer" />
                  <div className="w-10 h-5 bg-[#333] rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-400" />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Mail size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Email SMTP</h2>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1.5">Host SMTP</label>
                <input type="text" placeholder="smtp.gmail.com" className="input-brand w-full text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1.5">Porta</label>
                <input type="number" defaultValue={587} className="input-brand w-full text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Email remetente</label>
              <input type="email" placeholder="noreply@viralizahost.com" className="input-brand w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Senha</label>
              <input type="password" placeholder="••••••••" className="input-brand w-full text-sm" />
            </div>
            <button className="btn-primary px-5 py-2 rounded-xl text-sm font-bold">Salvar & Testar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
