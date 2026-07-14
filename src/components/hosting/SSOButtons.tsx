'use client'
import { useState } from 'react'
import { ExternalLink, Loader2, Mail } from 'lucide-react'

interface Props {
  serviceId: string
}

export function SSOButtons({ serviceId }: Props) {
  const [cpanelLoading,  setCpanelLoading]  = useState(false)
  const [webmailLoading, setWebmailLoading] = useState(false)
  const [error,          setError]          = useState('')

  async function openSso(type: 'cpanel' | 'webmail') {
    setError('')
    if (type === 'cpanel')  setCpanelLoading(true)
    else                    setWebmailLoading(true)

    try {
      const res = await fetch(`/api/client/hosting/${serviceId}/${type}-sso`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json() as { redirectUrl?: string; error?: string }

      if (!res.ok || !data.redirectUrl) {
        setError(data.error ?? 'Erro ao gerar sessão. Tente novamente.')
        return
      }

      // Open in new tab — don't store URL
      window.open(data.redirectUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Erro de comunicação. Verifique a sua ligação.')
    } finally {
      setCpanelLoading(false)
      setWebmailLoading(false)
    }
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '8px 14px', borderRadius: 10,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s', border: '1px solid',
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => openSso('cpanel')}
          disabled={cpanelLoading || webmailLoading}
          style={{
            ...btnBase,
            background: cpanelLoading ? '#F1F5F9' : 'linear-gradient(135deg,#F5B700,#D9A300)',
            color: '#000',
            borderColor: 'rgba(245,183,0,0.40)',
            opacity: (cpanelLoading || webmailLoading) ? 0.7 : 1,
          }}
          aria-label="Entrar no cPanel"
        >
          {cpanelLoading
            ? <><Loader2 size={12} className="animate-spin" /> Abrindo…</>
            : <><ExternalLink size={12} /> Entrar no cPanel</>
          }
        </button>

        <button
          onClick={() => openSso('webmail')}
          disabled={cpanelLoading || webmailLoading}
          style={{
            ...btnBase,
            background: '#F8FAFC',
            color: '#475569',
            borderColor: '#E2E8F0',
            opacity: (cpanelLoading || webmailLoading) ? 0.7 : 1,
          }}
          aria-label="Entrar no Webmail"
        >
          {webmailLoading
            ? <><Loader2 size={12} className="animate-spin" /> Abrindo…</>
            : <><Mail size={12} /> Entrar no Webmail</>
          }
        </button>
      </div>

      {error && (
        <p className="text-[11px] font-medium" style={{ color: '#DC2626' }}>{error}</p>
      )}
    </div>
  )
}
