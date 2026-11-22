'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, RefreshCw } from 'lucide-react'

// Topo do dashboard: o que exige intervenção. Recarrega ao voltar ao separador
// (depois de resolver um item noutra página) e a cada minuto.
type Item = { id: string; ref: string; detail: string; status: string; since: string | null; href: string }
type Category = { key: string; label: string; action: string; count: number | null; items: Item[]; listHref: string; error?: string }

function age(since: string | null) {
  if (!since) return ''
  const t = new Date(since.replace(' ', 'T').slice(0, 23) + 'Z').getTime()
  const min = Math.max(0, Math.round((Date.now() - t) / 60000))
  return min < 60 ? `há ${min} min` : min < 1440 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} d`
}

export function PendingActions() {
  const [cats, setCats] = useState<Category[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/pending-actions', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setCats(j.categories); setFailed(false)
    } catch { setFailed(true) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const timer = setInterval(load, 60_000)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); clearInterval(timer) }
  }, [load])

  const total = cats?.reduce((s, c) => s + (c.count ?? 0), 0) ?? 0
  const anyError = !!cats?.some(c => c.error)

  return (
    <section className="rounded-2xl bg-white border border-[#E5E7EB] p-5" aria-labelledby="pending-title" data-testid="pending-actions">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 id="pending-title" className="font-black text-[#0B0B0D]">Acções pendentes</h2>
        {cats && !failed && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${total ? 'bg-amber-50 text-amber-800' : anyError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`} data-testid="pending-total">
            {total ? `${total} por resolver` : anyError ? 'incompleto' : 'sem pendências'}
          </span>
        )}
        <button onClick={load} className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#64748B] hover:text-[#0B0B0D]" aria-label="Actualizar acções pendentes">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Actualizar
        </button>
      </div>

      {failed && !cats && (
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2" data-testid="pending-error">
          <AlertTriangle size={16} /> Falha ao carregar as acções pendentes. <button onClick={load} className="underline font-bold">Tentar novamente</button>
        </div>
      )}
      {!cats && !failed && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#F5B700]" /></div>}

      {cats && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {cats.map(c => (
            <div key={c.key} className="rounded-xl border border-[#F1F5F9] bg-[#FAFAFA] p-3 flex flex-col" data-testid={`pending-${c.key}`}>
              <Link href={c.listHref} className="flex items-start justify-between gap-2 group">
                <span className="text-xs font-bold text-[#334155] group-hover:underline">{c.label}</span>
                {c.error ? <span className="text-xs font-bold text-red-700" data-testid="pending-count">erro</span>
                  : <span className={`text-lg font-black ${c.count ? 'text-[#B45309]' : 'text-[#94A3B8]'}`} data-testid="pending-count">{c.count}</span>}
              </Link>
              {c.error ? (
                <p className="text-xs text-red-700 mt-2" role="alert">{c.error}. <button onClick={load} className="underline">Repetir</button></p>
              ) : c.count === 0 ? (
                <p className="text-xs text-green-700 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Sem pendências</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {c.items.map(it => (
                    <li key={it.id}>
                      <Link href={it.href} className="block rounded-lg bg-white border border-[#E5E7EB] p-2 hover:border-[#F5B700]" data-testid="pending-item">
                        <span className="block text-[11px] font-black text-[#0B0B0D] break-all" data-testid="pending-ref">{it.ref}</span>
                        {it.detail && <span className="block text-[11px] text-[#64748B] truncate" title={it.detail}>{it.detail}</span>}
                        <span className="block text-[11px] text-amber-800">{it.status} <span className="text-[#94A3B8] whitespace-nowrap">· {age(it.since)}</span></span>
                        <span className="mt-1 inline-flex items-center text-[11px] font-bold text-[#0B0B0D]">{c.action} <ChevronRight size={11} /></span>
                      </Link>
                    </li>
                  ))}
                  {(c.count ?? 0) > c.items.length && <li><Link href={c.listHref} className="text-[11px] font-bold underline">Ver todos ({c.count})</Link></li>}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
