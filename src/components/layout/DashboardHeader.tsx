'use client'
import { Bell, Search, User } from 'lucide-react'
import { CurrencySelector } from '@/components/shared/CurrencySelector'

export function DashboardHeader() {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" placeholder="Pesquisar..." className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <CurrencySelector />
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center">
            <User size={18} className="text-indigo-600" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-slate-900">Usuário</div>
            <div className="text-xs text-slate-500">cliente@email.com</div>
          </div>
        </div>
      </div>
    </header>
  )
}
