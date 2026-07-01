import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { Mail, Phone, MapPin, MessageCircle, Globe2, Play, Briefcase, Users } from 'lucide-react'

const columns = [
  {
    title: 'Hospedagem',
    links: [
      { label: 'Starter Host', href: '#planos' },
      { label: 'Business Cloud', href: '#planos' },
      { label: 'Cloud Pro', href: '#planos' },
      { label: 'Revenda WHM', href: '#planos' },
    ],
  },
  {
    title: 'Servidores',
    links: [
      { label: 'Servidor VPS', href: '#servicos' },
      { label: 'Servidor Dedicado', href: '#servicos' },
      { label: 'VPS n8n Auto-hospedado', href: '#servicos' },
      { label: 'Cloud Privado', href: '#servicos' },
    ],
  },
  {
    title: 'Domínios',
    links: [
      { label: 'Pesquisar Domínio', href: '#dominios' },
      { label: 'Transferir Domínio', href: '#dominios' },
      { label: 'Domínios .ao', href: '#dominios' },
      { label: 'Domínios .com.br', href: '#dominios' },
    ],
  },
  {
    title: 'E-mail Corporativo',
    links: [
      { label: 'Plano Starter', href: '#email-plans' },
      { label: 'Plano Business', href: '#email-plans' },
      { label: 'Plano Enterprise', href: '#email-plans' },
      { label: 'Corporate Pro', href: '#email-plans' },
    ],
  },
  {
    title: 'IA & Automação',
    links: [
      { label: 'Agentes de IA', href: '#servicos' },
      { label: 'n8n Gerido', href: '#servicos' },
      { label: 'Integrações', href: '#servicos' },
      { label: 'Consultoria IA', href: '#servicos' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { label: 'Blog', href: '#' },
      { label: 'Documentação', href: '#' },
      { label: 'Tutoriais', href: '#' },
      { label: 'Afiliados', href: '#' },
    ],
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Central de Ajuda', href: '#' },
      { label: 'Abrir Ticket', href: '/tickets' },
      { label: 'Chat ao Vivo', href: '#' },
      { label: 'Status do Sistema', href: '#' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre a ViralizaHost', href: '#' },
      { label: 'Parceiros', href: '#' },
      { label: 'Carreiras', href: '#' },
      { label: 'Contacto', href: '#' },
    ],
  },
]

const socials = [
  { Icon: MessageCircle, href: '#', label: 'Instagram' },
  { Icon: Users, href: '#', label: 'Facebook' },
  { Icon: Globe2, href: '#', label: 'Twitter / X' },
  { Icon: Play, href: '#', label: 'YouTube' },
  { Icon: Briefcase, href: '#', label: 'LinkedIn' },
]

const payments = ['Visa', 'Mastercard', 'PayPal', 'Pix', 'Multicaixa', 'Transferência']

export function Footer() {
  return (
    <footer className="bg-[#F5F5F5] border-t border-[#E8E8E8]">
      {/* Top yellow accent */}
      <div className="h-1 bg-[#F5B700]" />

      <div className="container mx-auto px-4 pt-14 pb-8">
        {/* Brand + contact */}
        <div className="flex flex-col lg:flex-row gap-10 mb-12 pb-12 border-b border-[#E0E0E0]">
          <div className="lg:w-72 shrink-0 space-y-5">
            <Logo variant="dark" size="sm" />
            <p className="text-[#555] text-sm leading-relaxed">
              Hospedagem web premium com LiteSpeed, NVMe SSD e suporte 24/7. Servindo Angola, Brasil e o mundo.
            </p>
            <div className="space-y-2 text-sm">
              {[
                { Icon: Mail, text: 'suporte@viralizahost.com' },
                { Icon: Phone, text: '+244 923 000 000' },
                { Icon: MapPin, text: 'Luanda, Angola · São Paulo, Brasil' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-[#555] hover:text-[#0A0A0A] transition-colors">
                  <Icon size={13} className="text-[#F5B700] shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 pt-1">
              {socials.map(({ Icon, href, label }) => (
                <a key={label} href={href} aria-label={label}
                  className="w-9 h-9 bg-white border border-[#E0E0E0] hover:border-[#F5B700] hover:bg-[#FFFDF0] rounded-xl flex items-center justify-center text-[#666] hover:text-[#0A0A0A] transition-all">
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8">
            {columns.map(({ title, links }) => (
              <div key={title}>
                <h4 className="text-[#0A0A0A] font-bold text-sm mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href} className="text-[#666] hover:text-[#0A0A0A] text-[13px] transition-colors hover:underline underline-offset-2">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Payment methods */}
        <div className="mb-8 pb-8 border-b border-[#E0E0E0]">
          <p className="text-xs text-[#999] mb-3 font-medium uppercase tracking-wider text-center">Métodos de pagamento aceites</p>
          <div className="flex flex-wrap justify-center gap-2">
            {payments.map(m => (
              <span key={m} className="text-xs text-[#555] bg-white border border-[#E0E0E0] px-3.5 py-2 rounded-lg font-medium">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#999]">
          <p>© {new Date().getFullYear()} ViralizaHost. Todos os direitos reservados.</p>
          <div className="flex flex-wrap justify-center gap-4">
            {['Termos de Serviço', 'Política de Privacidade', 'Política de Cookies', 'LGPD'].map(l => (
              <Link key={l} href="#" className="hover:text-[#0A0A0A] transition-colors">{l}</Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span>🇦🇴 Angola</span>
            <span>🇧🇷 Brasil</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse" />
              <span className="text-green-600">Sistemas operacionais</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
