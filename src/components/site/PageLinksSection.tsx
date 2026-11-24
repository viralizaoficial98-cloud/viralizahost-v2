import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  Activity, AlertTriangle, Archive, ArrowRight, Bot, BookOpen, Building2, Calendar, Code, Cpu, Database, Gauge, Globe, Handshake, HardDrive, Headphones,
  HelpCircle, Layers, Lock, Mail, MessageCircle, Monitor, MoveRight, RefreshCw, RotateCcw, Rss, Search, Server, Shield, ShieldCheck, Smartphone, Tag,
  Users, Workflow, Wrench, Zap,
} from 'lucide-react'
import type { PageIcon } from '@/lib/site/pages'

// Secção de ligações para os fluxos/páginas de um tema (usada nas páginas consolidadas: Domínios, E-mail, VPS…).
const ICONS: Record<PageIcon, typeof Globe> = {
  server: Server, users: Users, zap: Zap, code: Code, cpu: Cpu, workflow: Workflow, shield: Shield, message: MessageCircle, bot: Bot, harddrive: HardDrive,
  monitor: Monitor, globe: Globe, search: Search, move: MoveRight, rotate: RotateCcw, gauge: Gauge, lock: Lock, shieldcheck: ShieldCheck, layers: Layers,
  database: Database, book: BookOpen, mail: Mail, alert: AlertTriangle, archive: Archive, activity: Activity, smartphone: Smartphone, calendar: Calendar,
  refresh: RefreshCw, rss: Rss, wrench: Wrench, handshake: Handshake, headphones: Headphones, building: Building2, tag: Tag, help: HelpCircle,
}
export type LinkCard = { href: string; title: string; desc: string; icon: PageIcon; cta?: string }

export function PageLinksSection({ id, tag, title, subtitle, items, dark = false, children }: {
  id: string; tag?: string; title: ReactNode; subtitle?: string; items: LinkCard[]; dark?: boolean; children?: ReactNode
}) {
  return (
    <section id={id} className={`py-14 sm:py-16 scroll-mt-24 ${dark ? 'bg-[#0B0B0B]' : 'bg-white'}`} data-testid={`section-${id}`}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          {tag && <span className="section-tag">{tag}</span>}
          <h2 className={`text-2xl md:text-3xl font-black mt-3 ${dark ? 'text-white' : 'text-[#0A0A0A]'}`}>{title}</h2>
          {subtitle && <p className={`max-w-2xl mx-auto text-sm md:text-base mt-2 ${dark ? 'text-white/60' : 'text-[#666]'}`}>{subtitle}</p>}
        </div>
        {children}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(({ href, title: t, desc, icon, cta }) => {
            const I = ICONS[icon] ?? Globe
            return (
              <Link key={href} href={href} data-testid="link-card"
                className={`group flex items-start gap-3 rounded-2xl border p-4 transition-colors ${dark ? 'border-white/10 bg-white/[0.03] hover:border-[#F5B700]/50' : 'border-[#E8E8E8] bg-[#FCFCFC] hover:border-[#F5B700]'}`}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,183,0,0.12)' }}><I size={18} className="text-[#D9A300]" aria-hidden /></span>
                <span className="flex-1 min-w-0">
                  <span className={`block font-bold text-sm ${dark ? 'text-white' : 'text-[#0A0A0A]'}`}>{t}</span>
                  <span className={`block text-xs mt-0.5 ${dark ? 'text-white/50' : 'text-[#666]'}`}>{desc}</span>
                  {cta && <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B98900] mt-2">{cta} <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" aria-hidden /></span>}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
