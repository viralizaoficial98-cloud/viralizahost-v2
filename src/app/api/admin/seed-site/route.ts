import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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

const seedDomains = [
  { position: 1, extension: '.com',    currency: 'AKZ', price_monthly: 4500,  price_annual: 4500,  popular: false, active: true },
  { position: 2, extension: '.net',    currency: 'AKZ', price_monthly: 5200,  price_annual: 5200,  popular: false, active: true },
  { position: 3, extension: '.org',    currency: 'AKZ', price_monthly: 4800,  price_annual: 4800,  popular: false, active: true },
  { position: 4, extension: '.ao',     currency: 'AKZ', price_monthly: 8000,  price_annual: 8000,  popular: true,  active: true },
  { position: 5, extension: '.com.br', currency: 'BRL', price_monthly: 49,    price_annual: 49,    popular: false, active: true },
  { position: 6, extension: '.io',     currency: 'AKZ', price_monthly: 18000, price_annual: 18000, popular: false, active: true },
]

const seedEmailPlans = [
  {
    slug: 'webmail-start', position: 1, active: true, popular: false, color: 'blue',
    name: 'Webmail Start', price_monthly: 6800, storage_gb: 5, accounts: 1,
    features: ['1 conta de email', '5 GB de armazenamento', 'Webmail incluído', 'Suporte básico'],
  },
  {
    slug: 'webmail-business', position: 2, active: true, popular: true, color: 'violet',
    name: 'Webmail Business', price_monthly: 14800, storage_gb: 20, accounts: 5,
    features: ['5 contas de email', '20 GB de armazenamento', 'Webmail incluído', 'Anti-spam avançado', 'Suporte prioritário'],
  },
  {
    slug: 'webmail-enterprise', position: 3, active: true, popular: false, color: 'emerald',
    name: 'Webmail Enterprise', price_monthly: 28000, storage_gb: 50, accounts: 20,
    features: ['20 contas de email', '50 GB de armazenamento', 'Webmail incluído', 'Anti-spam avançado', 'Backup diário', 'Suporte 24/7'],
  },
  {
    slug: 'microsoft-365', position: 4, active: true, popular: false, color: 'orange',
    name: 'Microsoft 365 Outlook', price_monthly: 52000, storage_gb: 50, accounts: 1,
    features: ['1 conta Microsoft 365', '50 GB de armazenamento', 'Outlook, Teams, Word, Excel', 'OneDrive 1 TB', 'Suporte Microsoft', 'Integração completa Office'],
  },
]

const seedHostingPlans = [
  {
    slug: 'starter', position: 1, active: true, featured: false,
    name: 'Starter Host', price_monthly: 4500, price_annual: 4500, currency: 'AKZ',
    features: ['10 GB SSD', '100 GB Tráfego', '1 Domínio', 'SSL Grátis', 'cPanel', '1-click WordPress'],
  },
  {
    slug: 'business', position: 2, active: true, featured: true,
    name: 'Business Cloud', price_monthly: 9500, price_annual: 9500, currency: 'AKZ',
    features: ['25 GB SSD NVMe', '500 GB Tráfego', '5 Domínios', 'SSL Grátis', 'cPanel', 'Backups Diários', 'Email Profissional'],
  },
  {
    slug: 'premium', position: 3, active: true, featured: false,
    name: 'Cloud Pro', price_monthly: 19500, price_annual: 19500, currency: 'AKZ',
    features: ['60 GB SSD NVMe', 'Tráfego Ilimitado', '20 Domínios', 'SSL Grátis', 'cPanel', 'Backups Diários', 'IP Dedicado', 'Suporte Prioritário'],
  },
  {
    slug: 'reseller', position: 4, active: true, featured: false,
    name: 'Revenda WHM', price_monthly: 35000, price_annual: 35000, currency: 'AKZ',
    features: ['150 GB SSD NVMe', 'Tráfego Ilimitado', 'Domínios Ilimitados', 'WHM/cPanel', 'WHMCS', 'IP Dedicado', 'Suporte 24/7'],
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

const TABLES = ['site_banners', 'site_domains', 'site_email_plans', 'site_hosting_plans', 'site_team'] as const
const DATASETS = [seedBanners, seedDomains, seedEmailPlans, seedHostingPlans, seedTeam]

async function getCount(
  db: Awaited<ReturnType<typeof createAdminClient>>,
  table: string,
): Promise<{ count: number; error?: string }> {
  const { count, error } = await (db as any)
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error(`[seed-site] count error on ${table}:`, JSON.stringify(error))
    return { count: 0, error: `count failed: ${error.message}` }
  }
  return { count: count ?? 0 }
}

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
  const db = await createAdminClient()

  const summary = await Promise.all(
    TABLES.map((t, i) => upsertTable(db, t, DATASETS[i]).then(r => ({ table: t, ...r })))
  )

  const seededCount = summary.filter(s => s.seeded).length
  const errorCount  = summary.filter(s => s.error).length

  return NextResponse.json({ ok: errorCount === 0, summary, seededCount, errorCount })
}

export async function GET() {
  const db = await createAdminClient()

  const results = await Promise.all(TABLES.map(t => getCount(db, t)))

  const counts = TABLES.reduce((acc, t, i) => {
    acc[t] = results[i].count
    return acc
  }, {} as Record<string, number>)

  return NextResponse.json(counts)
}
