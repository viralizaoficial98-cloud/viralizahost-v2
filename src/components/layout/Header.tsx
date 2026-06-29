'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { CurrencySelector } from '@/components/shared/CurrencySelector'

export function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Logo />
          <nav className="hidden md:flex items-center gap-8">
            {[['/#planos','Planos'],['/#recursos','Recursos'],['/#dominios','Domínios'],['/#suporte','Suporte']].map(([href,label]) => (
              <Link key={href} href={href} className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">{label}</Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <CurrencySelector />
            <Link href="/login" className="text-slate-600 hover:text-indigo-600 font-medium">Entrar</Link>
            <Link href="/register" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium transition-colors">
              Começar Grátis
            </Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {open && (
          <div className="md:hidden py-4 border-t border-slate-200 space-y-3">
            {[['/#planos','Planos'],['/#recursos','Recursos'],['/#dominios','Domínios'],['/#suporte','Suporte']].map(([href,label]) => (
              <Link key={href} href={href} className="block text-slate-600 hover:text-indigo-600 py-2">{label}</Link>
            ))}
            <CurrencySelector />
            <div className="flex gap-3 pt-2">
              <Link href="/login" className="flex-1 text-center py-2 border border-indigo-600 text-indigo-600 rounded-lg font-medium">Entrar</Link>
              <Link href="/register" className="flex-1 text-center py-2 bg-indigo-600 text-white rounded-lg font-medium">Registar</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
