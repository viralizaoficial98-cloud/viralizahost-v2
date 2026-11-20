'use client'
import Link from 'next/link'
import Image from 'next/image'

// O carrinho é persistente: sair do checkout pelo logótipo já não o esvazia.
export function CheckoutLogo() {
  return (
    <Link href="/" className="flex items-center">
      <Image src="/logo-viraliza-yellow.png" alt="ViralizaHost" width={160} height={40} className="h-9 w-auto" priority />
    </Link>
  )
}
