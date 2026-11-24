'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, MailCheck, Save, Users } from 'lucide-react'

// Configurações → Contas. A opção é guardada na base (não precisa de reinício) e só administradores a alteram.
type S = { emailConfirmationRequired: boolean; source: 'panel' | 'default'; updatedAt: string | null; updatedBy: string | null }

export default function AccountsSettingsPage() {
  const [st, setSt] = useState<S | null>(null)
  const [value, setValue] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const apply = (s: S) => { setSt(s); setValue(s.emailConfirmationRequired) }
  useEffect(() => {
    fetch('/api/admin/settings/accounts', { cache: 'no-store' }).then(async r => {
      const j = await r.json()
      if (j.settings) apply(j.settings); else setNotice({ ok: false, text: j.error ?? 'Não foi possível carregar.' })
    })
  }, [])

  const save = async () => {
    if (!st) return
    if (value !== st.emailConfirmationRequired && !value && !window.confirm('Desactivar a confirmação de e-mail?\nOs NOVOS clientes passam a entrar sem confirmar o endereço (fica «por verificar»). As contas existentes não mudam.')) return
    setBusy(true); setNotice(null)
    const res = await fetch('/api/admin/settings/accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emailConfirmationRequired: value }) })
    const j = await res.json(); setBusy(false)
    if (!res.ok) { setNotice({ ok: false, text: j.error ?? 'Falhou.' }); return }
    apply(j.settings); setNotice({ ok: true, text: 'Guardado. Aplica-se já aos novos registos.' })
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-5" data-testid="accounts-settings">
      <Link href="/admin/settings" className="text-sm text-[#555] inline-flex items-center gap-1"><ArrowLeft size={14} /> Configurações</Link>
      <h1 className="text-2xl font-black flex items-center gap-2"><Users size={22} /> Contas</h1>
      {notice && <p role="status" data-testid="accounts-notice" className={`p-3 rounded-xl text-sm ${notice.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{notice.text}</p>}
      {!st ? (!notice && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#F5B700]" /></div>) : (
        <section className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#F5B700]" checked={value} onChange={e => setValue(e.target.checked)} data-testid="accounts-email-confirmation" />
            <span>
              <span className="font-bold text-[#0B0B0D] flex items-center gap-2"><MailCheck size={16} /> Exigir confirmação de e-mail para novos clientes</span>
              <span className="block text-sm text-[#475569] mt-1">
                {value
                  ? 'Activa: depois do registo (no site ou no checkout) enviamos o link de confirmação e a conta só inicia sessão depois de o abrir.'
                  : 'Desactivada: os novos clientes concluem o registo e iniciam sessão sem confirmar. Não é enviado e-mail de confirmação e o endereço fica «por verificar».'}
              </span>
            </span>
          </label>
          <ul className="text-xs text-[#64748B] list-disc pl-5 space-y-1">
            <li>Aplica-se ao formulário de registo e à criação de conta no checkout, a partir do pedido seguinte (sem reiniciar o servidor).</li>
            <li>As contas existentes mantêm a situação actual. Voltar a activar só afecta os registos novos.</li>
            <li>Recuperação de palavra-passe e alteração de e-mail não mudam. Associar contas WHM continua a exigir e-mail confirmado.</li>
          </ul>
          <p className="text-xs text-[#64748B]" data-testid="accounts-source">
            {st.source === 'default' ? 'Valor inicial (comportamento actual do servidor) — ainda não alterado no painel.' : `Última alteração: ${st.updatedAt ? new Date(st.updatedAt).toLocaleString('pt-PT') : '—'}${st.updatedBy ? ` por ${st.updatedBy}` : ''}.`}
          </p>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-[#F5B700] disabled:opacity-50" data-testid="accounts-save">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </section>
      )}
    </div>
  )
}
