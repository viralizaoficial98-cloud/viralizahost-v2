'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle, CheckCircle, ExternalLink, Film, Images, Link2,
  Loader2, RefreshCw, Trash2, Upload, X,
} from 'lucide-react'
import {
  AdminPageShell, adminCard, adminInput, adminLabel, btnPrimary, btnSecondary,
} from '@/components/admin/AdminPageShell'
import {
  HOME_HERO_VIDEO_MAX_BYTES, HOME_HERO_VIDEO_MIME,
  formatBytes, normalizeVideoSrc,
  type HomeHeroMode, type HomeHeroSettings,
} from '@/lib/home-hero'

/* ─── Tipos ──────────────────────────────────────────────────────────── */
type PendingVideo =
  | { source: 'storage'; storagePath: string; fileName: string; sizeBytes: number; previewUrl: string }
  | { source: 'url'; url: string; previewUrl: string }

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number; fileName: string }
  | { status: 'error'; message: string }

type Notice = { ok: boolean; text: string } | null

/* ─── Upload direto para o armazenamento do servidor (URL assinado) ──── */
function uploadToSignedUrl(signedUrl: string, file: File, onProgress: (pct: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let msg = `HTTP ${xhr.status}`
      try { const j = JSON.parse(xhr.responseText); msg = j.message ?? j.error ?? msg } catch {}
      if (xhr.status === 413 || /exceeded the maximum allowed size/i.test(msg)) {
        msg = 'O ficheiro excede o limite de tamanho permitido pelo servidor (verifique o limite de upload do proxy/Apache).'
      }
      reject(new Error(msg))
    }
    xhr.onerror = () => reject(new Error('Falha de rede durante o envio.'))
    xhr.onabort = () => reject(new Error('Envio cancelado.'))
    signal.addEventListener('abort', () => xhr.abort())

    const fd = new FormData()
    fd.append('cacheControl', '31536000')
    fd.append('', file)
    xhr.send(fd)
  })
}

/* ─── Leitura das definições ─────────────────────────────────────────── */
async function fetchSettings(): Promise<{ settings: HomeHeroSettings } | { error: string }> {
  try {
    const res = await fetch('/api/admin/home-hero', { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? `HTTP ${res.status}` }
    return { settings: json.settings }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

/* ─── Página ─────────────────────────────────────────────────────────── */
export default function HomeHeroAdminPage() {
  const [settings, setSettings] = useState<HomeHeroSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [mode, setMode] = useState<HomeHeroMode>('carousel')
  const [pending, setPending] = useState<PendingVideo | null>(null)
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' })
  const [dragging, setDragging] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const applyLoaded = useCallback((r: { settings: HomeHeroSettings } | { error: string }) => {
    if ('error' in r) setLoadError(r.error)
    else { setLoadError(null); setSettings(r.settings); setMode(r.settings.mode); setPending(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchSettings().then(r => { if (!cancelled) applyLoaded(r) })
    return () => { cancelled = true }
  }, [applyLoaded])

  const refresh = () => {
    setLoading(true); setLoadError(null); setNotice(null)
    fetchSettings().then(applyLoaded)
  }

  /* Liberta o object URL de pré-visualização */
  useEffect(() => () => {
    if (pending?.source === 'storage' && pending.previewUrl.startsWith('blob:')) URL.revokeObjectURL(pending.previewUrl)
  }, [pending])

  const savedVideoUrl = settings?.video_url ?? null
  const previewUrl = pending?.previewUrl ?? savedVideoUrl
  const hasVideo = !!previewUrl
  const dirty = !!settings && (mode !== settings.mode || !!pending)
  const busy = saving || upload.status === 'uploading'

  /* ── Upload ─────────────────────────────────────────────────── */
  const handleFile = useCallback(async (file: File) => {
    setNotice(null)
    // Alguns sistemas não indicam o tipo MIME; a extensão .mp4 é obrigatória.
    if (!/\.mp4$/i.test(file.name) || (file.type !== '' && file.type !== HOME_HERO_VIDEO_MIME)) {
      setUpload({ status: 'error', message: 'Formato não suportado. Envie um ficheiro MP4 (H.264).' })
      return
    }
    if (file.size > HOME_HERO_VIDEO_MAX_BYTES) {
      setUpload({ status: 'error', message: `Ficheiro muito grande (${formatBytes(file.size)}). Máximo: ${formatBytes(HOME_HERO_VIDEO_MAX_BYTES)}.` })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setUpload({ status: 'uploading', progress: 0, fileName: file.name })

    try {
      const res = await fetch('/api/admin/home-hero/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, size: file.size, contentType: HOME_HERO_VIDEO_MIME }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)

      await uploadToSignedUrl(json.signedUrl, file,
        pct => setUpload({ status: 'uploading', progress: pct, fileName: file.name }),
        controller.signal)

      setPending({
        source: 'storage', storagePath: json.path, fileName: file.name,
        sizeBytes: file.size, previewUrl: URL.createObjectURL(file),
      })
      setMode('video')
      setUpload({ status: 'idle' })
      setNotice({ ok: true, text: 'Vídeo enviado. Reveja a pré-visualização e carregue em "Publicar" para o colocar no site.' })
    } catch (err) {
      setUpload({ status: 'error', message: (err as Error).message })
    } finally {
      abortRef.current = null
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [])

  const applyUrl = () => {
    const url = normalizeVideoSrc(urlDraft)
    if (!url) {
      setUpload({ status: 'error', message: 'URL inválido. Use /caminho/ficheiro.mp4 ou um URL https:// direto para o MP4.' })
      return
    }
    setPending({ source: 'url', url, previewUrl: url })
    setMode('video')
    setShowUrl(false)
    setUpload({ status: 'idle' })
  }

  /* ── Publicar / remover ─────────────────────────────────────── */
  const publish = async () => {
    setSaving(true); setNotice(null)
    try {
      const video = pending?.source === 'storage'
        ? { source: 'storage', storagePath: pending.storagePath, fileName: pending.fileName, sizeBytes: pending.sizeBytes }
        : pending?.source === 'url'
          ? { source: 'url', url: pending.url }
          : undefined
      const res = await fetch('/api/admin/home-hero', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, video }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setSettings(json.settings)
      setMode(json.settings.mode)
      setPending(null)
      setNotice({
        ok: true,
        text: json.settings.mode === 'video'
          ? 'Publicado: a página inicial passa a mostrar o vídeo.'
          : 'Publicado: a página inicial passa a mostrar o carrossel.',
      })
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const removeVideo = async () => {
    if (pending) { setPending(null); setMode(settings?.mode === 'video' && settings.video_url ? 'video' : 'carousel'); return }
    if (!confirm('Remover o vídeo e voltar ao carrossel? O ficheiro enviado será apagado do Storage.')) return
    setSaving(true); setNotice(null)
    try {
      const res = await fetch('/api/admin/home-hero', { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setSettings(json.settings); setMode('carousel'); setPending(null)
      setNotice({ ok: true, text: 'Vídeo removido. A página inicial voltou ao carrossel.' })
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <AdminPageShell
      title="Topo da Página Inicial"
      subtitle="Escolha entre o carrossel de banners e um vídeo"
      action={
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noreferrer" style={btnSecondary}><ExternalLink size={14} /> Ver site</a>
          <button onClick={refresh} disabled={loading || busy} style={btnSecondary}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      }
    >
      {loadError && (
        <div className="px-4 py-3 rounded-xl text-sm flex items-start gap-2"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{loadError}</span>
        </div>
      )}

      {notice && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2" role="status"
          style={notice.ok
            ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
            : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
          {notice.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="ml-auto opacity-60" aria-label="Fechar"><X size={14} /></button>
        </div>
      )}

      {loading && !settings ? (
        <div className="flex items-center gap-2 text-sm p-6" style={{ color: '#64748B' }}>
          <Loader2 size={16} className="animate-spin" /> A carregar definições…
        </div>
      ) : settings && (
        <>
          {/* ── 1. Modo ─────────────────────────────────────── */}
          <section style={adminCard} className="p-5 md:p-6 space-y-4">
            <div>
              <h2 className="font-black text-base" style={{ color: '#0B0B0D' }}>O que mostrar no topo</h2>
              <p className="text-sm" style={{ color: '#64748B' }}>Só um dos dois fica ativo. A alteração só entra no site depois de publicar.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="radiogroup" aria-label="Modo do topo da página inicial">
              <ModeOption
                selected={mode === 'carousel'} live={settings.mode === 'carousel'}
                onSelect={() => setMode('carousel')} disabled={busy}
                icon={Images} title="Carrossel"
                desc="Slides com rotação automática geridos em Banners / Hero."
                footer={<Link href="/admin/site/banners" className="text-xs font-semibold" style={{ color: '#D9A300' }}>Gerir slides →</Link>}
              />
              <ModeOption
                selected={mode === 'video'} live={settings.mode === 'video'}
                onSelect={() => hasVideo && setMode('video')} disabled={busy || !hasVideo}
                icon={Film} title="Vídeo"
                desc={hasVideo
                  ? 'Leitor com controlos; o vídeo começa quando o visitante carrega em reproduzir.'
                  : 'Carregue um vídeo abaixo para poder ativar este modo.'}
              />
            </div>
          </section>

          {/* ── 2. Vídeo ────────────────────────────────────── */}
          <section style={adminCard} className="p-5 md:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <h2 className="font-black text-base" style={{ color: '#0B0B0D' }}>Vídeo</h2>
                <p className="text-sm" style={{ color: '#64748B' }}>
                  MP4 (H.264), até {formatBytes(HOME_HERO_VIDEO_MAX_BYTES)}. Recomendado 16:9 (ex.: 1920×1080). O vídeo é encaixado sem cortes.
                </p>
              </div>
              {hasVideo && (
                <button onClick={removeVideo} disabled={busy} style={{ ...btnSecondary, color: '#DC2626' }}>
                  <Trash2 size={14} /> {pending ? 'Descartar' : 'Remover vídeo'}
                </button>
              )}
            </div>

            {hasVideo && (
              <div className="space-y-2">
                <div className="rounded-xl overflow-hidden max-w-2xl" style={{ background: '#000', border: '1px solid #E2E8F0' }}>
                  <video key={previewUrl} src={previewUrl!} controls playsInline preload="metadata"
                    className="w-full aspect-video" style={{ objectFit: 'contain', background: '#000' }} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: '#64748B' }}>
                  {pending ? (
                    <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#B45309' }}>Por publicar</span>
                  ) : (
                    <span className="font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}>Guardado</span>
                  )}
                  <span className="truncate max-w-full">
                    {pending?.source === 'storage' ? pending.fileName
                      : pending?.source === 'url' ? pending.url
                      : settings.video_file_name ?? settings.video_url}
                  </span>
                  <span>{formatBytes(pending?.source === 'storage' ? pending.sizeBytes : pending ? null : settings.video_size_bytes)}</span>
                </div>
              </div>
            )}

            {/* Zona de upload */}
            {upload.status === 'uploading' ? (
              <div className="rounded-xl p-5 space-y-2" style={{ border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                <div className="flex items-center justify-between text-sm" style={{ color: '#0B0B0D' }}>
                  <span className="flex items-center gap-2 truncate"><Loader2 size={14} className="animate-spin shrink-0" /> A enviar {upload.fileName}</span>
                  <span className="tabular-nums font-bold">{upload.progress}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                  <div className="h-full rounded-full transition-all duration-200" style={{ width: `${upload.progress}%`, background: '#F5B700' }} />
                </div>
                <button onClick={() => abortRef.current?.abort()} className="text-xs font-semibold" style={{ color: '#64748B' }}>Cancelar</button>
              </div>
            ) : (
              <div
                onDragEnter={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={e => { e.preventDefault(); setDragging(false) }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }}
                onClick={() => !busy && fileRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all p-8 text-center"
                style={{
                  border: `2px dashed ${dragging ? '#F5B700' : '#CBD5E1'}`,
                  background: dragging ? 'rgba(245,183,0,0.06)' : '#F8FAFC',
                }}
              >
                <Upload size={22} style={{ color: dragging ? '#D9A300' : '#94A3B8' }} />
                <p className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>
                  {hasVideo ? 'Substituir vídeo' : 'Carregar vídeo'} — arraste o MP4 ou clique para escolher
                </p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>O ficheiro é enviado diretamente para o Supabase Storage.</p>
                <input ref={fileRef} type="file" accept="video/mp4,.mp4" className="hidden"
                  data-testid="home-hero-video-input"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>
            )}

            {upload.status === 'error' && (
              <div className="px-3 py-2 rounded-lg text-sm flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
                <AlertCircle size={15} className="mt-0.5 shrink-0" /> {upload.message}
              </div>
            )}

            {/* URL externo (alternativa) */}
            <div>
              {!showUrl ? (
                <button onClick={() => { setShowUrl(true); setUrlDraft(settings.video_storage_path ? '' : settings.video_url ?? '') }}
                  disabled={busy} className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#64748B' }}>
                  <Link2 size={13} /> Usar um URL externo em vez de carregar
                </button>
              ) : (
                <div className="space-y-2">
                  <label style={adminLabel} htmlFor="hero-video-url">URL do vídeo (https:// ou /caminho/ficheiro.mp4)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input id="hero-video-url" value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
                      placeholder="https://cdn.exemplo.ao/viralizahost-home.mp4" style={adminInput} />
                    <div className="flex gap-2 shrink-0">
                      <button onClick={applyUrl} style={btnSecondary}>Usar URL</button>
                      <button onClick={() => setShowUrl(false)} style={btnSecondary} aria-label="Cancelar"><X size={14} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Publicar ────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              {settings.updated_at && <>Última alteração: {new Date(settings.updated_at).toLocaleString('pt-PT')}. </>}
              A página inicial atualiza na visita seguinte à publicação.
            </p>
            <button onClick={publish} disabled={!dirty || busy}
              style={{ ...btnPrimary, opacity: !dirty || busy ? 0.5 : 1, cursor: !dirty || busy ? 'not-allowed' : 'pointer' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {mode === 'video' ? 'Publicar vídeo' : 'Publicar carrossel'}
            </button>
          </div>
        </>
      )}
    </AdminPageShell>
  )
}

/* ─── Cartão de opção de modo ────────────────────────────────────────── */
function ModeOption({ selected, live, onSelect, disabled, icon: Icon, title, desc, footer }: {
  selected: boolean; live: boolean; onSelect: () => void; disabled: boolean
  icon: React.ElementType; title: string; desc: string; footer?: React.ReactNode
}) {
  return (
    <div
      role="radio" aria-checked={selected} aria-disabled={disabled} tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect() } }}
      className="p-4 rounded-xl transition-all flex gap-3"
      style={{
        border: `2px solid ${selected ? '#F5B700' : '#E2E8F0'}`,
        background: selected ? 'rgba(245,183,0,0.06)' : '#FFFFFF',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !selected ? 0.55 : 1,
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: selected ? 'rgba(245,183,0,0.15)' : '#F1F5F9' }}>
        <Icon size={19} style={{ color: selected ? '#D9A300' : '#64748B' }} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{title}</span>
          {live && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}>Ativo no site</span>
          )}
        </div>
        <p className="text-xs" style={{ color: '#64748B' }}>{desc}</p>
        {footer && <div onClick={e => e.stopPropagation()}>{footer}</div>}
      </div>
      <div className="w-4 h-4 rounded-full shrink-0 mt-1 flex items-center justify-center"
        style={{ border: `2px solid ${selected ? '#F5B700' : '#CBD5E1'}` }}>
        {selected && <div className="w-2 h-2 rounded-full" style={{ background: '#F5B700' }} />}
      </div>
    </div>
  )
}
