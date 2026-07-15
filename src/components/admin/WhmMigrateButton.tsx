'use client'
import { useState } from 'react'
import { Database, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

type Status = 'idle' | 'loading' | 'success' | 'error' | 'manual'

export default function WhmMigrateButton() {
  const [status, setStatus]   = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [sql, setSql]         = useState('')

  const handleMigrate = async () => {
    if (status === 'loading') return
    setStatus('loading')
    setMessage('')
    setSql('')

    try {
      const res = await fetch('/api/admin/whm/migrate', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json() as {
        success?: boolean
        error?: string
        sql?: string
        managementApiError?: string
        tables?: Record<string, { ok: boolean; count: number; error?: string }>
      }

      if (res.ok && data.success) {
        setStatus('success')
        setMessage('Migrações aplicadas com sucesso! Recarregue a página.')
      } else if (data.sql) {
        // Management API not available — show SQL for manual execution
        setStatus('manual')
        setSql(data.sql)
        setMessage(data.error ?? 'Aplique o SQL manualmente no Supabase SQL Editor.')
      } else {
        setStatus('error')
        setMessage(data.error ?? 'Erro ao aplicar migrações.')
      }
    } catch {
      setStatus('error')
      setMessage('Erro de comunicação com o servidor.')
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleMigrate}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{
          background: status === 'loading' ? '#F1F5F9' : 'linear-gradient(135deg,#F5B700,#D9A300)',
          color: status === 'loading' ? '#94A3B8' : '#000',
          boxShadow: status === 'loading' ? 'none' : '0 4px 14px rgba(245,183,0,0.30)',
          border: 'none',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        }}>
        {status === 'loading'
          ? <><Loader2 size={15} className="animate-spin" /> Aplicando migrações…</>
          : <><Database size={15} /> Aplicar Migrações WHM</>
        }
      </button>

      {status === 'success' && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3"
          style={{ background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
          <CheckCircle size={16} style={{ color: '#059669' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#065F46' }}>{message}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs underline mt-0.5"
              style={{ color: '#047857', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Recarregar agora
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3"
          style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <AlertCircle size={16} style={{ color: '#DC2626' }} />
          <p className="text-sm" style={{ color: '#B91C1C' }}>{message}</p>
        </div>
      )}

      {status === 'manual' && sql && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl px-4 py-3"
            style={{ background: '#FFF8E1', border: '1px solid rgba(245,183,0,0.40)' }}>
            <AlertCircle size={16} style={{ color: '#D9A300' }} />
            <p className="text-sm" style={{ color: '#92720A' }}>{message}</p>
          </div>
          <details className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            <summary className="px-4 py-3 text-xs font-semibold cursor-pointer" style={{ color: '#475569', background: '#F8FAFC' }}>
              Ver SQL completo
            </summary>
            <pre className="text-[10px] p-4 overflow-x-auto"
              style={{ background: '#0F172A', color: '#E2E8F0', margin: 0, lineHeight: 1.5 }}>
              {sql}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
