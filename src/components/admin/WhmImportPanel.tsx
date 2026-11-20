'use client'
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, Loader2, Upload } from 'lucide-react'

// Importação de contas WHM com pré-visualização. Nada é gravado até «Aplicar».
type Item = { username: string; domain: string; package: string; suspended: boolean; action: 'new' | 'update' | 'unchanged'; link: 'linked' | 'pending_validation' | 'unlinked'; candidateReason?: string | null; conflicts: string[] }
type Plan = { found: number; new: number; updated: number; unchanged: number; alreadyLinked: number; autoLinked: number; pendingValidation: number; unlinked: number; missingFromWhm: string[]; conflicts: { username: string; message: string }[]; items: Item[] }

const LINK: Record<Item['link'], string> = { linked: 'Associada', pending_validation: 'Validação pendente', unlinked: 'Por associar' }
const ACTION: Record<Item['action'], string> = { new: 'Nova', update: 'Actualizar', unchanged: 'Sem alterações' }

export default function WhmImportPanel() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [applied, setApplied] = useState(false)
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null)
  const [error, setError] = useState('')

  async function run(kind: 'preview' | 'apply') {
    setBusy(kind); setError('')
    try {
      const res = await fetch('/api/admin/whm/import', { method: kind === 'preview' ? 'GET' : 'POST' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
      setPlan(j.plan); setApplied(kind === 'apply')
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const stat = (label: string, value: number, tone = '#0B0B0D') => (
    <div className="rounded-xl border border-[#E5E7EB] p-3"><p className="text-[11px] uppercase tracking-widest text-[#64748B]">{label}</p><p className="text-xl font-black" style={{ color: tone }}>{value}</p></div>
  )

  return (
    <section className="rounded-[18px] border border-[#E5E7EB] bg-white p-5 shadow-sm" aria-labelledby="whm-import-title">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 id="whm-import-title" className="font-black text-[#0B0B0D]">Importar contas do WHM</h2>
          <p className="text-xs text-[#64748B]">Pré-visualize antes de gravar. Contas só são associadas automaticamente a serviços já existentes (servidor + utilizador); e-mails coincidentes ficam para validação. Senhas não são importadas.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => run('preview')} disabled={!!busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB] hover:border-[#F5B700]">
            {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Pré-visualizar
          </button>
          <button onClick={() => run('apply')} disabled={!!busy || !plan} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black bg-[#F5B700] disabled:opacity-50">
            {busy === 'apply' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Aplicar importação
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mb-3" role="alert">{error}</p>}
      {plan && (
        <>
          {applied && <p className="text-sm text-green-700 mb-3 flex items-center gap-1" role="status"><CheckCircle2 size={14} /> Importação aplicada. Repetir actualiza as mesmas contas sem duplicar.</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
            {stat('Encontradas', plan.found)}{stat('Novas', plan.new)}{stat('A actualizar', plan.updated)}{stat('Sem alterações', plan.unchanged)}
            {stat('Já associadas', plan.alreadyLinked, '#15803D')}{stat('Associação automática', plan.autoLinked, '#15803D')}{stat('Validação pendente', plan.pendingValidation, '#B45309')}{stat('Por associar', plan.unlinked, '#64748B')}
          </div>
          {plan.conflicts.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-3 text-sm text-amber-900">
              <p className="font-bold flex items-center gap-1 mb-1"><AlertTriangle size={14} /> {plan.conflicts.length} conflito(s) — ficam pendentes de validação</p>
              <ul className="list-disc pl-5">{plan.conflicts.map((c, i) => <li key={i}><strong>{c.username}</strong>: {c.message}</li>)}</ul>
            </div>
          )}
          {plan.missingFromWhm.length > 0 && <p className="text-xs text-[#64748B] mb-3">Já não existem no WHM: {plan.missingFromWhm.join(', ')} (marcadas como «missing», não apagadas).</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th className="py-2 pr-3">Utilizador</th><th className="py-2 pr-3">Domínio</th><th className="py-2 pr-3">Pacote</th><th className="py-2 pr-3">Acção</th><th className="py-2">Associação</th></tr></thead>
              <tbody>
                {plan.items.map(i => (
                  <tr key={i.username} className="border-t border-[#F1F5F9]">
                    <td className="py-2 pr-3 font-mono">{i.username}{i.suspended ? <span className="ml-1 text-xs text-red-600">(suspensa)</span> : null}</td>
                    <td className="py-2 pr-3">{i.domain}</td><td className="py-2 pr-3">{i.package}</td><td className="py-2 pr-3">{ACTION[i.action]}</td>
                    <td className="py-2">{LINK[i.link]}{i.candidateReason ? <span className="block text-xs text-[#B45309]">{i.candidateReason}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
