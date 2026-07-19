import { tool } from 'ai'
import { z } from 'zod'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { sendInvoiceEmail } from '@/lib/invoice/send-invoice-email'
import type { UserLevel } from './system-prompt'

export interface AgentContext {
  userLevel: UserLevel
  profileId?: string
}

// ── Simple in-memory cache (per request, cleared after each invocation) ───────
const cache = new Map<string, { data: unknown; ts: number }>()
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data as T)
  return fn().then(data => { cache.set(key, { data, ts: Date.now() }); return data })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTools(ctx: AgentContext): Record<string, any> {
  const db = createAdminWriteClient()

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC TOOLS — available to all levels
  // ═══════════════════════════════════════════════════════════════

  /** List hosting plans with full detail */
  const getPlans = tool({
    description: 'Lista todos os planos de hospedagem disponíveis com preços em AKZ, BRL e USD, espaço em disco, largura de banda e funcionalidades. Usar sempre que o utilizador perguntar sobre planos, preços ou hospedagem.',
    inputSchema: z.object({
      type: z.enum(['shared', 'vps', 'dedicated', 'reseller', 'all']).optional().describe('Tipo de plano. Omitir para listar todos.'),
    }),
    execute: async (input) => {
      const type = input.type ?? 'all'
      return cached(`plans:${type}`, 60_000, async () => {
        let q = db.from('plans').select('id, slug, name, type, description, price_akz, price_brl, price_usd, disk_gb, bandwidth_gb, email_accounts, max_domains, max_subdomains, max_databases, features, is_popular, is_active')
        if (type !== 'all') q = q.eq('type', type)
        const { data, error } = await q.eq('is_active', true).order('sort_order', { ascending: true })
        if (error) return { error: 'Não foi possível carregar os planos de momento.' }
        return { plans: data, count: data?.length ?? 0 }
      })
    },
  })

  /** Search product catalogue */
  const getProducts = tool({
    description: 'Pesquisa produtos no catálogo ViralizaHost: hosting, email, domínios, SSL, VPS, Cloud, CDN, backup, Microsoft 365, etc. Usar quando o utilizador pergunta sobre produtos específicos ou quer comparar.',
    inputSchema: z.object({
      category: z.string().optional().describe('Categoria do produto: hosting, email, domain, ssl, vps, dedicated, reseller, cloud, cdn, backup, microsoft365'),
      search: z.string().optional().describe('Termo livre para pesquisar no nome do produto'),
    }),
    execute: async ({ category, search }) => {
      return cached(`products:${category}:${search}`, 60_000, async () => {
        let q = db.from('products').select('id, slug, name, category, subcategory, price_monthly, price_6m, price_1y, price_2y, price_3y, meta')
        if (category) q = q.eq('category', category)
        if (search) q = q.ilike('name', `%${search}%`)
        const { data, error } = await q.order('price_monthly', { ascending: true }).limit(15)
        if (error) return { error: 'Erro ao pesquisar produtos.' }
        return { products: data, count: data?.length ?? 0 }
      })
    },
  })

  /** List all product categories */
  const getProductCategories = tool({
    description: 'Lista todas as categorias de produtos disponíveis na ViralizaHost. Usar para dar uma visão geral do que é oferecido.',
    inputSchema: z.object({}),
    execute: async () => {
      return cached('product_categories', 120_000, async () => {
        const { data, error } = await db.from('products').select('category, subcategory').order('category')
        if (error) return { error: 'Erro ao carregar categorias.' }
        const cats = [...new Set(data?.map(p => p.category) ?? [])]
        const byCat: Record<string, string[]> = {}
        data?.forEach(p => {
          if (!byCat[p.category]) byCat[p.category] = []
          if (p.subcategory && !byCat[p.category].includes(p.subcategory)) byCat[p.category].push(p.subcategory)
        })
        return { categories: cats, details: byCat }
      })
    },
  })

  /** Domain availability check */
  const checkDomainAvailability = tool({
    description: 'Verifica disponibilidade de um domínio e mostra o preço de registo. Usar SEMPRE que o utilizador menciona um domínio. Se pricing=null, usar all_available_prices para mostrar alternativas e seguir as instruções da nota.',
    inputSchema: z.object({
      domain: z.string().describe('Nome completo do domínio, ex: minhavista.ao ou empresa.com'),
    }),
    execute: async ({ domain }) => {
      const clean = domain.toLowerCase().trim()
      const parts = clean.split('.')
      const ext = parts.length >= 2 ? parts.slice(1).join('.') : ''

      // Get pricing for this specific extension
      const { data: pricing } = await db
        .from('site_domains')
        .select('extension, price_monthly, price_annual, price_2y, price_3y')
        .eq('extension', ext)
        .maybeSingle()

      // When pricing for this extension is not found, get ALL available prices
      let allAvailablePrices: unknown[] = []
      let agentNote = ''

      if (!pricing) {
        const { data: allPrices } = await db
          .from('site_domains')
          .select('extension, price_monthly, price_annual')
          .order('extension')
        allAvailablePrices = allPrices ?? []

        if (allAvailablePrices.length > 0) {
          agentNote = `NOTA PARA AGENTE: O preço para a extensão .${ext} não está cadastrado individualmente na base de dados. Mostrar ao cliente os preços das extensões disponíveis (all_available_prices) e perguntar se pretende uma extensão alternativa. NÃO dizer "não tenho acesso" — o sistema consultou e simplesmente não tem este TLD cadastrado.`
        } else {
          agentNote = `NOTA PARA AGENTE: Nenhum preço de domínio está cadastrado no sistema. Dizer ao cliente que os preços não estão disponíveis online neste momento e usar createTicket com department='comercial' para registar o pedido de informação de preço. NÃO dizer "não tenho acesso" — criar o ticket imediatamente.`
        }
      }

      // Try domain check API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const res = await fetch(
        `${baseUrl}/api/checkout/domain-check?domain=${encodeURIComponent(clean)}`,
        { cache: 'no-store', signal: AbortSignal.timeout(5000) }
      ).catch(() => null)

      const availability = res?.ok ? await res.json().catch(() => null) : null

      return {
        domain: clean,
        extension: ext,
        pricing: pricing ?? null,
        all_available_prices: allAvailablePrices,
        agent_note: agentNote || null,
        availability: availability ?? { checked: false, note: 'Verificação em tempo real não disponível neste momento.' },
      }
    },
  })

  /** List domain extension prices */
  const getDomainPrices = tool({
    description: 'Lista os preços de registo de domínios por extensão (.ao, .co.ao, .com, etc.). Usar quando o utilizador quer saber quanto custa registar um domínio.',
    inputSchema: z.object({
      extension: z.string().optional().describe('Extensão específica, ex: ao, com, net. Omitir para listar todas.'),
    }),
    execute: async ({ extension }) => {
      return cached(`domain_prices:${extension}`, 120_000, async () => {
        let q = db.from('site_domains').select('extension, price_monthly, price_annual').order('extension')
        if (extension) q = q.eq('extension', extension)
        const { data, error } = await q
        if (error) return { error: 'Erro ao carregar preços de domínios.' }
        return { domain_prices: data }
      })
    },
  })

  /** Get company contact info */
  const getCompanyInfo = tool({
    description: 'Retorna informações de contacto da ViralizaHost: e-mail, telefone, website, endereço. Usar quando o cliente pergunta como contactar a empresa.',
    inputSchema: z.object({}),
    execute: async () => {
      return cached('company_info', 300_000, async () => {
        const { data } = await db
          .from('company_billing_settings')
          .select('company_name, email, website, phone, address, footer_text')
          .eq('active', true)
          .maybeSingle()
        return {
          company_name: data?.company_name ?? 'ViralizaHost',
          email: data?.email ?? 'comercial@viralizahost.com',
          support_email: 'suporte@viralizahost.com',
          website: data?.website ?? 'viralizahost.com',
          phone: data?.phone ?? '951 008 653',
          address: data?.address ?? null,
          social: { instagram: '@viralizahost', facebook: 'ViralizaHost' },
        }
      })
    },
  })

  /** Get payment methods */
  const getPaymentMethods = tool({
    description: 'Lista os métodos de pagamento aceites pela ViralizaHost. Usar quando o cliente pergunta como pode pagar.',
    inputSchema: z.object({}),
    execute: async () => {
      return cached('payment_methods', 300_000, async () => {
        const { data } = await db
          .from('company_billing_settings')
          .select('payment_methods, bank_name, account_holder, account_number, iban, swift, payment_instructions')
          .eq('active', true)
          .maybeSingle()
        return {
          methods: data?.payment_methods ?? ['Transferência Bancária', 'Multicaixa Express', 'PayPal'],
          bank_details: data?.bank_name ? {
            bank: data.bank_name,
            holder: data.account_holder,
            account: data.account_number,
            iban: data.iban,
            swift: data.swift,
          } : null,
          instructions: data?.payment_instructions ?? 'Após efectuar o pagamento, envie o comprovativo para comercial@viralizahost.com com a referência do pedido.',
          note: 'Para instruções detalhadas use a ferramenta getPaymentInstructions.',
        }
      })
    },
  })

  /** Get email plans */
  const getEmailPlans = tool({
    description: 'Lista os planos de e-mail corporativo e Microsoft 365 disponíveis com preços. Usar quando o utilizador pergunta sobre e-mail profissional.',
    inputSchema: z.object({}),
    execute: async () => {
      return cached('email_plans', 120_000, async () => {
        const { data, error } = await db.from('site_email_plans').select('*').order('price_monthly', { ascending: true })
        if (error) return { error: 'Erro ao carregar planos de e-mail.' }
        return { email_plans: data }
      })
    },
  })

  // ═══════════════════════════════════════════════════════════════
  // CLIENT TOOLS — requires authentication
  // ═══════════════════════════════════════════════════════════════

  /** Client profile */
  const getMyProfile = tool({
    description: 'Retorna o perfil completo do cliente autenticado: nome, email, telefone, país, plano, estado da conta.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, email, phone, country, currency, role, is_active, created_at')
        .eq('id', ctx.profileId)
        .single()
      if (error || !data) return { error: 'Não foi possível carregar o seu perfil.' }
      return { profile: data }
    },
  })

  /** Active services */
  const getMyServices = tool({
    description: 'Lista todos os serviços de hospedagem do cliente (activos, pendentes, suspensos). Inclui plano, preço, data de expiração e domínio principal.',
    inputSchema: z.object({
      status: z.enum(['active', 'pending', 'suspended', 'cancelled', 'all']).optional().describe('Filtrar por estado. Omitir para todos.'),
    }),
    execute: async (input) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      const status = input.status ?? 'all'
      let q = db
        .from('services')
        .select(`
          id, status, billing_cycle, price, currency, expires_at, auto_renew, started_at,
          plan:plans(name, type, disk_gb, bandwidth_gb, email_accounts),
          hosting_accounts(id, primary_domain, cpanel_username, status, disk_used_mb, bandwidth_used_mb, email_count, php_version, ssl_enabled)
        `)
        .eq('profile_id', ctx.profileId)
        .order('created_at', { ascending: false })
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) return { error: 'Não foi possível carregar os seus serviços.' }
      return { services: data, count: data?.length ?? 0 }
    },
  })

  /** Hosting accounts with cPanel info */
  const getMyHosting = tool({
    description: 'Detalha as contas de hospedagem cPanel do cliente: domínio, utilizador cPanel, uso de disco, número de e-mails, PHP, SSL.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      const { data, error } = await db
        .from('hosting_accounts')
        .select('id, service_id, primary_domain, cpanel_username, status, disk_used_mb, bandwidth_used_mb, email_count, db_count, php_version, ssl_enabled, created_at')
        .eq('profile_id', ctx.profileId)
        .order('created_at', { ascending: false })
      if (error) return { error: 'Não foi possível carregar as hospedagens.' }

      const enriched = data?.map(h => ({
        ...h,
        cpanel_url: `https://portal.viralizahost.com/portal`,
        webmail_url: `https://webmail.${h.primary_domain}`,
        cpanel_note: `Para aceder ao cPanel de ${h.primary_domain}: aceda ao portal do cliente e clique em "Aceder ao cPanel"`,
      }))

      return { hosting_accounts: enriched, count: enriched?.length ?? 0 }
    },
  })

  /** cPanel and Webmail access instructions */
  const getCpanelAccess = tool({
    description: 'Fornece instruções de acesso ao cPanel e Webmail para um domínio específico do cliente.',
    inputSchema: z.object({
      domain: z.string().optional().describe('Domínio específico. Omitir para listar todos com instruções.'),
    }),
    execute: async ({ domain }) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      let q = db
        .from('hosting_accounts')
        .select('id, service_id, primary_domain, cpanel_username, status')
        .eq('profile_id', ctx.profileId)
      if (domain) q = q.eq('primary_domain', domain)
      const { data, error } = await q

      if (error || !data?.length) return { error: domain ? `Hospedagem para ${domain} não encontrada na sua conta.` : 'Nenhuma hospedagem encontrada.' }

      return {
        accounts: data.map(h => ({
          domain: h.primary_domain,
          cpanel_username: h.cpanel_username,
          status: h.status,
          access: {
            cpanel: `Aceda ao portal ViralizaHost → clique em "cPanel" na sua hospedagem ${h.primary_domain}`,
            webmail: `https://webmail.${h.primary_domain} (ou aceder pelo cPanel → E-mail → Webmail)`,
            direct_cpanel: `https://${h.primary_domain}:2083`,
          },
        })),
      }
    },
  })

  /** Client domains with DNS info */
  const getMyDomains = tool({
    description: 'Lista os domínios registados pelo cliente com estado, data de expiração, nameservers e DNS.',
    inputSchema: z.object({}),
    execute: async () => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      const { data, error } = await db
        .from('domains')
        .select('id, full_domain, name, extension, status, registrar, nameservers, expires_at, auto_renew, is_locked, whois_privacy, registered_at')
        .eq('profile_id', ctx.profileId)
        .order('expires_at', { ascending: true })
      if (error) return { error: 'Não foi possível carregar os domínios.' }

      const today = new Date()
      const enriched = data?.map(d => {
        const exp = d.expires_at ? new Date(d.expires_at) : null
        const daysLeft = exp ? Math.ceil((exp.getTime() - today.getTime()) / 86400000) : null
        return {
          ...d,
          days_until_expiry: daysLeft,
          expires_soon: daysLeft !== null && daysLeft <= 30,
          viralizahost_nameservers: ['ns1.viralizahost.com', 'ns2.viralizahost.com'],
        }
      })

      return { domains: enriched, count: enriched?.length ?? 0 }
    },
  })

  /** Client email accounts */
  const getMyEmails = tool({
    description: 'Lista as contas de e-mail corporativo do cliente com quota e uso.',
    inputSchema: z.object({
      hosting_domain: z.string().optional().describe('Filtrar por domínio da hospedagem'),
    }),
    execute: async ({ hosting_domain }) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }

      // Get hosting IDs for the client (filtered by domain if provided)
      let hq = db.from('hosting_accounts').select('id, primary_domain').eq('profile_id', ctx.profileId)
      if (hosting_domain) hq = hq.eq('primary_domain', hosting_domain)
      const { data: hostings } = await hq

      if (!hostings?.length) return { emails: [], note: 'Nenhuma hospedagem encontrada para listar e-mails.' }

      const hostingIds = hostings.map(h => h.id)
      const { data, error } = await db
        .from('emails')
        .select('id, email_address, display_name, quota_mb, used_mb, status, hosting_id')
        .in('hosting_id', hostingIds)
        .eq('profile_id', ctx.profileId)
        .order('email_address')

      if (error) return { error: 'Não foi possível carregar as contas de e-mail.' }

      // Group by hosting/domain
      const grouped: Record<string, unknown[]> = {}
      data?.forEach(em => {
        const h = hostings.find(hh => hh.id === em.hosting_id)
        const domain = h?.primary_domain ?? 'unknown'
        if (!grouped[domain]) grouped[domain] = []
        grouped[domain].push({
          ...em,
          quota_gb: (em.quota_mb / 1024).toFixed(2),
          used_gb: (em.used_mb / 1024).toFixed(2),
          usage_pct: em.quota_mb > 0 ? Math.round((em.used_mb / em.quota_mb) * 100) : 0,
          webmail_url: `https://webmail.${domain}`,
        })
      })

      return { emails_by_domain: grouped, total: data?.length ?? 0 }
    },
  })

  /** Client invoices */
  const getMyInvoices = tool({
    description: 'Lista as facturas do cliente com estado de pagamento, valores e datas de vencimento.',
    inputSchema: z.object({
      status: z.enum(['pending', 'paid', 'overdue', 'cancelled', 'all']).optional(),
      limit: z.number().min(1).max(20).optional(),
    }),
    execute: async (input) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      const status = input.status ?? 'all'
      const limit = input.limit ?? 10

      let q = db
        .from('invoices')
        .select('id, invoice_number, status, currency, subtotal, total, due_date, created_at, items')
        .eq('profile_id', ctx.profileId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (status !== 'all') q = q.eq('status', status)

      const { data, error } = await q
      if (error) return { error: 'Não foi possível carregar as facturas.' }

      const today = new Date()
      const enriched = data?.map(inv => ({
        ...inv,
        items: undefined, // don't expose raw JSON items
        is_overdue: inv.status === 'pending' && inv.due_date && new Date(inv.due_date) < today,
      }))

      return { invoices: enriched, count: enriched?.length ?? 0 }
    },
  })

  /** Client payments */
  const getMyPayments = tool({
    description: 'Lista os pagamentos efectuados pelo cliente com método, valor e estado.',
    inputSchema: z.object({
      limit: z.number().min(1).max(20).optional(),
    }),
    execute: async (input) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      const limit = input.limit ?? 10

      const { data, error } = await db
        .from('payments')
        .select('id, method, amount, currency, status, paid_at, created_at')
        .eq('profile_id', ctx.profileId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return { error: 'Não foi possível carregar os pagamentos.' }
      return { payments: data, count: data?.length ?? 0 }
    },
  })

  /** Client tickets */
  const getMyTickets = tool({
    description: 'Lista os tickets de suporte do cliente com estado, prioridade e última actualização.',
    inputSchema: z.object({
      status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'all']).optional(),
    }),
    execute: async (input) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      const status = input.status ?? 'all'
      let q = db
        .from('tickets')
        .select('id, subject, status, priority, department, category, created_at, updated_at')
        .eq('profile_id', ctx.profileId)
        .order('updated_at', { ascending: false })
        .limit(15)
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) return { error: 'Não foi possível carregar os tickets.' }
      return { tickets: data, count: data?.length ?? 0 }
    },
  })

  /** Get single ticket with messages */
  const getTicketMessages = tool({
    description: 'Lê o conteúdo de um ticket específico, incluindo todas as mensagens trocadas.',
    inputSchema: z.object({
      ticket_id: z.string().uuid().describe('ID do ticket a consultar'),
    }),
    execute: async ({ ticket_id }) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }

      // Verify ticket belongs to client
      const { data: ticket, error: tErr } = await db
        .from('tickets')
        .select('id, subject, status, priority, department, created_at')
        .eq('id', ticket_id)
        .eq('profile_id', ctx.profileId)
        .single()

      if (tErr || !ticket) return { error: 'Ticket não encontrado na sua conta.' }

      const { data: messages } = await db
        .from('ticket_messages')
        .select('id, message, is_staff, is_internal, created_at')
        .eq('ticket_id', ticket_id)
        .eq('is_internal', false) // clients don't see internal notes
        .order('created_at', { ascending: true })
        .limit(50)

      return { ticket, messages: messages ?? [] }
    },
  })

  /** Create support ticket */
  const createTicket = tool({
    description: 'Cria um novo ticket de suporte para o cliente autenticado. Usar quando o cliente tem um problema ou pedido que precisa de acompanhamento.',
    inputSchema: z.object({
      subject: z.string().min(5).max(200).describe('Assunto resumido do problema ou pedido'),
      message: z.string().min(20).describe('Descrição detalhada do problema, incluindo passos para reproduzir se for técnico'),
      department: z.enum(['suporte', 'financeiro', 'comercial', 'tecnico']).optional().describe('Departamento: suporte (geral), financeiro, comercial (vendas), tecnico (problemas técnicos)'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('Prioridade: low (baixa), medium (normal), high (urgente)'),
      category: z.string().optional().describe('Categoria do problema, ex: email, dominio, hospedagem, faturacao'),
    }),
    execute: async ({ subject, message, department, priority, category }) => {
      if (!ctx.profileId || ctx.userLevel === 'visitor') return { error: 'Precisa de estar autenticado para criar um ticket.' }

      const { data: ticket, error: tErr } = await db
        .from('tickets')
        .insert({
          profile_id: ctx.profileId,
          subject,
          status: 'open',
          priority: priority ?? 'medium',
          department: department ?? 'suporte',
          category: category ?? 'geral',
        })
        .select('id, subject, status, priority')
        .single()

      if (tErr || !ticket) return { error: `Erro ao criar ticket: ${tErr?.message ?? 'desconhecido'}` }

      const { error: mErr } = await db.from('ticket_messages').insert({
        ticket_id: ticket.id,
        profile_id: ctx.profileId,
        message,
        is_staff: false,
        is_internal: false,
      })

      if (mErr) return { error: 'Ticket criado mas erro ao adicionar mensagem. Por favor, abra o ticket e adicione a descrição.' }

      return {
        success: true,
        ticket_id: ticket.id,
        reference: `#${ticket.id.slice(0, 8).toUpperCase()}`,
        subject: ticket.subject,
        priority: ticket.priority,
        note: `O seu ticket foi criado com sucesso (ref. ${ticket.id.slice(0, 8).toUpperCase()}). A nossa equipa irá responder em breve.`,
      }
    },
  })

  /** Reply to existing ticket */
  const replyToTicket = tool({
    description: 'Envia uma resposta ou mensagem adicional num ticket existente do cliente.',
    inputSchema: z.object({
      ticket_id: z.string().uuid().describe('ID do ticket onde responder'),
      message: z.string().min(5).describe('Texto da resposta'),
    }),
    execute: async ({ ticket_id, message }) => {
      if (!ctx.profileId || ctx.userLevel === 'visitor') return { error: 'Autenticação necessária.' }

      // Verify ownership
      const { data: ticket } = await db
        .from('tickets')
        .select('id, status')
        .eq('id', ticket_id)
        .eq('profile_id', ctx.profileId)
        .single()

      if (!ticket) return { error: 'Ticket não encontrado na sua conta.' }
      if (ticket.status === 'closed') return { error: 'Este ticket está fechado. Abra um novo ticket se precisar de mais ajuda.' }

      const { error } = await db.from('ticket_messages').insert({
        ticket_id,
        profile_id: ctx.profileId,
        message,
        is_staff: false,
        is_internal: false,
      })

      if (error) return { error: 'Erro ao enviar resposta no ticket.' }

      // Update ticket to in_progress if it was open
      if (ticket.status === 'open') {
        await db.from('tickets').update({ status: 'in_progress' }).eq('id', ticket_id)
      }

      return { success: true, note: 'A sua mensagem foi adicionada ao ticket com sucesso.' }
    },
  })

  /** Client orders */
  const getMyOrders = tool({
    description: 'Lista os pedidos/encomendas do cliente: serviços contratados, registo de domínios, estado e método de pagamento.',
    inputSchema: z.object({
      status: z.enum(['pending', 'processing', 'completed', 'cancelled', 'all']).optional(),
      limit: z.number().min(1).max(20).optional(),
    }),
    execute: async (input) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }
      const status = input.status ?? 'all'
      const limit = input.limit ?? 10

      let q = db
        .from('orders')
        .select('id, status, amount, billing_cycle, payment_method, domain_name, domain_action, notes, created_at')
        .eq('user_id', ctx.profileId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (status !== 'all') q = q.eq('status', status)

      const { data, error } = await q
      if (error) return { error: 'Não foi possível carregar os pedidos.' }
      return { orders: data, count: data?.length ?? 0 }
    },
  })

  /** Single invoice details with items */
  const getInvoiceDetails = tool({
    description: 'Retorna o detalhe completo de uma factura específica incluindo os itens de linha, valores e instruções de pagamento.',
    inputSchema: z.object({
      invoice_id: z.string().describe('ID ou número da factura (UUID ou invoice_number)'),
    }),
    execute: async ({ invoice_id }) => {
      if (!ctx.profileId) return { error: 'Sessão expirada. Por favor, faça login novamente.' }

      const isUuid = /^[0-9a-f-]{36}$/i.test(invoice_id)
      let q = db
        .from('invoices')
        .select('id, invoice_number, status, currency, subtotal, discount, tax, total, due_date, issue_date, paid_at, notes, pdf_storage_path, created_at')
        .eq('profile_id', ctx.profileId)

      if (isUuid) q = q.eq('id', invoice_id)
      else q = q.eq('invoice_number', invoice_id)

      const { data: inv, error: invErr } = await q.maybeSingle()
      if (invErr || !inv) return { error: 'Factura não encontrada na sua conta.' }

      // Get items from invoice_items table (may not have rows if using old JSON items field)
      const { data: items } = await db
        .from('invoice_items')
        .select('description, quantity, unit_price, subtotal, position')
        .eq('invoice_id', inv.id)
        .order('position')

      return { invoice: inv, items: items ?? [], has_pdf: !!inv.pdf_storage_path }
    },
  })

  /** Close a ticket */
  const closeTicket = tool({
    description: 'Fecha um ticket de suporte quando o problema foi resolvido. Pedir confirmação ao cliente antes de executar.',
    inputSchema: z.object({
      ticket_id: z.string().uuid().describe('ID do ticket a fechar'),
      reason: z.string().optional().describe('Motivo ou comentário de fecho (opcional)'),
    }),
    execute: async ({ ticket_id, reason }) => {
      if (!ctx.profileId || ctx.userLevel === 'visitor') return { error: 'Autenticação necessária.' }

      const { data: ticket } = await db
        .from('tickets')
        .select('id, status, subject')
        .eq('id', ticket_id)
        .eq('profile_id', ctx.profileId)
        .single()

      if (!ticket) return { error: 'Ticket não encontrado na sua conta.' }
      if (ticket.status === 'closed') return { success: true, note: 'Este ticket já se encontra fechado.' }

      if (reason) {
        await db.from('ticket_messages').insert({
          ticket_id,
          profile_id: ctx.profileId,
          message: `[Ticket fechado pelo cliente] ${reason}`,
          is_staff: false,
          is_internal: false,
        })
      }

      const { error } = await db.from('tickets').update({ status: 'closed' }).eq('id', ticket_id)
      if (error) return { error: 'Erro ao fechar o ticket.' }

      return { success: true, note: `Ticket "${ticket.subject}" fechado com sucesso.` }
    },
  })

  /** Reopen a closed ticket */
  const reopenTicket = tool({
    description: 'Reabre um ticket de suporte previamente fechado quando o problema resurge.',
    inputSchema: z.object({
      ticket_id: z.string().uuid().describe('ID do ticket a reabrir'),
      message: z.string().min(10).describe('Mensagem explicando porque o ticket está a ser reaberto'),
    }),
    execute: async ({ ticket_id, message }) => {
      if (!ctx.profileId || ctx.userLevel === 'visitor') return { error: 'Autenticação necessária.' }

      const { data: ticket } = await db
        .from('tickets')
        .select('id, status, subject')
        .eq('id', ticket_id)
        .eq('profile_id', ctx.profileId)
        .single()

      if (!ticket) return { error: 'Ticket não encontrado na sua conta.' }
      if (ticket.status !== 'closed' && ticket.status !== 'resolved') {
        return { error: `O ticket já está aberto (estado: ${ticket.status}).` }
      }

      await db.from('tickets').update({ status: 'open' }).eq('id', ticket_id)
      await db.from('ticket_messages').insert({
        ticket_id,
        profile_id: ctx.profileId,
        message,
        is_staff: false,
        is_internal: false,
      })

      return { success: true, note: `Ticket "${ticket.subject}" reaberto com sucesso. A nossa equipa irá responder em breve.` }
    },
  })

  /** Get payment instructions from company billing settings */
  const getPaymentInstructions = tool({
    description: 'Retorna as instruções de pagamento por transferência bancária da ViralizaHost (dados bancários, IBAN, referências). Usar quando o cliente perguntar como pagar.',
    inputSchema: z.object({}),
    execute: async () => {
      return cached('payment_instructions', 300_000, async () => {
        const { data } = await db
          .from('company_billing_settings')
          .select('bank_name, account_holder, account_number, iban, swift, payment_instructions')
          .eq('active', true)
          .maybeSingle()

        if (!data) {
          return {
            instructions: 'Para obter as instruções de pagamento, por favor contacte comercial@viralizahost.com ou abra um ticket de suporte.',
          }
        }

        return {
          bank_name: data.bank_name,
          account_holder: data.account_holder,
          account_number: data.account_number,
          iban: data.iban,
          swift: data.swift,
          payment_instructions: data.payment_instructions ?? 'Após efectuar a transferência, envie o comprovativo por e-mail para comercial@viralizahost.com indicando o número da factura.',
        }
      })
    },
  })

  /**
   * sendInvoiceToCustomer — ferramenta central de envio de facturas.
   * O agente DEVE chamar esta ferramenta (não apenas dizer que vai enviar).
   * O e-mail do cliente é sempre lido do perfil autenticado — nunca do input.
   */
  const sendInvoiceToCustomer = tool({
    description: `Gera a fatura em PDF e envia por e-mail ao cliente autenticado.
IMPORTANTE: Chamar SEMPRE que o cliente pedir que seja enviada uma fatura. Nunca dizer "receberá uma fatura" sem ter executado esta ferramenta.
Após executar, usar o resultado real para confirmar ou reportar erro ao cliente.`,
    inputSchema: z.object({
      order_id: z.string().uuid().optional().describe('UUID do pedido a facturar (preferencial)'),
      invoice_id: z.string().uuid().optional().describe('UUID de fatura existente a reenviar'),
      ticket_id: z.string().uuid().optional().describe('UUID do ticket relacionado (opcional)'),
      force_resend: z.boolean().optional().describe('true apenas quando o cliente pede explicitamente para reenviar uma fatura já enviada'),
    }),
    execute: async ({ order_id, invoice_id, ticket_id, force_resend }) => {
      if (!ctx.profileId || ctx.userLevel === 'visitor') {
        return { success: false, code: 'UNAUTHORIZED', message: 'Precisa de estar autenticado para receber facturas.' }
      }

      let targetInvoiceId = invoice_id

      // Se só temos order_id, procurar ou criar fatura
      if (!targetInvoiceId && order_id) {
        // Verificar se o pedido pertence ao cliente
        const { data: order } = await db
          .from('orders')
          .select('id, amount, billing_cycle, domain_name, status, user_id')
          .eq('id', order_id)
          .eq('user_id', ctx.profileId)
          .maybeSingle()

        if (!order) {
          return { success: false, code: 'ORDER_NOT_FOUND', message: 'Pedido não encontrado na sua conta.' }
        }

        // Verificar se já existe fatura para este pedido
        const { data: existingInv } = await db
          .from('invoices')
          .select('id, invoice_number, email_status, email_to')
          .eq('order_id', order_id)
          .eq('profile_id', ctx.profileId)
          .maybeSingle()

        if (existingInv) {
          targetInvoiceId = existingInv.id
        } else {
          // Buscar itens do pedido
          const { data: orderItems } = await db
            .from('order_items')
            .select('service_name, service_type, price, quantity')
            .eq('order_id', order_id)

          // Criar fatura nova
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + 7)

          const { data: newInv, error: createErr } = await db
            .from('invoices')
            .insert({
              profile_id:     ctx.profileId,
              order_id:       order_id,
              ticket_id:      ticket_id ?? null,
              status:         'pending',
              currency:       'USD',
              subtotal:       order.amount,
              discount:       0,
              tax:            0,
              total:          order.amount,
              due_date:       dueDate.toISOString(),
              issue_date:     new Date().toISOString().slice(0, 10),
              items:          JSON.stringify(orderItems ?? []),
              notes:          order.domain_name ? `Pedido relativo ao domínio ${order.domain_name}` : null,
            })
            .select('id, invoice_number')
            .single()

          if (createErr || !newInv) {
            return { success: false, code: 'INVOICE_CREATE_FAILED', message: 'Erro ao criar a fatura. Por favor tente novamente.' }
          }

          targetInvoiceId = newInv.id

          // Criar itens de fatura
          if (orderItems?.length) {
            await db.from('invoice_items').insert(
              orderItems.map((item, idx) => ({
                invoice_id:  newInv.id,
                description: item.service_name,
                quantity:    item.quantity ?? 1,
                unit_price:  item.price ?? 0,
                subtotal:    (item.price ?? 0) * (item.quantity ?? 1),
                position:    idx,
              }))
            )
          } else {
            // Fallback: item genérico
            await db.from('invoice_items').insert({
              invoice_id:  newInv.id,
              description: order.domain_name ? `Serviço ViralizaHost — ${order.domain_name}` : `Serviço ViralizaHost — Pedido #${String(order_id).slice(0, 8).toUpperCase()}`,
              quantity:    1,
              unit_price:  order.amount,
              subtotal:    order.amount,
              position:    0,
            })
          }
        }
      }

      if (!targetInvoiceId) {
        return {
          success: false,
          code: 'NO_INVOICE_REF',
          message: 'Por favor indica o número do pedido ou da fatura que pretende enviar.',
        }
      }

      // Chamar o serviço central de envio
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await sendInvoiceEmail({
        invoiceId:         targetInvoiceId,
        customerId:        ctx.profileId,
        db: db as any,
        initiatedByAgent:  true,
        orderId:           order_id,
        ticketId:          ticket_id,
        forceResend:       force_resend ?? false,
      })

      if (result.success) {
        return {
          success: true,
          invoice_number: result.invoiceNumber,
          sent_to:        result.sentTo,
          download_url:   result.downloadUrl,
          provider_id:    result.providerMessageId,
          message:        `✅ Fatura ${result.invoiceNumber} enviada com sucesso para ${result.sentTo}.${result.downloadUrl ? ' Disponível para download.' : ''}`,
        }
      }

      return {
        success:  false,
        code:     result.code,
        message:  result.message ?? 'Não foi possível enviar a fatura neste momento.',
        details:  result.details,
        note:     'O erro foi registado. A equipa técnica será notificada.',
      }
    },
  })

  // ═══════════════════════════════════════════════════════════════
  // ADMIN TOOLS — requires admin role
  // ═══════════════════════════════════════════════════════════════

  /** Search client */
  const adminSearchClient = tool({
    description: '[Admin] Pesquisa um cliente pelo nome, e-mail ou ID. Retorna perfil e resumo de serviços.',
    inputSchema: z.object({
      query: z.string().min(2).describe('Nome, e-mail ou UUID do cliente'),
    }),
    execute: async ({ query }) => {
      if (ctx.userLevel !== 'admin') return { error: 'Acesso restrito a administradores.' }

      const { data, error } = await db
        .from('profiles')
        .select('id, full_name, email, phone, country, role, is_active, currency, created_at')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,id.eq.${query.length === 36 ? query : '00000000-0000-0000-0000-000000000000'}`)
        .limit(5)

      if (error) return { error: 'Erro na pesquisa de clientes.' }
      return { clients: data, count: data?.length ?? 0 }
    },
  })

  /** Admin ticket stats */
  const adminGetTicketStats = tool({
    description: '[Admin] Retorna estatísticas globais dos tickets de suporte.',
    inputSchema: z.object({}),
    execute: async () => {
      if (ctx.userLevel !== 'admin') return { error: 'Acesso restrito a administradores.' }
      const { data, error } = await db.from('tickets').select('status, priority, created_at')
      if (error) return { error: 'Erro ao carregar estatísticas.' }

      const today = new Date().toISOString().slice(0, 10)
      return {
        stats: {
          total: data.length,
          open: data.filter(t => t.status === 'open').length,
          in_progress: data.filter(t => t.status === 'in_progress').length,
          resolved: data.filter(t => t.status === 'resolved').length,
          closed: data.filter(t => t.status === 'closed').length,
          critical: data.filter(t => t.priority === 'critical').length,
          high: data.filter(t => t.priority === 'high').length,
          new_today: data.filter(t => t.created_at?.startsWith(today)).length,
        },
      }
    },
  })

  /** Admin list recent conversations */
  const adminGetConversations = tool({
    description: '[Admin] Lista as conversas recentes com o agente IA, com estatísticas por nível de utilizador.',
    inputSchema: z.object({
      limit: z.number().min(1).max(50).optional(),
    }),
    execute: async (input) => {
      if (ctx.userLevel !== 'admin') return { error: 'Acesso restrito a administradores.' }
      const limit = input.limit ?? 20
      const { data, error } = await db
        .from('ai_conversations')
        .select('id, title, user_level, status, profile_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return { error: 'Erro ao carregar conversas.' }

      const stats = {
        total: data.length,
        visitors: data.filter(c => c.user_level === 'visitor').length,
        clients: data.filter(c => c.user_level === 'client').length,
        active: data.filter(c => c.status === 'active').length,
      }

      return { conversations: data, stats }
    },
  })

  /** Admin get client services */
  const adminGetClientServices = tool({
    description: '[Admin] Consulta os serviços de um cliente específico por profile_id.',
    inputSchema: z.object({
      profile_id: z.string().uuid().describe('UUID do cliente'),
    }),
    execute: async ({ profile_id }) => {
      if (ctx.userLevel !== 'admin') return { error: 'Acesso restrito a administradores.' }
      const { data, error } = await db
        .from('services')
        .select('id, status, billing_cycle, price, currency, expires_at, plan:plans(name, type), hosting_accounts(primary_domain, status)')
        .eq('profile_id', profile_id)
        .order('created_at', { ascending: false })
      if (error) return { error: 'Erro ao carregar serviços do cliente.' }
      return { services: data, count: data?.length ?? 0 }
    },
  })

  /** Admin financial summary */
  const adminGetFinancialSummary = tool({
    description: '[Admin] Retorna resumo financeiro: total facturado, pago, pendente.',
    inputSchema: z.object({}),
    execute: async () => {
      if (ctx.userLevel !== 'admin') return { error: 'Acesso restrito a administradores.' }
      const { data, error } = await db.from('invoices').select('status, currency, total')
      if (error) return { error: 'Erro ao carregar dados financeiros.' }

      const byStatus: Record<string, number> = {}
      data?.forEach(inv => {
        if (!byStatus[inv.status]) byStatus[inv.status] = 0
        byStatus[inv.status] += inv.total ?? 0
      })

      return {
        total_invoices: data?.length ?? 0,
        by_status: byStatus,
        paid: byStatus['paid'] ?? 0,
        pending: byStatus['pending'] ?? 0,
        overdue: byStatus['overdue'] ?? 0,
      }
    },
  })

  // ═══════════════════════════════════════════════════════════════
  // Assemble tools by permission level
  // ═══════════════════════════════════════════════════════════════

  const publicTools = {
    getPlans,
    getProducts,
    getProductCategories,
    checkDomainAvailability,
    getDomainPrices,
    getEmailPlans,
    getCompanyInfo,
    getPaymentMethods,
  }

  const clientTools = {
    getMyProfile,
    getMyServices,
    getMyHosting,
    getCpanelAccess,
    getMyDomains,
    getMyEmails,
    getMyInvoices,
    getMyPayments,
    getMyTickets,
    getTicketMessages,
    createTicket,
    replyToTicket,
    getMyOrders,
    getInvoiceDetails,
    closeTicket,
    reopenTicket,
    getPaymentInstructions,
    sendInvoiceToCustomer,
  }

  const adminTools = {
    adminSearchClient,
    adminGetTicketStats,
    adminGetConversations,
    adminGetClientServices,
    adminGetFinancialSummary,
  }

  if (ctx.userLevel === 'admin') {
    return { ...publicTools, ...clientTools, ...adminTools }
  }
  if (ctx.userLevel === 'client') {
    return { ...publicTools, ...clientTools }
  }
  return publicTools
}
