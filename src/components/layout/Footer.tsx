import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { Mail, Phone, MapPin, Share2, MessageCircle, Globe2, Users } from 'lucide-react'

const footerLinks = {
  'Hospedagem': [
    { label: 'Starter Host', href: '#planos' },
    { label: 'Business Cloud', href: '#planos' },
    { label: 'Cloud Pro', href: '#planos' },
    { label: 'Revenda WHM', href: '#planos' },
    { label: 'VPS', href: '#' },
  ],
  'Serviços': [
    { label: 'Domínios', href: '#dominios' },
    { label: 'Emails Corporativos', href: '#emails' },
    { label: 'Certificados SSL', href: '#ssl' },
    { label: 'Backup Cloud', href: '#backup' },
    { label: 'CDN Global', href: '#' },
  ],
  'Empresa': [
    { label: 'Sobre Nós', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Afiliados', href: '#' },
    { label: 'Status do Servidor', href: '#' },
    { label: 'Contacto', href: '#' },
  ],
  'Suporte': [
    { label: 'Central de Ajuda', href: '#' },
    { label: 'Abrir Ticket', href: '/tickets' },
    { label: 'Documentação', href: '#' },
    { label: 'Termos de Serviço', href: '#' },
    { label: 'Política de Privacidade', href: '#' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
      <div className="absolute inset-0 bg-mesh opacity-10" />

      <div className="relative container mx-auto px-4 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-5">
            <Logo variant="light" size="lg" />
            <p className="text-sm leading-relaxed text-slate-400">
              Hospedagem web premium com performance LiteSpeed, segurança avançada e suporte 24/7.
              Servindo Angola, Brasil e o mundo.
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <Mail size={14} className="text-indigo-400 flex-shrink-0" />
                <span>suporte@viralizahost.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-indigo-400 flex-shrink-0" />
                <span>+244 923 000 000</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={14} className="text-indigo-400 flex-shrink-0" />
                <span>Luanda, Angola • São Paulo, Brasil</span>
              </div>
            </div>

            {/* Social */}
            <div className="flex gap-3">
              {[Share2, MessageCircle, Globe2, Users].map((Icon, i) => (
                <a key={i} href="#"
                  className="w-9 h-9 bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-white font-bold mb-4 text-sm">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm hover:text-indigo-400 transition-colors hover:translate-x-1 inline-block">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Payment methods */}
        <div className="border-t border-slate-800 pt-8 mb-8">
          <p className="text-xs text-slate-600 mb-4 text-center">Métodos de pagamento aceites</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Mercado Pago', 'PayPal', 'Visa', 'Mastercard', 'Pix', 'Transferência'].map(m => (
              <span key={m} className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">{m}</span>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} ViralizaHost. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>🇦🇴 Angola</span>
            <span>•</span>
            <span>🇧🇷 Brasil</span>
            <span>•</span>
            <span>🌍 Internacional</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Todos os sistemas operacionais
          </div>
        </div>
      </div>
    </footer>
  )
}
