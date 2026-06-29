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
  yellow: { bg: 'bg-yellow-400/10 border-yellow-400/20', icon: 'text-yellow-400' },
  green: { bg: 'bg-green-400/10 border-green-400/20', icon: 'text-green-400' },
  blue: { bg: 'bg-blue-400/10 border-blue-400/20', icon: 'text-blue-400' },
  red: { bg: 'bg-red-400/10 border-red-400/20', icon: 'text-red-400' },
}

export function StatsCard({ title, value, change, changeType, icon: Icon, color = 'yellow' }: StatsCardProps) {
  const c = colors[color]
  return (
    <div className="glass-dark rounded-2xl p-6 border border-[#222] hover:border-[#FFC107]/20 transition-all hover:shadow-[0_0_20px_rgba(255,193,7,0.05)]">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 ${c.bg} border rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={c.icon} />
        </div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${changeType === 'up' ? 'bg-green-400/10 text-green-400' : changeType === 'down' ? 'bg-red-400/10 text-red-400' : 'bg-gray-400/10 text-gray-400'}`}>
            {changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : ''} {change}
          </span>
        )}
      </div>
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  )
}
