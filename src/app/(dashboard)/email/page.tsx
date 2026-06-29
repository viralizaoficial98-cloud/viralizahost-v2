import { Metadata } from 'next'
import { Plus, Mail } from 'lucide-react'

export const metadata: Metadata = { title: 'Emails' }

export default function EmailPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Emails Corporativos</h1>
          <p className="text-slate-500 mt-1">Gerencie as suas contas de email profissional</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors">
          <Plus size={18} /> Criar Email
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Mail size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma conta de email ainda</h3>
        <p className="text-slate-500 mb-6">Crie contas de email profissionais com o seu domínio</p>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
          Criar Primeiro Email
        </button>
      </div>
    </div>
  )
}
