import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configurações' }

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500 mt-1">Gerencie as configurações da sua conta</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Informações Pessoais</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                <input type="text" defaultValue="João Silva" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" defaultValue="joao@email.com" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
              <input type="tel" defaultValue="+244 923 456 789" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="pt-2">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">Salvar Alterações</button>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Segurança</h2>
          <div className="space-y-4">
            <button className="w-full text-left p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
              <div className="font-medium text-slate-900">Alterar Senha</div>
              <div className="text-sm text-slate-500 mt-1">Última alteração há 30 dias</div>
            </button>
            <button className="w-full text-left p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors">
              <div className="font-medium text-slate-900">Autenticação 2FA</div>
              <div className="text-sm text-slate-500 mt-1">Não configurado</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
