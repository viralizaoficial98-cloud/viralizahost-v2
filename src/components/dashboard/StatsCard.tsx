'use client'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: LucideIcon
  color?: 'yellow' | 'green' | 'blue' | 'red'
}

const colors = {
  yellow: { iconBg: 'rgba(245,183,0,0.10)', iconBorder: 'rgba(245,183,0,0.20)', iconColor: '#D9A300', accent: '#F5B700' },
  green:  { iconBg: 'rgba(16,185,129,0.10)', iconBorder: 'rgba(16,185,129,0.20)', iconColor: '#059669', accent: '#10B981' },
  blue:   { iconBg: 'rgba(59,130,246,0.10)', iconBorder: 'rgba(59,130,246,0.20)', iconColor: '#2563EB', accent: '#3B82F6' },
  red:    { iconBg: 'rgba(239,68,68,0.10)',  iconBorder: 'rgba(239,68,68,0.20)',  iconColor: '#DC2626', accent: '#EF4444' },
}

export function StatsCard({ title, value, change, changeType, icon: Icon, color = 'yellow' }: StatsCardProps) {
  const c = colors[color]
  return (
    <div
      className="rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px ${c.accent}30` }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: c.iconBg, border: `1px solid ${c.iconBorder}` }}
        >
          <Icon size={20} style={{ color: c.iconColor }} />
        </div>
        {change && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: changeType === 'up' ? 'rgba(16,185,129,0.10)' : changeType === 'down' ? 'rgba(239,68,68,0.10)' : 'rgba(156,163,175,0.10)',
              color: changeType === 'up' ? '#059669' : changeType === 'down' ? '#DC2626' : '#6B7280',
            }}
          >
            {changeType === 'up' ? '↑ ' : changeType === 'down' ? '↓ ' : ''}{change}
          </span>
        )}
      </div>
      <div className="text-3xl font-black mb-1" style={{ color: '#111827' }}>{value}</div>
      <div className="text-sm font-medium" style={{ color: '#6B7280' }}>{title}</div>
    </div>
  )
}
