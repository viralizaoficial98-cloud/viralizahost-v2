'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ChevronRight, Clock, Globe, Loader2, Minus, Pencil, Plus, Server, ShoppingCart, Trash2 } from 'lucide-react'
import { useCart, type CartLine, type Cycle, type DomainMode } from '@/store/cartStore'
import { flushCart } from '@/store/cartSync'
import { CYCLE_LABEL, PurchaseSteps, Summary, btnGhost, btnPrimary, card, discountOf, input, kz, periodOf, renewalOf, useCartHydrated, useQuote, type QuoteLine } from '@/components/checkout/shared'

// Carrinho: todos os itens (domínios, alojamento, e-mail, renovações) com período, preço agora e
// renovação calculados no servidor. Editar, remover, continuar a comprar, esvaziar e «Finalizar»
// (o passo seguinte é decidido no servidor: cadastro, dados do cliente ou pagamento).

function lineTitle(l: CartLine, q?: QuoteLine) {
  if (q?.name) return q.name
  if (l.type === 'domain') return `${l.operation === 'transfer' ? 'Transferência' : l.operation === 'renew' ? 'Renovação' : 'Registo'} de domínio ${l.domain}`
  if (l.type === 'renewal') return l.label ?? 'Renovação'
  return l.slug
}

function Line({ l, q, onRemove }: { l: CartLine; q?: QuoteLine; onRemove: () => void }) {
  const update = useCart(s => s.update)
  const addDomain = useCart(s => s.addDomain)
  const Icon = l.type === 'domain' ? Globe : Server
  return (
    <li className="border border-[#E8E8E8] rounded-xl p-4 bg-white" data-testid="cart-line" data-type={l.type} data-domain={l.type === 'domain' ? l.domain : l.type === 'product' ? l.domain ?? '' : ''}>
      <div className="flex items-start gap-3">
        <span className="hidden sm:flex w-9 h-9 rounded-lg bg-[#FFF7D6] items-center justify-center shrink-0"><Icon size={17} className="text-[#B38600]" /></span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3">
            <p className="font-bold text-[#0A0A0A] break-words">{lineTitle(l, q)}</p>
            {q && !q.error && <p className="font-black text-[#0A0A0A] whitespace-nowrap" data-testid="line-total">{kz(q.lineTotal)}</p>}
          </div>
          {q && !q.error && (
            <dl className="mt-1 grid grid-cols-2 sm:flex sm:flex-wrap gap-x-5 gap-y-0.5 text-xs text-[#666]">
              <div><dt className="inline">Período: </dt><dd className="inline font-semibold text-[#333]" data-testid="line-period">{periodOf(q)}</dd></div>
              {q.type !== 'renewal' && <div><dt className="inline">Renovação: </dt><dd className="inline font-semibold text-[#333]" data-testid="line-renewal">{renewalOf(q)}</dd></div>}
              {(q.quantity > 1 || q.quantityUnit) && <div><dt className="inline">Quantidade: </dt><dd className="inline font-semibold text-[#333]" data-testid="line-quantity">{q.quantity}{q.quantityUnit === 'caixa' ? ` ${q.quantity === 1 ? 'caixa de correio' : 'caixas de correio'}` : ''}</dd></div>}
              {discountOf(q) && <div><dt className="sr-only">Desconto: </dt><dd className="inline font-semibold text-green-700" data-testid="line-discount">{discountOf(q)}</dd></div>}
            </dl>
          )}
          {q?.error && (
            <p className="text-sm text-red-700 mt-1 flex items-start gap-1" role="alert"><AlertCircle size={14} className="mt-0.5 shrink-0" />{q.error.message}
              {q.error.code === 'on_request' && <Link href="/suporte/contactar" className="underline ml-1">Contactar</Link>}</p>
          )}
          {q?.availability?.status === 'confirm' && (
            <p className="text-xs text-amber-800 mt-2 flex gap-1" data-testid="line-confirm"><Clock size={13} className="shrink-0 mt-0.5" /> A confirmar pela equipa. Pode pagar agora: a nossa equipa vai confirmar a disponibilidade do domínio antes de o registar.</p>
          )}

          {l.type === 'domain' && l.operation === 'register' && (
            <p className="text-xs text-[#666] mt-2" data-testid="line-ns">Nameservers: {q?.nameservers
              ? <span className="font-mono text-[#333]">{q.nameservers.ns.join(', ')}</span>
              : l.nameservers && !l.nameservers.useDefault ? <span className="font-mono text-[#333]">{l.nameservers.ns.join(', ')}</span> : 'padrão da ViralizaHost'}
              {(q?.nameservers?.useDefault ?? l.nameservers?.useDefault ?? true) ? ' (padrão ViralizaHost)' : ' (próprios)'}</p>
          )}
          {l.type === 'domain' && l.operation === 'transfer' && (
            <label className="block text-xs text-[#888] mt-3">Código de autorização (EPP) {q?.extension?.endsWith('.ao') ? '(opcional para .ao)' : ''}
              <input type="password" autoComplete="off" className={`${input} mt-1`} value={l.eppCode ?? ''} onChange={e => update(l.key, { eppCode: e.target.value })} />
              <span className="block mt-1 text-[11px]">Guardado cifrado e usado apenas para a transferência. Não fica guardado no navegador.</span>
            </label>
          )}

          {l.type === 'product' && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <label className="text-xs text-[#888]">Ciclo de facturação
                <select className={`${input} mt-1`} value={l.cycle} onChange={e => update(l.key, { cycle: e.target.value as Cycle })} aria-label={`Ciclo de ${lineTitle(l, q)}`}>
                  {(q?.cycles?.length ? q.cycles : [{ cycle: l.cycle, months: 0, price: 0, renewal: 0 }]).map(c => (
                    <option key={c.cycle} value={c.cycle}>{CYCLE_LABEL[c.cycle as Cycle]}{c.price ? ` — ${kz(c.price * (l.quantity || 1))}` : ''}{c.discount ? ` (−${c.discount}%)` : ''}</option>
                  ))}
                </select>
              </label>
              {q?.quantityUnit && (
                <div className="text-xs text-[#888]">Quantidade ({q.quantityUnit}s)
                  <div className="flex items-center gap-2 mt-1">
                    <button className={btnGhost} aria-label="Diminuir" onClick={() => update(l.key, { quantity: Math.max(1, l.quantity - 1) })}><Minus size={14} /></button>
                    <span className="w-10 text-center font-bold text-sm text-[#0A0A0A]" aria-live="polite">{l.quantity}</span>
                    <button className={btnGhost} aria-label="Aumentar" onClick={() => update(l.key, { quantity: Math.min(q.maxQuantity ?? 1, l.quantity + 1) })}><Plus size={14} /></button>
                  </div>
                </div>
              )}
              {(q?.serviceType === 'hosting' || q?.serviceType === 'email') && (
                <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
                  <label className="text-xs text-[#888]">Domínio do serviço
                    <input className={`${input} mt-1`} placeholder="exemplo.ao" value={l.domain ?? ''} onChange={e => update(l.key, { domain: e.target.value.trim().toLowerCase() })} />
                  </label>
                  <label className="text-xs text-[#888]">Este domínio…
                    <select className={`${input} mt-1`} value={l.domainMode ?? 'existing'} onChange={e => {
                      const mode = e.target.value as DomainMode
                      update(l.key, { domainMode: mode })
                      if (l.domain && mode !== 'existing') addDomain(l.domain, mode)
                    }}>
                      <option value="existing">já é meu (sem custo)</option>
                      <option value="register">é novo — registar</option>
                      <option value="transfer">é meu noutro registrador — transferir</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {l.type === 'domain' && l.operation === 'register' && (
              <Link href={`/dominios/configurar?dominio=${encodeURIComponent(l.domain)}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[#E8E8E8] hover:border-[#F5B700]" data-testid="edit-line"><Pencil size={13} /> Editar</Link>
            )}
            {l.type === 'product' && (
              <Link href={`/comprar/${l.slug}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[#E8E8E8] hover:border-[#F5B700]">Ver plano</Link>
            )}
            <button onClick={onRemove} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-[#E8E8E8] text-[#666] hover:border-red-300 hover:text-red-700" aria-label={`Remover ${lineTitle(l, q)} do carrinho`} data-testid="remove-line"><Trash2 size={13} /> Remover</button>
          </div>
        </div>
      </div>
    </li>
  )
}

export function CartView() {
  const router = useRouter()
  const hydrated = useCartHydrated()
  const lines = useCart(s => s.lines)
  const remove = useCart(s => s.remove)
  const clear = useCart(s => s.clear)
  const { quote, loading, error, refresh } = useQuote(lines, hydrated && lines.length > 0)
  const [confirmClear, setConfirmClear] = useState(false)
  const [going, setGoing] = useState(false)

  if (!hydrated) return <div className="flex items-center justify-center min-h-[40vh]" role="status"><Loader2 className="animate-spin text-[#F5B700]" /><span className="sr-only">A carregar o carrinho…</span></div>

  if (!lines.length) {
    return (
      <div className={`${card} text-center py-12`} data-testid="cart-empty">
        <ShoppingCart className="mx-auto text-[#CCC] mb-3" size={40} />
        <h1 className="text-2xl font-black mb-2">O carrinho está vazio</h1>
        <p className="text-sm text-[#888] mb-6">Pesquise um domínio ou escolha um serviço para começar.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link className={btnPrimary} href="/dominios/pesquisar"><Globe size={16} /> Pesquisar domínio</Link>
          <Link className={btnGhost} href="/hospedagem-de-sites">Hospedagem</Link>
          <Link className={btnGhost} href="/email-corporativo">E-mail</Link>
          <Link className={btnGhost} href="/servidor-vps">VPS</Link>
        </div>
      </div>
    )
  }

  const finalize = async () => {
    setGoing(true)
    await flushCart()
    router.push('/carrinho/finalizar')
  }
  const ql = (i: number) => quote?.lines.find(x => x.index === i)
  const renewals = quote?.lines.filter(l => !l.error && l.type !== 'renewal') ?? []

  return (
    <div>
      <PurchaseSteps current="Carrinho" />
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h1 className="text-3xl font-black text-[#0A0A0A]">Carrinho</h1>
              <p className="text-sm text-[#666]">{lines.length} {lines.length === 1 ? 'item' : 'itens'} · os preços são confirmados no servidor.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/dominios/pesquisar" className={btnGhost} data-testid="continue-shopping">Continuar a comprar</Link>
            </div>
          </div>
          {error && <p className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex flex-wrap gap-2" role="alert"><AlertCircle size={16} /> {error} <button className="underline font-bold" onClick={refresh}>Tentar novamente</button></p>}
          <ul className="space-y-3">
            {lines.map((l, i) => <Line key={l.key} l={l} q={ql(i)} onRemove={() => remove(l.key)} />)}
          </ul>
          <div className="mt-4">
            {!confirmClear ? (
              <button className="text-sm font-semibold text-[#666] underline hover:text-red-700" onClick={() => setConfirmClear(true)} data-testid="clear-cart">Esvaziar carrinho</button>
            ) : (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm flex flex-wrap items-center gap-3" role="alertdialog" aria-label="Confirmar esvaziar carrinho">
                <span className="text-red-800">Retirar todos os itens do carrinho?</span>
                <button className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold" onClick={() => { clear(); setConfirmClear(false) }} data-testid="clear-cart-confirm">Esvaziar</button>
                <button className="px-3 py-1.5 rounded-lg border border-[#DDD] bg-white font-bold" onClick={() => setConfirmClear(false)}>Cancelar</button>
              </div>
            )}
          </div>
        </div>

        <aside className="w-full lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-24">
          <Summary quote={quote} loading={loading} />
          {renewals.length > 0 && (
            <div className={card} data-testid="cart-renewals">
              <p className="text-xs font-black text-[#999] uppercase tracking-widest mb-3">Valores de renovação</p>
              <ul className="space-y-2 text-sm">
                {renewals.map(l => <li key={l.index} className="flex justify-between gap-3"><span className="text-[#555] min-w-0 break-words">{l.domain && l.type === 'domain' ? l.domain : l.name}</span><span className="whitespace-nowrap font-semibold">{renewalOf(l)}</span></li>)}
              </ul>
            </div>
          )}
          <button className={`${btnPrimary} w-full`} disabled={!quote?.valid || loading || going} onClick={finalize} data-testid="finalize">
            {going ? <Loader2 size={16} className="animate-spin" /> : null} Finalizar <ChevronRight size={16} />
          </button>
          {quote && !quote.valid && <p className="text-xs text-red-700 text-center">Corrija ou remova os itens assinalados para continuar.</p>}
        </aside>
      </div>
    </div>
  )
}
