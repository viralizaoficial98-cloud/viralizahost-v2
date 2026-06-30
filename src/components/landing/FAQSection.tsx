'use client'
import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

const faqs = [
  {
    q: 'O que está incluído nos planos de hospedagem?',
    a: 'Todos os planos incluem cPanel Premium, SSL grátis (Let\'s Encrypt), backup automático, Softaculous para instalar WordPress e outras apps, proteção DDoS básica e suporte técnico 24/7 via chat e ticket. Planos superiores incluem backup diário, IP dedicado e Wildcard SSL.',
  },
  {
    q: 'Posso migrar o meu site atual para a ViralizaHost?',
    a: 'Sim! Oferecemos migração gratuita para todos os novos clientes. Nossa equipa técnica realiza a migração completa — ficheiros, bases de dados e emails — sem downtime. O processo demora em média 2-4 horas dependendo do tamanho do site.',
  },
  {
    q: 'Quais métodos de pagamento são aceites?',
    a: 'Aceitamos Mercado Pago (cartão, Pix, boleto), PayPal, transferência bancária e pagamento em Kwanzas (AKZ) para clientes angolanos. Todos os planos podem ser pagos mensalmente ou anualmente (com 30% de desconto).',
  },
  {
    q: 'Vocês têm garantia de reembolso?',
    a: 'Sim, oferecemos garantia de reembolso de 30 dias sem perguntas para novos clientes. Se não estiver satisfeito por qualquer razão nos primeiros 30 dias, devolvemos 100% do valor pago.',
  },
  {
    q: 'Qual é a diferença entre hospedagem compartilhada e cloud?',
    a: 'Na hospedagem compartilhada, os recursos (CPU, RAM) são partilhados entre vários clientes no mesmo servidor. No Cloud Hosting, você tem recursos dedicados e escaláveis. Para a maioria dos sites, a hospedagem compartilhada com LiteSpeed é mais que suficiente.',
  },
  {
    q: 'Posso usar o WordPress na ViralizaHost?',
    a: 'Absolutamente! Todos os planos incluem Softaculous que permite instalar WordPress com um clique. Além disso, o LiteSpeed com LiteSpeed Cache é a combinação mais rápida para WordPress disponível no mercado.',
  },
  {
    q: 'Como funciona o suporte técnico?',
    a: 'Nosso suporte está disponível 24 horas por dia, 7 dias por semana através de chat em tempo real, sistema de tickets e WhatsApp. O tempo médio de resposta é de menos de 10 minutos. Também disponibilizamos uma base de conhecimento com centenas de tutoriais.',
  },
  {
    q: 'Posso fazer upgrade ou downgrade do meu plano?',
    a: 'Sim, pode fazer upgrade ou downgrade a qualquer momento. As mudanças são aplicadas imediatamente e o valor é calculado proporcionalmente. Nenhum dado é perdido durante a mudança de plano.',
  },
  {
    q: 'Os servidores estão localizados em Angola ou Brasil?',
    a: 'Temos infraestrutura em múltiplas localidades estratégicas para garantir baixa latência na África e América do Sul. Utilizamos CDN global para garantir velocidade de carregamento em qualquer parte do mundo.',
  },
  {
    q: 'O plano de Revenda WHM inclui marca branca?',
    a: 'Sim! O plano de Revenda WHM inclui marca branca completa — pode personalizar o painel com o seu logótipo, cores e nome de empresa. Os seus clientes não saberão que usa a ViralizaHost como infraestrutura.',
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <section id="faq" className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">FAQ</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Perguntas <span className="gradient-text">Frequentes</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto">
            Encontre respostas para as dúvidas mais comuns. Não encontrou? Contacte o nosso suporte.
          </p>
        </div>

        {/* Accordion */}
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, i) => (
            <div key={i}
              className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                openIndex === i
                  ? 'border-[#F5B700]/50 bg-[#FFFDF0] shadow-sm'
                  : 'border-[#E8E8E8] bg-white hover:border-[#F5B700]/30'
              }`}
            >
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between p-6 text-left gap-4 group"
              >
                <span className={`font-semibold text-sm leading-snug transition-colors ${
                  openIndex === i ? 'text-[#B88900]' : 'text-[#0A0A0A] group-hover:text-[#B88900]'
                }`}>
                  {faq.q}
                </span>
                <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center transition-all ${
                  openIndex === i
                    ? 'bg-[#F5B700] text-[#0A0A0A]'
                    : 'bg-[#F8F8F8] text-gray-400 group-hover:bg-[#FFF8E1] group-hover:text-[#B88900]'
                }`}>
                  {openIndex === i ? <Minus size={15} /> : <Plus size={15} />}
                </div>
              </button>

              <div className={`overflow-hidden transition-all duration-300 ${openIndex === i ? 'max-h-64' : 'max-h-0'}`}>
                <div className="px-6 pb-6 text-gray-600 leading-relaxed text-sm border-t border-[#F0F0F0] pt-4">
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-500 mb-4 text-sm">Ainda tem dúvidas? Estamos aqui para ajudar.</p>
          <a href="/tickets"
            className="inline-flex items-center gap-2 btn-dark px-8 py-3 rounded-2xl font-semibold text-sm">
            Falar com Suporte →
          </a>
        </div>
      </div>
    </section>
  )
}
