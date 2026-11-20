/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db/pool'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { adminGuard } from '@/lib/api/require-admin'

// Seed data ---------------------------------------------------------------

const seedBanners = [
  {
    position: 1, active: true,
    bg_image: null, bg_color: '#000000', accent_color: '#F5B700',
    tag: 'Inteligência Artificial',
    title: 'Automação & IA',
    subtitle: 'Soluções de inteligência artificial para automatizar e acelerar o seu negócio.',
    cta_text: 'Começar Agora', cta_href: '/checkout',
    cta_secondary_text: 'Saiba Mais', cta_secondary_href: '#planos',
    features: ['IA Avançada', 'Automação 24/7', 'Integração Completa'],
  },
  {
    position: 2, active: true,
    bg_image: '/viraliza-email-banner.png', bg_color: '#000000', accent_color: '#8b5cf6',
    tag: 'Email Profissional',
    title: 'E-mail Corporativo',
    subtitle: 'Tenha um email com o nome da sua empresa. Confiável, seguro e integrado com as melhores ferramentas do mercado.',
    cta_text: 'Criar Email', cta_href: '/checkout',
    cta_secondary_text: 'Ver Planos', cta_secondary_href: '#email-plans',
    features: ['Anti-spam Avançado', 'Backup Diário', 'Webmail Incluído'],
  },
  {
    position: 3, active: true,
    bg_image: '/servidores_banner.png', bg_color: '#000000', accent_color: '#10b981',
    tag: 'Domínios',
    title: 'A Sua Identidade Online',
    subtitle: 'Registe o domínio perfeito para o seu negócio. Disponível em .ao, .com, .net e muitas outras extensões.',
    cta_text: 'Registar Domínio', cta_href: '/checkout',
    cta_secondary_text: 'Verificar Disponibilidade', cta_secondary_href: '#dominios',
    features: ['.ao Disponível', '.com Disponível', 'Transferência Grátis'],
  },
]




const seedTeam = [
  {
    position: 1, active: true, is_ceo: true,
    name: 'Manuel Muenho', role: 'CEO & Founder', title: 'Chief Executive Officer',
    bio: 'Fundador da ViralizaHost com visão de democratizar o acesso à tecnologia em Angola.',
    photo_url: '/Manuel Muenho.jpeg', flag: '🇦🇴', country: 'Angola', accent_color: '#3b82f6',
  },
  {
    position: 2, active: true, is_ceo: false,
    name: 'Lucas Marcelino', role: 'CTO', title: 'Chief Technology Officer',
    bio: 'Responsável pela infraestrutura técnica e inovação dos nossos serviços de hospedagem.',
    photo_url: null, flag: '🇦🇴', country: 'Angola', accent_color: '#8b5cf6',
  },
  {
    position: 3, active: true, is_ceo: false,
    name: 'Jacob Pessela', role: 'COO', title: 'Chief Operating Officer',
    bio: 'Garante a excelência operacional e a qualidade dos serviços entregues aos nossos clientes.',
    photo_url: null, flag: '🇦🇴', country: 'Angola', accent_color: '#10b981',
  },
  {
    position: 4, active: true, is_ceo: false,
    name: 'Vladimiro Francisco', role: 'Head of Infrastructure', title: 'Infraestrutura & DevOps',
    bio: 'Especialista em servidores e redes, mantendo a disponibilidade e segurança da plataforma.',
    photo_url: null, flag: '🇦🇴', country: 'Angola', accent_color: '#f59e0b',
  },
  {
    position: 5, active: true, is_ceo: false,
    name: 'Israel Soares', role: 'Head of Support', title: 'Suporte & Customer Success',
    bio: 'Lidera a equipa de suporte garantindo que cada cliente receba ajuda rápida e eficaz.',
    photo_url: null, flag: '🇦🇴', country: 'Angola', accent_color: '#ef4444',
  },
  {
    position: 6, active: true, is_ceo: false,
    name: 'Arnaldo Eduardo', role: 'Head of Sales', title: 'Vendas & Parcerias',
    bio: 'Responsável pelo crescimento comercial e desenvolvimento de parcerias estratégicas.',
    photo_url: null, flag: '🇦🇴', country: 'Angola', accent_color: '#06b6d4',
  },
]

// Upsert conflict columns per table
const UPSERT_CONFLICT: Record<string, string> = {
  site_banners:       'position',
  site_domains:       'extension',
  site_email_plans:   'slug',
  site_hosting_plans: 'slug',
  site_team:          'name',
}

// Helpers -----------------------------------------------------------------

// Só conteúdo editorial. Planos, preços e domínios vêm do catálogo (product_prices /
// domain_prices, «Catálogo e Preços»): nunca se semeiam preços por omissão.
const TABLES = ['site_banners', 'site_team'] as const
const DATASETS = [seedBanners, seedTeam]


async function upsertTable(
  db: Awaited<ReturnType<typeof createAdminClient>>,
  table: string,
  data: object[]
): Promise<{ seeded: boolean; count: number; error?: string }> {
  const { error } = await (db as any)
    .from(table)
    .upsert(data, { onConflict: UPSERT_CONFLICT[table] })

  if (error) {
    console.error(`[seed-site] upsert error on ${table}:`, JSON.stringify(error))
    return { seeded: false, count: 0, error: `upsert failed: ${error.message}` }
  }

  return { seeded: true, count: data.length }
}

// Handlers ----------------------------------------------------------------

export async function POST() {
  const denied = await adminGuard()
  if (denied) return denied

  const db = await createAdminClient()

  const summary = await Promise.all(
    TABLES.map((t, i) => upsertTable(db, t, DATASETS[i]).then(r => ({ table: t, ...r })))
  )

  const seededCount = summary.filter(s => s.seeded).length
  const errorCount  = summary.filter(s => s.error).length

  return NextResponse.json({ ok: errorCount === 0, summary, seededCount, errorCount })
}

/** Contagens do painel «Gestão do Site»: { counts, errors } — um erro nunca aparece como 0. */
export async function GET() {
  const denied = await adminGuard()
  if (denied) return denied
  const db = getPool()
  const Q: Record<string, string> = {
    site_banners: 'SELECT COUNT(*) n FROM site_banners',
    site_team: 'SELECT COUNT(*) n FROM site_team',
    banner_pages: 'SELECT COUNT(*) n FROM banner_pages',
    hosting_plans: "SELECT COUNT(*) n FROM products WHERE active = 1 AND sale_status <> 'draft' AND category IN ('hosting','wordpress','website-builder','reseller')",
    email_plans: "SELECT COUNT(*) n FROM products WHERE active = 1 AND sale_status <> 'draft' AND category = 'email'",
    domain_extensions: "SELECT COUNT(DISTINCT extension) n FROM domain_prices WHERE status <> 'draft'",
    products: 'SELECT COUNT(*) n FROM products',
    product_prices: 'SELECT COUNT(*) n FROM product_prices WHERE active = 1',
  }
  const counts: Record<string, number> = {}, errors: Record<string, string> = {}
  await Promise.all(Object.entries(Q).map(async ([k, sql]) => {
    try { const [[r]] = await db.query(sql) as any; counts[k] = Number(r.n) } catch (e) { errors[k] = (e as Error).message.slice(0, 200) }
  }))
  return NextResponse.json({ counts, errors })
}
