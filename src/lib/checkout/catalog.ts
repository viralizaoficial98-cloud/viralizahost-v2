import type { CheckoutItem } from '@/store/checkoutStore'

// Fallback plan catalog (used by the checkout page and validated server-side
// in /api/checkout/orders). DB prices from `products` / `site_email_plans`
// take precedence when present.
export const PLAN_CATALOG: Record<string, CheckoutItem> = {
  // ── Hosting ────────────────────────────────────────────────────────────────
  'hosting-start':    { id: 'hosting-start',    name: 'Plano Start',           type: 'hosting',  price: 19900,  currency: 'AOA', quantity: 1 },
  'hosting-business': { id: 'hosting-business', name: 'Plano Business',        type: 'hosting',  price: 39900,  currency: 'AOA', quantity: 1 },
  'hosting-turbo':    { id: 'hosting-turbo',    name: 'Plano Turbo',           type: 'hosting',  price: 79900,  currency: 'AOA', quantity: 1 },
  // legacy hosting slugs (backward compat)
  starter:   { id: 'hosting-start',    name: 'Plano Start',    type: 'hosting',  price: 19900, currency: 'AOA', quantity: 1 },
  business:  { id: 'hosting-business', name: 'Plano Business', type: 'hosting',  price: 39900, currency: 'AOA', quantity: 1 },
  pro:       { id: 'hosting-turbo',    name: 'Plano Turbo',    type: 'hosting',  price: 79900, currency: 'AOA', quantity: 1 },
  premium:   { id: 'hosting-turbo',    name: 'Plano Turbo',    type: 'hosting',  price: 79900, currency: 'AOA', quantity: 1 },
  // ── WordPress ──────────────────────────────────────────────────────────────
  'wp-start':  { id: 'wp-start',  name: 'WordPress Start',  type: 'hosting', price: 24900, currency: 'AOA', quantity: 1 },
  'wp-pro':    { id: 'wp-pro',    name: 'WordPress Pro',    type: 'hosting', price: 49900, currency: 'AOA', quantity: 1 },
  'wp-turbo':  { id: 'wp-turbo',  name: 'WordPress Turbo',  type: 'hosting', price: 99900, currency: 'AOA', quantity: 1 },
  // ── Reseller ───────────────────────────────────────────────────────────────
  'reseller-start':      { id: 'reseller-start',      name: 'Revenda Start',      type: 'reseller', price: 59900,  currency: 'AOA', quantity: 1 },
  'reseller-growth':     { id: 'reseller-growth',     name: 'Revenda Growth',     type: 'reseller', price: 99900,  currency: 'AOA', quantity: 1 },
  'reseller-business':   { id: 'reseller-business',   name: 'Revenda Business',   type: 'reseller', price: 179900, currency: 'AOA', quantity: 1 },
  'reseller-enterprise': { id: 'reseller-enterprise', name: 'Revenda Enterprise', type: 'reseller', price: 0,      currency: 'AOA', quantity: 1 },
  reseller: { id: 'reseller-start', name: 'Revenda Start', type: 'reseller', price: 59900, currency: 'AOA', quantity: 1 },
  // ── Email ──────────────────────────────────────────────────────────────────
  'email-starter':        { id: 'email-starter',        name: 'Email Starter',         type: 'email', price: 6800,  currency: 'AOA', quantity: 1 },
  'email-standard':       { id: 'email-standard',       name: 'Email Standard',        type: 'email', price: 14800, currency: 'AOA', quantity: 1 },
  'email-premium':        { id: 'email-premium',        name: 'Email Premium',         type: 'email', price: 28000, currency: 'AOA', quantity: 1 },
  'microsoft-365-outlook':{ id: 'microsoft-365-outlook',name: 'Microsoft 365 Outlook', type: 'email', price: 52000, currency: 'AOA', quantity: 1 },
  // legacy email aliases
  'webmail-start':      { id: 'email-starter',         name: 'Email Starter',         type: 'email', price: 6800,  currency: 'AOA', quantity: 1 },
  'webmail-business':   { id: 'email-standard',        name: 'Email Standard',        type: 'email', price: 14800, currency: 'AOA', quantity: 1 },
  'webmail-enterprise': { id: 'email-premium',         name: 'Email Premium',         type: 'email', price: 28000, currency: 'AOA', quantity: 1 },
  'microsoft-365':      { id: 'microsoft-365-outlook', name: 'Microsoft 365 Outlook', type: 'email', price: 52000, currency: 'AOA', quantity: 1 },
  'microsoft365':       { id: 'microsoft-365-outlook', name: 'Microsoft 365 Outlook', type: 'email', price: 52000, currency: 'AOA', quantity: 1 },
  'starter-mail':       { id: 'email-starter',  name: 'Email Starter',  type: 'email', price: 6800,  currency: 'AOA', quantity: 1 },
  'business-mail':      { id: 'email-standard', name: 'Email Standard', type: 'email', price: 14800, currency: 'AOA', quantity: 1 },
  'enterprise-mail':    { id: 'email-premium',  name: 'Email Premium',  type: 'email', price: 28000, currency: 'AOA', quantity: 1 },
  // ── VPS ────────────────────────────────────────────────────────────────────
  'vps-nvme2': { id: 'vps-nvme2', name: 'VPS NVMe 2', type: 'vps', price: 45000,  currency: 'AOA', quantity: 1 },
  'vps-nvme4': { id: 'vps-nvme4', name: 'VPS NVMe 4', type: 'vps', price: 85000,  currency: 'AOA', quantity: 1 },
  'vps-nvme8': { id: 'vps-nvme8', name: 'VPS NVMe 8', type: 'vps', price: 159000, currency: 'AOA', quantity: 1 },
  'vps-n8n-start':  { id: 'vps-n8n-start',  name: 'n8n Start',          type: 'vps', price: 55000,  currency: 'AOA', quantity: 1 },
  'vps-n8n-pro':    { id: 'vps-n8n-pro',    name: 'n8n Pro',            type: 'vps', price: 99000,  currency: 'AOA', quantity: 1 },
  'vps-n8n-scale':  { id: 'vps-n8n-scale',  name: 'n8n Scale',          type: 'vps', price: 179000, currency: 'AOA', quantity: 1 },
  'vps-openclaw-start': { id: 'vps-openclaw-start', name: 'OpenClaw Start', type: 'vps', price: 65000,  currency: 'AOA', quantity: 1 },
  'vps-openclaw-pro':   { id: 'vps-openclaw-pro',   name: 'OpenClaw Pro',   type: 'vps', price: 119000, currency: 'AOA', quantity: 1 },
  'vps-openclaw-scale': { id: 'vps-openclaw-scale', name: 'OpenClaw Scale', type: 'vps', price: 219000, currency: 'AOA', quantity: 1 },
  'vps-evolution-start': { id: 'vps-evolution-start', name: 'Evolution Start', type: 'vps', price: 69000,  currency: 'AOA', quantity: 1 },
  'vps-evolution-pro':   { id: 'vps-evolution-pro',   name: 'Evolution Pro',   type: 'vps', price: 129000, currency: 'AOA', quantity: 1 },
  'vps-evolution-scale': { id: 'vps-evolution-scale', name: 'Evolution Scale', type: 'vps', price: 249000, currency: 'AOA', quantity: 1 },
  'vps-ai-cloud-start':      { id: 'vps-ai-cloud-start',      name: 'AI Cloud Start',      type: 'vps', price: 89000,  currency: 'AOA', quantity: 1 },
  'vps-ai-cloud-pro':        { id: 'vps-ai-cloud-pro',        name: 'AI Cloud Pro',        type: 'vps', price: 169000, currency: 'AOA', quantity: 1 },
  'vps-ai-cloud-enterprise': { id: 'vps-ai-cloud-enterprise', name: 'AI Cloud Enterprise', type: 'vps', price: 349000, currency: 'AOA', quantity: 1 },
  // ── Dedicated Linux ────────────────────────────────────────────────────────
  'ded-16': { id: 'ded-16', name: 'Dedicado NVMe 16', type: 'dedicated', price: 249000, currency: 'AOA', quantity: 1 },
  'ded-32': { id: 'ded-32', name: 'Dedicado NVMe 32', type: 'dedicated', price: 449000, currency: 'AOA', quantity: 1 },
  'ded-64': { id: 'ded-64', name: 'Dedicado NVMe 64', type: 'dedicated', price: 799000, currency: 'AOA', quantity: 1 },
  // ── Dedicated Windows ──────────────────────────────────────────────────────
  'win-black':    { id: 'win-black',    name: 'Black',    type: 'dedicated', price: 299000, currency: 'AOA', quantity: 1 },
  'win-sapphire': { id: 'win-sapphire', name: 'Sapphire', type: 'dedicated', price: 549000, currency: 'AOA', quantity: 1 },
  'win-diamond':  { id: 'win-diamond',  name: 'Diamond',  type: 'dedicated', price: 999000, currency: 'AOA', quantity: 1 },
  // ── AI Site Builder ────────────────────────────────────────────────────────
  'ia-starter':  { id: 'ia-starter',  name: 'IA Starter',  type: 'other', price: 14900, currency: 'AOA', quantity: 1 },
  'ia-pro':      { id: 'ia-pro',      name: 'IA Pro',      type: 'other', price: 29900, currency: 'AOA', quantity: 1 },
  'ia-business': { id: 'ia-business', name: 'IA Business', type: 'other', price: 59900, currency: 'AOA', quantity: 1 },
  // ── Domains ────────────────────────────────────────────────────────────────
  'domain-com':    { id: 'domain-com',    name: 'Domínio .com',    type: 'domain', price: 4500,  currency: 'AOA', quantity: 1 },
  'domain-net':    { id: 'domain-net',    name: 'Domínio .net',    type: 'domain', price: 5200,  currency: 'AOA', quantity: 1 },
  'domain-org':    { id: 'domain-org',    name: 'Domínio .org',    type: 'domain', price: 4800,  currency: 'AOA', quantity: 1 },
  'domain-ao':     { id: 'domain-ao',     name: 'Domínio .ao',     type: 'domain', price: 8000,  currency: 'AOA', quantity: 1 },
  'domain-co-ao':  { id: 'domain-co-ao',  name: 'Domínio .co.ao',  type: 'domain', price: 7500,  currency: 'AOA', quantity: 1 },
  'domain-com-br': { id: 'domain-com-br', name: 'Domínio .com.br', type: 'domain', price: 4900,  currency: 'AOA', quantity: 1 },
  'domain-io':     { id: 'domain-io',     name: 'Domínio .io',     type: 'domain', price: 18000, currency: 'AOA', quantity: 1 },
  'domain-search': { id: 'domain-search', name: 'Domínio',         type: 'domain', price: 4500,  currency: 'AOA', quantity: 1 },
  // legacy dot-separated domain keys (old format)
  'domain.com':    { id: 'domain-com',    name: 'Domínio .com',    type: 'domain', price: 4500,  currency: 'AOA', quantity: 1 },
  'domain.net':    { id: 'domain-net',    name: 'Domínio .net',    type: 'domain', price: 5200,  currency: 'AOA', quantity: 1 },
  'domain.org':    { id: 'domain-org',    name: 'Domínio .org',    type: 'domain', price: 4800,  currency: 'AOA', quantity: 1 },
  'domain.ao':     { id: 'domain-ao',     name: 'Domínio .ao',     type: 'domain', price: 8000,  currency: 'AOA', quantity: 1 },
  'domain.com.br': { id: 'domain-com-br', name: 'Domínio .com.br', type: 'domain', price: 4900,  currency: 'AOA', quantity: 1 },
  'domain.io':     { id: 'domain-io',     name: 'Domínio .io',     type: 'domain', price: 18000, currency: 'AOA', quantity: 1 },
}
