export const APP_NAME = 'ViralizaHost'
export const APP_DESCRIPTION = 'Hospedagem Web Premium para o seu negócio'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const CURRENCIES = [
  { code: 'AKZ', label: 'Kwanza (Kz)', flag: '🇦🇴' },
  { code: 'BRL', label: 'Real (R$)', flag: '🇧🇷' },
  { code: 'USD', label: 'Dólar ($)', flag: '🇺🇸' },
] as const

export const DEPARTMENTS = [
  { value: 'technical', label: 'Suporte Técnico' },
  { value: 'billing', label: 'Financeiro' },
  { value: 'sales', label: 'Vendas' },
  { value: 'domains', label: 'Domínios' },
]

export const PRIORITY_LABELS = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}

export const STATUS_LABELS = {
  open: 'Aberto',
  in_progress: 'Em Andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export const HOSTING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    type: 'shared',
    description: 'Perfeito para iniciar sua presença online',
    features: ['1 Site', '10 GB SSD', '100 GB Banda', '5 Emails', 'SSL Grátis', 'cPanel'],
    price_akz: 4500,
    price_brl: 19.90,
    price_usd: 3.99,
    disk_gb: 10,
    bandwidth_gb: 100,
    email_accounts: 5,
    domains: 1,
    subdomains: 5,
    databases: 3,
    is_popular: false,
    is_active: true,
  },
  {
    id: 'business',
    name: 'Business',
    type: 'shared',
    description: 'Ideal para pequenas e médias empresas',
    features: ['5 Sites', '50 GB SSD', 'Ilimitado Banda', '20 Emails', 'SSL Grátis', 'cPanel', 'Backup Diário'],
    price_akz: 9500,
    price_brl: 39.90,
    price_usd: 7.99,
    disk_gb: 50,
    bandwidth_gb: 0,
    email_accounts: 20,
    domains: 5,
    subdomains: 20,
    databases: 10,
    is_popular: true,
    is_active: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    type: 'shared',
    description: 'Para empresas que precisam de mais recursos',
    features: ['Sites Ilimitados', '200 GB SSD', 'Ilimitado Banda', 'Emails Ilimitados', 'SSL Grátis', 'cPanel', 'Backup Diário', 'IP Dedicado'],
    price_akz: 19500,
    price_brl: 79.90,
    price_usd: 15.99,
    disk_gb: 200,
    bandwidth_gb: 0,
    email_accounts: 0,
    domains: 0,
    subdomains: 0,
    databases: 0,
    is_popular: false,
    is_active: true,
  },
]
