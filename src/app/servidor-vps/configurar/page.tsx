import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { VpsConfigurator, type CfgPlan } from '@/components/vps/VpsConfigurator'
import { loadVpsPlans } from '@/lib/commerce/vps-plans'
import { loadCloudSettings } from '@/lib/vps/cloud'
import { createAuthClient } from '@/lib/supabase/server'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Configurar Cloud VPS', description: 'Escolha o plano, o sistema operativo ou aplicação, o centro de dados e o período do seu VPS.' }

// Configurador Cloud VPS: planos e preços do catálogo (MariaDB), opções publicadas no painel; o servidor valida e calcula.
export default async function ConfigurarVpsPage({ searchParams }: { searchParams: Promise<{ plano?: string; ciclo?: string; app?: string; upgrade?: string }> }) {
  const sp = await searchParams
  const [all, cloud] = await Promise.all([loadVpsPlans().catch(() => []), loadCloudSettings().catch(() => null)])
  const plans: CfgPlan[] = all.filter(p => p.saleStatus === 'active').map(p => ({
    slug: p.slug, name: p.name,
    specs: { vcpu: p.specs.vcpu ?? null, ramGb: p.specs.ramGb ?? null, diskGb: p.specs.diskGb ?? null },
    cycles: p.periods.filter(x => x.active && x.price != null).map(x => ({ cycle: x.cycle, months: x.months, price: x.price!, renewal: x.renewal ?? x.price! })),
  })).filter(p => p.cycles.length)
  const { data: { user } } = await (await createAuthClient()).auth.getUser()
  const [[me]] = user ? await getPool().query('SELECT role FROM profiles WHERE id = ?', [user.id]) as never as [{ role: string }[]] : [[null]]
  return (
    <>
      <Header />
      <main className="bg-[#F7F7F7] min-h-screen pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-xs font-bold uppercase tracking-widest text-[#D9A300]">Cloud VPS</p>
          <h1 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-1 mb-6">Configure o seu VPS</h1>
          <Suspense>
            <VpsConfigurator plans={plans} addons={(cloud?.addons ?? []).filter(a => a.enabled).map(a => ({ id: a.id, label: a.label, kind: a.kind, monthlyKz: a.monthlyKz, description: a.description }))}
              mode={cloud?.mode ?? 'disabled'} isAdmin={me?.role === 'admin'} loggedIn={!!user} initial={{ plan: sp.plano, cycle: sp.ciclo, app: sp.app, upgrade: sp.upgrade && /^[0-9a-f-]{36}$/i.test(sp.upgrade) ? sp.upgrade : undefined }} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  )
}
