'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Navegação da área Cloud VPS (uma página por secção; nada concentrado numa página única).
export const CLOUD_SECTIONS = [
  ['', 'Visão geral'], ['servidores', 'Servidores VPS'], ['solicitacoes', 'Solicitações'], ['planos', 'Planos e preços'], ['fornecedores', 'Fornecedores Cloud'],
  ['sistemas', 'SO e aplicações'], ['datacenters', 'Datacenters'], ['aprovisionamento', 'Aprovisionamento'], ['custos', 'Custos e rentabilidade'], ['configuracoes', 'Configurações'],
] as const
export function CloudNav() {
  const path = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto bg-white border border-[#E5E7EB] rounded-xl p-1 -mx-1 sm:mx-0" aria-label="Cloud VPS" data-testid="cv-nav">
      {CLOUD_SECTIONS.map(([slug, label]) => {
        const href = `/admin/cloud-vps${slug ? `/${slug}` : ''}`
        const active = slug ? path.startsWith(href) : path === '/admin/cloud-vps'
        return <Link key={slug} href={href} className={`whitespace-nowrap px-3 py-2 rounded-lg text-sm font-semibold ${active ? 'bg-[#F5B700] text-black' : 'text-[#64748B] hover:text-black'}`} data-testid={`cv-nav-${slug || 'overview'}`}>{label}</Link>
      })}
    </nav>
  )
}
