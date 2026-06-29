'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Search, Shield, Zap, Server, ArrowRight, Check, Star } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { HOSTING_PLANS } from '@/lib/constants'
import { Currency } from '@/types'

const DOMAIN_EXTENSIONS = ['.com', '.net', '.org', '.ao', '.com.br', '.store', '.tech', '.io']

export function HeroSection() {
  const { format, currency } = useCurrency()
  const [domain, setDomain] = useState('')
  const [searching, setSearching] = useState(false)

  const starterPlan = HOSTING_PLANS[0]
  const prices: Record<Currency, number> = { AKZ: starterPlan.price_akz, BRL: starterPlan.price_brl, USD: starterPlan.price_usd }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain.trim()) return
    setSearching(true)
    setTimeout(() => setSearching(false), 1500)
  }

  return (
    <section className="relative overflow-hidden bg-hero noise min-h-screen flex flex-col justify-center">
      {/* Animated orbs */}
      <div className="absolute inset-0 bg-mesh pointer-events-none" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl animate-pulse-slow delay-500" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-3xl" />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="relative container mx-auto px-4 py-20 lg:py-28">
        <div className="max-w-5xl mx-auto text-center">

          {/* Top badge */}
          <div className="inline-flex items-center gap-2 glass rounded-full px-5 py-2.5 mb-8 animate-fade-in-up">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-slate-300 font-medium">99.9% Uptime Garantido • Servidores Online</span>
            <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">PRO</span>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-6 animate-fade-in-up delay-100">
            Hospedagem Web{' '}
            <span className="gradient-text">Premium</span>
            <br />
            para o seu{' '}
            <span className="relative inline-block">
              <span className="gradient-text">Negócio</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path d="M2 8C50 3 150 1 298 8" stroke="url(#u1)" strokeWidth="3" strokeLinecap="round"/>
                <defs><linearGradient id="u1" x1="0" y1="0" x2="300" y2="0"><stop stopColor="#818cf8"/><stop offset="1" stopColor="#c084fc"/></linearGradient></defs>
              </svg>
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed animate-fade-in-up delay-200">
            Performance ultrarrápida com <strong className="text-indigo-400">LiteSpeed</strong> e <strong className="text-indigo-400">NVMe SSD</strong>.
            SSL grátis, cPanel Premium e suporte 24/7. Comece hoje a partir de{' '}
            <strong className="text-white">{format(prices[currency])}/mês</strong>.
          </p>

          {/* Domain search */}
          <div className="max-w-2xl mx-auto mb-10 animate-fade-in-up delay-300">
            <form onSubmit={handleSearch} className="relative">
              <div className="flex glass rounded-2xl p-2 border border-indigo-500/30 focus-within:border-indigo-400/60 transition-all">
                <div className="flex items-center pl-4">
                  <Search size={20} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  placeholder="Pesquise o seu domínio ideal..."
                  className="flex-1 bg-transparent text-white placeholder-slate-500 px-4 py-3 text-lg focus:outline-none domain-input"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="btn-shimmer bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {searching ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Pesquisando...</>
                  ) : (
                    <>Pesquisar<ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </form>
            {/* Domain extensions */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {DOMAIN_EXTENSIONS.map(ext => (
                <button
                  key={ext}
                  onClick={() => setDomain(domain.replace(/\.[^.]+$/, '') + ext)}
                  className="text-xs text-slate-400 hover:text-indigo-400 bg-slate-800/60 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-600 px-3 py-1.5 rounded-lg transition-all font-mono"
                >
                  {ext}
                </button>
              ))}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in-up delay-400">
            <Link href="/register"
              className="btn-shimmer animate-glow bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-10 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-2xl shadow-indigo-500/30 flex items-center justify-center gap-2">
              Começar Agora — Grátis
              <ArrowRight size={20} />
            </Link>
            <Link href="/#planos"
              className="border-2 border-white/20 hover:border-indigo-400/60 text-white hover:text-indigo-300 px-10 py-4 rounded-2xl font-bold text-lg transition-all hover:bg-indigo-950/50 flex items-center justify-center gap-2">
              Ver Todos os Planos
            </Link>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto animate-fade-in-up delay-500">
            {[
              { icon: Zap, label: 'LiteSpeed', sublabel: '10x mais rápido', color: 'text-yellow-400' },
              { icon: Shield, label: 'DDoS Protection', sublabel: 'Proteção total', color: 'text-green-400' },
              { icon: Server, label: 'cPanel Premium', sublabel: 'Interface completa', color: 'text-blue-400' },
              { icon: Star, label: 'Suporte 24/7', sublabel: 'Sempre disponível', color: 'text-purple-400' },
            ].map(({ icon: Icon, label, sublabel, color }) => (
              <div key={label} className="glass rounded-2xl p-4 text-center card-hover border border-white/5">
                <Icon size={28} className={`${color} mx-auto mb-2`} />
                <div className="text-white font-semibold text-sm">{label}</div>
                <div className="text-slate-500 text-xs mt-0.5">{sublabel}</div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 mt-12 animate-fade-in-up delay-600">
            <div className="flex -space-x-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-900 bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />)}
              </div>
              <p className="text-slate-400 text-sm"><strong className="text-white">+5.000</strong> clientes satisfeitos</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
