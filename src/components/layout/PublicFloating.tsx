'use client'
import { usePathname } from 'next/navigation'
import { FloatingChat } from './FloatingChat'
import { isPublicPage } from '@/lib/site/areas'

// WhatsApp (canto inferior esquerdo) e chat (canto inferior direito) em TODAS as páginas públicas, a partir do
// layout raiz: uma única instância por página. A Área do Cliente tem a sua (DashboardShell) e o painel não tem.
export function PublicFloating() {
  const pathname = usePathname() ?? '/'
  if (!isPublicPage(pathname)) return null
  return <FloatingChat pageContext={pathname} />
}
