import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Logo variant="light" />
            <p className="text-sm leading-relaxed">
              Hospedagem web premium com alta performance, segurança e suporte 24/7.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Hospedagem</h4>
            <ul className="space-y-2 text-sm">
              {[['Compartilhada','#'],['VPS','#'],['Dedicado','#'],['Revenda','#']].map(([l,h]) => (
                <li key={l}><Link href={h} className="hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Suporte</h4>
            <ul className="space-y-2 text-sm">
              {[['Abrir Ticket','/tickets'],['Documentação','#'],['Status','#'],['Contacto','#']].map(([l,h]) => (
                <li key={l}><Link href={h} className="hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm">
              {[['Sobre Nós','#'],['Termos','#'],['Privacidade','#'],['Reembolso','#']].map(([l,h]) => (
                <li key={l}><Link href={h} className="hover:text-white transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm">© {new Date().getFullYear()} ViralizaHost. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4 text-sm">
            <span>🇦🇴 Angola</span><span>🇧🇷 Brasil</span><span>🌍 Internacional</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
