import Link from 'next/link'
import { ArrowRight, MessageSquare } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-800" />
      <div className="absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.05) 1px, transparent 1px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-10 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      <div className="relative container mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-5 py-2.5 mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white text-sm font-semibold">Servidores online e prontos para si</span>
        </div>

        <h2 className="text-4xl lg:text-6xl font-black text-white mb-6 leading-tight">
          Pronto para Crescer <br /> com a ViralizaHost?
        </h2>
        <p className="text-xl text-indigo-200 mb-10 max-w-2xl mx-auto">
          Junte-se a mais de 5.000 empresas que confiam na ViralizaHost. Configure em minutos, sem cartão de crédito obrigatório.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/register"
            className="btn-shimmer inline-flex items-center justify-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 px-10 py-5 rounded-2xl font-black text-lg transition-all hover:scale-105 shadow-2xl">
            Começar Agora — Grátis
            <ArrowRight size={22} />
          </Link>
          <Link href="/tickets"
            className="inline-flex items-center justify-center gap-2 border-2 border-white/40 hover:border-white text-white hover:bg-white/10 px-10 py-5 rounded-2xl font-bold text-lg transition-all">
            <MessageSquare size={22} />
            Falar com Especialista
          </Link>
        </div>

        {/* Guarantees */}
        <div className="flex flex-wrap justify-center gap-6 text-white/80 text-sm">
          {['✓ Sem cartão de crédito', '✓ Garantia de 30 dias', '✓ Cancele quando quiser', '✓ Migração gratuita'].map(g => (
            <span key={g} className="font-medium">{g}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
