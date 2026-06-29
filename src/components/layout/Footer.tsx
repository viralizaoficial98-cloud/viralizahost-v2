import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { Mail, Phone, MapPin, MessageCircle, Globe2 } from 'lucide-react'

const footerLinks = {
  'Hospedagem': [
    { label: 'Starter Host', href: '#planos' },
    { label: 'Business Cloud', href: '#planos' },
    { label: 'Cloud Pro', href: '#planos' },
    { label: 'Revenda WHM', href: '#planos' },
  ],
  'Serviços': [
    { label: 'Domínios', href: '#dominios' },
    { label: 'Emails Corporativos', href: '#emails' },
    { label: 'Certificados SSL', href: '#ssl' },
    { label: 'Backup Cloud', href: '#backup' },
  ],
  'Empresa': [
    { label: 'Sobre Nós', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Afiliados', href: '#' },
    { label: 'Contacto', href: '#' },
  ],
  'Suporte': [
    { label: 'Central de Ajuda', href: '#' },
    { label: 'Abrir Ticket', href: '/tickets' },
    { label: 'Termos de Serviço', href: '#' },
    { label: 'Política de Privacidade', href: '#' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-[#FFC107]/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-30" />
      <div className="relative container mx-auto px-4 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 mb-12">
          <div className="lg:col-span-2 space-y-5">
            <Logo size="md" />
            <p className="text-sm leading-relaxed text-gray-500">
              Hospedagem web premium com performance LiteSpeed, segurança avançada e suporte 24/7.
              Servindo Angola, Brasil e o mundo.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3 text-gray-500">
                <Mail size={14} className="text-yellow-400 shrink-0" />
                <span>suporte@viralizahost.com</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500">
                <Phone size={14} className="text-yellow-400 shrink-0" />
                <span>+244 923 000 000</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500">
                <MapPin size={14} className="text-yellow-400 shrink-0" />
                <span>Luanda, Angola • São Paulo, Brasil</span>
              </div>
            </div>
            <div className="flex gap-3">
              {[MessageCircle, Globe2].map((Icon, i) => (
                <a key={i} href="#"
                  className="w-9 h-9 bg-[#1A1A1A] hover:bg-yellow-500 border border-[#333] hover:border-yellow-500 rounded-xl flex items-center justify-center text-gray-500 hover:text-black transition-all">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-white font-bold mb-4 text-sm">{title}</h4>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-gray-500 hover:text-yellow-400 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[#1A1A1A] pt-8 mb-8">
          <p className="text-xs text-gray-600 mb-4 text-center">Métodos de pagamento aceites</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['Mercado Pago', 'PayPal', 'Visa', 'Mastercard', 'Pix', 'Transferência'].map(m => (
              <span key={m} className="text-xs text-gray-600 bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-1.5 rounded-lg">{m}</span>
            ))}
          </div>
        </div>
        <div className="border-t border-[#1A1A1A] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} ViralizaHost. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span>🇦🇴 Angola</span><span>•</span><span>🇧🇷 Brasil</span><span>•</span><span>🌍 Internacional</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Todos os sistemas operacionais
          </div>
        </div>
      </div>
    </footer>
  )
}
