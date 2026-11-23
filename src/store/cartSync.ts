'use client'
import { useCart, type CartLine } from './cartStore'

// Sincroniza o carrinho do navegador (localStorage) com o carrinho guardado no servidor (/api/cart).
// - ao abrir: se este navegador não tem itens, recupera os do servidor (ex.: depois de confirmar o
//   e-mail noutro separador ou de iniciar sessão noutro dispositivo); se tem, envia-os;
// - a cada alteração: envia (com pequena espera); esvaziar envia logo.
// O código EPP nunca sai do navegador por aqui (o servidor também o descarta).

let started = false
let timer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> = Promise.resolve()
let ready = false

const strip = (lines: CartLine[]) => lines.map(l => (l.type === 'domain' ? { ...l, eppCode: undefined } : l))

function push(lines: CartLine[]) {
  inflight = inflight.then(() => fetch('/api/cart', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lines: strip(lines) }), keepalive: true,
  }).then(() => undefined).catch(() => undefined))
  return inflight
}

/** Envia já o estado actual (usar antes de «Finalizar» e de mudar de página com decisão no servidor). */
export async function flushCart() {
  if (timer) { clearTimeout(timer); timer = null }
  await push(useCart.getState().lines)
}

async function initial() {
  try {
    const r = await fetch('/api/cart', { cache: 'no-store' })
    const j = await r.json() as { lines?: CartLine[] }
    const local = useCart.getState().lines
    if (!local.length && j.lines?.length) useCart.getState().replaceAll(j.lines)
    else if (local.length || j.lines?.length) await push(local)
  } catch { /* sem ligação: o carrinho local continua a funcionar */ }
  ready = true
}

export function startCartSync() {
  if (started || typeof window === 'undefined') return
  started = true
  const run = () => {
    void initial()
    useCart.subscribe((s, prev) => {
      if (!ready || s.lines === prev.lines) return
      if (timer) clearTimeout(timer)
      if (!s.lines.length) { void push([]); return }
      timer = setTimeout(() => { timer = null; void push(useCart.getState().lines) }, 300)
    })
  }
  if (useCart.persist.hasHydrated()) run()
  else useCart.persist.onFinishHydration(() => run())
}

/** Recarrega do servidor (ex.: depois de iniciar sessão: o carrinho da conta pode ter itens). */
export async function reloadCartFromServer() {
  await flushCart()
  const r = await fetch('/api/cart', { cache: 'no-store' }).then(x => x.json()).catch(() => null) as { lines?: CartLine[] } | null
  if (r?.lines?.length && !useCart.getState().lines.length) useCart.getState().replaceAll(r.lines)
}
