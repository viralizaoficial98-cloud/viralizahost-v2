'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw, LifeBuoy, Mail, Globe } from 'lucide-react'
import { useCart } from '@/store/cartStore'
import { CpanelButton } from '@/components/hosting/HostingCard'

// Acções por tipo de serviço. Cada acção chama uma rota que volta a verificar,
// no servidor, que o serviço pertence ao cliente da sessão.

export interface ServiceActionProps {
  id: string
  name: string
  kind: 'hosting' | 'email' | 'domain' | 'server' | 'other'
  domain: string | null
  active: boolean
  hasCpanel: boolean
  canRenew: boolean
  renewalPendingOrder: string | null
}

const btn = 'inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#0B0B0D] hover:border-[#F5B700] transition-colors'

export function ServiceActions(p: ServiceActionProps) {
  const router = useRouter()
  const addRenewal = useCart(s => s.addRenewal)
  const addDomain = useCart(s => s.addDomain)
  const support = (what: string) => `/tickets?assunto=${encodeURIComponent(`${what} — ${p.name}${p.domain ? ` (${p.domain})` : ''}`)}`

  const renew = () => {
    if (p.kind === 'domain' && p.domain) addDomain(p.domain, 'renew')
    else addRenewal(p.id, `Renovação — ${p.name}`)
    router.push('/carrinho')
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="service-actions">
      {p.active && p.hasCpanel && (p.kind === 'hosting' || p.kind === 'email') && (
        <>
          {p.kind === 'hosting' && <CpanelButton serviceId={p.id} type="cpanel" />}
          <CpanelButton serviceId={p.id} type="webmail" />
          <Link href="/email" className={btn}><Mail size={14} /> Contas de e-mail</Link>
        </>
      )}
      {p.kind === 'domain' && p.active && (
        <Link href={support('Alterar nameservers/DNS')} className={btn}><Globe size={14} /> Pedir alteração de DNS/NS</Link>
      )}
      {p.kind === 'server' && p.active && (
        <Link href={support('Operação no servidor (reinício, reinstalação, acesso)')} className={btn}><LifeBuoy size={14} /> Pedir operação no servidor</Link>
      )}
      {p.renewalPendingOrder ? (
        <Link href={`/orders/${p.renewalPendingOrder}`} className={btn}><RefreshCw size={14} /> Renovação por pagar</Link>
      ) : p.canRenew ? (
        <button onClick={renew} className={btn} data-testid="renew"><RefreshCw size={14} /> Renovar</button>
      ) : null}
      <Link href={support('Ajuda com o serviço')} className={btn}><LifeBuoy size={14} /> Suporte</Link>
    </div>
  )
}
