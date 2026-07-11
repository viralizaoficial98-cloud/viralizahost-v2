'use client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ReactNode } from 'react'

interface AdminPageShellProps {
  title: string
  subtitle: string
  backHref?: string
  action?: ReactNode
  children: ReactNode
}

export function AdminPageShell({ title, subtitle, backHref = '/admin/site', action, children }: AdminPageShellProps) {
  return (
    <div className="space-y-5 md:space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={backHref}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0"
            style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#E2E8F0' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F1F5F9' }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-black truncate" style={{ color: '#0B0B0D' }}>{title}</h1>
            <p className="text-sm truncate" style={{ color: '#64748B' }}>{subtitle}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}

export const adminCard = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
  overflow: 'hidden' as const,
}

export const adminInput = {
  width: '100%',
  padding: '9px 13px',
  borderRadius: 10,
  border: '1px solid #E2E8F0',
  background: '#F8FAFC',
  color: '#0B0B0D',
  fontSize: 14,
  outline: 'none',
}

export const adminLabel = {
  display: 'block' as const,
  fontSize: 12,
  fontWeight: 600,
  color: '#64748B',
  marginBottom: 5,
}

export const btnPrimary = {
  display: 'inline-flex' as const,
  alignItems: 'center' as const,
  gap: 6,
  padding: '10px 18px',
  borderRadius: 12,
  fontWeight: 700,
  fontSize: 13,
  color: '#000',
  background: 'linear-gradient(135deg,#F5B700,#D9A300)',
  boxShadow: '0 4px 14px rgba(245,183,0,0.30)',
  cursor: 'pointer' as const,
  border: 'none' as const,
}

export const btnSecondary = {
  display: 'inline-flex' as const,
  alignItems: 'center' as const,
  gap: 6,
  padding: '9px 16px',
  borderRadius: 12,
  fontWeight: 600,
  fontSize: 13,
  color: '#475569',
  background: '#F1F5F9',
  border: '1px solid #E2E8F0',
  cursor: 'pointer' as const,
}

export const thStyle = {
  padding: '12px 20px',
  textAlign: 'left' as const,
  fontSize: 11,
  fontWeight: 700,
  color: '#94A3B8',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  background: '#F8FAFC',
  borderBottom: '1px solid #F1F5F9',
}
