import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-6">Pronto para começar?</h2>
        <p className="text-xl text-indigo-200 mb-10 max-w-2xl mx-auto">
          Junte-se a milhares de empresas que confiam na ViralizaHost. Configure em minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-50 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105">
            Começar Agora <ArrowRight size={20} />
          </Link>
          <Link href="/tickets" className="inline-flex items-center gap-2 border border-white/40 hover:border-white text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:bg-white/10">
            Falar com Suporte
          </Link>
        </div>
      </div>
    </section>
  )
}
