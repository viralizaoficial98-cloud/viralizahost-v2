'use client'
import { Loader2 } from 'lucide-react'

// Peças partilhadas do painel Cloud VPS (identidade visual do painel: cartões brancos, amarelo #F5B700).
/* eslint-disable @typescript-eslint/no-explicit-any */
export const card = 'bg-white border border-[#E5E7EB] rounded-2xl'
export const btn = 'px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50'
export const input = 'border border-[#E5E7EB] rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#F5B700]'
export const kz = (v: unknown) => (v == null || v === '' ? '—' : `${Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} Kz`)
export const money = (minor: unknown, cur: unknown) => (minor == null ? '—' : `${(Number(minor) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur ?? ''}`.trim())
export const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—')
export const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : '—')

export async function cvApi(section: string, params: Record<string, string | number | undefined> = {}) {
  const q = new URLSearchParams({ section, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])) })
  const r = await fetch(`/api/admin/cloud-vps?${q}`, { cache: 'no-store' })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`)
  return j
}
export async function cvPost(body: Record<string, unknown>) {
  const r = await fetch('/api/admin/cloud-vps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error ?? `Erro ${r.status}`), { code: j.code })
  return j
}

export const Spinner = () => <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#F5B700]" /></div>
export const ErrorBox = ({ msg }: { msg: string }) => <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3" role="alert">{msg}</p>
export const Msg = ({ m }: { m: { ok: boolean; t: string } | null }) => m ? <p className={`text-xs font-semibold ${m.ok ? 'text-green-700' : 'text-red-700'}`} role="status" data-testid="cv-msg">{m.t}</p> : null

const TONE: Record<string, string> = {
  green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800', blue: 'bg-blue-100 text-blue-800', gray: 'bg-gray-100 text-gray-700', cyan: 'bg-cyan-100 text-cyan-800',
}
export const Badge = ({ tone = 'gray', children, testId }: { tone?: keyof typeof TONE; children: React.ReactNode; testId?: string }) =>
  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${TONE[tone]}`} data-testid={testId}>{children}</span>

export function Kpi({ label, value, hint, tone, testId }: { label: string; value: React.ReactNode; hint?: string; tone?: 'red' | 'green' | 'amber'; testId?: string }) {
  return (
    <div className={`${card} p-4`} data-testid={testId}>
      <p className={`text-2xl font-black ${tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : 'text-[#0B0B0D]'}`}>{value}</p>
      <p className="text-xs text-[#64748B]">{label}</p>
      {hint && <p className="text-[11px] text-[#94A3B8] mt-0.5">{hint}</p>}
    </div>
  )
}

/** Gráfico de barras simples (sem dependências), valores reais. */
export function Bars({ data, title, testId }: { data: { label: string; n: number }[]; title: string; testId?: string }) {
  const max = Math.max(1, ...data.map(d => d.n))
  return (
    <div className={`${card} p-4`} data-testid={testId}>
      <p className="font-bold text-sm mb-3">{title}</p>
      {data.length === 0 ? <p className="text-xs text-[#64748B]">Sem dados.</p> : (
        <ul className="space-y-2">{data.map(d => (
          <li key={d.label} className="text-xs">
            <div className="flex justify-between"><span className="text-[#475569]">{d.label}</span><span className="font-bold">{d.n}</span></div>
            <div className="h-2 rounded-full bg-[#F1F5F9] mt-1"><div className="h-2 rounded-full bg-[#F5B700]" style={{ width: `${(d.n / max) * 100}%` }} /></div>
          </li>
        ))}</ul>
      )}
    </div>
  )
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center gap-2 text-xs" data-testid="cv-pager">
      <button className={`${btn} border`} disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span>Página {page} de {pages}</span>
      <button className={`${btn} border`} disabled={page >= pages} onClick={() => onPage(page + 1)}>Seguinte</button>
    </div>
  )
}
