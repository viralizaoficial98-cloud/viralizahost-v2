import Link from 'next/link'
import { ArrowRight, MessageCircle } from 'lucide-react'

interface FinalCTAProps {
  title?: string
  subtitle?: string
  cta?: string
  ctaHref?: string
  ctaSecondary?: string
  ctaSecondaryHref?: string
}

export function FinalCTA({
  title = 'Pronto para começar?',
  subtitle = 'Crie a sua conta agora e aproveite 30 dias de garantia sem risco.',
  cta = 'Criar Conta Grátis',
  ctaHref = '/register',
  ctaSecondary = 'Falar com Especialista',
  ctaSecondaryHref = '/tickets',
}: FinalCTAProps) {
  return (
    <section className="bg-[#0A0A0A] py-20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#F5B700 1px,transparent 1px),linear-gradient(90deg,#F5B700 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(245,183,0,0.07),transparent)]" />

      <div className="relative container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">{title}</h2>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto">{subtitle}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={ctaHref}
            className="btn-primary btn-shimmer px-8 py-3.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-[0_4px_20px_rgba(245,183,0,0.30)]">
            {cta} <ArrowRight size={15} />
          </Link>
          <Link href={ctaSecondaryHref}
            className="px-8 py-3.5 rounded-xl text-sm font-semibold border border-white/15 text-white hover:border-[#F5B700]/40 hover:text-[#F5B700] transition-all flex items-center gap-2">
            <MessageCircle size={15} /> {ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  )
}
