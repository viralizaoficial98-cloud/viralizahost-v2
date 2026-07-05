'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useCheckoutStore } from '@/store/checkoutStore'

export function CheckoutLogo() {
  const clear = useCheckoutStore(s => s.clear)
  return (
    <Link href="/" onClick={clear} className="flex items-center">
      <Image src="/logo-viraliza-yellow.png" alt="ViralizaHost" width={160} height={40} className="h-9 w-auto" priority />
    </Link>
  )
}
