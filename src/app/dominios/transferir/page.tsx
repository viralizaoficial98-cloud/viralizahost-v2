import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ShopPage } from '@/components/purchase/ShopPage'
import { DomainShop } from '@/components/purchase/DomainShop'

export const metadata: Metadata = { title: 'Transferir Domínio', description: 'Transfira o seu domínio para a ViralizaHost.' }

export default function TransferirDominioPage() {
  return (
    <ShopPage title="Transferir domínio" subtitle="Traga o seu domínio para a ViralizaHost. Desbloqueie-o no registrador actual e tenha à mão o código EPP (não é preciso para .ao).">
      <Suspense><DomainShop initialMode="transfer" /></Suspense>
    </ShopPage>
  )
}
