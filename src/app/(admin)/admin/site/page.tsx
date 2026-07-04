'use client'
import Link from 'next/link'
import { Monitor, Image, Globe, Mail, Users, Server, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'

const modules = [
  { href: '/admin/site/banners',       icon: Image,  label: 'Banners / Hero',       desc: 'Slides do carrossel principal', color: '#F5B700', table: 'site_banners' },
  { href: '/admin/site/domains',       icon: Globe,  label: 'Domínios',             desc: 'Extensões e preços de domínios', color: '#3B82F6', table: 'site_domains' },
  { href: '/admin/site/email-plans',   icon: Mail,   label: 'Planos de Email',      desc: 'Planos de email corporativo',    color: '#10B981', table: 'site_email_plans' },
  { href: '/admin/site/team',          icon: Users,  label: 'Equipa',               desc: 'Membros e estrutura',            color: '#8B5CF6', table: 'site_team' },
  { href: '/admin/site/hosting-plans', icon: Server, label: 'Planos de Hospedagem', desc: 'Planos e preços de hosting',     color: '#EF4444', table: 'site_hosting_plans' },
]

export default function SitePage() {
  const [counts, setCounts] = useState<number[]>(modules.map(() => 0))
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadCounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/seed-site')
      const data = await res.json()
      setCounts(modules.map(m => data[m.table] ?? 0))
    } catch {
      setCounts(modules.map(() => 0))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadCounts() }, [loadCounts])

  const totalItems = counts.reduce((a, b) => a + b, 0)

  const handleSeed = async () => {
    if (!confirm('Isto irá popular as tabelas vazias com conteúdo padrão. Continuar?')) return
    setSeeding(true)
    setSeedMsg(null)
    try {
      const res  = await fetch('/api/admin/seed-site', { method: 'POST' })
      const data = await res.json()
      const seeded  = data.seededCount  ?? data.summary?.filter((s: any) => s.seeded).length ?? 0
      const skipped = data.skippedCount ?? data.summary?.filter((s: any) => !s.seeded && !s.error).length ?? 0
      const errors  = data.errorCount   ?? data.summary?.filter((s: any) => s.error).length ?? 0
      const errDetails = data.summary?.filter((s: any) => s.error).map((s: any) => `${s.table}: ${s.error}`).join(' | ') ?? ''
      if (errors > 0) {
        setSeedMsg({ ok: false, text: `${errors} erro(s): ${errDetails}` })
      } else {
        setSeedMsg({ ok: true, text: `${seeded} tabela(s) populadas, ${skipped} já tinham dados.` })
      }
      loadCounts()
    } catch {
      setSeedMsg({ ok: false, text: 'Erro ao fazer seed. Verifique os logs.' })
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
            <Monitor size={20} style={{ color: '#D9A300' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Gestão do Site</h1>
            <p className="text-sm" style={{ color: '#64748B' }}>Gerir conteúdo dinâmico do website público</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadCounts} disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          {totalItems === 0 && !loading && (
            <button onClick={handleSeed} disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', color: '#000', boxShadow: '0 4px 14px rgba(245,183,0,0.30)', border: 'none', cursor: 'pointer', opacity: seeding ? 0.7 : 1 }}>
              <Sparkles size={13} /> {seeding ? 'A popular...' : 'Popular conteúdo padrão'}
            </button>
          )}
        </div>
      </div>

      {/* Seed feedback */}
      {seedMsg && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
          style={seedMsg.ok
            ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
            : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
          {seedMsg.text}
          <button onClick={() => setSeedMsg(null)} className="ml-auto text-xs opacity-60">✕</button>
        </div>
      )}

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((mod, i) => {
          const Icon = mod.icon
          return (
            <Link key={mod.href} href={mod.href}
              className="group p-6 transition-all duration-200"
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}30` }}>
                  <Icon size={22} style={{ color: mod.color }} />
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={loading
                    ? { background: '#F1F5F9', color: '#94A3B8' }
                    : counts[i] > 0
                      ? { background: `${mod.color}12`, color: mod.color }
                      : { background: '#FEF3C7', color: '#D9A300' }}>
                  {loading ? '…' : `${counts[i]} itens`}
                </span>
              </div>
              <h2 className="font-black text-base mb-1" style={{ color: '#0B0B0D' }}>{mod.label}</h2>
              <p className="text-sm" style={{ color: '#64748B' }}>{mod.desc}</p>
              <div className="mt-4 text-xs font-semibold" style={{ color: mod.color }}>
                Gerir →
              </div>
            </Link>
          )
        })}
      </div>

      {/* Seed prompt when all tables empty */}
      {totalItems === 0 && !loading && (
        <div className="p-6 rounded-2xl flex items-center gap-4"
          style={{ background: 'rgba(245,183,0,0.06)', border: '1px solid rgba(245,183,0,0.20)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,183,0,0.12)', border: '1px solid rgba(245,183,0,0.25)' }}>
            <Sparkles size={18} style={{ color: '#D9A300' }} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Tabelas vazias detectadas</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Clique em "Popular agora" para inserir o conteúdo que já existe no site público nas tabelas da base de dados. Após isso pode editar tudo pelo painel.</p>
          </div>
          <button onClick={handleSeed} disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', color: '#000', boxShadow: '0 4px 14px rgba(245,183,0,0.30)', border: 'none', cursor: 'pointer', opacity: seeding ? 0.7 : 1 }}>
            <Sparkles size={14} /> {seeding ? 'A popular...' : 'Popular agora'}
          </button>
        </div>
      )}
    </div>
  )
}
