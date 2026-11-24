import Link from 'next/link'
import { ArrowRight, Boxes, Code2, Database, HardDrive, LayoutDashboard, Monitor, Server, Terminal, Workflow } from 'lucide-react'
import type { DedicatedKind } from '@/lib/commerce/dedicated-shared'

// Opções de servidores dedicados distribuídas por compatibilidade: o que corre em cada sistema e para onde ir quando
// a necessidade é outra (VPS com aplicações pré-configuradas, ou o outro sistema operativo).
const ITEMS: Record<DedicatedKind, { icon: typeof Server; title: string; desc: string }[]> = {
  linux: [
    { icon: Terminal, title: 'Distribuições Linux', desc: 'Ubuntu Server, Debian, AlmaLinux e Rocky Linux com acesso root total.' },
    { icon: LayoutDashboard, title: 'cPanel/WHM', desc: 'Painel de alojamento para revenda ou dezenas de sites (licença à parte).' },
    { icon: Boxes, title: 'Docker e Kubernetes', desc: 'Contentores e orquestração para aplicações e microsserviços.' },
    { icon: Workflow, title: 'Automação self-hosted', desc: 'n8n, Evolution API e agentes de IA com recursos dedicados para grandes volumes.' },
    { icon: Database, title: 'Bases de dados', desc: 'MySQL/MariaDB, PostgreSQL e Redis com discos NVMe e RAID.' },
  ],
  windows: [
    { icon: Monitor, title: 'Windows Server', desc: 'Windows Server 2022/2019 licenciado e actualizado.' },
    { icon: LayoutDashboard, title: 'Plesk', desc: 'Painel de gestão de sites e serviços para ambientes Windows.' },
    { icon: Code2, title: 'ASP.NET e IIS', desc: 'Aplicações .NET Framework e .NET com IIS configurado.' },
    { icon: Database, title: 'Microsoft SQL Server', desc: 'Bases de dados MS SQL para ERP, faturação e sistemas internos.' },
    { icon: HardDrive, title: 'Remote Desktop (RDP)', desc: 'Acesso remoto ao ambiente gráfico para software de gestão.' },
  ],
}
const OTHER: Record<DedicatedKind, { href: string; label: string; desc: string }[]> = {
  linux: [
    { href: '/servidor-dedicado-windows', label: 'Precisa de Windows Server?', desc: 'ASP.NET, MS SQL e RDP no Servidor Dedicado Windows.' },
    { href: '/servidor-vps#aplicacoes', label: 'Aplicações prontas em VPS', desc: 'n8n, Evolution API, OpenClaw e Viraliza AI Cloud pré-configurados.' },
  ],
  windows: [
    { href: '/servidor-dedicado', label: 'Prefere Linux?', desc: 'Root total, cPanel/WHM, Docker e automação no Servidor Dedicado Linux.' },
    { href: '/servidor-vps', label: 'Começar com um VPS', desc: 'Recursos escaláveis com activação rápida.' },
  ],
}

export function DedicatedCompatibility({ kind }: { kind: DedicatedKind }) {
  return (
    <section id="compatibilidade" className="py-14 bg-white" data-testid="ded-compatibility">
      <div className="container mx-auto px-4 max-w-6xl">
        <h2 className="text-2xl md:text-3xl font-black text-[#0A0A0A] text-center">{kind === 'linux' ? 'O que corre no seu dedicado Linux' : 'O que corre no seu dedicado Windows'}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-8">
          {ITEMS[kind].map(({ icon: I, title, desc }) => (
            <div key={title} className="rounded-2xl border border-[#EEE] bg-[#FAFAFA] p-4">
              <I size={20} className="text-[#B98900]" aria-hidden />
              <p className="font-bold text-sm mt-2 text-[#0A0A0A]">{title}</p>
              <p className="text-xs text-[#666] mt-1">{desc}</p>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          {OTHER[kind].map(o => (
            <Link key={o.href} href={o.href} className="group flex items-center justify-between gap-3 rounded-2xl border border-[#E8E8E8] p-4 hover:border-[#F5B700]">
              <span><span className="block font-bold text-sm text-[#0A0A0A]">{o.label}</span><span className="block text-xs text-[#666]">{o.desc}</span></span>
              <ArrowRight size={16} className="text-[#B98900] shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
