import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ShopPage } from '@/components/purchase/ShopPage'
import { DomainShop } from '@/components/purchase/DomainShop'

export const metadata: Metadata = { title: 'Pesquisar Domínio', description: 'Pesquise a disponibilidade do seu domínio e registe-o na ViralizaHost.' }

export default function PesquisarDominioPage() {
  return (
    <ShopPage title="Pesquisar domínio" subtitle="Veja se o nome está livre, compare alternativas e escolha a duração do registo.">
      <Suspense><DomainShop /></Suspense>
    </ShopPage>
  )
}
