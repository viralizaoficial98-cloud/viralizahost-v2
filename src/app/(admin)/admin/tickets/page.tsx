import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tickets - Admin' }

export default function AdminTicketsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Gestão de Tickets</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <p className="text-slate-500">Gerenciamento de tickets de suporte em desenvolvimento.</p>
      </div>
    </div>
  )
}
