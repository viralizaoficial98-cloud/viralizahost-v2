'use client'
import Link from 'next/link'
import { useEffect, useSyncExternalStore } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/store/cartStore'
import { startCartSync } from '@/store/cartSync'

// Acesso ao carrinho no cabeçalho, com contador. O contador só aparece depois de
// ler o carrinho guardado no navegador (evita diferenças entre servidor e cliente).
export function CartButton({ className = '', onClick }: { className?: string; onClick?: () => void }) {
  const hydrated = useSyncExternalStore(cb => useCart.persist.onFinishHydration(cb), () => useCart.persist.hasHydrated(), () => false)
  const count = useCart(s => s.lines.length)
  const n = hydrated ? count : 0
  useEffect(() => { startCartSync() }, [])
  return (
    <Link href="/carrinho" onClick={onClick} data-testid="header-cart"
      aria-label={n ? `Carrinho, ${n} ${n === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
      className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] transition-all ${className}`}>
      <ShoppingCart size={20} />
      {n > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F5B700] text-[#0A0A0A] text-[11px] font-black flex items-center justify-center" data-testid="header-cart-count">{n}</span>
      )}
    </Link>
  )
}
