import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Seed data ---------------------------------------------------------------

const seedBanners = [
  {
    position: 0, active: true,
    bg_image: '/viraliza-ai-banner.png', bg_color: '#000000', accent_color: '#F5B700',
    tag: 'Inteligência Artificial',
    title: 'Automatize Processos com\nInteligência Artificial',
    subtitle: 'Chatbots, automações inteligentes e agentes IA para transformar o seu negócio digitalmente.',
    cta_text: 'Explorar Soluções IA', cta_href: '#servicos',
    cta_secondary_text: 'Saiba Mais', cta_secondary_href: '#servicos',
    features: ['Chatbots Inteligentes', 'Automação de Processos', 'Agentes IA'],
  },
  {
    position: 1, active: true,
    bg_image: '/viraliza-email-banner.png', bg_color: '#000000', accent_color: '#34D399',
    tag: null, title: null, subtitle: null,
    cta_text: null, cta_href: null, cta_secondary_text: null, cta_secondary_href: null,
    features: [],
  },
  {
    position: 2, active: true,
    bg_image: '/servidores_banner.png', bg_color: '#000000', accent_color: '#F5B700',
    tag: null, title: null, subtitle: null,
    cta_text: null, cta_href: null, cta_secondary_text: null, cta_secondary_href: null,
    features: [],
  },
]

const seedDomains = [
  { position: 0, extension: '.com',    currency: 'AOA', price_monthly: null, price_annual: 4500,  popular: true,  active: true },
  { position: 1, extension: '.net',    currency: 'AOA', price_monthly: null, price_annual: 5200,  popular: false, active: true },
  { position: 2, extension: '.org',    currency: 'AOA', price_monthly: null, price_annual: 4800,  popular: false, active: true },
  { position: 3, extension: '.ao',     currency: 'AOA', price_monthly: null, price_annual: 8000,  popular: true,  active: true },
  { position: 4, extension: '.com.br', currency: 'BRL', price_monthly: null, price_annual: 49,    popular: false, active: true },
  { position: 5, extension: '.io',     currency: 'AOA', price_monthly: null, price_annual: 18000, popular: false, active: true },
]

const seedEmailPlans = [
  {
    position: 0, active: true, popular: false, color: '#3B82F6',
    name: 'Starter Mail', currency: 'AOA', price_monthly: 25000, price_annual: null,
    storage_gb: 10, accounts: 5,
    features: ['Anti-spam básico', 'Webmail moderno', 'IMAP / POP3 / SMTP', 'SSL/TLS seguro'],
  },
  {
    position: 1, active: true, popular: true, color: '#F5B700',
    name: 'Business Mail', currency: 'AOA', price_monthly: 45000, price_annual: null,
    storage_gb: 25, accounts: 10,
    features: ['Anti-spam premium', 'Webmail moderno', 'IMAP / POP3 / SMTP', 'Backup semanal', 'SPF/DKIM/DMARC', 'Integração Outlook'],
  },
  {
    position: 2, active: true, popular: false, color: '#8B5CF6',
    name: 'Enterprise Mail', currency: 'AOA', price_monthly: 95000, price_annual: null,
    storage_gb: 50, accounts: 25,
    features: ['Segurança avançada', 'Backup diário', 'SPF/DKIM/DMARC', 'Proteção avançada', 'Integração Outlook'],
  },
]

const seedHostingPlans = [
  {
    position: 0, active: true, featured: false, badge: null,
    name: 'Starter Host', description: 'Ideal para começar sua presença online',
    price_monthly: 4500, price_annual: null, discount_annual: 20,
    features: ['1 Site', '10 GB NVMe SSD', '100 GB Bandwidth', '5 Contas de Email', 'SSL Grátis', 'cPanel Premium', '3 Bases de Dados MySQL', 'Backup Semanal'],
  },
  {
    position: 1, active: true, featured: true, badge: 'MAIS POPULAR',
    name: 'Business Cloud', description: 'Para pequenas e m��dias empresas crescerem',
    price_monthly: 9500, price_annual: null, discount_annual: 20,
    features: ['5 Sites', '50 GB NVMe SSD', 'Bandwidth Ilimitado', '20 Contas de Email', 'SSL Grátis', 'cPanel Premium', '10 Bases de Dados MySQL', 'Backup Diário', 'Softaculous (400+ apps)'],
  },
  {
    position: 2, active: true, featured: false, badge: 'MELHOR VALOR',
    name: 'Cloud Pro', description: 'Para empresas que exigem alta performance',
    price_monthly: 19500, price_annual: null, discount_annual: 20,
    features: ['Sites Ilimitados', '200 GB NVMe SSD', 'Bandwidth Ilimitado', 'Emails Ilimitados', 'Wildcard SSL Grátis', 'cPanel Premium', 'Bases de Dados Ilimitadas', 'Backup Diário Automático', 'IP Dedicado', 'Proteção DDoS Avançada'],
  },
]

const seedTeam = [
  {
    position: 0, active: true, is_ceo: true,
    name: 'Manuel Muenho', title: 'CEO & Fundador', role: 'Liderança Estratégica',
    bio: 'Visionário por trás da ViralizaHost, com foco em transformar o panorama digital angolano.',
    photo_url: '/Manuel Muenho.jpeg', flag: '🇦🇴', country: 'Angola', accent_color: '#F5B700',
  },
  {
    position: 1, active: true, is_ceo: false,
    name: 'Ana Silva', title: 'Directora Técnica', role: 'Infraestrutura & DevOps',
    bio: 'Especialista em infraestrutura cloud e automação de sistemas.',
    photo_url: null, flag: '🇦🇴', country: 'Angola', accent_color: '#3B82F6',
  },
  {
    position: 2, active: true, is_ceo: false,
    name: 'Carlos Rodrigues', title: 'Marketing & Growth', role: 'Tráfego Pago',
    bio: 'Responsável pelo crescimento digital e aquisição de clientes.',
    photo_url: null, flag: '🇦🇴', country: 'Angola', accent_color: '#10B981',
  },
]

// Helpers -----------------------------------------------------------------

const TABLES = ['site_banners', 'site_domains', 'site_email_plans', 'site_hosting_plans', 'site_team'] as const
const DATASETS = [seedBanners, seedDomains, seedEmailPlans, seedHostingPlans, seedTeam]

async function seedTable(
  db: Awaited<ReturnType<typeof createAdminClient>>,
  table: string,
  data: object[]
): Promise<{ seeded: boolean; count: number; error?: string }> {
  console.log(`[seed-site] checking ${table}...`)

  const { count, error: countErr } = await (db as any)
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    console.error(`[seed-site] ❌ count error on ${table}:`, JSON.stringify(countErr))
    return { seeded: false, count: 0, error: `count failed: ${countErr.message} (code: ${countErr.code})` }
  }

  console.log(`[seed-site] ${table} has ${count} rows`)

  if ((count ?? 0) > 0) {
    return { seeded: false, count: count ?? 0 }
  }

  const { error: insertErr } = await (db as any).from(table).insert(data)

  if (insertErr) {
    console.error(`[seed-site] ❌ insert error on ${table}:`, JSON.stringify(insertErr))
    return { seeded: false, count: 0, error: `insert failed: ${insertErr.message} (code: ${insertErr.code})` }
  }

  console.log(`[seed-site] ✅ seeded ${data.length} rows into ${table}`)
  return { seeded: true, count: data.length }
}

// Handlers ----------------------------------------------------------------

export async function POST() {
  console.log('[seed-site] POST called — creating admin client...')

  const db = await createAdminClient()

  console.log('[seed-site] admin client ready — starting seed...')

  const summary = await Promise.all(
    TABLES.map((t, i) => seedTable(db, t, DATASETS[i]).then(r => ({ table: t, ...r })))
  )

  const seededCount  = summary.filter(s => s.seeded).length
  const skippedCount = summary.filter(s => !s.seeded && !s.error).length
  const errorCount   = summary.filter(s => s.error).length

  console.log(`[seed-site] done — seeded: ${seededCount}, skipped: ${skippedCount}, errors: ${errorCount}`)
  console.log('[seed-site] summary:', JSON.stringify(summary))

  return NextResponse.json({ ok: errorCount === 0, summary, seededCount, skippedCount, errorCount })
}

export async function GET() {
  console.log('[seed-site] GET called — reading counts...')

  const db = await createAdminClient()

  const results = await Promise.all(
    TABLES.map(t => (db as any).from(t).select('*', { count: 'exact', head: true }))
  )

  const counts = TABLES.reduce((acc, t, i) => {
    const r = results[i]
    if (r.error) {
      console.error(`[seed-site] GET count error on ${t}:`, JSON.stringify(r.error))
      acc[t] = 0
    } else {
      acc[t] = r.count ?? 0
    }
    return acc
  }, {} as Record<string, number>)

  console.log('[seed-site] counts:', JSON.stringify(counts))
  return NextResponse.json(counts)
}
