'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, LifeBuoy, Loader2, MapPin, Play, Power, RotateCcw, Server, ShieldCheck, Square, Terminal } from 'lucide-react'
import type { MyVps } from '@/lib/vps/manage'
import type { InstallOption } from '@/lib/vps/install-shared'
import { InstallIcon } from '@/components/purchase/VpsInstallPicker'
import { VPS_TONE } from './tone'
import { VpsBackupsCard, VpsDetailsCard, VpsFirewallCard, VpsMetricsCard, VpsPlanActions } from './VpsExtras'

// «Os meus VPS» → detalhe. As operações chamam /api/client/vps/:id (posse verificada no servidor).
// A palavra-passe root só existe neste formulário até ser enviada; nunca é guardada nem mostrada depois.

interface Live { state: string | null; ip: string | null; busy: boolean; actions: { id: number; name: string | null; state: string; at: string | null }[] }
const POWER: Record<string, string> = {
  running: 'Ligado', stopped: 'Desligado', starting: 'A ligar…', stopping: 'A desligar…', recreating: 'A reinstalar…', creating: 'A criar…', initial: 'A configurar…',
  restoring: 'A restaurar…', recovery: 'Modo de recuperação', suspended: 'Suspenso', error: 'Erro',
}
const ACTION: Record<string, string> = { success: 'concluída', error: 'falhou', started: 'em curso', created: 'pedida', sent: 'enviada', delayed: 'adiada', cancelled: 'cancelada' }
const card = 'rounded-2xl border border-[#E5E7EB] bg-white shadow-sm p-4 sm:p-5'
const btn = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold border disabled:opacity-50 disabled:cursor-not-allowed'
const field = 'w-full border border-[#E2E2E2] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/20'

async function call(id: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/client/vps/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Operação indisponível de momento.')
  return j
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false)
  return <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-[#555] underline" aria-label={label}
    onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) }).catch(() => {}) }}>{ok ? <Check size={12} /> : <Copy size={12} />}{ok ? 'Copiado' : 'Copiar'}</button>
}

export function VpsManager({ initial }: { initial: MyVps }) {
  const [vps, setVps] = useState(initial)
  const [installs, setInstalls] = useState<InstallOption[]>([])
  const [keys, setKeys] = useState<{ type: string; fingerprint: string; comment: string | null }[]>([])
  const [live, setLive] = useState<Live | null>(null)
  const [liveErr, setLiveErr] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/client/vps/${initial.id}`, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (r.ok) { setVps(j.vps); setInstalls(j.installs ?? []); setKeys(j.sshKeys ?? []) }
  }, [initial.id])
  const loadLive = useCallback(async (): Promise<Live | null> => {
    const r = await fetch(`/api/client/vps/${initial.id}?live=1`, { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setLiveErr(j.error ?? 'Estado indisponível.'); return null }
    setLiveErr(''); setLive(j); return j
  }, [initial.id])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial
  useEffect(() => { load() }, [load])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial
  useEffect(() => { if (vps.manageable) loadLive() }, [vps.manageable, loadLive])
  useEffect(() => () => { if (poll.current) clearTimeout(poll.current) }, [])

  // Acompanha uma operação até terminar (estado da VM e acções da Hostinger)
  const follow = useCallback((label: string) => {
    let n = 0
    const tick = async () => {
      const l = await loadLive()
      n++
      if (l && !l.busy && !['starting', 'stopping', 'recreating', 'creating', 'initial'].includes(String(l.state))) {
        const failed = l.actions[0]?.state === 'error'
        setMsg({ ok: !failed, text: failed ? `${label}: a Hostinger indicou um erro. Tente novamente ou peça suporte.` : `${label}: concluído. Estado actual: ${POWER[l.state ?? ''] ?? l.state}.` })
        setBusy(''); load(); return
      }
      if (n > 100) { setMsg({ ok: false, text: `${label}: ainda em curso. Actualize a página dentro de alguns minutos.` }); setBusy(''); return }
      poll.current = setTimeout(tick, 2500)
    }
    poll.current = setTimeout(tick, 1500)
  }, [loadLive, load])

  const run = async (key: string, label: string, body: Record<string, unknown>, track = true, after?: () => void) => {
    setBusy(key); setMsg(null)
    try {
      await call(vps.id, body)
      after?.()
      if (track) { setMsg({ ok: true, text: `${label}: pedido aceite, em curso…` }); follow(label) }
      else { setMsg({ ok: true, text: `${label}: concluído.` }); setBusy(''); load() }
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); setBusy('') }
  }

  const support = `/tickets?assunto=${encodeURIComponent(`VPS ${vps.plan} — ${vps.reference}`)}`
  const state = live?.state ?? vps.power
  const working = !!busy || !!live?.busy

  return (
    <div className="max-w-5xl space-y-4">
      <Link href="/vps" className="inline-flex items-center gap-1 text-sm text-[#555] underline"><ArrowLeft size={14} /> Os meus VPS</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0B0B0D]">{vps.plan}</h1>
          <p className="text-sm text-[#64748B]">Referência: <span className="font-mono" data-testid="vps-reference">{vps.reference}</span> · {vps.cycleLabel}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${VPS_TONE[vps.state]}`} data-testid="vps-state">{vps.stateLabel}</span>
      </div>

      {msg && <p role={msg.ok ? 'status' : 'alert'} data-testid="vps-msg" className={`p-3 rounded-xl text-sm ${msg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg.text}</p>}

      {vps.accessPending && vps.manageable && (
        <div className="rounded-2xl border-2 border-[#F5B700] bg-[#FFF8E1] p-4 text-sm" role="status" data-testid="vps-access-pending">
          <p className="font-black text-[#0B0B0D]">Defina o acesso ao seu VPS</p>
          <p className="text-[#334155] mt-1">O VPS está criado. Por segurança a senha gerada pelo fornecedor não é conhecida por ninguém: defina a sua senha root ou adicione a sua chave SSH em «Acesso inicial seguro» para começar a usar o servidor.</p>
        </div>
      )}

      {vps.state !== 'ready' && (
        <div className={card} data-testid="vps-status-help">
          <p className="text-sm text-[#334155]">{vps.stateHelp}</p>
          {vps.message && <p className="text-sm text-[#334155] mt-1">{vps.message}</p>}
          <p className="text-sm mt-2"><Link href={`/orders/${vps.orderId}`} className="underline">Ver encomenda {vps.orderNumber}</Link></p>
        </div>
      )}

      {vps.awaitingChoice && (
        <section className={card} aria-labelledby="choose-title" data-testid="vps-choose">
          <h2 id="choose-title" className="font-black text-[#0B0B0D] mb-1">Escolha o que instalar</h2>
          <p className="text-sm text-[#64748B] mb-3">{vps.location ? <>Localização: <strong>{vps.location}</strong>. </> : null}Só aparecem opções compatíveis com o seu plano e localização (licença incluída).</p>
          <ChooseInstall installs={installs} busy={busy === 'choose'} onChoose={img => run('choose', 'Instalação escolhida', { action: 'choose_install', image: img }, false)} />
        </section>
      )}

      <section className={card}>
        <h2 className="font-black text-[#0B0B0D] mb-3 flex items-center gap-2"><Server size={18} className="text-[#B45309]" /> Detalhes</h2>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-[#64748B]">Plano</dt><dd className="font-semibold">{vps.plan}</dd></div>
          <div><dt className="text-[#64748B]">Estado</dt><dd className="font-semibold">{vps.stateLabel}{vps.state === 'ready' && state ? ` · ${POWER[state] ?? state}` : ''}</dd></div>
          <div><dt className="text-[#64748B]">Localização</dt><dd className="font-semibold inline-flex items-center gap-1">{vps.location ? <><MapPin size={13} />{vps.location}</> : '—'}</dd></div>
          <div><dt className="text-[#64748B]">Endereço IP</dt><dd className="font-mono" data-testid="vps-ip">{vps.ip ?? '—'}</dd></div>
          <div><dt className="text-[#64748B]">{vps.install?.category === 'panel' ? 'Painel' : vps.install?.category === 'app' ? 'Aplicação' : 'Sistema operativo'}</dt>
            <dd className="font-semibold" data-testid="vps-install">{vps.install ? vps.install.label : vps.awaitingChoice ? 'Por escolher' : '—'}</dd></div>
          {vps.install?.includedOs && <div><dt className="text-[#64748B]">Sistema operativo</dt><dd className="font-semibold" data-testid="vps-os">{vps.install.includedOs}</dd></div>}
          {vps.nextDue && <div><dt className="text-[#64748B]">Próximo vencimento</dt><dd className="font-semibold">{new Date(vps.nextDue).toLocaleDateString('pt-PT')}</dd></div>}
        </dl>
      </section>

      {vps.manageable && <><VpsDetailsCard vps={vps} /><VpsMetricsCard id={vps.id} /></>}

      {vps.state === 'ready' && vps.ip && (
        <section className={card} aria-labelledby="access-title" data-testid="vps-access">
          <h2 id="access-title" className="font-black text-[#0B0B0D] mb-3 flex items-center gap-2"><Terminal size={18} className="text-[#B45309]" /> Acesso</h2>
          <p className="text-sm text-[#334155] mb-2">Ligue-se por SSH com o utilizador <strong>{vps.sshUser}</strong>:</p>
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#0B0B0D] text-[#F5F5F5] font-mono text-sm overflow-x-auto"><code data-testid="vps-ssh">ssh {vps.sshUser}@{vps.ip}</code><CopyButton text={`ssh ${vps.sshUser}@${vps.ip}`} label="Copiar comando SSH" /></div>
          <p className="text-xs text-[#64748B] mt-2">Por segurança, nunca enviamos palavras-passe por e-mail nem as mostramos aqui. Defina a palavra-passe root ou adicione a sua chave SSH em «Acesso inicial seguro».</p>
          {vps.accessUrl && <a href={vps.accessUrl} target="_blank" rel="noopener noreferrer" className={`${btn} mt-3 border-[#F5B700] bg-[#F5B700] text-black`} data-testid="vps-open-panel"><ExternalLink size={15} /> Abrir {vps.install?.category === 'app' ? 'a aplicação' : 'o painel'}</a>}
        </section>
      )}

      {vps.state === 'ready' && !vps.manageable && (
        <p className={`${card} text-sm text-[#334155]`} data-testid="vps-manual-note">Este VPS foi entregue pela nossa equipa: a gestão (energia, palavra-passe, reinstalação) é feita através do suporte. <Link href={support} className="underline font-bold">Pedir suporte</Link></p>
      )}

      {vps.manageable && (
        <>
          <section className={card} aria-labelledby="power-title" data-testid="vps-power">
            <h2 id="power-title" className="font-black text-[#0B0B0D] mb-1 flex items-center gap-2"><Power size={18} className="text-[#B45309]" /> Energia</h2>
            <p className="text-sm text-[#64748B] mb-3" data-testid="vps-power-state">{liveErr ? `Estado indisponível: ${liveErr}` : live ? `Estado actual: ${POWER[live.state ?? ''] ?? live.state ?? '—'}${live.busy ? ' — operação em curso…' : ''}` : 'A consultar o estado…'}</p>
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} border-green-600 text-green-700`} disabled={working || !live || live.state !== 'stopped'} onClick={() => run('start', 'Ligar', { action: 'start' })} data-testid="vps-start">{busy === 'start' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Ligar</button>
              <button className={`${btn} border-[#CBD5E1] text-[#334155]`} disabled={working || !live || live.state !== 'running'} onClick={() => { if (window.confirm('Desligar o VPS? Os serviços ficam indisponíveis até o voltar a ligar.')) run('stop', 'Desligar', { action: 'stop' }) }} data-testid="vps-stop">{busy === 'stop' ? <Loader2 size={15} className="animate-spin" /> : <Square size={15} />} Desligar</button>
              <button className={`${btn} border-[#CBD5E1] text-[#334155]`} disabled={working || !live || live.state !== 'running'} onClick={() => run('restart', 'Reiniciar', { action: 'restart' })} data-testid="vps-restart">{busy === 'restart' ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} Reiniciar</button>
            </div>
            {live && live.actions.length > 0 && (
              <ul className="mt-3 text-xs text-[#64748B] space-y-0.5" data-testid="vps-actions">{live.actions.map(a => <li key={a.id}>{(a.name ?? 'acção').replace(/_/g, ' ')} — {ACTION[a.state] ?? a.state}{a.at ? ` · ${new Date(a.at).toLocaleString('pt-PT')}` : ''}</li>)}</ul>
            )}
          </section>

          <SecureAccess busy={busy} keys={keys} disabled={working}
            onPassword={pw => run('pw', 'Palavra-passe root', { action: 'root_password', password: pw })}
            onKey={k => run('key', 'Chave SSH', { action: 'ssh_key', key: k })} />

          <Reinstall installs={installs} current={vps.install?.id ?? null} busy={busy === 'reinstall'} disabled={working}
            onReinstall={(img, confirmText) => run('reinstall', 'Reinstalação', { action: 'reinstall', image: img, acceptDataLoss: true, confirmText })} />

          <VpsBackupsCard id={vps.id} />
          <VpsFirewallCard id={vps.id} />
        </>
      )}

      {vps.state === 'ready' && <VpsPlanActions vps={vps} />}

      <section className={card} data-testid="vps-support">
        <h2 className="font-black text-[#0B0B0D] mb-1 flex items-center gap-2"><LifeBuoy size={18} className="text-[#B45309]" /> Precisa de ajuda?</h2>
        <p className="text-sm text-[#64748B] mb-3">A consola no navegador e o modo de recuperação não estão disponíveis no portal. A equipa ajuda com acesso, rede, cópias de segurança ou qualquer problema.</p>
        <Link href={support} className={`${btn} border-[#F5B700] text-[#0B0B0D]`} data-testid="vps-support-link"><LifeBuoy size={15} /> Pedir suporte</Link>
      </section>
    </div>
  )
}

function ChooseInstall({ installs, busy, onChoose }: { installs: InstallOption[]; busy: boolean; onChoose: (id: string) => void }) {
  const [sel, setSel] = useState('')
  if (!installs.length) return <p className="text-sm text-[#64748B]">Sem opções disponíveis de momento. <Link href="/tickets" className="underline">Peça suporte</Link>.</p>
  return (
    <>
      <div role="radiogroup" aria-label="O que instalar" className="grid sm:grid-cols-2 gap-2 mb-3">
        {installs.map(i => (
          <button key={i.id} type="button" role="radio" aria-checked={sel === i.id} onClick={() => setSel(i.id)} data-testid={`choose-image-${i.id}`}
            className={`text-left p-3 rounded-xl border-2 flex gap-3 items-center ${sel === i.id ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#EEE]'}`}>
            <InstallIcon icon={i.icon} name={i.name} size={32} /><span className="text-sm"><strong className="block">{i.name}{i.version ? ` ${i.version}` : ''}</strong>{i.includedOs && <span className="text-xs text-[#666]">inclui {i.includedOs}</span>}</span>
          </button>
        ))}
      </div>
      <button className={`${btn} border-[#F5B700] bg-[#F5B700] text-black`} disabled={!sel || busy} onClick={() => onChoose(sel)} data-testid="choose-confirm">{busy && <Loader2 size={15} className="animate-spin" />} Instalar e preparar o VPS</button>
    </>
  )
}

function SecureAccess({ busy, keys, disabled, onPassword, onKey }: { busy: string; keys: { type: string; fingerprint: string; comment: string | null }[]; disabled: boolean; onPassword: (pw: string) => void; onKey: (k: string) => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [key, setKey] = useState('')
  const rules = [[pw.length >= 12 && pw.length <= 50, '12 a 50 caracteres'], [/[A-Z]/.test(pw) && /[a-z]/.test(pw), 'maiúsculas e minúsculas'], [/\d/.test(pw), 'um número'], [/[-().&@?'#;/,+]/.test(pw) && !/[^A-Za-z0-9\-().&@?'#;/,+]/.test(pw), "um símbolo de - ( ) . & @ ? ' # ; / , +"]] as const
  const ok = rules.every(r => r[0]) && pw === pw2
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm p-4 sm:p-5" aria-labelledby="secure-title" data-testid="vps-secure">
      <h2 id="secure-title" className="font-black text-[#0B0B0D] mb-1 flex items-center gap-2"><ShieldCheck size={18} className="text-[#B45309]" /> Acesso inicial seguro</h2>
      <p className="text-sm text-[#64748B] mb-4">Recomendamos chaves SSH. A palavra-passe é enviada directamente para o servidor por ligação cifrada e não fica guardada na ViralizaHost.</p>
      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={e => { e.preventDefault(); if (ok) { onPassword(pw); setPw(''); setPw2('') } }} autoComplete="off">
          <p className="text-sm font-bold mb-2">Palavra-passe root</p>
          <label className="block text-xs text-[#555] mb-2">Nova palavra-passe
            <span className="relative block mt-1"><input className={`${field} pr-10`} type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" data-testid="root-pw" maxLength={50} />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888]" onClick={() => setShow(!show)} aria-label={show ? 'Esconder' : 'Mostrar'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
          </label>
          <label className="block text-xs text-[#555] mb-2">Repetir
            <input className={`${field} mt-1`} type={show ? 'text' : 'password'} value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" data-testid="root-pw2" maxLength={50} /></label>
          <ul className="text-xs space-y-0.5 mb-3">{rules.map(([v, t]) => <li key={t} className={v ? 'text-green-700' : 'text-[#888]'}>{v ? '✓' : '•'} {t}</li>)}{pw2 && pw !== pw2 && <li className="text-red-700">As palavras-passe não coincidem</li>}</ul>
          <button className={`${btn} border-[#0B0B0D] text-[#0B0B0D]`} disabled={!ok || disabled} data-testid="root-pw-save">{busy === 'pw' ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Definir palavra-passe</button>
        </form>
        <form onSubmit={e => { e.preventDefault(); if (key.trim()) { onKey(key.trim()); setKey('') } }}>
          <p className="text-sm font-bold mb-2">Chaves SSH ({'root'})</p>
          {keys.length > 0 && <ul className="text-xs font-mono text-[#334155] mb-2 space-y-0.5" data-testid="ssh-keys">{keys.map((k, i) => <li key={i}>{k.type} {k.fingerprint}{k.comment ? ` ${k.comment}` : ''}</li>)}</ul>}
          <label className="block text-xs text-[#555] mb-2">Chave pública (ex.: conteúdo de ~/.ssh/id_ed25519.pub)
            <textarea className={`${field} mt-1 font-mono text-xs`} rows={3} value={key} onChange={e => setKey(e.target.value)} placeholder="ssh-ed25519 AAAA… nome@computador" data-testid="ssh-key" /></label>
          <p className="text-[11px] text-[#888] mb-2">Nunca cole a chave privada.</p>
          <button className={`${btn} border-[#0B0B0D] text-[#0B0B0D]`} disabled={!key.trim() || disabled} data-testid="ssh-key-add">{busy === 'key' ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Adicionar chave</button>
        </form>
      </div>
    </section>
  )
}

function Reinstall({ installs, current, busy, disabled, onReinstall }: { installs: InstallOption[]; current: string | null; busy: boolean; disabled: boolean; onReinstall: (img: string, confirmText: string) => void }) {
  const [img, setImg] = useState(current ?? '')
  const [step, setStep] = useState(false)
  const [accept, setAccept] = useState(false)
  const [text, setText] = useState('')
  const chosen = installs.find(i => i.id === img)
  return (
    <section className="rounded-2xl border border-red-200 bg-white shadow-sm p-4 sm:p-5" aria-labelledby="reinstall-title" data-testid="vps-reinstall">
      <h2 id="reinstall-title" className="font-black text-[#0B0B0D] mb-1 flex items-center gap-2"><RotateCcw size={18} className="text-red-600" /> Reinstalar</h2>
      <p className="text-sm text-[#64748B] mb-3">Instala de novo o sistema, painel ou aplicação escolhidos.</p>
      <label className="block text-xs text-[#555] mb-3 max-w-md">Instalação
        <select className={`${field} mt-1`} value={img} onChange={e => { setImg(e.target.value); setStep(false); setAccept(false); setText('') }} data-testid="reinstall-image">
          <option value="">— escolha —</option>
          {installs.map(i => <option key={i.id} value={i.id}>{i.label}{i.includedOs ? ` (inclui ${i.includedOs})` : ''}{i.id === current ? ' — actual' : ''}</option>)}
        </select>
      </label>
      {!step ? (
        <button className={`${btn} border-red-300 text-red-700`} disabled={!chosen || disabled} onClick={() => setStep(true)} data-testid="reinstall-start">Reinstalar…</button>
      ) : (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 space-y-3" role="alert" data-testid="reinstall-warning">
          <p className="font-bold flex items-center gap-2"><AlertTriangle size={16} /> Todos os dados do VPS serão apagados</p>
          <p>A reinstalação apaga definitivamente ficheiros, bases de dados, configurações e cópias instantâneas (snapshots) deste VPS. Não é possível desfazer. Faça uma cópia de segurança antes de continuar.</p>
          <label className="flex gap-2 items-start"><input type="checkbox" className="mt-1" checked={accept} onChange={e => setAccept(e.target.checked)} data-testid="reinstall-accept" /> Compreendo que todos os dados serão perdidos e quero reinstalar com «{chosen?.label}».</label>
          <label className="block">Para confirmar, escreva <strong>REINSTALAR</strong>
            <input className={`${field} mt-1 bg-white max-w-xs`} value={text} onChange={e => setText(e.target.value)} autoComplete="off" data-testid="reinstall-confirm-text" /></label>
          <div className="flex gap-2">
            <button className={`${btn} border-red-600 bg-red-600 text-white`} disabled={!accept || text.trim().toUpperCase() !== 'REINSTALAR' || busy || disabled} onClick={() => { onReinstall(img, text.trim()); setStep(false); setAccept(false); setText('') }} data-testid="reinstall-confirm">{busy && <Loader2 size={15} className="animate-spin" />} Apagar dados e reinstalar</button>
            <button className={`${btn} border-[#CBD5E1] text-[#334155]`} onClick={() => { setStep(false); setAccept(false); setText('') }}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  )
}
