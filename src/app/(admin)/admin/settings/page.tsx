import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configurações - Admin' }

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Configurações do Sistema</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-slate-500">Configurações do sistema em desenvolvimento.</p>
      </div>
    </div>
  )
}
