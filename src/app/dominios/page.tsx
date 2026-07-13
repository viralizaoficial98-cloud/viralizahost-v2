import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FloatingChat } from '@/components/layout/FloatingChat'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { Globe, Shield, Lock, Zap, RefreshCw, Headphones } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Domínios — Todos os preços | ViralizaHost',
  description: 'Veja todos os domínios disponíveis e registe o seu com o melhor preço em Angola.',
}

export const revalidate = 300

const currencySymbol: Record<string, string> = { AOA: 'Kz', AKZ: 'Kz', USD: '$', BRL: 'R$', EUR: '€' }

const benefits = [
  { icon: Lock, title: 'SSL Grátis', desc: 'HTTPS incluído no registo' },
  { icon: Shield, title: 'WHOIS Protegido', desc: 'Privacidade total dos seus dados' },
  { icon: Zap, title: 'DNS Ultrarrápido', desc: 'Propagação em minutos' },
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Nunca perca o seu domínio' },
  { icon: Globe, title: 'Subdomínios Ilimitados', desc: 'Organize como quiser' },
  { icon: Headphones, title: 'Suporte 24/7', desc: 'Equipa técnica especializada' },
]

type DomainRow = {
  extension: string
  price_annual: number | null
  price_monthly: number | null
  currency: string
  popular: boolean
  label: string | null
}

export default async function DominiosPage() {
  const supabase = createAdminWriteClient()
  const { data } = await supabase
    .from('site_domains')
    .select('extension, price_annual, price_monthly, currency, popular, label')
    .eq('active', true)
    .order('position')

  const extensions: DomainRow[] = data ?? []

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

        {/* Extensions grid */}
        <section className="bg-white py-16 px-4">
          <div className="max-w-6xl mx-auto">
            {extensions.length === 0 ? (
              <div className="text-center text-[#AAA] py-20">
                <Globe size={40} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">Não foi possível carregar os domínios. Tente novamente mais tarde.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {extensions.map(ext => {
                  const price = ext.price_annual ?? ext.price_monthly ?? 0
                  const sym = currencySymbol[ext.currency] ?? ext.currency
                  const priceFormatted = `${sym} ${price.toLocaleString('pt-AO')}/ano`
                  const popular = ext.popular

                  return (
                    <Link
                      key={ext.extension}
                      href={`/checkout?tld=${encodeURIComponent(ext.extension)}`}
                      className="group relative flex flex-col items-center text-center bg-white border rounded-2xl p-5 transition-all duration-200 hover:shadow-[0_8px_32px_rgba(245,183,0,0.22)] hover:-translate-y-1"
                      style={{
                        borderColor: popular ? '#F5B700' : '#EBEBEB',
                        boxShadow: popular ? '0 4px 24px rgba(245,183,0,0.18)' : '0 2px 12px rgba(0,0,0,0.05)',
                      }}
                    >
                      {popular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F5B700] text-[#0A0A0A] text-[10px] font-black px-3 py-0.5 rounded-full tracking-wide uppercase">
                          Popular
                        </span>
                      )}
                      <div className="text-2xl font-black text-[#0A0A0A] mb-1">{ext.extension}</div>
                      <div className="text-[11px] text-[#999] mb-3 leading-tight min-h-[2rem]">
                        {ext.label || ext.extension}
                      </div>
                      <div className="text-[13px] font-bold text-[#0A0A0A] mb-4">{priceFormatted}</div>
                      <span
                        className="w-full py-2 rounded-xl text-xs font-bold border text-center transition-all duration-200 group-hover:bg-[#F5B700] group-hover:border-[#F5B700] group-hover:text-[#0A0A0A]"
                        style={{
                          background: popular ? '#F5B700' : 'transparent',
                          borderColor: popular ? '#F5B700' : '#D0D0D0',
                          color: popular ? '#0A0A0A' : '#444',
                        }}
                      >
                        Registar
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </section>

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
