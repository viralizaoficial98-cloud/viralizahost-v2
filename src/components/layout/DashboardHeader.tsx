'use client'
import { Bell, Search, User } from 'lucide-react'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function DashboardHeader() {
  const [userName, setUserName] = useState('Usuário')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? '')
        setUserName(data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Usuário')
      }
    })
  }, [])

  return (
    <header className="bg-[#0D0D0D] border-b border-[#1A1A1A] px-6 py-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input type="search" placeholder="Pesquisar..." className="w-full pl-9 pr-4 py-2 bg-[#1A1A1A] border border-[#333] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC107] focus:ring-1 focus:ring-[#FFC107]/20 transition-all" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <CurrencySelector />
        <button className="relative p-2 text-gray-600 hover:text-yellow-400 hover:bg-[#1A1A1A] rounded-xl transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-3 pl-3 border-l border-[#222]">
          <div className="w-8 h-8 bg-yellow-400/10 border border-yellow-400/20 rounded-full flex items-center justify-center">
            <User size={16} className="text-yellow-400" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-white">{userName}</div>
            <div className="text-xs text-gray-600">{userEmail}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
