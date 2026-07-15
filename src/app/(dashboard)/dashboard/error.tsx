'use client'
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard-error]', error.message, error.digest)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl mb-5 flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
        <span className="text-2xl">⚠️</span>
      </div>
      <h2 className="text-lg font-black mb-2" style={{ color: '#111827' }}>
        Não foi possível carregar a Dashboard
      </h2>
      <p className="text-sm mb-6 max-w-sm" style={{ color: '#6B7280' }}>
        A sua sessão continua segura. Tente novamente ou recarregue a página.
      </p>
      {error.digest && (
        <p className="text-[11px] mb-4 font-mono" style={{ color: '#D1D5DB' }}>
          Código: {error.digest}
        </p>
      )}
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-xl text-sm font-bold text-black"
        style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}
      >
        Tentar novamente
      </button>
    </div>
  )
}
