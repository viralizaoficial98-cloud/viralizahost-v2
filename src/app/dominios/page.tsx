import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FloatingChat } from '@/components/layout/FloatingChat'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { Shield, Lock, Zap, RefreshCw, Globe, Headphones } from 'lucide-react'
import { DominiosListing } from '@/components/landing/DominiosListing'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Domínios — Todos os preços | ViralizaHost',
  description: 'Veja todos os domínios disponíveis e registe o seu com o melhor preço em Angola.',
}

const benefits = [
  { icon: Lock, title: 'SSL Grátis', desc: 'HTTPS incluído no registo' },
  { icon: Shield, title: 'WHOIS Protegido', desc: 'Privacidade total dos seus dados' },
  { icon: Zap, title: 'DNS Ultrarrápido', desc: 'Propagação em minutos' },
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Nunca perca o seu domínio' },
  { icon: Globe, title: 'Subdomínios Ilimitados', desc: 'Organize como quiser' },
  { icon: Headphones, title: 'Suporte 24/7', desc: 'Equipa técnica especializada' },
]

export default async function DominiosPage() {
  const supabase = createAdminWriteClient()
  const { data, error } = await supabase
    .from('site_domains')
    .select('extension, price_annual, price_monthly, currency, popular, label')
    .eq('active', true)
    .order('position')

  const extensions = data ?? []
  const fetchError = error ? error.message : null

  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="bg-[#0A0A0A] pt-28 pb-16 text-center px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#F5B700]" />
            <p className="text-[#F5B700] text-xs font-bold tracking-widest uppercase">Registo de Domínios</p>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#F5B700]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
            Todos os domínios{' '}
            <span className="text-[#F5B700]">e preços</span>
          </h1>
          <p className="text-[#999] text-base md:text-lg max-w-2xl mx-auto">
            Escolha a extensão certa para a sua marca. Activação imediata, SSL incluído.
          </p>
        </section>

        {/* Extensions grid with search */}
        <DominiosListing extensions={extensions} fetchError={fetchError} />

        {/* Benefits */}
        <section className="bg-[#FAFAFA] py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-xs font-black text-[#999] uppercase tracking-widest mb-8">
              Incluído em todos os domínios
            </p>
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[#E8E8E8] rounded-2xl overflow-hidden"
              style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.06)' }}
            >
              {benefits.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white px-4 py-6 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FFF8E1]">
                    <Icon size={18} className="text-[#F5B700]" />
                  </div>
                  <p className="text-[#0A0A0A] font-bold text-xs leading-tight">{title}</p>
                  <p className="text-[#999] text-[11px] leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingChat />
    </>
  )
}
