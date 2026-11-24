'use client'
import { useMemo, useState } from 'react'
import { AlertCircle, Check, Clock, Info, LayoutDashboard, Loader2, MapPin, Monitor, Package, RefreshCw, Search, X } from 'lucide-react'
import { kz as kzFmt } from '@/lib/commerce/status'
import { INSTALL_CATEGORIES, fitsLocation, type InstallCategory, type InstallOption, type PublicVpsOptions } from '@/lib/vps/install-shared'

// Secção «Localização do servidor» + «Escolha o que instalar» da página «Escolha a duração» (Servidor VPS).
// Só mostra opções compatíveis com o plano (filtradas no servidor) e com a localização escolhida.

const kz = (n: number) => kzFmt(Math.round(n))
const COLORS: Record<string, string> = {
  ubuntu: '#E95420', debian: '#A80030', almalinux: '#0F4266', rocky: '#10B981', centos: '#932279', alpine: '#0D597F', arch: '#1793D1',
  cloudlinux: '#0097F3', fedora: '#294172', windows: '#0078D4', cpanel: '#FF6C2C', plesk: '#52BBE6', cyberpanel: '#1F6FEB', cloudpanel: '#2D6BF4',
  docker: '#2496ED', n8n: '#EA4B71', wordpress: '#21759B', coolify: '#6B16ED', webmin: '#2C5AA0', ollama: '#111111', nodejs: '#3C873A', odoo: '#714B67',
}
const CAT_ICON: Record<InstallCategory, typeof Monitor> = { os: Monitor, panel: LayoutDashboard, app: Package }

export function InstallIcon({ icon, name, size = 40 }: { icon: string; name: string; size?: number }) {
  const bg = COLORS[icon] ?? '#0A0A0A'
  const initials = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  return <span aria-hidden="true" className="inline-flex items-center justify-center rounded-xl font-black text-white shrink-0" style={{ background: bg, width: size, height: size, fontSize: size * 0.36 }}>{initials}</span>
}

export const licenseText = (img: Pick<InstallOption, 'license'>) => img.license.type === 'paid' ? `Licença paga: ${kz(img.license.monthlyKz)}/mês` : 'Licença incluída'

export function VpsInstallPicker({ data, state, reload, location, image, later, onLocation, onImage, onLater, months, notice }: {
  data: PublicVpsOptions | null; state: 'loading' | 'error' | 'ready'; reload: () => void
  location?: string; image?: string; later?: boolean
  onLocation: (id: string) => void; onImage: (id: string) => void; onLater: (v: boolean) => void
  months: number; notice: string
}) {
  const [tab, setTab] = useState<InstallCategory>(() => data?.images.find(i => i.id === image)?.category ?? 'os')
  const [q, setQ] = useState('')
  const compatible = useMemo(() => (data?.images ?? []).filter(i => fitsLocation(i, location)), [data, location])
  const byTab = useMemo(() => {
    const out: Record<InstallCategory, InstallOption[]> = { os: [], panel: [], app: [] }
    for (const i of compatible) out[i.category].push(i)
    return out
  }, [compatible])
  const needle = q.trim().toLowerCase()
  const shown = needle ? compatible.filter(i => `${i.name} ${i.version ?? ''} ${i.label} ${i.includedOs ?? ''}`.toLowerCase().includes(needle)) : byTab[tab]
  const chosen = data?.images.find(i => i.id === image) ?? null

  if (state === 'loading') return (
    <div className="mb-6" role="status" aria-live="polite" data-testid="install-loading">
      <p className="text-sm text-[#666] flex items-center gap-2 mb-3"><Loader2 size={14} className="animate-spin" /> A carregar localizações e opções de instalação…</p>
      <div className="grid sm:grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-[#F2F2F2] animate-pulse" />)}</div>
    </div>
  )
  if (state === 'error' || !data) return (
    <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700" role="alert" data-testid="install-unavailable">
      <p className="font-bold flex items-center gap-2"><AlertCircle size={16} /> Catálogo de instalações indisponível</p>
      <p className="mt-1">Não foi possível carregar as localizações e os sistemas disponíveis. Não é possível continuar sem esta escolha.</p>
      <button type="button" className="mt-2 inline-flex items-center gap-1 font-bold underline" onClick={reload}><RefreshCw size={14} /> Tentar novamente</button>
    </div>
  )

  return (
    <div className="mb-6 space-y-6">
      {data.locations.length > 1 && (
        <fieldset>
          <legend className="text-sm font-bold text-[#0A0A0A] mb-2 flex items-center gap-1.5"><MapPin size={15} className="text-[#D9A300]" /> Localização do servidor</legend>
          <div role="radiogroup" aria-label="Localização do servidor" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {data.locations.map(l => (
              <button key={l.id} type="button" role="radio" aria-checked={location === l.id} onClick={() => onLocation(l.id)} data-testid={`opt-location-${l.id}`}
                className={`text-left p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${location === l.id ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE] hover:border-[#F5B700]/50'}`}>{l.label}</button>
            ))}
          </div>
        </fieldset>
      )}
      {data.locations.length === 1 && <p className="text-sm text-[#555] flex items-center gap-1.5"><MapPin size={15} className="text-[#D9A300]" /> Localização do servidor: <strong className="text-[#0A0A0A]">{data.locations[0].label}</strong></p>}

      {data.images.length > 0 && (
        <section aria-labelledby="install-title" data-testid="install-picker">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
            <h2 id="install-title" className="text-sm font-bold text-[#0A0A0A]">Escolha o que instalar</h2>
            {data.locations.length > 1 && !location && <span className="text-xs text-[#888]">Escolha primeiro a localização para ver só o que é compatível.</span>}
          </div>
          {notice && <p className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex gap-2" role="alert" data-testid="install-notice"><Info size={16} className="shrink-0 mt-0.5" /> {notice}</p>}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" aria-hidden="true" />
            <label htmlFor="install-search" className="sr-only">Pesquisar sistema, painel ou aplicação</label>
            <input id="install-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar sistema, painel ou aplicação" data-testid="install-search" autoComplete="off"
              className="w-full border border-[#E2E2E2] rounded-xl pl-9 pr-9 py-3 text-sm text-[#0A0A0A] focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/20" />
            {q && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999]"><X size={16} /></button>}
          </div>
          {!needle && (
            <div role="tablist" aria-label="Tipo de instalação" className="flex gap-1 p-1 rounded-xl bg-[#F4F4F4] mb-3 overflow-x-auto">
              {INSTALL_CATEGORIES.map(c => {
                const Icon = CAT_ICON[c.id]
                return (
                  <button key={c.id} type="button" role="tab" aria-selected={tab === c.id} onClick={() => setTab(c.id)} data-testid={`install-tab-${c.id}`}
                    className={`flex-1 min-w-max inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap ${tab === c.id ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-[#666]'}`}>
                    <Icon size={14} /> {c.label} <span className="text-[10px] font-black text-[#999]">{byTab[c.id].length}</span>
                  </button>
                )
              })}
            </div>
          )}
          {needle && <p className="text-xs text-[#888] mb-2">Resultados em todas as categorias para «{q.trim()}»</p>}
          {shown.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-[#DDD] text-sm text-[#666] text-center" data-testid="install-empty">
              {needle ? <>Nenhum resultado para «{q.trim()}». <button type="button" className="underline font-bold" onClick={() => setQ('')}>Limpar pesquisa</button></>
                : `Sem opções de ${INSTALL_CATEGORIES.find(c => c.id === tab)?.label.toLowerCase()} disponíveis${location ? ' nesta localização' : ''}.`}
            </div>
          ) : (
            <div role="radiogroup" aria-label="O que instalar" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {shown.map(i => {
                const on = image === i.id && !later
                return (
                  <button key={i.id} type="button" role="radio" aria-checked={on} onClick={() => onImage(i.id)} data-testid={`opt-image-${i.id}`}
                    className={`relative text-left p-3 rounded-xl border-2 flex gap-3 items-start transition-colors ${on ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE] hover:border-[#F5B700]/50'}`}>
                    <InstallIcon icon={i.icon} name={i.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-sm text-[#0A0A0A] truncate">{i.name}</span>
                      <span className="block text-xs text-[#666]">{i.version ? `Versão ${i.version}` : 'Versão mais recente'}{i.includedOs ? ` · inclui ${i.includedOs}` : ''}</span>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${i.license.type === 'paid' ? 'bg-amber-100 text-amber-900' : 'bg-green-50 text-green-700'}`} data-testid="install-license">
                        {licenseText(i)}
                      </span>
                      {i.license.type === 'paid' && on && <span className="block text-[11px] text-amber-900 mt-1">+ {kz(i.license.monthlyKz * months)} neste período ({months} {months === 1 ? 'mês' : 'meses'})</span>}
                    </span>
                    {on && <Check size={16} className="text-[#D9A300] shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
          {data.allowChooseLater && (
            <label className={`mt-3 flex gap-3 items-start p-3 rounded-xl border-2 cursor-pointer ${later ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE]'}`} data-testid="install-later">
              <input type="checkbox" className="mt-1 accent-[#F5B700]" checked={!!later} onChange={e => onLater(e.target.checked)} />
              <span className="text-sm"><strong className="text-[#0A0A0A] flex items-center gap-1"><Clock size={14} /> Escolher mais tarde</strong>
                <span className="text-xs text-[#666] block">Paga agora e escolhe o sistema em «Os meus VPS» depois do pagamento confirmado. A preparação do VPS só começa depois dessa escolha. Opções com licença paga não estão disponíveis mais tarde.</span></span>
            </label>
          )}
          {chosen && !later && chosen.includedOs && <p className="text-xs text-[#666] mt-2">{chosen.name} é instalado sobre {chosen.includedOs}: não é preciso escolher o sistema operativo à parte.</p>}
        </section>
      )}
    </div>
  )
}
