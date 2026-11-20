import type { Metadata } from 'next'
import Link from 'next/link'
import { ShopPage } from '@/components/purchase/ShopPage'

export const metadata: Metadata = { title: 'Renovar Domínio', description: 'Renove os seus domínios na Área do Cliente.' }

export default function RenovarDominioPage() {
  return (
    <ShopPage title="Renovar domínio" subtitle="As renovações são feitas na Área do Cliente, para os domínios da sua conta.">
      <div className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-6 space-y-3 text-sm text-[#444]">
        <p>1. Inicie sessão e abra <strong>Serviços</strong>.</p>
        <p>2. No domínio, escolha <strong>Renovar</strong>: o valor de renovação da extensão vai para o carrinho.</p>
        <p>3. Conclua a encomenda e envie o comprovativo. A data de expiração é prolongada depois de confirmado o pagamento.</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/services" className="px-5 py-3 rounded-xl text-sm font-bold bg-[#F5B700] text-[#0A0A0A]">Ir para os meus serviços</Link>
          <Link href="/dominios/transferir" className="px-5 py-3 rounded-xl text-sm font-bold border border-[#E8E8E8]">O domínio está noutro registrador? Transferir</Link>
        </div>
      </div>
    </ShopPage>
  )
}
