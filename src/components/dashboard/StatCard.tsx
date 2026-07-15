'use client'
import { Globe, Server, Mail, Ticket, ArrowRight } from 'lucide-react'

export type StatIconKey = 'domains' | 'hosting' | 'email' | 'tickets'

const iconMap: Record<StatIconKey, React.ElementType> = {
  domains: Globe,
  hosting: Server,
  email:   Mail,
  tickets: Ticket,
}

interface StatCardProps {
  label:       string
  value:       number
  href:        string
  iconKey:     StatIconKey
  iconBg:      string
  iconBorder:  string
  iconColor:   string
  shadow:      string
}

export function StatCard({ label, value, href, iconKey, iconBg, iconBorder, iconColor, shadow }: StatCardProps) {
  const Icon = iconMap[iconKey]
  return (
    <a href={href} className="block group">
      <div
        className="rounded-2xl p-6 transition-all duration-300 group-hover:-translate-y-1 cursor-pointer"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${shadow}, 0 2px 8px rgba(0,0,0,0.04)` }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
          >
            <Icon size={22} style={{ color: iconColor }} />
          </div>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
            style={{ background: iconBg }}
          >
            <ArrowRight size={14} style={{ color: iconColor }} />
          </div>
        </div>
        <div className="text-3xl font-black mb-1.5 tabular-nums" style={{ color: '#111827' }}>{value}</div>
        <div className="text-sm font-medium" style={{ color: '#6B7280' }}>{label}</div>
      </div>
    </a>
  )
}
