import Link from 'next/link'
import { ArrowRight, MessageSquare, Shield, Zap, Clock } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-24 bg-[#0A0A0A] relative overflow-hidden">
      {/* Yellow top line */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#F5B700] to-transparent" />

      {/* Subtle dot grid */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#F5B700]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative container mx-auto px-4 text-center">
        {/* Status badge */}
        <div className="inline-flex items-center gap-2 bg-white/8 border border-white/12 backdrop-blur rounded-full px-5 py-2.5 mb-10">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white/80 text-sm font-medium">Servidores online e prontos para si</span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl lg:text-6xl font-black text-white mb-6 leading-tight">
          Pronto para Crescer com a<br />
          <span className="bg-gradient-to-r from-[#F5B700] to-[#FFD54F] bg-clip-text text-transparent">
            ViralizaHost?
          </span>
        </h2>

        <p className="text-lg text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
          Junte-se a mais de 5.000 empresas que confiam na ViralizaHost. Configure em minutos, sem cartão de crédito obrigatório.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
          <Link href="/register"
            className="btn-shimmer inline-flex items-center justify-center gap-2 bg-[#F5B700] text-[#0A0A0A] hover:bg-[#D9A300] px-10 py-5 rounded-2xl font-black text-lg transition-all hover:scale-105 shadow-[0_8px_40px_rgba(245,183,0,0.35)]">
            Começar Agora — Grátis
            <ArrowRight size={22} />
          </Link>
          <Link href="/tickets"
            className="inline-flex items-center justify-center gap-2 border-2 border-white/20 hover:border-white/40 text-white hover:bg-white/8 px-10 py-5 rounded-2xl font-bold text-lg transition-all">
            <MessageSquare size={20} />
            Falar com Especialista
          </Link>
        </div>

        {/* Trust points */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-10">
          {[
            { icon: Shield, text: 'Sem cartão de crédito' },
            { icon: Clock, text: 'Garantia de 30 dias' },
            { icon: Zap, text: 'Cancele quando quiser' },
            { icon: ArrowRight, text: 'Migração gratuita' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center justify-center gap-2 text-white/50 text-sm">
              <Icon size={14} className="text-[#F5B700] flex-shrink-0" />
              {text}
            </div>
          ))}
        </div>

        {/* Flags */}
        <div className="flex items-center justify-center gap-4 text-white/30 text-sm">
          <span>🇦🇴 Angola</span>
          <span>•</span>
          <span>🇧🇷 Brasil</span>
          <span>•</span>
          <span>🌍 Internacional</span>
        </div>
      </div>
    </section>
  )
}
