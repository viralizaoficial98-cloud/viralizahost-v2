import { Metadata } from 'next'
import { User, Lock, Bell, Shield, Globe } from 'lucide-react'

export const metadata: Metadata = { title: 'Configurações — ViralizaHost' }

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie as configurações da sua conta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="glass-dark rounded-2xl border border-[#222] p-6">
            <div className="flex items-center gap-2 mb-5">
              <User size={16} className="text-yellow-400" />
              <h2 className="font-bold text-white">Informações Pessoais</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome Completo</label>
                  <input type="text" defaultValue="João Silva" className="input-brand w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                  <input type="email" defaultValue="joao@email.com" className="input-brand w-full" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Telefone</label>
                  <input type="tel" defaultValue="+244 923 456 789" className="input-brand w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">País</label>
                  <select className="input-brand w-full">
                    <option value="AO">🇦🇴 Angola</option>
                    <option value="BR">🇧🇷 Brasil</option>
                    <option value="PT">🇵🇹 Portugal</option>
                  </select>
                </div>
              </div>
              <div className="pt-1">
                <button className="btn-primary px-6 py-2.5 rounded-xl text-sm font-bold">Salvar Alterações</button>
              </div>
            </div>
          </div>

          <div className="glass-dark rounded-2xl border border-[#222] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Bell size={16} className="text-yellow-400" />
              <h2 className="font-bold text-white">Notificações</h2>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Vencimentos próximos', desc: 'Notificação 30 dias antes do vencimento' },
                { label: 'Faturas geradas', desc: 'Aviso quando uma nova fatura for emitida' },
                { label: 'Tickets respondidos', desc: 'Notificação de novas respostas de suporte' },
                { label: 'Alertas de segurança', desc: 'Acessos e atividades suspeitas' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3 border-b border-[#1A1A1A] last:border-0">
                  <div>
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-xs text-gray-600">{item.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-5 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-400" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass-dark rounded-2xl border border-[#222] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={16} className="text-yellow-400" />
              <h2 className="font-bold text-white">Segurança</h2>
            </div>
            <div className="space-y-3">
              <button className="w-full text-left p-3.5 bg-[#111] border border-[#1A1A1A] rounded-xl hover:border-[#FFC107]/20 transition-all group">
                <div className="font-medium text-white text-sm group-hover:text-yellow-400 transition-colors">Alterar Senha</div>
                <div className="text-xs text-gray-600 mt-0.5">Última alteração há 30 dias</div>
              </button>
              <button className="w-full text-left p-3.5 bg-[#111] border border-[#1A1A1A] rounded-xl hover:border-[#FFC107]/20 transition-all group">
                <div className="font-medium text-white text-sm group-hover:text-yellow-400 transition-colors flex items-center justify-between">
                  Autenticação 2FA
                  <span className="text-xs text-gray-600 bg-[#1A1A1A] px-2 py-0.5 rounded-full">Inativo</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">Adicione uma camada extra de segurança</div>
              </button>
              <button className="w-full text-left p-3.5 bg-[#111] border border-[#1A1A1A] rounded-xl hover:border-[#FFC107]/20 transition-all group">
                <div className="font-medium text-white text-sm group-hover:text-yellow-400 transition-colors">Sessões Ativas</div>
                <div className="text-xs text-gray-600 mt-0.5">1 dispositivo conectado</div>
              </button>
            </div>
          </div>

          <div className="glass-dark rounded-2xl border border-[#222] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={16} className="text-yellow-400" />
              <h2 className="font-bold text-white">Preferências</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1.5">Idioma</label>
                <select className="input-brand w-full text-sm">
                  <option>Português (PT)</option>
                  <option>Português (BR)</option>
                  <option>English</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1.5">Fuso Horário</label>
                <select className="input-brand w-full text-sm">
                  <option>Africa/Luanda (WAT)</option>
                  <option>America/Sao_Paulo (BRT)</option>
                  <option>Europe/Lisbon (WET)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="glass-dark rounded-2xl border border-red-400/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-red-400" />
              <h2 className="font-bold text-white">Zona de Perigo</h2>
            </div>
            <p className="text-xs text-gray-600 mb-3">Estas ações são irreversíveis. Proceda com cuidado.</p>
            <button className="w-full py-2.5 px-4 bg-red-400/10 border border-red-400/20 text-red-400 text-sm font-medium rounded-xl hover:bg-red-400/20 transition-all">
              Excluir Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
