'use client'
import { Bell, Search, User } from 'lucide-react'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { createAuthClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export function DashboardHeader() {
  const [userName, setUserName] = useState('Usuário')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const supabase = createAuthClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? '')
        setUserName(data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Usuário')
      }
    })
  }, [])

  return (
    <header
      className="px-6 py-3.5 flex items-center justify-between flex-shrink-0"
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xs">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Pesquisar..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 transition-all"
            style={{
              background: '#F8F9FB',
              border: '1px solid #E5E7EB',
              color: '#1A1A2E',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#F5B700'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,183,0,0.10)' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <CurrencySelector />

        {/* Bell */}
        <button
          className="relative p-2 rounded-xl transition-colors"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLElement).style.color = '#F5B700' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9CA3AF' }}
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* Divider */}
        <div className="w-px h-7 mx-1" style={{ background: '#E5E7EB' }} />

        {/* User */}
        <div className="flex items-center gap-2.5 pl-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #F5B700, #D9A300)',
              boxShadow: '0 2px 8px rgba(245,183,0,0.30)',
            }}
          >
            <User size={15} className="text-black" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold" style={{ color: '#111827' }}>{userName}</div>
            <div className="text-xs" style={{ color: '#9CA3AF' }}>{userEmail}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
